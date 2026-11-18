import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  leerSecciones,
  normalizarOrigen,
  textoRobots,
  textoAdsTxt,
  textoHeaders,
  generarPortada,
  copiarSeccion,
  aplanarSegmentosNext,
  comprobarLimitesPages,
  ensamblar,
  dirSalidaDeWorker,
  quitarRscDePaginas,
  leerProduccion,
  leerOpcionSolo,
  comandoCompilacion,
  dirExportacionDeSeccion,
  insertarAdsense,
} from "../lib/ensamblado.mjs";

const SECCIONES = [
  { ruta: "/es/multas", proyecto: "multas", nombre: "Multas", descripcion: "Desc multas" },
  { ruta: "/es/impuestos", proyecto: "impuestos", nombre: "Impuestos", descripcion: "Desc impuestos" },
];
const PLANTILLA = "<link href=\"<!-- ORIGEN -->/\"><main><!-- SECCIONES --></main>";
const ORIGEN = "https://ododex.com";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ododex-ens-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function escribir(ruta, contenido) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido);
}

function escribirConfig(valor) {
  const fichero = path.join(tmp, "secciones.json");
  fs.writeFileSync(fichero, JSON.stringify(valor));
  return fichero;
}

describe("leerSecciones", () => {
  test("acepta una configuración válida", () => {
    assert.deepEqual(leerSecciones(escribirConfig(SECCIONES)), SECCIONES);
  });

  test("un JSON roto da un Error que nombra el fichero", () => {
    const fichero = path.join(tmp, "roto.json");
    fs.writeFileSync(fichero, "{ no es json");
    assert.throws(() => leerSecciones(fichero), /roto.json.*JSON válido/);
  });

  test("rechaza un array vacío", () => {
    assert.throws(() => leerSecciones(escribirConfig([])), /al menos una sección/);
  });

  test("rechaza un campo ausente indicando índice y campo", () => {
    const { descripcion, ...incompleta } = SECCIONES[1];
    assert.ok(descripcion);
    assert.throws(() => leerSecciones(escribirConfig([SECCIONES[0], incompleta])), /sección 1.*"descripcion"/);
  });

  test("rechaza una ruta con barra final", () => {
    const mala = { ...SECCIONES[0], ruta: "/es/multas/" };
    assert.throws(() => leerSecciones(escribirConfig([mala])), /"ruta"/);
  });

  test("rechaza rutas repetidas", () => {
    assert.throws(() => leerSecciones(escribirConfig([SECCIONES[0], SECCIONES[0]])), /repetida/);
  });
});

describe("normalizarOrigen", () => {
  test("quita la barra final y admite localhost", () => {
    assert.equal(normalizarOrigen("https://ododex.com/"), ORIGEN);
    assert.equal(normalizarOrigen("http://localhost:8788"), "http://localhost:8788");
  });

  test("rechaza http no local y textos que no son URL", () => {
    assert.throws(() => normalizarOrigen("http://ododex.com"), /Origen no válido/);
    assert.throws(() => normalizarOrigen("ododex.com"), /Origen no válido/);
  });
});

test("textoRobots devuelve el contenido exacto", () => {
  assert.equal(
    textoRobots(ORIGEN, SECCIONES),
    "User-agent: *\nAllow: /\n\n" +
      "Sitemap: https://ododex.com/es/multas/sitemap.xml\n" +
      "Sitemap: https://ododex.com/es/impuestos/sitemap.xml\n",
  );
});

describe("textoAdsTxt", () => {
  const esperado = "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n";

  test("acepta ca-pub- y pub-", () => {
    assert.equal(textoAdsTxt("ca-pub-1234567890123456"), esperado);
    assert.equal(textoAdsTxt("pub-1234567890123456"), esperado);
  });

  test("devuelve null si está vacío o no existe", () => {
    assert.equal(textoAdsTxt(""), null);
    assert.equal(textoAdsTxt(undefined), null);
  });

  test("lanza Error con formato inválido", () => {
    assert.throws(() => textoAdsTxt("ca-pub-123"), /AdSense no válido/);
  });
});

test("textoHeaders incluye caché por sección y cabeceras globales", () => {
  assert.equal(
    textoHeaders(SECCIONES),
    "/es/multas/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n" +
      "/es/impuestos/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n\n" +
      "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n",
  );
});

