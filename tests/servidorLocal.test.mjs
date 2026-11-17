import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { resolverRuta, tipoMime, crearServidor } from "../lib/servidorLocal.mjs";

let tmp;
let dist;

function escribir(relativa, contenido) {
  const ruta = path.join(dist, relativa);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido);
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ododex-srv-"));
  dist = path.join(tmp, "dist");
  escribir("index.html", "raiz");
  escribir("404.html", "404 raiz");
  escribir("robots.txt", "robots");
  escribir("con espacio.txt", "espacio");
  escribir("es/multas.html", "multas");
  escribir("es/multas/index.html", "multas index");
  escribir("es/multas/radares.html", "radares");
  escribir("es/multas/404.html", "404 multas");
  escribir("es/impuestos/index.html", "impuestos");
  fs.writeFileSync(path.join(tmp, "secreto.txt"), "fuera de dist");
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("resolverRuta", () => {
  test("regla 1: fichero exacto", () => {
    assert.deepEqual(resolverRuta(dist, "/robots.txt"), { fichero: path.join(dist, "robots.txt"), estado: 200 });
  });

  test("regla 2: ruta.html tiene prioridad sobre el directorio", () => {
    assert.equal(resolverRuta(dist, "/es/multas").fichero, path.join(dist, "es", "multas.html"));
    assert.equal(resolverRuta(dist, "/es/multas/radares").fichero, path.join(dist, "es", "multas", "radares.html"));
  });

  test("regla 3: directorio con index.html", () => {
    assert.deepEqual(resolverRuta(dist, "/es/impuestos"), {
      fichero: path.join(dist, "es", "impuestos", "index.html"),
      estado: 200,
    });
    assert.equal(resolverRuta(dist, "/").fichero, path.join(dist, "index.html"));
  });

  test("regla 4: 404.html del directorio más cercano", () => {
    assert.deepEqual(resolverRuta(dist, "/es/multas/no-existe"), {
      fichero: path.join(dist, "es", "multas", "404.html"),
      estado: 404,
    });
    assert.deepEqual(resolverRuta(dist, "/no-existe"), { fichero: path.join(dist, "404.html"), estado: 404 });
    assert.equal(resolverRuta(dist, "/es/impuestos/x").fichero, path.join(dist, "404.html"));
  });

  test("regla 5: sin 404.html devuelve fichero null", () => {
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), "ododex-vacio-"));
    try {
      assert.deepEqual(resolverRuta(vacio, "/nada"), { fichero: null, estado: 404 });
    } finally {
      fs.rmSync(vacio, { recursive: true, force: true });
    }
  });

  test("la barra final equivale a la ruta sin barra", () => {
    assert.equal(resolverRuta(dist, "/es/multas/").fichero, path.join(dist, "es", "multas.html"));
  });

  test("decodifica %20", () => {
    assert.equal(resolverRuta(dist, "/con%20espacio.txt").fichero, path.join(dist, "con espacio.txt"));
  });

  test("rechaza .. que sale de dist", () => {
    assert.equal(resolverRuta(dist, "/../secreto.txt").estado, 404);
    assert.equal(resolverRuta(dist, "/%2e%2e/secreto.txt").estado, 404);
  });

  test("rechaza traversal con barra invertida, byte nulo y ruta absoluta", () => {
    assert.equal(resolverRuta(dist, "/..%5Csecreto.txt").estado, 404);
    assert.equal(resolverRuta(dist, "/a%00").estado, 404);
    assert.equal(resolverRuta(dist, "/a%00").fichero, null);
    const absoluta = resolverRuta(dist, "/C:/Windows/win.ini");
    assert.equal(absoluta.estado, 404);
    assert.notEqual(absoluta.fichero, "C:\Windows\win.ini");
  });

  test("GET / no sale de dist hacia <dist>.html", () => {
    const aislado = fs.mkdtempSync(path.join(os.tmpdir(), "ododex-hermano-"));
    try {
      const distAislado = path.join(aislado, "dist");
      fs.mkdirSync(distAislado);
      fs.writeFileSync(path.join(distAislado, "index.html"), "portada");
      fs.writeFileSync(path.join(aislado, "dist.html"), "hermano");
      assert.equal(resolverRuta(distAislado, "/").fichero, path.join(distAislado, "index.html"));
    } finally {
      fs.rmSync(aislado, { recursive: true, force: true });
    }
  });

  test("una secuencia %xx malformada da 404", () => {
    assert.deepEqual(resolverRuta(dist, "/%E0%A4%A"), { fichero: null, estado: 404 });
  });
});

