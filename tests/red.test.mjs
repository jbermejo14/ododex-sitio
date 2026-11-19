import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generarRed, leerRutasDeSeccion } from "../scripts/generar-red.mjs";
import {
  EMPAREJAMIENTOS_RECHAZADOS,
  PATRON_TITULO_GASOLINERAS,
  PATRON_TITULO_RECARGA,
  emparejarDetallado,
  nombreDeTitulo,
  NOMBRES_PROVINCIA,
  SECCION_ELECTRICO,
  SECCION_GASOLINERAS,
  SECCION_ITV,
  SECCION_MULTAS,
  SECCION_RECARGA,
  SECCION_ZBE,
  claveLugar,
  clavesCompatibles,
  emparejar,
  extraerRutasSitemap,
  generarEnlaces,
  nombreLugar,
} from "../lib/red.mjs";

describe("claveLugar", () => {
  test("quita artículos y conectores", () => {
    assert.equal(claveLugar("rozas-de-madrid-las"), "madrid rozas");
  });
  test("ordena palabras y elimina repetidas", () => {
    assert.equal(claveLugar("valencia-valencia"), "valencia");
    assert.equal(claveLugar("coruna-a"), claveLugar("a-coruna"));
    assert.equal(claveLugar("rioja-la"), claveLugar("la-rioja"));
  });
});

describe("clavesCompatibles", () => {
  test("iguales y contención en ambos sentidos", () => {
    assert.ok(clavesCompatibles("alicante", "alicante"));
    assert.ok(clavesCompatibles("alicante", "alacant alicante"));
    assert.ok(clavesCompatibles("alacant alicante", "alicante"));
    assert.ok(!clavesCompatibles("alicante", "avila"));
  });
  test("una clave vacía nunca es compatible", () => {
    assert.ok(!clavesCompatibles("", ""));
    assert.ok(!clavesCompatibles("", "madrid"));
  });
});

describe("emparejar", () => {
  test("empareja por clave igual", () => {
    const pares = emparejar(["coruna-a", "lugo"], ["lugo", "a-coruna"]);
    assert.equal(pares.get("coruna-a"), "a-coruna");
    assert.equal(pares.get("lugo"), "lugo");
  });
  test("empareja por contención si es única y lo separa de la clave igual", () => {
    const { iguales, contencion } = emparejarDetallado(["castellon-castello", "lugo"], ["castellon", "lugo"]);
    assert.equal(contencion.get("castellon-castello"), "castellon");
    assert.equal(iguales.get("lugo"), "lugo");
    assert.equal(iguales.size, 1);
  });
  test("un par rechazado no se empareja (buenache-de-alarcon / alarcon)", () => {
    assert.equal(emparejar(["buenache-de-alarcon"], ["alarcon"]).get("buenache-de-alarcon"), "alarcon");
    const pares = emparejar(["buenache-de-alarcon"], ["alarcon"], new Set(["buenache-de-alarcon|alarcon"]));
    assert.equal(pares.size, 0);
    assert.ok(EMPAREJAMIENTOS_RECHAZADOS.includes("cuenca/buenache-de-alarcon|alarcon"));
  });
  test("el slug idéntico gana a una clave igual que colisiona", () => {
    const pares = emparejar(["mora-de-rubielos", "rubielos-de-mora"], ["rubielos-de-mora"]);
    assert.equal(pares.get("rubielos-de-mora"), "rubielos-de-mora");
    assert.equal(pares.has("mora-de-rubielos"), false);
  });
  test("clave igual con colisión y sin slug idéntico no se empareja", () => {
    assert.equal(emparejar(["mora-de-rubielos", "rubielos-de-mora"], ["mora-rubielos-de"]).size, 0);
  });
  test("clave vacía municipal (les): solo por slug idéntico", () => {
    assert.equal(emparejar(["les"], ["les"]).get("les"), "les");
    assert.equal(emparejar(["les"], ["lles-de-cerdanya"]).size, 0);
    assert.equal(emparejar(["les"], ["las"]).size, 0);
  });
  test("la ambigüedad deja sin pareja", () => {
    const pares = emparejar(["san-juan"], ["san-juan-norte", "san-juan-sur"]);
    assert.equal(pares.size, 0);
  });
  test("lo ya emparejado por clave igual no compite en la contención", () => {
    const pares = emparejar(["santa-cruz", "santa-cruz-norte"], ["santa-cruz", "santa-cruz-norte"]);
    assert.equal(pares.get("santa-cruz"), "santa-cruz");
    assert.equal(pares.get("santa-cruz-norte"), "santa-cruz-norte");
  });
});