describe("generarPortada", () => {
  test("genera un enlace por sección y sustituye el origen", () => {
    const html = generarPortada(PLANTILLA, SECCIONES, ORIGEN);
    assert.match(html, /<a class="link-card" href="\/es\/multas">/);
    assert.match(html, /<a class="link-card" href="\/es\/impuestos">/);
    assert.match(html, /href="https:\/\/ododex.com\/"/);
    assert.doesNotMatch(html, /<!-- (SECCIONES|ORIGEN) -->/);
  });

  test("escapa < y & en nombre y descripción", () => {
    const peligrosa = [{ ...SECCIONES[0], nombre: "A <b> & C", descripcion: "x < y" }];
    const html = generarPortada(PLANTILLA, peligrosa, ORIGEN);
    assert.match(html, /A &lt;b&gt; &amp; C/);
    assert.match(html, /x &lt; y/);
    assert.doesNotMatch(html, /<b>/);
  });

  test("lanza Error si falta un marcador", () => {
    assert.throws(() => generarPortada("<main><!-- SECCIONES --></main>", SECCIONES, ORIGEN), /ORIGEN/);
    assert.throws(() => generarPortada("<!-- ORIGEN -->", SECCIONES, ORIGEN), /SECCIONES/);
  });
});

describe("copiarSeccion", () => {
  test("genera <ruta>.html y <ruta>/index.html", () => {
    const out = path.join(tmp, "out");
    escribir(path.join(out, "index.html"), "portada");
    escribir(path.join(out, "radares.html"), "radares");
    const dist = path.join(tmp, "dist");
    copiarSeccion(out, dist, "/es/multas");
    assert.equal(fs.readFileSync(path.join(dist, "es", "multas.html"), "utf8"), "portada");
    assert.equal(fs.readFileSync(path.join(dist, "es", "multas", "index.html"), "utf8"), "portada");
    assert.equal(fs.readFileSync(path.join(dist, "es", "multas", "radares.html"), "utf8"), "radares");
  });

  test("da error sin out/ y avisa de compilar", () => {
    assert.throws(() => copiarSeccion(path.join(tmp, "nada"), path.join(tmp, "dist"), "/es/multas"), /compila la sección/);
  });
});

describe("aplanarSegmentosNext", () => {
  test("aplana un nivel", () => {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "radares", "a-coruna", "__next.radares", "$d$provincia", "__PAGE__.txt"), "p");
    assert.equal(aplanarSegmentosNext(dir), 1);
    const destino = path.join(dir, "radares", "a-coruna", "__next.radares.$d$provincia.__PAGE__.txt");
    assert.equal(fs.readFileSync(destino, "utf8"), "p");
    assert.ok(!fs.existsSync(path.join(dir, "radares", "a-coruna", "__next.radares")));
  });

  test("aplana varios niveles", () => {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "a", "__next.radares", "$d$provincia", "$d$carretera", "__PAGE__.txt"), "p");
    assert.equal(aplanarSegmentosNext(dir), 1);
    assert.ok(fs.existsSync(path.join(dir, "a", "__next.radares.$d$provincia.$d$carretera.__PAGE__.txt")));
    assert.ok(!fs.existsSync(path.join(dir, "a", "__next.radares")));
  });

  test("aplana varios ficheros del mismo __next.*", () => {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "a", "__next.radares", "__PAGE__.txt"), "1");
    escribir(path.join(dir, "a", "__next.radares", "$d$provincia", "__PAGE__.txt"), "2");
    escribir(path.join(dir, "a", "__next.radares", "$d$provincia", "__head.txt"), "3");
    assert.equal(aplanarSegmentosNext(dir), 3);
    for (const nombre of ["__next.radares.__PAGE__.txt", "__next.radares.$d$provincia.__PAGE__.txt", "__next.radares.$d$provincia.__head.txt"]) {
      assert.ok(fs.existsSync(path.join(dir, "a", nombre)), `falta ${nombre}`);
    }
  });

  test("sin directorios __next.* devuelve 0 y no toca nada", () => {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "a", "index.html"), "i");
    escribir(path.join(dir, "a", "__next.radares.__PAGE__.txt"), "ya plano");
    assert.equal(aplanarSegmentosNext(dir), 0);
    assert.equal(fs.readFileSync(path.join(dir, "a", "__next.radares.__PAGE__.txt"), "utf8"), "ya plano");
    assert.ok(fs.existsSync(path.join(dir, "a", "index.html")));
  });

  test("si el destino existe lanza Error y no mueve nada", () => {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "a", "__next.radares", "__PAGE__.txt"), "origen");
    escribir(path.join(dir, "a", "__next.radares.__PAGE__.txt"), "destino");
    assert.throws(() => aplanarSegmentosNext(dir), /ya existe/);
    assert.ok(fs.existsSync(path.join(dir, "a", "__next.radares", "__PAGE__.txt")));
    assert.equal(fs.readFileSync(path.join(dir, "a", "__next.radares.__PAGE__.txt"), "utf8"), "destino");
  });
});

