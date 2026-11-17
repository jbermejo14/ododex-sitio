import fs from "node:fs";
import path from "node:path";

export const MAX_FICHEROS_PAGES = 20000;
export const MAX_BYTES_FICHERO_PAGES = 25 * 1024 * 1024;
export const MARCADOR_SECCIONES = "<!-- SECCIONES -->";
export const MARCADOR_ORIGEN = "<!-- ORIGEN -->";

const CAMPOS_SECCION = ["ruta", "proyecto", "nombre", "descripcion"];
const PATRON_RUTA = /^(\/[a-z0-9-]+)+$/;
const PATRON_ORIGEN = /^(https:\/\/[^\s/]+|http:\/\/localhost(:\d+)?)\/*$/;
const PATRON_ADSENSE = /^(?:ca-)?pub-(\d{16})$/;
const ADSENSE_ID_CERTIFICACION = "f08c47fec0942fa0";
const NOMBRE_DIR_DIST = "dist";
const BYTES_POR_MIB = 1024 * 1024;

/**
 * @typedef {{ ruta: string, proyecto: string, nombre: string, descripcion: string }} Seccion
 */

function validarSeccion(seccion, indice, ficheroConfig) {
  const donde = `${ficheroConfig}, sección ${indice}`;
  if (seccion === null || typeof seccion !== "object") {
    throw new Error(`${donde}: debe ser un objeto con ${CAMPOS_SECCION.join(", ")}.`);
  }
  for (const campo of CAMPOS_SECCION) {
    if (typeof seccion[campo] !== "string" || seccion[campo].trim() === "") {
      throw new Error(`${donde}: falta el campo "${campo}" o no es un texto no vacío.`);
    }
  }
  if (!PATRON_RUTA.test(seccion.ruta)) {
    throw new Error(
      `${donde}: el campo "ruta" ("${seccion.ruta}") debe empezar por "/", ir en minúsculas y no acabar en "/".`,
    );
  }
}

/**
 * Lee y valida el fichero de secciones.
 * @param {string} ficheroConfig Ruta del JSON de configuración.
 * @returns {Seccion[]}
 */
export function leerSecciones(ficheroConfig) {
  const secciones = JSON.parse(fs.readFileSync(ficheroConfig, "utf8"));
  if (!Array.isArray(secciones) || secciones.length === 0) {
    throw new Error(`${ficheroConfig}: debe ser un array con al menos una sección.`);
  }
  const rutasVistas = new Set();
  secciones.forEach((seccion, indice) => {
    validarSeccion(seccion, indice, ficheroConfig);
    if (rutasVistas.has(seccion.ruta)) {
      throw new Error(`${ficheroConfig}, sección ${indice}: la ruta "${seccion.ruta}" está repetida.`);
    }
    rutasVistas.add(seccion.ruta);
  });
  return secciones;
}

/**
 * Devuelve el origen sin barra final.
 * @param {string} origen
 * @returns {string}
 */
export function normalizarOrigen(origen) {
  if (typeof origen !== "string" || !PATRON_ORIGEN.test(origen)) {
    throw new Error(
      `Origen no válido: "${origen}". Usa una URL https://dominio o http://localhost[:puerto] sin ruta.`,
    );
  }
  return origen.replace(/\/+$/, "");
}

/**
 * Contenido de robots.txt con un sitemap por sección.
 * @param {string} origen
 * @param {Seccion[]} secciones
 * @returns {string}
 */
export function textoRobots(origen, secciones) {
  const sitemaps = secciones.map((s) => `Sitemap: ${origen}${s.ruta}/sitemap.xml`);
  return ["User-agent: *", "Allow: /", "", ...sitemaps].join("\n") + "\n";
}

/**
 * Contenido de ads.txt, o null si no hay cliente de AdSense.
 * @param {string | undefined} clienteAdsense "ca-pub-<16 dígitos>" o "pub-<16 dígitos>".
 * @returns {string | null}
 */
export function textoAdsTxt(clienteAdsense) {
  if (clienteAdsense === undefined || clienteAdsense === null || clienteAdsense.trim() === "") {
    return null;
  }
  const coincidencia = PATRON_ADSENSE.exec(clienteAdsense.trim());
  if (!coincidencia) {
    throw new Error(
      `Cliente de AdSense no válido: "${clienteAdsense}". Usa "ca-pub-" o "pub-" seguido de 16 dígitos.`,
    );
  }
  return `google.com, pub-${coincidencia[1]}, DIRECT, ${ADSENSE_ID_CERTIFICACION}\n`;
}

/**
 * Contenido de _headers para Cloudflare Pages.
 * @param {Seccion[]} secciones
 * @returns {string}
 */