describe("nombreLugar", () => {
  test("provincias de la tabla", () => {
    assert.equal(nombreLugar("coruna-a", "provincia"), "A Coruña");
    assert.equal(nombreLugar("balears-illes", "provincia"), "Islas Baleares");
    assert.equal(Object.keys(NOMBRES_PROVINCIA).length, 52);
  });
  test("provincia desconocida lanza error", () => {
    assert.throws(() => nombreLugar("narnia", "provincia"), /NOMBRES_PROVINCIA/);
  });
  test("municipios: mayúsculas y artículo final al principio", () => {
    assert.equal(nombreLugar("rozas-de-madrid-las", "municipio"), "Las Rozas de Madrid");
    assert.equal(nombreLugar("alcobendas", "municipio"), "Alcobendas");
    assert.equal(nombreLugar("hospitalet-de-llobregat-l", "municipio"), "l'Hospitalet de Llobregat");
  });
  test("apóstrofo en el respaldo por slug", () => {
    assert.equal(nombreLugar("sant-joan-d-alacant", "municipio"), "Sant Joan d'Alacant");
  });
  test("usa el nombre compilado y mueve el artículo final al principio", () => {
    assert.equal(nombreLugar("x", "municipio", "Rozas de Madrid (Las)"), "Las Rozas de Madrid");
    assert.equal(nombreLugar("x", "municipio", "Borges Blanques, Les"), "Les Borges Blanques");
    assert.equal(nombreLugar("x", "municipio", "Hospitalet de Llobregat, L'"), "L'Hospitalet de Llobregat");
    assert.equal(nombreLugar("x", "municipio", "Alcobendas"), "Alcobendas");
  });
  test("tipo desconocido lanza error", () => {
    assert.throws(() => nombreLugar("madrid", "barrio"), /desconocido/);
  });
});

describe("nombreDeTitulo", () => {
  test("gasolineras: decodifica entidades", () => {
    const html = "<head><title>Gasolineras más baratas en Sant Joan d&#x27;Alacant hoy (Alicante) | Precios MITECO | Ododex</title>";
    assert.equal(nombreDeTitulo(html, PATRON_TITULO_GASOLINERAS), "Sant Joan d'Alacant");
  });
  test("recarga y título no reconocido", () => {
    assert.equal(nombreDeTitulo("<title>Puntos de Recarga en Castelló (1 Estaciones) | Valencia | Ododex</title>", PATRON_TITULO_RECARGA), "Castelló");
    assert.equal(nombreDeTitulo("<title>Otra cosa</title>", PATRON_TITULO_RECARGA), undefined);
    assert.equal(nombreDeTitulo("<html></html>", PATRON_TITULO_RECARGA), undefined);
  });
});

describe("extraerRutasSitemap", () => {
  test("un <loc> inválido lanza error con el valor", () => {
    assert.throws(() => extraerRutasSitemap("<url><loc>no es url</loc></url>"), /no es url/);
  });
  test("devuelve rutas sin dominio ni barra final", () => {
    const xml = "<urlset><url><loc>https://ododex.com/es/itv/centros/madrid/</loc></url><url><loc>https://ododex.com/es/itv</loc></url></urlset>";
    assert.deepEqual(extraerRutasSitemap(xml), ["/es/itv/centros/madrid", "/es/itv"]);
  });
});

function rutasDePrueba() {
  return {
    [SECCION_GASOLINERAS]: [
      "/es/gasolineras/provincia/madrid",
      "/es/gasolineras/provincia/madrid/alcobendas",
      "/es/gasolineras/provincia/madrid/rozas-de-madrid-las",
      "/es/gasolineras/provincia/madrid/sin-recarga",
      "/es/gasolineras/provincia/coruna-a",
    ],
    [SECCION_RECARGA]: [
      "/es/puntos-recarga/provincia/madrid",
      "/es/puntos-recarga/provincia/madrid/alcobendas",
      "/es/puntos-recarga/provincia/madrid/las-rozas-de-madrid",
    ],
    [SECCION_ITV]: ["/es/itv/centros/madrid", "/es/itv/centros/a-coruna"],
    [SECCION_MULTAS]: ["/es/multas/radares/madrid"],
    [SECCION_ELECTRICO]: ["/es/electrico-vs-gasolina/madrid"],
    [SECCION_ZBE]: ["/es/zbe/madrid", "/es/zbe/alcobendas", "/es/zbe/ciudades"],
  };
}