describe("comprobarLimitesPages", () => {
  test("devuelve el número de ficheros", () => {
    escribir(path.join(tmp, "a.txt"), "a");
    escribir(path.join(tmp, "sub", "b.txt"), "b");
    assert.equal(comprobarLimitesPages(tmp), 2);
  });

  test("lanza Error al superar el máximo de ficheros", () => {
    escribir(path.join(tmp, "a.txt"), "a");
    escribir(path.join(tmp, "b.txt"), "b");
    assert.throws(() => comprobarLimitesPages(tmp, { maxFicheros: 1 }), /2 ficheros.*admite 1/);
  });

  test("lanza Error si un fichero supera el tamaño máximo", () => {
    escribir(path.join(tmp, "grande.bin"), "0123456789");
    assert.throws(() => comprobarLimitesPages(tmp, { maxBytes: 5 }), /grande\.bin/);
  });
});

describe("ensamblar", () => {
  function prepararBase() {
    const dirRaiz = path.join(tmp, "raiz");
    escribir(path.join(dirRaiz, "index.html"), PLANTILLA);
    escribir(path.join(dirRaiz, "404.html"), "404 raiz");
    escribir(path.join(dirRaiz, "estilos.css"), "body{}");
    for (const seccion of SECCIONES) {
      escribir(path.join(tmp, seccion.proyecto, "out", "index.html"), `home ${seccion.proyecto}`);
      escribir(path.join(tmp, seccion.proyecto, "out", "404.html"), `404 ${seccion.proyecto}`);
    }
    return { secciones: SECCIONES, dirBase: tmp, dirRaiz, dist: path.join(tmp, "dist"), origen: ORIGEN };
  }

  test("genera el árbol completo con dos secciones", () => {
    const opciones = prepararBase();
    escribir(path.join(opciones.dist, "viejo.txt"), "debe desaparecer");
    const resumen = ensamblar({ ...opciones, clienteAdsense: "pub-1234567890123456" });
    const { dist } = opciones;
    assert.deepEqual(resumen, {
      workers: [{ worker: undefined, dir: dist, ficheros: 12 }],
      secciones: 2,
      adsTxt: true,
    });
    assert.ok(!fs.existsSync(path.join(dist, "viejo.txt")));
    for (const relativa of [
      "index.html", "404.html", "estilos.css", "robots.txt", "_headers", "ads.txt",
      "es/multas.html", "es/multas/index.html", "es/multas/404.html",
      "es/impuestos.html", "es/impuestos/index.html", "es/impuestos/404.html",
    ]) {
      assert.ok(fs.existsSync(path.join(dist, relativa)), `falta ${relativa}`);
    }
    assert.match(fs.readFileSync(path.join(dist, "index.html"), "utf8"), /href="\/es\/multas"/);
  });

  test("aplana los __next.* de cada sección copiada", () => {
    const opciones = prepararBase();
    escribir(path.join(tmp, "multas", "out", "radares", "__next.radares", "$d$p", "__PAGE__.txt"), "p");
    ensamblar(opciones);
    assert.ok(fs.existsSync(path.join(opciones.dist, "es", "multas", "radares", "__next.radares.$d$p.__PAGE__.txt")));
    assert.ok(fs.existsSync(path.join(tmp, "multas", "out", "radares", "__next.radares", "$d$p", "__PAGE__.txt")));
  });

  test("si falta el out/ de una sección no vacía dist", () => {
    const opciones = prepararBase();
    escribir(path.join(opciones.dist, "previo.txt"), "debe seguir");
    fs.rmSync(path.join(tmp, "impuestos", "out", "index.html"));
    assert.throws(() => ensamblar(opciones), /compila la sección/);
    assert.ok(fs.existsSync(path.join(opciones.dist, "previo.txt")));
  });

  test("rechaza rutas de sección con segmentos ..", () => {
    const opciones = prepararBase();
    const secciones = [{ ...SECCIONES[0], ruta: "/es/../fuera" }];
    assert.throws(() => ensamblar({ ...opciones, secciones }), /"ruta"/);
  });

  test("sin cliente de AdSense no genera ads.txt", () => {
    const opciones = prepararBase();
    const resumen = ensamblar(opciones);
    assert.equal(resumen.adsTxt, false);
    assert.ok(!fs.existsSync(path.join(opciones.dist, "ads.txt")));
  });

  test("se niega a vaciar una carpeta que no se llama dist", () => {
    const opciones = prepararBase();
    const otra = path.join(tmp, "otra");
    escribir(path.join(otra, "importante.txt"), "no tocar");
    assert.throws(() => ensamblar({ ...opciones, dist: otra }), /Me niego a vaciar/);
    assert.ok(fs.existsSync(path.join(otra, "importante.txt")));
  });

  test("se niega a vaciar un dist fuera de dirBase", () => {
    const opciones = prepararBase();
    const fuera = fs.mkdtempSync(path.join(os.tmpdir(), "ododex-fuera-"));
    try {
      const distFuera = path.join(fuera, "dist");
      escribir(path.join(distFuera, "importante.txt"), "no tocar");
      assert.throws(() => ensamblar({ ...opciones, dist: distFuera }), /Me niego a vaciar/);
      assert.ok(fs.existsSync(path.join(distFuera, "importante.txt")));
    } finally {
      fs.rmSync(fuera, { recursive: true, force: true });
    }
  });
});

