import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import worker, {
  MENSAJE_METODO,
  MENSAJE_NO_ENCONTRADO,
  MENSAJE_ORIGEN,
  MENSAJE_POSTE_INVALIDO,
  TIEMPO_MAXIMO_MS,
  extraerFilasAvanza,
  mapearDndzgz,
} from "../workers/zaragoza-bus.mjs";

const BASE = "https://ododex.com/es/zaragoza-bus";
const POSTE = "104";
const URL_API = `${BASE}/api/poste/${POSTE}`;
const URL_AVANZA_ESPERADA = `https://zaragoza-pasobus.avanzagrupo.com/frm_esquemaparadatime.php?poste=${POSTE}`;
const URL_DNDZGZ_ESPERADA = `https://api.dndzgz.com/services/bus/${POSTE}`;
const RESPUESTA_ASSETS = new Response("estatico", { status: 200 });

const ICONO_ACCESIBLE = '<td class="digital"><svg xmlns="http://www.w3.org/2000/svg"><title>Accesible.</title></svg></td><td class="digital"></td>';

function fila(linea, destino, tiempo) {
  return `<tr><td class="digital">${linea}</td><td class="digital">${destino}</td><td class="digital">${tiempo}</td>${ICONO_ACCESIBLE}</tr>`;
}

function paginaAvanza(filas, poste = POSTE) {
  const cabecera = `<table><tr><td align="center"><h4>POSTE: ${poste}</h4></td></tr><tr><td class="titDigital">LINEA</td></tr>`;
  return `<html><body>${cabecera}${filas.join("")}</table></body></html>`;
}

/** Respuesta HTML codificada en ISO-8859-1, como la de Avanza. */
function respuestaAvanza(html, estado = 200) {
  return new Response(Buffer.from(html, "latin1"), { status: estado, headers: { "content-type": "text/html; charset=ISO-8859-1" } });
}

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

const ESTIMACIONES_DNDZGZ = { estimates: [{ line: "51", direction: "PABELLON PRINCIPE FELIPE.", estimate: 3 }] };