export function textoHeaders(secciones) {
  const bloques = secciones.map(
    (s) => `${s.ruta}/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
  );
  bloques.push("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n");
  return bloques.join("\n");
}

function escaparHtml(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tarjetaSeccion(seccion) {
  return (
    `<a class="link-card" href="${escaparHtml(seccion.ruta)}">` +
    `<span><span class="link-card-name">${escaparHtml(seccion.nombre)}</span>` +
    `<span class="link-card-hint">${escaparHtml(seccion.descripcion)}</span></span>` +
    `<span class="link-card-arrow" aria-hidden="true">→</span></a>`
  );
}

/**
 * Rellena la plantilla de portada con las secciones y el origen.
 * @param {string} plantilla
 * @param {Seccion[]} secciones
 * @param {string} origen
 * @returns {string}
 */
export function generarPortada(plantilla, secciones, origen) {
  for (const marcador of [MARCADOR_SECCIONES, MARCADOR_ORIGEN]) {
    if (!plantilla.includes(marcador)) {
      throw new Error(`La plantilla de portada no contiene el marcador ${marcador}.`);
    }
  }
  const tarjetas = secciones.map(tarjetaSeccion).join("\n");
  return plantilla
    .replaceAll(MARCADOR_SECCIONES, () => tarjetas)
    .replaceAll(MARCADOR_ORIGEN, () => escaparHtml(origen));
}

/**
 * Copia el out/ de una sección bajo su ruta y añade <ruta>.html.
 * @param {string} dirOut
 * @param {string} dist
 * @param {string} ruta
 */
export function copiarSeccion(dirOut, dist, ruta) {
  const indice = path.join(dirOut, "index.html");
  if (!fs.existsSync(dirOut) || !fs.existsSync(indice)) {
    throw new Error(`No existe ${indice}: compila la sección (npm run build) antes de ensamblar.`);
  }
  const destino = path.join(dist, ...ruta.split("/"));
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.cpSync(dirOut, destino, { recursive: true });
  fs.copyFileSync(indice, `${destino}.html`);
}

function listarFicheros(directorio) {
  const resultado = [];
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completa = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarFicheros(completa));
    } else {
      resultado.push(completa);
    }
  }
  return resultado;
}

/**
 * Comprueba los límites de Cloudflare Pages y devuelve el número de ficheros.
 * @param {string} dist
 * @param {{ maxFicheros?: number, maxBytes?: number }} [limites] Límites alternativos (pruebas).
 * @returns {number}
 */
export function comprobarLimitesPages(dist, limites = {}) {
  const maxFicheros = limites.maxFicheros ?? MAX_FICHEROS_PAGES;
  const maxBytes = limites.maxBytes ?? MAX_BYTES_FICHERO_PAGES;
  const ficheros = listarFicheros(dist);
  if (ficheros.length > maxFicheros) {
    throw new Error(
      `Hay ${ficheros.length} ficheros y Cloudflare Pages admite ${maxFicheros}. Reduce las secciones o sus páginas.`,
    );
  }
  for (const fichero of ficheros) {
    const bytes = fs.statSync(fichero).size;
    if (bytes > maxBytes) {
      throw new Error(
        `${fichero} pesa ${(bytes / BYTES_POR_MIB).toFixed(1)} MiB y Cloudflare Pages admite ` +
          `${(maxBytes / BYTES_POR_MIB).toFixed(1)} MiB por fichero. Elimínalo o redúcelo.`,
      );
    }
  }
  return ficheros.length;
}

function vaciarDist(dist, dirBase) {
  const distAbsoluto = path.resolve(dist);
  const baseAbsoluta = path.resolve(dirBase);
  const relativa = path.relative(baseAbsoluta, distAbsoluto);
  const dentroDeBase = relativa !== "" && !relativa.startsWith("..") && !path.isAbsolute(relativa);
  if (path.basename(distAbsoluto) !== NOMBRE_DIR_DIST || !dentroDeBase) {
    throw new Error(
      `Me niego a vaciar "${distAbsoluto}": debe llamarse "${NOMBRE_DIR_DIST}" y estar dentro de "${baseAbsoluta}".`,
    );
  }
  fs.rmSync(distAbsoluto, { recursive: true, force: true });
  fs.mkdirSync(distAbsoluto, { recursive: true });
}

function copiarRaiz(dirRaiz, dist) {
  const indice = path.resolve(dirRaiz, "index.html");
  fs.cpSync(dirRaiz, dist, { recursive: true, filter: (origen) => path.resolve(origen) !== indice });
}

/**
 * Ensambla dist/ con la raíz y las secciones compiladas.
 * @param {{ secciones: Seccion[], dirBase: string, dirRaiz: string, dist: string,
 *   origen: string, clienteAdsense?: string }} opciones
 * @returns {{ ficheros: number, secciones: number, adsTxt: boolean }}
 */
export function ensamblar({ secciones, dirBase, dirRaiz, dist, origen, clienteAdsense }) {
  const origenNormalizado = normalizarOrigen(origen);
  const adsTxt = textoAdsTxt(clienteAdsense);
  const plantilla = fs.readFileSync(path.join(dirRaiz, "index.html"), "utf8");
  const portada = generarPortada(plantilla, secciones, origenNormalizado);
  vaciarDist(dist, dirBase);
  copiarRaiz(dirRaiz, dist);
  fs.writeFileSync(path.join(dist, "index.html"), portada);
  for (const seccion of secciones) {
    copiarSeccion(path.join(dirBase, seccion.proyecto, "out"), dist, seccion.ruta);
  }
  fs.writeFileSync(path.join(dist, "robots.txt"), textoRobots(origenNormalizado, secciones));
  fs.writeFileSync(path.join(dist, "_headers"), textoHeaders(secciones));
  if (adsTxt !== null) {
    fs.writeFileSync(path.join(dist, "ads.txt"), adsTxt);
  }
  return { ficheros: comprobarLimitesPages(dist), secciones: secciones.length, adsTxt: adsTxt !== null };
}