describe("dirSalidaDeWorker", () => {
  test("el principal usa dist y los demás dist-<sufijo>", () => {
    assert.equal(dirSalidaDeWorker(undefined), "dist");
    assert.equal(dirSalidaDeWorker("ododex-gasolineras"), "dist-gasolineras");
  });
});

describe("quitarRscDePaginas", () => {
  function crearSeccion() {
    const dir = path.join(tmp, "seccion");
    escribir(path.join(dir, "gasolinera", "a.html"), "a");
    escribir(path.join(dir, "gasolinera", "a.txt"), "rsc");
    escribir(path.join(dir, "gasolinera", "a", "__next.gasolinera.a.__PAGE__.txt"), "rsc");
    escribir(path.join(dir, "provincia", "madrid.html"), "provincia");
    escribir(path.join(dir, "provincia", "madrid.txt"), "rsc provincia");
    escribir(path.join(dir, "provincia", "madrid", "getafe.html"), "municipio");
    escribir(path.join(dir, "provincia", "madrid", "getafe.txt"), "rsc municipio");
    escribir(path.join(dir, "provincia", "madrid", "getafe", "__next.x.txt"), "rsc");
    return dir;
  }

  test("quita el RSC de las páginas que cumplen el patrón con *", () => {
    const dir = crearSeccion();
    assert.equal(quitarRscDePaginas(dir, ["gasolinera/*", "provincia/*/*"]), 2);
    assert.ok(fs.existsSync(path.join(dir, "gasolinera", "a.html")));
    assert.ok(!fs.existsSync(path.join(dir, "gasolinera", "a.txt")));
    assert.ok(!fs.existsSync(path.join(dir, "gasolinera", "a")));
    assert.ok(fs.existsSync(path.join(dir, "provincia", "madrid", "getafe.html")));
    assert.ok(!fs.existsSync(path.join(dir, "provincia", "madrid", "getafe.txt")));
    assert.ok(!fs.existsSync(path.join(dir, "provincia", "madrid", "getafe")));
  });

  test("no toca la página de provincia", () => {
    const dir = crearSeccion();
    quitarRscDePaginas(dir, ["gasolinera/*", "provincia/*/*"]);
    assert.ok(fs.existsSync(path.join(dir, "provincia", "madrid.html")));
    assert.ok(fs.existsSync(path.join(dir, "provincia", "madrid.txt")));
    assert.ok(fs.existsSync(path.join(dir, "provincia", "madrid")));
  });

  test("lanza Error si el directorio tiene contenido real", () => {
    const dir = crearSeccion();
    escribir(path.join(dir, "gasolinera", "a", "otra.html"), "real");
    assert.throws(() => quitarRscDePaginas(dir, ["gasolinera/*"]), /otra\.html/);
    assert.ok(fs.existsSync(path.join(dir, "gasolinera", "a", "otra.html")));
  });
});