/** Sustituye fetch: cada origen se resuelve con su función. */
function simularOrigenes({ avanza, dndzgz }) {
  return async (url) => {
    if (url === URL_AVANZA_ESPERADA) return avanza();
    if (url === URL_DNDZGZ_ESPERADA) return dndzgz();
    throw new Error(`URL inesperada: ${url}`);
  };
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

function comprobarError(respuesta, estado) {
  assert.equal(respuesta.status, estado);
  assert.equal(respuesta.headers.get("cache-control"), "no-store");
  assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
}

describe("worker del autobús de Zaragoza", () => {
  let simulado;

  beforeEach(() => {
    simulado = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch sin configurar");
    });
    mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  function configurar(origenes) {
    simulado.mock.mockImplementation(simularOrigenes(origenes));
  }

  const dndzgzCaido = () => {
    throw new TypeError("DNDzgz caído");
  };
  const avanzaCaido = () => {
    throw new TypeError("Avanza caído");
  };

  it("200 con Avanza: decodifica latin1 con tildes y devuelve las filas con sus cabeceras", async () => {
    configurar({
      avanza: () => respuestaAvanza(paginaAvanza([fila("25", "LA CARTUJA", "14 minutos."), fila("51", "PABELLÓN PRÍNCIPE FELIPE", "3 minutos.")])),
      dndzgz: dndzgzCaido,
    });
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), {
      origen: "avanza",
      destinos: [
        { linea: "25", destino: "LA CARTUJA", primero: "14 minutos." },
        { linea: "51", destino: "PABELLÓN PRÍNCIPE FELIPE", primero: "3 minutos." },
      ],
    });
    assert.equal(respuesta.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(respuesta.headers.get("cache-control"), "public, max-age=15");
    assert.equal(respuesta.headers.get("x-robots-tag"), "noindex");
  });

  it("conserva «En la parada.» como tiempo", async () => {
    configurar({ avanza: () => respuestaAvanza(paginaAvanza([fila("23", "PARQUE VENECIA", "En la parada.")])), dndzgz: dndzgzCaido });
    const cuerpo = await (await worker.fetch(peticion(), entornoSimulado())).json();
    assert.deepEqual(cuerpo.destinos, [{ linea: "23", destino: "PARQUE VENECIA", primero: "En la parada." }]);
  });

  it("página con cabecera pero sin filas: lista vacía válida de Avanza", async () => {
    configurar({ avanza: () => respuestaAvanza(paginaAvanza([])), dndzgz: dndzgzCaido });
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { origen: "avanza", destinos: [] });
  });

  it("página sin «POSTE:»: cae a DNDzgz", async () => {
    configurar({ avanza: () => respuestaAvanza("<html>Mantenimiento</html>"), dndzgz: () => respuestaJson(ESTIMACIONES_DNDZGZ) });
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), {
      origen: "dndzgz",
      destinos: [{ linea: "51", destino: "PABELLON PRINCIPE FELIPE.", primero: 3 }],
    });
    assert.equal(respuesta.headers.get("cache-control"), "public, max-age=15");
  });

  it("Avanza responde 500: cae a DNDzgz", async () => {
    configurar({ avanza: () => respuestaAvanza("error", 500), dndzgz: () => respuestaJson(ESTIMACIONES_DNDZGZ) });
    const cuerpo = await (await worker.fetch(peticion(), entornoSimulado())).json();
    assert.equal(cuerpo.origen, "dndzgz");
  });

  it("Avanza falla por red: cae a DNDzgz", async () => {
    configurar({ avanza: avanzaCaido, dndzgz: () => respuestaJson(ESTIMACIONES_DNDZGZ) });
    const cuerpo = await (await worker.fetch(peticion(), entornoSimulado())).json();
    assert.equal(cuerpo.origen, "dndzgz");
  });

  it("Avanza no responde en 5 s: cae a DNDzgz", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    simulado.mock.mockImplementation((url, { signal }) => {
      if (url === URL_DNDZGZ_ESPERADA) return Promise.resolve(respuestaJson(ESTIMACIONES_DNDZGZ));
      return new Promise((_resolver, rechazar) => {
        signal.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
      });
    });
    const pendiente = worker.fetch(peticion(), entornoSimulado());
    mock.timers.tick(TIEMPO_MAXIMO_MS);
    const respuesta = await pendiente;
    assert.equal(TIEMPO_MAXIMO_MS, 5000);
    assert.equal((await respuesta.json()).origen, "dndzgz");
  });

  it("consulta las URL exactas con cacheTtl 20, sin cabeceras del usuario y sin seguir redirecciones", async () => {
    configurar({ avanza: () => respuestaAvanza("sin cabecera"), dndzgz: () => respuestaJson(ESTIMACIONES_DNDZGZ) });
    const entrada = peticion(URL_API, { headers: { cookie: "sesion=placeholder", authorization: "placeholder", "x-forwarded-for": "203.0.113.7" } });
    await worker.fetch(entrada, entornoSimulado());
    assert.equal(simulado.mock.callCount(), 2);
    const urls = simulado.mock.calls.map((llamada) => llamada.arguments[0]);
    assert.deepEqual(urls, [URL_AVANZA_ESPERADA, URL_DNDZGZ_ESPERADA]);
    for (const llamada of simulado.mock.calls) {
      const opciones = llamada.arguments[1];
      assert.deepEqual(opciones.cf, { cacheTtl: 20, cacheEverything: true });
      assert.equal(opciones.redirect, "error");
      assert.equal(opciones.headers, undefined);
      assert.ok(opciones.signal instanceof AbortSignal);
    }
  });

  it("502: fallan los dos orígenes, sin caché y registrando el motivo de cada uno", async () => {
    configurar({ avanza: avanzaCaido, dndzgz: () => respuestaJson({ otra: [] }) });
    const respuesta = await worker.fetch(peticion(), entornoSimulado());
    comprobarError(respuesta, 502);
    assert.deepEqual(await respuesta.json(), { error: MENSAJE_ORIGEN });
    const [mensaje] = console.warn.mock.calls[0].arguments;
    assert.match(mensaje, /Avanza caído/);
    assert.match(mensaje, /estimates/);
  });

  it("502: DNDzgz responde con estado de error o JSON ilegible", async () => {
    for (const dndzgz of [() => respuestaJson(ESTIMACIONES_DNDZGZ, 500), () => new Response("no es json")]) {
      configurar({ avanza: avanzaCaido, dndzgz });
      comprobarError(await worker.fetch(peticion(), entornoSimulado()), 502);
    }
  });

  it("400: poste con formato inválido, sin llamar a los orígenes", async () => {
    for (const poste of ["abc", "123456", "10a", "104/", "-1", ""]) {
      const respuesta = await worker.fetch(peticion(`${BASE}/api/poste/${poste}`), entornoSimulado());
      comprobarError(respuesta, 400);
      assert.deepEqual(await respuesta.json(), { error: MENSAJE_POSTE_INVALIDO });
    }
    assert.equal(simulado.mock.callCount(), 0);
  });

  it("acepta postes de 1 a 5 dígitos", async () => {
    simulado.mock.mockImplementation(async () => respuestaAvanza(paginaAvanza([])));
    for (const poste of ["1", "12345"]) {
      const respuesta = await worker.fetch(peticion(`${BASE}/api/poste/${poste}`), entornoSimulado());
      assert.equal(respuesta.status, 200, poste);
    }
  });

  it("404: otra ruta bajo /api/", async () => {
    for (const ruta of ["/api/", "/api/otra", "/api/poste"]) {
      const respuesta = await worker.fetch(peticion(`${BASE}${ruta}`), entornoSimulado());
      comprobarError(respuesta, 404);
      assert.deepEqual(await respuesta.json(), { error: MENSAJE_NO_ENCONTRADO });
    }
  });

  it("405: otro método, con allow: GET", async () => {
    for (const metodo of ["POST", "PUT", "DELETE", "HEAD"]) {
      const respuesta = await worker.fetch(peticion(URL_API, { method: metodo }), entornoSimulado());
      comprobarError(respuesta, 405);
      assert.equal(respuesta.headers.get("allow"), "GET");
      if (metodo !== "HEAD") {
        assert.deepEqual(await respuesta.json(), { error: MENSAJE_METODO });
      }
    }
    assert.equal(simulado.mock.callCount(), 0);
  });

  it("delega en ASSETS las rutas que no son de la API", async () => {
    const entorno = entornoSimulado();
    for (const ruta of ["/es/zaragoza-bus", "/es/zaragoza-bus/", "/es/zaragoza-bus/api", "/es/zaragoza-bus/parada/104", "/otra"]) {
      const entrada = peticion(`https://ododex.com${ruta}`);
      assert.equal(await worker.fetch(entrada, entorno), RESPUESTA_ASSETS, ruta);
      assert.equal(entorno.peticiones.at(-1), entrada);
    }
    assert.equal(simulado.mock.callCount(), 0);
  });
});

