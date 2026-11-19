import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import worker from "../workers/tranvia-zaragoza.mjs";

// Literales del contrato (el Worker no exporta constantes: workerd lo rechazaría).
const MENSAJE_ANDEN_INVALIDO = "El andén debe ser un número de cuatro cifras.";
const MENSAJE_NO_ENCONTRADO = "Ruta de la API no encontrada.";
const MENSAJE_METODO = "Método no permitido: usa GET.";
const MENSAJE_ORIGEN = "No se pudo obtener los tiempos del tranvía. Inténtalo de nuevo en unos segundos.";
const TIEMPO_MAXIMO_MS = 5000;

const BASE = "https://ododex.com/es/tranvia-zaragoza";
const ANDEN = "1402";
const URL_API = `${BASE}/api/tram/${ANDEN}`;
const URL_ORIGEN_ESPERADA = `https://api.dndzgz.com/services/tram/${ANDEN}`;
const RESPUESTA_ASSETS = new Response("estatico", { status: 200 });

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function entornoSimulado() {
  const peticiones = [];
  return {
    peticiones,
    ASSETS: {
      fetch: async (peticion) => {
        peticiones.push(peticion);
        return RESPUESTA_ASSETS;
      },
    },
  };
}

function peticion(url = URL_API, init = {}) {
  return new Request(url, init);
}

describe("worker del tranvía de Zaragoza", () => {
  let simulado;

  beforeEach(() => {
    simulado = mock.method(globalThis, "fetch", async () => respuestaJson({ estimates: [] }));
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  it("200: devuelve solo direction y estimate con sus cabeceras", async () => {
    simulado.mock.mockImplementation(async () =>
      respuestaJson({ estimates: [{ line: "L1", direction: "AVENIDA ACADEMIA", estimate: 3, extra: 1 }], otro: true }),
    );
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { estimates: [{ direction: "AVENIDA ACADEMIA", estimate: 3 }] });
    assert.equal(respuesta.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(respuesta.headers.get("cache-control"), "public, max-age=15");
    assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
  });

  it("consulta la URL exacta del origen con cacheTtl 20 y sin cabeceras del usuario", async () => {
    const entrada = peticion(URL_API, {
      headers: { cookie: "sesion=placeholder", "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "203.0.113.7", authorization: "placeholder" },
    });
    await worker.fetch(entrada, entornoSimulado());
    assert.equal(simulado.mock.callCount(), 1);
    const [url, opciones] = simulado.mock.calls[0].arguments;
    assert.equal(url, URL_ORIGEN_ESPERADA);
    assert.deepEqual(opciones.cf, { cacheTtl: 20, cacheEverything: true });
    assert.equal(opciones.redirect, "manual");
    assert.equal(opciones.headers, undefined);
    assert.ok(opciones.signal instanceof AbortSignal);
  });

  it("400: andén con formato inválido, sin llamar al origen", async () => {
    for (const anden of ["abc", "123", "12345", "1402/", "14a2", ""]) {
      const respuesta = await worker.fetch(peticion(`${BASE}/api/tram/${anden}`), entornoSimulado());
      assert.equal(respuesta.status, 400, anden);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
      assert.deepEqual(await respuesta.json(), { error: MENSAJE_ANDEN_INVALIDO });
      assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
    }
    assert.equal(simulado.mock.callCount(), 0);
  });

  it("404: otra ruta bajo /api/", async () => {
    for (const ruta of ["/api/", "/api/otra", "/api/tram"]) {
      const respuesta = await worker.fetch(peticion(`${BASE}${ruta}`), entornoSimulado());
      assert.equal(respuesta.status, 404, ruta);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
      assert.deepEqual(await respuesta.json(), { error: MENSAJE_NO_ENCONTRADO });
      assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
    }
  });

  it("405: otro método, con allow: GET", async () => {
    for (const metodo of ["POST", "PUT", "DELETE", "HEAD"]) {
      const respuesta = await worker.fetch(peticion(URL_API, { method: metodo }), entornoSimulado());
      assert.equal(respuesta.status, 405, metodo);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
      assert.equal(respuesta.headers.get("allow"), "GET");
      assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
      if (metodo !== "HEAD") {
        assert.deepEqual(await respuesta.json(), { error: MENSAJE_METODO });
      }
    }
    assert.equal(simulado.mock.callCount(), 0);
  });

  it("502: fallo de red", async () => {
    simulado.mock.mockImplementation(async () => {
      throw new TypeError("fallo de red");
    });
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 502);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await respuesta.json(), { error: MENSAJE_ORIGEN });
    assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
  });

  it("502: el origen responde con un estado de error", async () => {
    simulado.mock.mockImplementation(async () => respuestaJson({ estimates: [] }, 500));
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 502);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
  });

  it("502: tiempo agotado a los 5 s", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    simulado.mock.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolver, rechazar) => {
          signal.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
        }),
    );
    const pendiente = worker.fetch(peticion(), entornoSimulado());
    mock.timers.tick(TIEMPO_MAXIMO_MS);
    const respuesta = await pendiente;
    assert.equal(respuesta.status, 502);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await respuesta.json(), { error: MENSAJE_ORIGEN });
  });

  it("502: formato inesperado (JSON ilegible, sin estimates u objeto no válido)", async () => {
    const cuerpos = [new Response("no es json"), respuestaJson({ otra: [] }), respuestaJson(null), respuestaJson({ estimates: "x" })];
    for (const cuerpo of cuerpos) {
      simulado.mock.mockImplementation(async () => cuerpo);
      const respuesta = await worker.fetch(peticion(), entornoSimulado());
      assert.equal(respuesta.status, 502);
assert.equal(respuesta.headers.get("cache-control"), "no-store");
      assert.deepEqual(await respuesta.json(), { error: MENSAJE_ORIGEN });
    }
  });

  it("delega en ASSETS las rutas que no son de la API", async () => {
    const entorno = entornoSimulado();
    for (const ruta of ["/es/tranvia-zaragoza", "/es/tranvia-zaragoza/", "/es/tranvia-zaragoza/api", "/es/tranvia-zaragoza/parada/1402", "/otra"]) {
      const entrada = peticion(`https://ododex.com${ruta}`);
      assert.equal(await worker.fetch(entrada, entorno), RESPUESTA_ASSETS, ruta);
      assert.equal(entorno.peticiones.at(-1), entrada);
    }
    assert.equal(simulado.mock.callCount(), 0);
  });
});