describe("leerProduccion", () => {
  function escribirProduccion(valor) {
    const fichero = path.join(tmp, "produccion.json");
    fs.writeFileSync(fichero, JSON.stringify(valor));
    return fichero;
  }

  test("sin variables de entorno usa el fichero", () => {
    const fichero = escribirProduccion({ origen: "https://ododex.com/", clienteAdsense: "", unidadAdsense: "" });
    assert.deepEqual(leerProduccion(fichero, {}), { origen: "https://ododex.com", clienteAdsense: "", unidadAdsense: "" });
  });

  test("las variables de entorno tienen prioridad", () => {
    const fichero = escribirProduccion({ origen: "https://ododex.com", clienteAdsense: "", unidadAdsense: "1111111111" });
    const entorno = { SITE_ORIGIN: "http://localhost:3000", ADSENSE_CLIENT: "pub-1234567890123456", ADSENSE_SLOT: "2222222222" };
    assert.deepEqual(leerProduccion(fichero, entorno), {
      origen: "http://localhost:3000",
      clienteAdsense: "pub-1234567890123456",
      unidadAdsense: "2222222222",
    });
  });

  test("las variables vacías no pisan el fichero", () => {
    const fichero = escribirProduccion({ origen: "https://ododex.com", clienteAdsense: "pub-1111111111111111", unidadAdsense: "3333333333" });
    const resultado = leerProduccion(fichero, { SITE_ORIGIN: "", ADSENSE_CLIENT: "", ADSENSE_SLOT: "" });
    assert.equal(resultado.clienteAdsense, "pub-1111111111111111");
    assert.equal(resultado.unidadAdsense, "3333333333");
  });

  test("lanza Error si la unidad (fichero o entorno) no tiene 10 dígitos", () => {
    const malaEnFichero = escribirProduccion({ origen: "https://ododex.com", clienteAdsense: "", unidadAdsense: "123" });
    assert.throws(() => leerProduccion(malaEnFichero, {}), /Unidad de AdSense no válida.*data-ad-slot/);
    const vacia = escribirProduccion({ origen: "https://ododex.com", clienteAdsense: "", unidadAdsense: "" });
    assert.throws(() => leerProduccion(vacia, { ADSENSE_SLOT: "12345678901" }), /Unidad de AdSense no válida/);
  });

  test("lanza Error si falta unidadAdsense", () => {
    const fichero = escribirProduccion({ origen: "https://ododex.com", clienteAdsense: "" });
    assert.throws(() => leerProduccion(fichero, {}), /unidadAdsense/);
  });

  test("lanza Error si falta un campo", () => {
    const fichero = escribirProduccion({ origen: "https://ododex.com" });
    assert.throws(() => leerProduccion(fichero, {}), /clienteAdsense/);
  });
});

describe("leerOpcionSolo", () => {
  test("devuelve la ruta, undefined sin la opción y error sin valor", () => {
    assert.equal(leerOpcionSolo(["node", "x", "--solo", "/es/a"]), "/es/a");
    assert.equal(leerOpcionSolo(["node", "x"]), undefined);
    assert.throws(() => leerOpcionSolo(["node", "x", "--solo"]), /--solo/);
  });
});

describe("leerSecciones con worker y paginasSoloHtml", () => {
  const base = { ruta: "/es/g", proyecto: "g", nombre: "G", descripcion: "D" };

  test("acepta valores válidos", () => {
    const fichero = escribirConfig([{ ...base, worker: "ododex-g", paginasSoloHtml: ["a/*", "b/*/*"] }]);
    assert.equal(leerSecciones(fichero)[0].worker, "ododex-g");
  });

  for (const [descripcion, extra, mensaje] of [
    ["worker sin prefijo", { worker: "g" }, /worker/],
    ["worker que no es texto", { worker: 3 }, /worker/],
    ["paginasSoloHtml que no es array", { paginasSoloHtml: "a/*" }, /paginasSoloHtml/],
    ["patrón con mayúsculas", { paginasSoloHtml: ["A/*"] }, /paginasSoloHtml/],
    ["patrón con comodín parcial", { paginasSoloHtml: ["a*/b"] }, /paginasSoloHtml/],
    ["patrón que no es texto", { paginasSoloHtml: [1] }, /paginasSoloHtml/],
  ]) {
    test(`rechaza ${descripcion}`, () => {
      assert.throws(() => leerSecciones(escribirConfig([{ ...base, ...extra }])), mensaje);
    });
  }
});