describe("extraerFilasAvanza", () => {
  it("decodifica entidades básicas y numéricas y recorta espacios", () => {
    const html = paginaAvanza([fila(" 51 ", "BAR &amp; CAF&#201; &lt;1&gt; &quot;X&quot; &#39;Y&#39; &#xC1;", "\n 3 minutos. ")]);
    assert.deepEqual(extraerFilasAvanza(html), [{ linea: "51", destino: 'BAR & CAFÉ <1> "X" \'Y\' Á', primero: "3 minutos." }]);
  });

  it("solo toma las tres primeras celdas y deja las entidades desconocidas", () => {
    const [primera] = extraerFilasAvanza(paginaAvanza([fila("Ci1", "A &desconocida; B", "En la parada.")]));
    assert.deepEqual(primera, { linea: "Ci1", destino: "A &desconocida; B", primero: "En la parada." });
  });

  it("ignora los puntos de código fuera de rango", () => {
    const [primera] = extraerFilasAvanza(paginaAvanza([fila("1", "A&#99999999;B", "1 minutos.")]));
    assert.equal(primera.destino, "AB");
  });

  it("devuelve null sin cabecera «POSTE:» y lista vacía con cabecera sin filas", () => {
    assert.equal(extraerFilasAvanza("<html>otra cosa</html>"), null);
    assert.equal(extraerFilasAvanza(undefined), null);
    assert.deepEqual(extraerFilasAvanza(paginaAvanza([])), []);
  });
});

describe("mapearDndzgz", () => {
  it("mapea a filas con el número de minutos y descarta las inválidas conservando el 0", () => {
    const datos = {
      estimates: [
        { line: "25", direction: "A", estimate: 0 },
        { line: "25", direction: "B", estimate: -1 },
        { line: "25", direction: "C", estimate: "5" },
        { line: "25", direction: "D", estimate: Number.NaN },
        { line: 25, direction: "E", estimate: 4 },
        { line: "25", direction: 7, estimate: 4 },
        null,
        "texto",
        { line: "51", direction: "F", estimate: 12 },
      ],
    };
    assert.deepEqual(mapearDndzgz(datos), [
      { linea: "25", destino: "A", primero: 0 },
      { linea: "51", destino: "F", primero: 12 },
    ]);
  });

  it("devuelve null si el formato no es { estimates: [...] }", () => {
    for (const datos of [null, undefined, 3, "x", [], {}, { estimates: {} }]) {
      assert.equal(mapearDndzgz(datos), null);
    }
  });
});
