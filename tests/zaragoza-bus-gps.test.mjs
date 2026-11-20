import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import worker from "../workers/zaragoza-bus.mjs";

const TIEMPO_MAXIMO_MS = 7000;
const MAX_AGE_ESPERADO = "public, max-age=15";
const MENSAJE_POSTE_INVALIDO = "El poste debe ser un número de uno a cinco dígitos.";
const MENSAJE_ORIGEN_GPS = "No se pudo obtener la posición de los autobuses. Inténtalo de nuevo en unos segundos.";
const BASE = "https://ododex.com/es/zaragoza-bus";
const URL_ORIGEN_ESPERADA = "https://gps.avanzabus.com/index.php/zaragoza/fRefrescaEmpresaExternos";
const USER_AGENT_ESPERADO = "Ododex/1.0 (+https://ododex.com/es/zaragoza-bus)";
const ESTADO_ORIGEN_FALLIDO = 502;

function leerFixture(nombre) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), "utf8"));
}

const GPS_688 = leerFixture("zaragoza-bus-gps-688.json");
const GPS_744 = leerFixture("zaragoza-bus-gps-744.json");
const GPS_VACIO = { tablatiempos: "" };

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "text/html" } });
}

function peticion(poste, metodo = "GET", cabeceras = {}) {
  return new Request(`${BASE}/api/gps/${poste}`, { method: metodo, headers: cabeceras });
}

const entorno = { ASSETS: { fetch: async () => new Response("estatico") } };

/** Entrada de autobús con una fila por cada tupla de `filas` (celdas ya escritas tal cual). */
function maquinaConFilas(filas, coordenadas = { 0: { LAT: 41.6, LON: -0.9 } }) {
  const html = filas.map((celdas) => `<tr>${celdas.map((c) => `<td class="td_info2">${c}</td>`).join("")}</tr>`).join("");
  return { coordenadas, icon: "https://gps.avanzabus.com/img/bus.png", info: `<table><tr><td class="td_info">Bus</td></tr>${html}</table>` };
}