describe("ensamblar con varios Workers", () => {
  const SECCION_PROPIA = {
    ruta: "/es/gas",
    proyecto: "gas",
    nombre: "Gas",
    descripcion: "Desc gas",
    worker: "ododex-gas",
    paginasSoloHtml: ["gasolinera/*"],
  };
  const TODAS = [...SECCIONES, SECCION_PROPIA];
  const BYTES_SOBRE_LIMITE = 26 * 1024 * 1024;

  function prepararVarios() {
    const dirRaiz = path.join(tmp, "raiz");
    escribir(path.join(dirRaiz, "index.html"), PLANTILLA);
    escribir(path.join(dirRaiz, "404.html"), "404 raiz");
    for (const seccion of TODAS) {
      escribir(path.join(tmp, seccion.proyecto, "out", "index.html"), `home ${seccion.proyecto}`);
      escribir(path.join(tmp, seccion.proyecto, "out", "404.html"), `404 ${seccion.proyecto}`);
    }
    escribir(path.join(tmp, "gas", "out", "gasolinera", "x.html"), "x");
    escribir(path.join(tmp, "gas", "out", "gasolinera", "x.txt"), "rsc");
    escribir(path.join(tmp, "gas", "out", "gasolinera", "x", "__next.gasolinera.x.txt"), "rsc");
    return { secciones: TODAS, dirBase: tmp, dirRaiz, dist: path.join(tmp, "dist"), origen: ORIGEN };
  }

  test("genera una carpeta por Worker y robots.txt con los tres sitemaps", () => {
    const opciones = prepararVarios();
    const resumen = ensamblar(opciones);
    const dirGas = path.join(tmp, "dist-gas");
    assert.deepEqual(resumen.workers.map((w) => w.dir), [opciones.dist, dirGas]);
    assert.equal(resumen.secciones, 3);
    assert.ok(fs.existsSync(path.join(dirGas, "es", "gas.html")));
    assert.ok(fs.existsSync(path.join(dirGas, "es", "gas", "404.html")));
    assert.ok(fs.existsSync(path.join(dirGas, "es", "gas", "gasolinera", "x.html")));
    assert.ok(!fs.existsSync(path.join(dirGas, "es", "gas", "gasolinera", "x.txt")));
    assert.ok(!fs.existsSync(path.join(dirGas, "es", "gas", "gasolinera", "x")));
    assert.ok(!fs.existsSync(path.join(dirGas, "index.html")));
    assert.ok(!fs.existsSync(path.join(dirGas, "robots.txt")));
    assert.match(fs.readFileSync(path.join(dirGas, "_headers"), "utf8"), /\/es\/gas\/_next\/static\/\*/);
    assert.ok(!fs.existsSync(path.join(opciones.dist, "es", "gas")));
    const robots = fs.readFileSync(path.join(opciones.dist, "robots.txt"), "utf8");
    for (const ruta of ["/es/multas", "/es/impuestos", "/es/gas"]) {
      assert.ok(robots.includes(`Sitemap: ${ORIGEN}${ruta}/sitemap.xml`), ruta);
    }
    assert.match(fs.readFileSync(path.join(opciones.dist, "index.html"), "utf8"), /href="\/es\/gas"/);
  });

  test("solo con un Worker propio no toca dist", () => {
    const opciones = prepararVarios();
    ensamblar(opciones);
    escribir(path.join(opciones.dist, "marca.txt"), "intacto");
    escribir(path.join(tmp, "dist-gas", "viejo.txt"), "debe desaparecer");
    const resumen = ensamblar({ ...opciones, solo: "/es/gas" });
    assert.equal(resumen.workers.length, 1);
    assert.equal(resumen.secciones, 1);
    assert.equal(resumen.adsTxt, false);
    assert.ok(fs.existsSync(path.join(opciones.dist, "marca.txt")));
    assert.ok(!fs.existsSync(path.join(tmp, "dist-gas", "viejo.txt")));
  });

  test("solo con una sección del Worker principal regenera dist y no el otro", () => {
    const opciones = prepararVarios();
    ensamblar(opciones);
    escribir(path.join(tmp, "dist-gas", "marca.txt"), "intacto");
    escribir(path.join(opciones.dist, "viejo.txt"), "debe desaparecer");
    ensamblar({ ...opciones, solo: "/es/multas" });
    assert.ok(fs.existsSync(path.join(tmp, "dist-gas", "marca.txt")));
    assert.ok(!fs.existsSync(path.join(opciones.dist, "viejo.txt")));
    assert.ok(fs.existsSync(path.join(opciones.dist, "es", "impuestos", "index.html")));
  });

  test("solo con una ruta desconocida da error", () => {
    assert.throws(() => ensamblar({ ...prepararVarios(), solo: "/es/nada" }), /\/es\/nada/);
  });

  test("sin compilar la sección propia da un error que dice cuál y no vacía nada", () => {
    const opciones = prepararVarios();
    escribir(path.join(opciones.dist, "previo.txt"), "debe seguir");
    fs.rmSync(path.join(tmp, "gas", "out", "index.html"));
    assert.throws(() => ensamblar(opciones), /Falta compilar \/es\/gas/);
    assert.ok(fs.existsSync(path.join(opciones.dist, "previo.txt")));
  });

  test("comprueba los límites de cada carpeta", () => {
    const opciones = prepararVarios();
    escribir(path.join(tmp, "gas", "out", "grande.bin"), "x".repeat(BYTES_SOBRE_LIMITE));
    assert.throws(() => ensamblar(opciones), /grande\.bin/);
  });
});

