import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import worker from "../workers/zaragoza-bus.mjs";

const BASE = "https://ododex.com/es/zaragoza-bus";
const MAX_AGE_ESPERADO = "public, max-age=15";
const ESTADO_PETICION_INVALIDA = 400;
const ESTADO_ORIGEN_FALLIDO = 502;
const MAXIMO_POSTES = 10;
const MAXIMO_SIMULTANEAS = 4;
const POSTES_LENTOS = 8;
const TIEMPO_MAXIMO_GPS_MS = 7000;
const TIEMPO_MAXIMO_LINEA_MS = 12000;
const TIEMPO_POSTE_LENTO_MS = 11000;
const entorno = { ASSETS: { fetch: async () => new Response("estatico") } };

/** Respuesta del GPS de Avanza con un autobús por tupla [coche, "línea->destino", latitud]. */
function gpsCon(autobuses) {
  const maquinas = { 0: { coordenadas: { 0: { LAT: 41.6, LON: -0.9 } }, icon: "https://gps.avanzabus.com/img/bus_rojo.png" } };
  autobuses.forEach(([coche, lineaDestino, latitud], indice) => {
    const fila = [`&nbsp${coche}`, lineaDestino, "3 min.", "1 kms."].map((c) => `<td class="td_info2">${c}</td>`).join("");
    maquinas[indice + 1] = {
      coordenadas: { 0: { LAT: latitud, LON: -0.8 } },
      icon: "https://gps.avanzabus.com/img/bus.png",
      info: `<table><tr><td class="td_info">Bus</td></tr><tr>${fila}</tr></table>`,
    };
  });
  return { tablatiempos: "x", maquinas };
}

function respuestaJson(cuerpo) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "text/html" } });
}

function peticion(linea, postes) {
  const consulta = postes === undefined ? "" : `?postes=${postes}`;
  return new Request(`${BASE}/api/gps-linea/${linea}${consulta}`);
}