const ENLACES_ZBE = {
  madrid: { fuel: "madrid/madrid", charging: "madrid/madrid" },
  alcobendas: { fuel: "madrid/alcobendas", charging: "madrid/alcobendas" },
};

describe("generarEnlaces", () => {
  test("provincia de gasolineras: orden fijo y solo destinos existentes", () => {
    const { enlaces } = generarEnlaces({ rutas: rutasDePrueba(), enlacesZbe: ENLACES_ZBE });
    const secciones = enlaces["/es/gasolineras/provincia/madrid"].map((e) => e.seccion);
    assert.deepEqual(secciones, [SECCION_RECARGA, SECCION_ELECTRICO, SECCION_ITV, SECCION_MULTAS]);
    assert.equal(enlaces["/es/gasolineras/provincia/madrid"][0].texto, "Puntos de recarga en Madrid");
    assert.deepEqual(enlaces["/es/gasolineras/provincia/coruna-a"].map((e) => e.seccion), [SECCION_ITV]);
  });
  test("radares: gasolineras, ITV y recarga; sin autoenlace", () => {
    const { enlaces } = generarEnlaces({ rutas: rutasDePrueba() });
    const lista = enlaces["/es/multas/radares/madrid"];
    assert.deepEqual(lista.map((e) => e.seccion), [SECCION_GASOLINERAS, SECCION_ITV, SECCION_RECARGA]);
    for (const [clave, destinos] of Object.entries(enlaces)) {
      assert.ok(destinos.every((destino) => destino.href !== clave), `autoenlace en ${clave}`);
    }
  });
  test("municipio con ZBE: recarga, ZBE e ITV en ese orden", () => {
    const { enlaces } = generarEnlaces({ rutas: rutasDePrueba(), enlacesZbe: ENLACES_ZBE });
    const lista = enlaces["/es/gasolineras/provincia/madrid/alcobendas"];
    assert.deepEqual(lista.map((e) => e.href), ["/es/puntos-recarga/provincia/madrid/alcobendas", "/es/zbe/alcobendas", "/es/itv/centros/madrid"]);
    assert.equal(lista[1].texto, "Zona de bajas emisiones de Alcobendas");
    const inversa = enlaces["/es/puntos-recarga/provincia/madrid/alcobendas"];
    assert.equal(inversa[0].href, "/es/gasolineras/provincia/madrid/alcobendas");
  });
  test("municipio emparejado por contención y municipio sin recarga", () => {
    const { enlaces, informe } = generarEnlaces({ rutas: rutasDePrueba() });
    assert.equal(enlaces["/es/gasolineras/provincia/madrid/rozas-de-madrid-las"][0].href, "/es/puntos-recarga/provincia/madrid/las-rozas-de-madrid");
    assert.deepEqual(enlaces["/es/gasolineras/provincia/madrid/sin-recarga"].map((e) => e.seccion), [SECCION_ITV]);
    assert.equal(informe.municipiosIguales, 2);
  });
  test("sin datos de ZBE no hay enlaces ZBE", () => {
    const { enlaces, informe } = generarEnlaces({ rutas: rutasDePrueba() });
    const todos = Object.values(enlaces).flat();
    assert.ok(todos.every((e) => e.seccion !== SECCION_ZBE));
    assert.equal(informe.ciudadesZbeEnlazadas, 0);
  });
  test("una ciudad ZBE sin página en su sitemap no se enlaza", () => {
    const rutas = { ...rutasDePrueba(), [SECCION_ZBE]: ["/es/zbe/madrid"] };
    const { enlaces } = generarEnlaces({ rutas, enlacesZbe: ENLACES_ZBE });
    const lista = enlaces["/es/gasolineras/provincia/madrid/alcobendas"];
    assert.ok(lista.every((e) => e.seccion !== SECCION_ZBE));
  });
});

describe("generarEnlaces con nombres compilados", () => {
  test("el texto usa el nombre del destino", () => {
    const nombres = {
      "/es/gasolineras/provincia/madrid/rozas-de-madrid-las": "Rozas de Madrid (Las)",
      "/es/puntos-recarga/provincia/madrid/las-rozas-de-madrid": "Rozas de Madrid, Las",
    };
    const rutas = rutasDePrueba();
    const { enlaces } = generarEnlaces({ rutas, nombres });
    assert.equal(enlaces["/es/gasolineras/provincia/madrid/rozas-de-madrid-las"][0].texto, "Puntos de recarga en Las Rozas de Madrid");
    assert.equal(enlaces["/es/puntos-recarga/provincia/madrid/las-rozas-de-madrid"][0].texto, "Gasolineras en Las Rozas de Madrid");
  });
  test("un par rechazado de la provincia no genera enlace de recarga", () => {
    const rutas = {
      ...rutasDePrueba(),
      [SECCION_GASOLINERAS]: ["/es/gasolineras/provincia/cuenca", "/es/gasolineras/provincia/cuenca/buenache-de-alarcon"],
      [SECCION_RECARGA]: ["/es/puntos-recarga/provincia/cuenca", "/es/puntos-recarga/provincia/cuenca/alarcon"],
      [SECCION_ITV]: [],
    };
    const { enlaces } = generarEnlaces({ rutas });
    assert.equal(enlaces["/es/gasolineras/provincia/cuenca/buenache-de-alarcon"], undefined);
  });
});