describe("leerSecciones con entorno, exportacion, scriptBuild y enPortada", () => {
  const base = { ruta: "/es/r", proyecto: "r", nombre: "R", descripcion: "D" };

  test("acepta valores válidos", () => {
    const extra = { entorno: { RECALLS_LANG: "es", _X1: "" }, exportacion: "out-es", scriptBuild: "build:es", enPortada: false };
    const seccion = leerSecciones(escribirConfig([{ ...base, ...extra }]))[0];
    assert.equal(seccion.exportacion, "out-es");
    assert.equal(seccion.enPortada, false);
  });

  for (const [descripcion, extra, mensaje] of [
    ["entorno que no es objeto", { entorno: "A=1" }, /entorno/],
    ["entorno que es un array", { entorno: ["A"] }, /entorno/],
    ["clave de entorno en minúsculas", { entorno: { lang: "es" } }, /lang/],
    ["valor de entorno con espacio", { entorno: { LANG_X: "a b" } }, /LANG_X/],
    ["valor de entorno con carácter de shell", { entorno: { LANG_X: "a;b" } }, /LANG_X/],
    ["valor de entorno que no es texto", { entorno: { LANG_X: 1 } }, /LANG_X/],
    ["exportacion con mayúsculas", { exportacion: "Out" }, /exportacion/],
    ["exportacion con barra", { exportacion: "a/b" }, /exportacion/],
    ["scriptBuild con espacio", { scriptBuild: "build es" }, /scriptBuild/],
    ["scriptBuild que no es texto", { scriptBuild: 3 }, /scriptBuild/],
    ["enPortada que no es booleano", { enPortada: "no" }, /enPortada/],
  ]) {
    test(`rechaza ${descripcion}`, () => {
      assert.throws(() => leerSecciones(escribirConfig([{ ...base, ...extra }])), mensaje);
    });
  }
});

describe("comandoCompilacion y dirExportacionDeSeccion", () => {
  test("usa build y out por defecto", () => {
    assert.equal(comandoCompilacion(SECCIONES[0]), "npm run build");
    assert.equal(dirExportacionDeSeccion(SECCIONES[0]), "out");
  });

  test("usa scriptBuild y exportacion si se indican", () => {
    const seccion = { ...SECCIONES[0], scriptBuild: "build:en", exportacion: "out-en" };
    assert.equal(comandoCompilacion(seccion), "npm run build:en");
    assert.equal(dirExportacionDeSeccion(seccion), "out-en");
  });
});

