import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { comprobarSalidaProduccion } from "../lib/ensamblado.mjs";

const CLIENTE = "pub-1234567890123456";
const SCRIPT = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456"></script>`;
const PAGINA_OK = `<html><head>${SCRIPT}</head><body>ok</body></html>`;

let tmp;

function escribir(relativa, contenido) {
  const fichero = path.join(tmp, relativa);
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  fs.writeFileSync(fichero, contenido);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "salida-prod-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("comprobarSalidaProduccion", () => {
  test("una salida correcta devuelve el número de ficheros revisados", () => {
    escribir("index.html", PAGINA_OK);
    escribir("sitemap.xml", "<loc>https://ododex.com/fr/x</loc>");
    escribir("_next/static/app.js", "console.log('http://localhost')");
    assert.deepEqual(comprobarSalidaProduccion(tmp, CLIENTE), { revisados: 3 });
  });

  test("un marcador de plantilla sin sustituir lanza un error que nombra fichero y marcador", () => {
    escribir("index.html", PAGINA_OK);
    escribir("sobre-nosotros.html", `${SCRIPT}<link rel="canonical" href="<!-- ORIGEN -->/sobre-nosotros">`);
    assert.throws(
      () => comprobarSalidaProduccion(tmp, CLIENTE),
      /sobre-nosotros\.html: marcador MARCADOR_ORIGEN sin sustituir/,
    );
  });

  test("una página sin script de AdSense lanza un error que nombra el fichero", () => {
    escribir("index.html", PAGINA_OK);
    escribir("fr/zfe/paris.html", "<html>sin script</html>");
    assert.throws(
      () => comprobarSalidaProduccion(tmp, CLIENTE),
      (error) => /fr\/zfe\/paris\.html/.test(error.message) && /npm run build/.test(error.message) && /1 fichero/.test(error.message),
    );
  });

  test("localhost en un sitemap.xml lanza error", () => {
    escribir("index.html", PAGINA_OK);
    escribir("sitemap.xml", "<loc>http://localhost:3000/fr/zfe</loc>");
    assert.throws(() => comprobarSalidaProduccion(tmp, CLIENTE), /sitemap\.xml/);
  });

  test("detecta 127.0.0.1 y 0.0.0.0 en .txt", () => {
    escribir("a.txt", "http://127.0.0.1:8787");
    escribir("b.txt", "http://0.0.0.0:3000");
    assert.throws(() => comprobarSalidaProduccion(tmp, ""), /2 fichero/);
  });

  test("404.html y _not-found sin script no fallan", () => {
    escribir("index.html", PAGINA_OK);
    escribir("404.html", "<html>404</html>");
    escribir("fr/zfe/404.html", "<html>404</html>");
    escribir("fr/zfe/_not-found.html", "<html>nf</html>");
    escribir("fr/zfe/_not-found/index.html", "<html>nf</html>");
    assert.equal(comprobarSalidaProduccion(tmp, CLIENTE).revisados, 5);
  });

  test("con cliente vacío no exige el script pero sí detecta localhost", () => {
    escribir("index.html", "<html>sin script</html>");
    assert.deepEqual(comprobarSalidaProduccion(tmp, ""), { revisados: 1 });
    escribir("fr/x.html", '<link rel="canonical" href="http://localhost:3000/fr/x">');
    assert.throws(() => comprobarSalidaProduccion(tmp, ""), /fr\/x\.html/);
  });

  test("con más de 5 afectados dice el total y lista solo 5", () => {
    for (let i = 1; i <= 8; i += 1) {
      escribir(`p${i}.html`, "<html>sin script</html>");
    }
    assert.throws(
      () => comprobarSalidaProduccion(tmp, CLIENTE),
      (error) => /8 fichero/.test(error.message) && (error.message.match(/\.html:/g) ?? []).length === 5 && /y 3 más/.test(error.message),
    );
  });

  test("un cliente de AdSense mal escrito lanza error", () => {
    escribir("index.html", PAGINA_OK);
    assert.throws(() => comprobarSalidaProduccion(tmp, "xyz"), /Cliente de AdSense no válido/);
  });
});