function escribirFichero(base, ruta, contenido) {
  const fichero = path.join(base, ruta);
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  fs.writeFileSync(fichero, contenido);
}

function sitemap(...rutas) {
  return `<urlset>${rutas.map((ruta) => `<url><loc>https://ododex.com${ruta}</loc></url>`).join("")}</urlset>`;
}

function crearProyectoDePrueba(base) {
  const secciones = [
    { ruta: SECCION_GASOLINERAS, proyecto: "../g", nombre: "Gasolineras", descripcion: "d", worker: "ododex-gasolineras" },
    { ruta: SECCION_RECARGA, proyecto: "../r", nombre: "Recarga", descripcion: "d", worker: "ododex-recarga" },
    { ruta: SECCION_ITV, proyecto: "../i", nombre: "ITV", descripcion: "d" },
    { ruta: SECCION_MULTAS, proyecto: "../m", nombre: "Multas", descripcion: "d" },
    { ruta: SECCION_ELECTRICO, proyecto: "../e", nombre: "Eléctrico", descripcion: "d" },
    { ruta: SECCION_ZBE, proyecto: "../z", nombre: "ZBE", descripcion: "d" },
  ];
  escribirFichero(base, "config/secciones.json", JSON.stringify(secciones));
  escribirFichero(base, "dist-gasolineras/es/gasolineras/sitemap.xml", sitemap("/es/gasolineras/provincia/madrid", "/es/gasolineras/provincia/madrid/alcobendas"));
  escribirFichero(base, "dist-gasolineras/es/gasolineras/provincia/madrid/alcobendas.html", "<title>Gasolineras más baratas en Alcobendas hoy (Madrid) | x</title>");
  escribirFichero(base, "dist-recarga/es/puntos-recarga/sitemap.xml", sitemap("/es/puntos-recarga/provincia/madrid", "/es/puntos-recarga/provincia/madrid/alcobendas"));
  escribirFichero(base, "dist-recarga/es/puntos-recarga/provincia/madrid/alcobendas.html", "<title>Puntos de Recarga en Alcobendas (5 Estaciones) | Madrid | x</title>");
  escribirFichero(base, "dist/es/itv/sitemap.xml", sitemap("/es/itv/centros/madrid"));
}

describe("scripts/generar-red", () => {
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "red-"));
  crearProyectoDePrueba(temporal);
  const opciones = { dirBase: temporal, ficheroZbe: path.join(temporal, "no-existe.json"), ficheroSalida: path.join(temporal, "red.json") };

  test("leerRutasDeSeccion lee el sitemap del Worker de la sección", () => {
    const rutas = leerRutasDeSeccion(temporal, { ruta: SECCION_GASOLINERAS, worker: "ododex-gasolineras" });
    assert.ok(rutas.includes("/es/gasolineras/provincia/madrid/alcobendas"));
  });
  test("falta el sitemap de gasolineras: error", () => {
    assert.throws(() => leerRutasDeSeccion(temporal, { ruta: SECCION_GASOLINERAS, worker: "ododex-otro" }), /compila/);
  });
  test("genera el JSON con los nombres de los títulos y no lo reescribe si no cambia", () => {
    assert.equal(generarRed(opciones).escrito, true);
    const red = JSON.parse(fs.readFileSync(opciones.ficheroSalida, "utf8"));
    assert.equal(red.enlaces["/es/gasolineras/provincia/madrid/alcobendas"][0].texto, "Puntos de recarga en Alcobendas");
    assert.equal(generarRed(opciones).escrito, false);
  });
  test("un municipality-links.json corrupto da error con el nombre del fichero", () => {
    const corrupto = path.join(temporal, "links.json");
    fs.writeFileSync(corrupto, "{no json");
    assert.throws(() => generarRed({ ...opciones, ficheroZbe: corrupto }), /links\.json/);
  });
});
