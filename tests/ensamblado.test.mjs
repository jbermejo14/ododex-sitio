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
  comprobarLimitesPages,
  ensamblar,
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
    assert.deepEqual(resumen, { ficheros: 12, secciones: 2, adsTxt: true });
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