describe("secciones fuera de portada y del mismo proyecto", () => {
  const ES = {
    ruta: "/es/rec", proyecto: "rec", nombre: "Revisiones", descripcion: "Desc es",
    worker: "ododex-rec-es", exportacion: "out-es", scriptBuild: "build:es",
  };
  const EN = {
    ruta: "/en/rec", proyecto: "rec", nombre: "Recalls", descripcion: "Desc en",
    worker: "ododex-rec-en", exportacion: "out-en", scriptBuild: "build:en", enPortada: false,
  };
  const TODAS = [...SECCIONES, ES, EN];

  function prepararMismoProyecto() {
    const dirRaiz = path.join(tmp, "raiz");
    escribir(path.join(dirRaiz, "index.html"), PLANTILLA);
    for (const seccion of SECCIONES) {
      escribir(path.join(tmp, seccion.proyecto, "out", "index.html"), seccion.proyecto);
    }
    escribir(path.join(tmp, "rec", "out-es", "index.html"), "pagina es");
    escribir(path.join(tmp, "rec", "out-en", "index.html"), "pagina en");
    escribir(path.join(tmp, "rec", "out-en", "solo-en.html"), "x");
    return { secciones: TODAS, dirBase: tmp, dirRaiz, dist: path.join(tmp, "dist"), origen: ORIGEN };
  }

  test("la portada omite las secciones con enPortada false", () => {
    const portada = generarPortada(PLANTILLA, TODAS, ORIGEN);
    assert.ok(portada.includes('href="/es/rec"'));
    assert.ok(!portada.includes("/en/rec"));
  });

  test("robots.txt lista todas las secciones", () => {
    const robots = textoRobots(ORIGEN, TODAS);
    assert.ok(robots.includes(`Sitemap: ${ORIGEN}/en/rec/sitemap.xml`));
    assert.ok(robots.includes(`Sitemap: ${ORIGEN}/es/rec/sitemap.xml`));
  });

  test("ensambla cada idioma desde su carpeta de exportación en su Worker", () => {
    const opciones = prepararMismoProyecto();
    ensamblar(opciones);
    assert.equal(fs.readFileSync(path.join(tmp, "dist-rec-es", "es", "rec", "index.html"), "utf8"), "pagina es");
    assert.equal(fs.readFileSync(path.join(tmp, "dist-rec-en", "en", "rec", "index.html"), "utf8"), "pagina en");
    assert.ok(fs.existsSync(path.join(tmp, "dist-rec-en", "en", "rec", "solo-en.html")));
    assert.ok(!fs.existsSync(path.join(tmp, "dist-rec-es", "es", "rec", "solo-en.html")));
    const portada = fs.readFileSync(path.join(opciones.dist, "index.html"), "utf8");
    assert.ok(!portada.includes("/en/rec"));
    assert.ok(fs.readFileSync(path.join(opciones.dist, "robots.txt"), "utf8").includes("/en/rec/sitemap.xml"));
  });

  test("el error de sección sin compilar nombra su carpeta y su comando", () => {
    const opciones = prepararMismoProyecto();
    fs.rmSync(path.join(tmp, "rec", "out-en", "index.html"));
    assert.throws(() => ensamblar(opciones), /Falta compilar \/en\/rec.*out-en.*npm run build:en/);
  });
});

describe("insertarAdsense", () => {
  const HTML = "<head><!-- ADSENSE --></head>";

  test("pone el script de AdSense con el cliente ca-pub", () => {
    const html = insertarAdsense(HTML, "ca-pub-1234567890123456");
    assert.match(html, /adsbygoogle\.js\?client=ca-pub-1234567890123456" crossorigin="anonymous"><\/script>/);
    assert.doesNotMatch(html, /<!-- ADSENSE -->/);
  });

  test("acepta el formato pub- y lo convierte a ca-pub-", () => {
    assert.match(insertarAdsense(HTML, "pub-1234567890123456"), /client=ca-pub-1234567890123456/);
  });

  test("sin cliente quita el marcador y no añade nada", () => {
    assert.equal(insertarAdsense(HTML, ""), "<head></head>");
    assert.equal(insertarAdsense(HTML, undefined), "<head></head>");
  });

  test("con un cliente inválido lanza error", () => {
    assert.throws(() => insertarAdsense(HTML, "ca-pub-123"), /no válido/);
  });
});