describe("GET /api/gps-linea/{línea}", () => {
  let simulado;
  let datosPorPoste;

  beforeEach(() => {
    datosPorPoste = {};
    simulado = mock.method(globalThis, "fetch", async (_url, opciones) => {
      const poste = new URLSearchParams(opciones.body).get("poste");
      const datos = datosPorPoste[poste];
      if (datos instanceof Error) throw datos;
      return respuestaJson(datos ?? { tablatiempos: "" });
    });
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    delete globalThis.caches;
  });

  async function pedir(linea, postes) {
    const respuesta = await worker.fetch(peticion(linea, postes), entorno);
    return { respuesta, cuerpo: await respuesta.json() };
  }

  it("une por coche los autobuses de varios postes sin duplicar", async () => {
    datosPorPoste["1"] = gpsCon([["100", "25->LA CARTUJA", 41.1], ["101", "25->LA CARTUJA", 41.2]]);
    datosPorPoste["2"] = gpsCon([["101", "25->LA CARTUJA", 41.9], ["102", "25->ACTUR", 41.3]]);
    const { respuesta, cuerpo } = await pedir("25", "1,2");
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), MAX_AGE_ESPERADO);
    assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
    assert.deepEqual(cuerpo, {
      linea: "25",
      autobuses: [
        { coche: "100", linea: "25", destino: "LA CARTUJA", latitud: 41.1, longitud: -0.8 },
        { coche: "101", linea: "25", destino: "LA CARTUJA", latitud: 41.2, longitud: -0.8 },
        { coche: "102", linea: "25", destino: "ACTUR", latitud: 41.3, longitud: -0.8 },
      ],
      postesConsultados: 2,
      postesFallidos: 0,
    });
  });

  it("filtra por línea, ignorando ceros a la izquierda y mayúsculas", async () => {
    datosPorPoste["1"] = gpsCon([["1", "058->A", 41.1], ["2", "58->B", 41.2], ["3", "59->C", 41.3], ["4", "CI1->D", 41.4]]);
    const sinCeros = await pedir("58", "1");
    assert.deepEqual(sinCeros.cuerpo.autobuses.map((b) => b.coche), ["1", "2"]);
    const conCeros = await pedir("058", "1");
    assert.equal(conCeros.cuerpo.linea, "58");
    assert.deepEqual(conCeros.cuerpo.autobuses.map((b) => b.coche), ["1", "2"]);
    const minusculas = await pedir("ci1", "1");
    assert.equal(minusculas.cuerpo.linea, "CI1");
    assert.deepEqual(minusculas.cuerpo.autobuses.map((b) => b.coche), ["4"]);
  });

  it("devuelve lista vacía si ningún autobús es de la línea", async () => {
    datosPorPoste["1"] = gpsCon([["1", "59->C", 41.1]]);
    const { respuesta, cuerpo } = await pedir("25", "1");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo.autobuses, []);
  });

  it("cuenta un poste fallido y responde con los demás", async () => {
    datosPorPoste["1"] = gpsCon([["100", "25->LA CARTUJA", 41.1]]);
    datosPorPoste["2"] = new Error("red caída");
    const { respuesta, cuerpo } = await pedir("25", "1,2");
    assert.equal(respuesta.status, 200);
    assert.equal(cuerpo.autobuses.length, 1);
    assert.equal(cuerpo.postesConsultados, 1);
    assert.equal(cuerpo.postesFallidos, 1);
  });

  it("responde 502 sin caché si fallan todos los postes", async () => {
    datosPorPoste["1"] = new Error("red caída");
    datosPorPoste["2"] = new Error("red caída");
    const { respuesta, cuerpo } = await pedir("25", "1,2");
    assert.equal(respuesta.status, ESTADO_ORIGEN_FALLIDO);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.match(cuerpo.error, /posición de los autobuses/);
  });

  describe("validaciones (400)", () => {
    const casos = [
      ["línea con símbolos", "2-5", "1"],
      ["línea de cinco caracteres", "ABCDE", "1"],
      ["sin parámetro postes", "25", undefined],
      ["postes vacío", "25", ""],
      ["once postes", "25", Array.from({ length: MAXIMO_POSTES + 1 }, (_, i) => i + 1).join(",")],
      ["postes repetidos", "25", "1,2,1"],
      ["postes repetidos con ceros", "25", "7,007"],
      ["poste no numérico", "25", "1,abc"],
      ["poste de seis dígitos", "25", "123456"],
      ["coma sobrante", "25", "1,"],
    ];
    for (const [nombre, linea, postes] of casos) {
      it(nombre, async () => {
        const { respuesta, cuerpo } = await pedir(linea, postes);
        assert.equal(respuesta.status, ESTADO_PETICION_INVALIDA);
        assert.equal(typeof cuerpo.error, "string");
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        assert.equal(simulado.mock.callCount(), 0);
      });
    }

    it("acepta diez postes", async () => {
      const postes = Array.from({ length: MAXIMO_POSTES }, (_, i) => i + 1).join(",");
      const { respuesta, cuerpo } = await pedir("25", postes);
      assert.equal(respuesta.status, 200);
      assert.equal(cuerpo.postesConsultados, MAXIMO_POSTES);
    });
  });

  it("nunca hay más de 4 peticiones simultáneas a Avanza y acaban las 8", async () => {
    let activas = 0;
    let maximoSimultaneas = 0;
    simulado.mock.mockImplementation(async () => {
      activas += 1;
      maximoSimultaneas = Math.max(maximoSimultaneas, activas);
      await new Promise((resolver) => setTimeout(resolver, 10));
      activas -= 1;
      return respuestaJson({ tablatiempos: "" });
    });
    const { cuerpo } = await pedir("25", "1,2,3,4,5,6,7,8");
    assert.equal(maximoSimultaneas, MAXIMO_SIMULTANEAS);
    assert.equal(simulado.mock.callCount(), POSTES_LENTOS);
    assert.equal(cuerpo.postesConsultados, POSTES_LENTOS);
    assert.equal(cuerpo.postesFallidos, 0);
  });

  describe("tiempo máximo por poste", () => {
    /** Origen que responde pasados `retardoMs` (temporizador falso) o falla si se aborta antes. */
    function instalarOrigenLento(retardoMs) {
      simulado.mock.mockImplementation((_url, opciones) =>
        new Promise((resolver, rechazar) => {
          opciones.signal.addEventListener("abort", () => rechazar(new Error("abortado")));
          setTimeout(() => resolver(respuestaJson({ tablatiempos: "" })), retardoMs);
        }),
      );
    }

    async function pedirTrasAvanzar(milisegundos) {
      mock.timers.enable({ apis: ["setTimeout"] });
      const pendiente = pedir("25", "1");
      await new Promise((resolver) => setImmediate(resolver));
      mock.timers.tick(milisegundos);
      return pendiente;
    }

    it("espera a un poste lento hasta 12 s", async () => {
      instalarOrigenLento(TIEMPO_POSTE_LENTO_MS);
      const { respuesta, cuerpo } = await pedirTrasAvanzar(TIEMPO_POSTE_LENTO_MS);
      assert.equal(respuesta.status, 200);
      assert.equal(cuerpo.postesConsultados, 1);
    });

    it("aborta el poste al llegar a 12 s", async () => {
      instalarOrigenLento(TIEMPO_MAXIMO_LINEA_MS + 1);
      const { respuesta } = await pedirTrasAvanzar(TIEMPO_MAXIMO_LINEA_MS);
      assert.equal(respuesta.status, ESTADO_ORIGEN_FALLIDO);
    });

    it("/api/gps/ sigue abortando a los 7 s", async () => {
      instalarOrigenLento(TIEMPO_POSTE_LENTO_MS);
      mock.timers.enable({ apis: ["setTimeout"] });
      const pendiente = worker.fetch(new Request(`${BASE}/api/gps/1`), entorno);
      await new Promise((resolver) => setImmediate(resolver));
      mock.timers.tick(TIEMPO_MAXIMO_GPS_MS);
      assert.equal((await pendiente).status, ESTADO_ORIGEN_FALLIDO);
    });
  });

  describe("caché por poste", () => {
    function instalarCache() {
      const almacen = new Map();
      globalThis.caches = {
        default: {
          match: async (clave) => almacen.get(clave.url)?.clone(),
          put: async (clave, respuesta) => void almacen.set(clave.url, respuesta),
        },
      };
      return almacen;
    }

    it("guarda una entrada por poste y la reutiliza en la segunda consulta", async () => {
      const almacen = instalarCache();
      datosPorPoste["1"] = gpsCon([["100", "25->LA CARTUJA", 41.1]]);
      const primera = await pedir("25", "1,2");
      const segunda = await pedir("25", "1,2");
      assert.equal(almacen.size, 2);
      assert.equal(simulado.mock.callCount(), 2);
      assert.deepEqual(segunda.cuerpo, primera.cuerpo);
    });

    it("comparte la caché con /api/gps/{poste}", async () => {
      instalarCache();
      datosPorPoste["1"] = gpsCon([["100", "25->LA CARTUJA", 41.1]]);
      await worker.fetch(new Request(`${BASE}/api/gps/1`), entorno);
      const { cuerpo } = await pedir("25", "1");
      assert.equal(simulado.mock.callCount(), 1);
      assert.equal(cuerpo.autobuses.length, 1);
    });
  });
});