test("tipoMime", () => {
  assert.equal(tipoMime("a.html"), "text/html; charset=utf-8");
  assert.equal(tipoMime("a.css"), "text/css; charset=utf-8");
  assert.equal(tipoMime("a.js"), "text/javascript; charset=utf-8");
  assert.equal(tipoMime("a.svg"), "image/svg+xml");
  assert.equal(tipoMime("a.woff2"), "font/woff2");
  assert.equal(tipoMime("a.desconocido"), "application/octet-stream");
});

describe("crearServidor", () => {
  let servidor;
  let base;

  before(async () => {
    servidor = crearServidor(dist);
    await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  after(async () => {
    await new Promise((resolver) => servidor.close(resolver));
  });

  test("GET devuelve 200 con el contenido y el tipo", async () => {
    const respuesta = await fetch(`${base}/es/multas/radares`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(await respuesta.text(), "radares");
  });

  test("GET inexistente devuelve 404 con la página más cercana", async () => {
    const respuesta = await fetch(`${base}/es/multas/no-existe`);
    assert.equal(respuesta.status, 404);
    assert.equal(await respuesta.text(), "404 multas");
  });

  test("HEAD devuelve 200 sin cuerpo", async () => {
    const respuesta = await fetch(`${base}/es/multas/radares`, { method: "HEAD" });
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("content-length"), String("radares".length));
    assert.equal(await respuesta.text(), "");
  });

  test("una URL imposible de analizar devuelve 400 y el servidor sigue vivo", async () => {
    const estado = await new Promise((resolver, rechazar) => {
      const peticion = http.request({ host: "127.0.0.1", port: servidor.address().port, path: "//" }, (respuesta) => {
        respuesta.resume();
        resolver(respuesta.statusCode);
      });
      peticion.on("error", rechazar);
      peticion.end();
    });
    assert.equal(estado, 400);
    assert.equal((await fetch(`${base}/robots.txt`)).status, 200);
  });

  test("POST devuelve 405", async () => {
    const respuesta = await fetch(`${base}/`, { method: "POST" });
    assert.equal(respuesta.status, 405);
  });
});

describe("crearServidor con montajes", () => {
  let servidor;
  let base;

  before(async () => {
    const dirMontaje = path.join(tmp, "dist-gas");
    fs.mkdirSync(path.join(dirMontaje, "es", "gas"), { recursive: true });
    fs.writeFileSync(path.join(dirMontaje, "es", "gas.html"), "gas");
    fs.writeFileSync(path.join(dirMontaje, "es", "gas", "404.html"), "404 gas");
    servidor = crearServidor(dist, [{ prefijo: "/es/gas", dir: dirMontaje }]);
    await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  after(async () => {
    await new Promise((resolver) => servidor.close(resolver));
  });

  test("sirve bajo el prefijo desde la carpeta del montaje", async () => {
    const respuesta = await fetch(`${base}/es/gas`);
    assert.equal(respuesta.status, 200);
    assert.equal(await respuesta.text(), "gas");
  });

  test("una ruta inexistente bajo el prefijo da la 404 del montaje", async () => {
    const respuesta = await fetch(`${base}/es/gas/no-existe`);
    assert.equal(respuesta.status, 404);
    assert.equal(await respuesta.text(), "404 gas");
  });

  test("fuera del prefijo sigue sirviendo dist, también con un prefijo parecido", async () => {
    assert.equal(await (await fetch(`${base}/es/multas`)).text(), "multas");
    assert.equal((await fetch(`${base}/es/gasolina`)).status, 404);
  });
});