describe("GET /api/gps/{poste}", () => {
  let simulado;

  beforeEach(() => {
    simulado = mock.method(globalThis, "fetch", async () => respuestaJson(GPS_688));
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
    delete globalThis.caches;
  });

  function responderOrigen(cuerpo) {
    simulado.mock.mockImplementation(async () => respuestaJson(cuerpo));
  }

  async function pedirJson(poste = "688") {
    const respuesta = await worker.fetch(peticion(poste), entorno);
    return { respuesta, cuerpo: await respuesta.json() };
  }

  it("agrupa las dos entradas del mismo coche y ordena las llegadas", async () => {
    const { respuesta, cuerpo } = await pedirJson("688");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo, {
      poste: { latitud: 41.627026, longitud: -0.907306 },
      autobuses: [
        {
          coche: "4709",
          linea: "58",
          destino: "FUENTE JUNQUERA",
          latitud: 41.62698151376142,
          longitud: -0.9073186407254249,
          llegadas: [{ minutos: 0, km: 0 }, { minutos: 30, km: 6 }],
        },
      ],
    });
  });

  it("devuelve un autobús por coche con varias líneas y quita los ceros de la línea", async () => {
    responderOrigen(GPS_744);
    const { cuerpo } = await pedirJson("744");
    assert.deepEqual(cuerpo.poste, { latitud: 41.649996, longitud: -0.876037 });
    assert.deepEqual(cuerpo.autobuses.map((a) => [a.coche, a.linea, a.destino]), [
      ["4665", "39", "VADORREY"],
      ["4272", "39", "VADORREY"],
      ["4662", "29", "SAN GREGORIO"],
      ["4127", "29", "SAN GREGORIO"],
    ]);
  });

  it("ordena las llegadas por minutos aunque lleguen desordenadas", async () => {
    responderOrigen({
      maquinas: {
        1: maquinaConFilas([["&nbsp7", "CI2->CIRCULAR", "30 min.", "6 kms."]]),
        2: maquinaConFilas([["&nbsp7", "CI2->CIRCULAR", "5 min.", "1 kms."]]),
      },
    });
    const { cuerpo } = await pedirJson();
    assert.deepEqual(cuerpo.autobuses[0].llegadas, [{ minutos: 5, km: 1 }, { minutos: 30, km: 6 }]);
  });

  it("deja las líneas no numéricas en mayúsculas, decodifica entidades y normaliza espacios del destino", async () => {
    responderOrigen({ maquinas: { 1: maquinaConFilas([["&nbsp12", "ci2->  PLAZA   &amp;  CIA ", "2 min.", "0 kms."]]) } });
    const { cuerpo } = await pedirJson();
    assert.equal(cuerpo.autobuses[0].linea, "CI2");
    assert.equal(cuerpo.autobuses[0].destino, "PLAZA & CIA");
    assert.equal(cuerpo.poste, null);
  });

  it("responde 200 con lista vacía si no hay maquinas", async () => {
    responderOrigen(GPS_VACIO);
    const { respuesta, cuerpo } = await pedirJson("99999");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo, { poste: null, autobuses: [] });
  });

  const FORMATOS_ROTOS = {
    "la respuesta no es un objeto": [],
    "maquinas no es un objeto": { maquinas: "x" },
    "un autobús sin coordenadas numéricas": { maquinas: { 1: maquinaConFilas([["&nbsp1", "1->A", "1 min.", "1 kms."]], { 0: { LAT: "a", LON: 1 } }) } },
    "un autobús sin coordenadas": { maquinas: { 1: { ...maquinaConFilas([["&nbsp1", "1->A", "1 min.", "1 kms."]]), coordenadas: undefined } } },
    "una fila sin las 4 celdas": { maquinas: { 1: maquinaConFilas([["&nbsp1", "1->A", "1 min."]]) } },
    "una fila sin separador línea->destino": { maquinas: { 1: maquinaConFilas([["&nbsp1", "1 A", "1 min.", "1 kms."]]) } },
    "minutos ilegibles": { maquinas: { 1: maquinaConFilas([["&nbsp1", "1->A", "pronto", "1 kms."]]) } },
    "un autobús sin info": { maquinas: { 1: { coordenadas: { 0: { LAT: 1, LON: 1 } }, icon: "bus.png" } } },
    "un autobús sin filas": { maquinas: { 1: maquinaConFilas([]) } },
  };

  for (const [descripcion, cuerpo] of Object.entries(FORMATOS_ROTOS)) {
    it(`responde 502 si ${descripcion}`, async () => {
      responderOrigen(cuerpo);
      const { respuesta, cuerpo: error } = await pedirJson();
      assert.equal(respuesta.status, ESTADO_ORIGEN_FALLIDO);
      assert.equal(error.error, MENSAJE_ORIGEN_GPS);
      assert.equal(respuesta.headers.get("cache-control"), "no-store");
    });
  }

  it("responde 502 si el origen devuelve HTTP de error o no es JSON", async () => {
    simulado.mock.mockImplementation(async () => respuestaJson(GPS_688, 500));
    assert.equal((await worker.fetch(peticion("1"), entorno)).status, ESTADO_ORIGEN_FALLIDO);
    simulado.mock.mockImplementation(async () => new Response("<html>"));
    assert.equal((await worker.fetch(peticion("1"), entorno)).status, ESTADO_ORIGEN_FALLIDO);
  });

  it("responde 502 si el origen redirige (redirect manual)", async () => {
    simulado.mock.mockImplementation(async () => new Response(null, { status: 302 }));
    assert.equal((await worker.fetch(peticion("1"), entorno)).status, ESTADO_ORIGEN_FALLIDO);
  });

  it("responde 400 con un poste inválido sin llamar al origen", async () => {
    for (const poste of ["abc", "123456", "1a", ""]) {
      const respuesta = await worker.fetch(peticion(poste), entorno);
      assert.equal(respuesta.status, 400, poste);
      assert.equal((await respuesta.json()).error, MENSAJE_POSTE_INVALIDO);
    }
    assert.equal(simulado.mock.callCount(), 0);
  });

  it("responde 405 a métodos que no son GET", async () => {
    const respuesta = await worker.fetch(peticion("688", "POST"), entorno);
    assert.equal(respuesta.status, 405);
    assert.equal(respuesta.headers.get("allow"), "GET");
  });

  it("responde 502 al agotar el tiempo máximo", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    let senal;
    simulado.mock.mockImplementation((_url, { signal }) => new Promise((_resolver, rechazar) => {
      senal = signal;
      signal.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
    }));
    const pendiente = worker.fetch(peticion("688"), entorno);
    await Promise.resolve();
    mock.timers.tick(TIEMPO_MAXIMO_MS - 1);
    assert.equal(senal.aborted, false, "el GPS de Avanza tarda hasta 6 s: no se corta antes del máximo");
    mock.timers.tick(1);
    assert.equal((await pendiente).status, ESTADO_ORIGEN_FALLIDO);
  });

  it("hace un POST con el cuerpo, el User-Agent y las opciones esperados, sin cabeceras del usuario", async () => {
    await worker.fetch(peticion("744", "GET", { cookie: "sesion=1", authorization: "x", "x-usuario": "y" }), entorno);
    assert.equal(simulado.mock.callCount(), 1);
    const [url, opciones] = simulado.mock.calls[0].arguments;
    assert.equal(url, URL_ORIGEN_ESPERADA);
    assert.equal(opciones.method, "POST");
    assert.equal(opciones.body, "poste=744&coche=0");
    assert.equal(opciones.redirect, "manual");
    assert.ok(opciones.signal instanceof AbortSignal);
    assert.deepEqual(opciones.headers, { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT_ESPERADO });
  });

  it("no reenvía la query de la petición al origen", async () => {
    await worker.fetch(new Request(`${BASE}/api/gps/744?x=1`), entorno);
    await worker.fetch(peticion("744"), entorno);
    const [primera, segunda] = simulado.mock.calls.map((llamada) => llamada.arguments);
    assert.equal(primera[0], segunda[0]);
    assert.equal(primera[1].body, segunda[1].body);
  });

  it("acepta &nbsp; con punto y coma en la celda del coche", async () => {
    responderOrigen({ maquinas: { 1: maquinaConFilas([["&nbsp;4709", "58->FUENTE", "2 min.", "1 kms."]]) } });
    const { cuerpo } = await pedirJson();
    assert.equal(cuerpo.autobuses[0].coche, "4709");
  });

  it("envía las cabeceras de una respuesta correcta y de un error", async () => {
    const ok = await worker.fetch(peticion("688"), entorno);
    assert.equal(ok.headers.get("cache-control"), MAX_AGE_ESPERADO);
    assert.equal(ok.headers.get("x-robots-tag"), "noindex");
    assert.match(ok.headers.get("content-type"), /^application\/json/);
    const error = await worker.fetch(peticion("abc"), entorno);
    assert.equal(error.headers.get("cache-control"), "no-store");
    assert.equal(error.headers.get("x-robots-tag"), "noindex");
  });

  describe("caché", () => {
    function instalarCache(inicial = new Map()) {
      const almacen = inicial;
      globalThis.caches = {
        default: {
          match: async (clave) => almacen.get(clave.url)?.clone(),
          put: async (clave, respuesta) => void almacen.set(clave.url, respuesta),
        },
      };
      return almacen;
    }

    it("guarda la respuesta por poste y la reutiliza sin volver a llamar al origen", async () => {
      const almacen = instalarCache();
      const primera = await worker.fetch(peticion("688"), entorno);
      const segunda = await worker.fetch(peticion("688"), entorno);
      assert.equal(simulado.mock.callCount(), 1);
      assert.equal(almacen.size, 1);
      assert.deepEqual(await segunda.json(), await primera.json());
      assert.equal(segunda.headers.get("cache-control"), MAX_AGE_ESPERADO);
    });

    it("usa una clave distinta por poste", async () => {
      const almacen = instalarCache();
      await worker.fetch(peticion("688"), entorno);
      await worker.fetch(peticion("744"), entorno);
      assert.equal(simulado.mock.callCount(), 2);
      assert.equal(almacen.size, 2);
    });

    it("no guarda los errores", async () => {
      const almacen = instalarCache();
      responderOrigen([]);
      await worker.fetch(peticion("688"), entorno);
      assert.equal(almacen.size, 0);
    });

    it("responde con datos del origen si la caché falla al leer", async () => {
      globalThis.caches = { default: { match: async () => { throw new Error("caché caída"); }, put: async () => {} } };
      const { respuesta, cuerpo } = await pedirJson("688");
      assert.equal(respuesta.status, 200);
      assert.equal(cuerpo.autobuses.length, 1);
      assert.equal(simulado.mock.callCount(), 1);
    });

    it("normaliza los ceros a la izquierda: una sola clave y una sola petición al origen", async () => {
      const almacen = instalarCache();
      await worker.fetch(peticion("01"), entorno);
      await worker.fetch(peticion("1"), entorno);
      assert.equal(simulado.mock.callCount(), 1);
      assert.equal(almacen.size, 1);
      assert.equal(simulado.mock.calls[0].arguments[1].body, "poste=1&coche=0");
    });

    it("responde igualmente si la caché falla al guardar", async () => {
      globalThis.caches = { default: { match: async () => undefined, put: async () => { throw new Error("caché caída"); } } };
      assert.equal((await worker.fetch(peticion("688"), entorno)).status, 200);
    });
  });
});