// El saneado se prueba a través de fetch: el Worker no exporta funciones auxiliares (workerd lo rechazaría).
describe("saneado de estimaciones", () => {
  afterEach(() => mock.restoreAll());

  async function responderCon(cuerpo) {
    mock.method(globalThis, "fetch", async () => respuestaJson(cuerpo));
    return worker.fetch(peticion(), entornoSimulado());
  }

  it("descarta estimaciones inválidas y conserva el 0", async () => {
    const datos = {
      estimates: [
        { direction: "A", estimate: 0 },
        { direction: "B", estimate: -1 },
        { direction: "C", estimate: "5" },
        { direction: "D", estimate: Number.NaN },
        { direction: "E", estimate: null },
        { direction: 7, estimate: 4 },
        { estimate: 4 },
        null,
        "texto",
        { direction: "F", estimate: 12.5 },
      ],
    };
    const respuesta = await responderCon(datos);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), {
      estimates: [
      { direction: "A", estimate: 0 },
      { direction: "F", estimate: 12.5 },
      ],
    });
  });

  it("responde 502 si el formato no es { estimates: [...] }", async () => {
    for (const datos of [null, 3, "x", [], {}, { estimates: {} }]) {
      const respuesta = await responderCon(datos);
      assert.equal(respuesta.status, 502, JSON.stringify(datos));
      mock.restoreAll();
    }
  });
});
