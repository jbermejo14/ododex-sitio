import fs from "node:fs";
import path from "node:path";

export const MAX_FICHEROS_PAGES = 20000;
export const MAX_BYTES_FICHERO_PAGES = 25 * 1024 * 1024;
export const MARCADOR_SECCIONES = "<!-- SECCIONES -->";
export const MARCADOR_ORIGEN = "<!-- ORIGEN -->";
export const MARCADOR_ADSENSE = "<!-- ADSENSE -->";
const URL_SCRIPT_ADSENSE = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const PAGINAS_RAIZ_CON_ADSENSE = ["index.html", "404.html", "fr/index.html", "fr/404.html", "contacto.html", "sobre-nosotros.html"];
const IDIOMA_POR_DEFECTO = "es";

/** Portadas por idioma: plantilla en raiz/, destino en la salida del Worker principal. */
export const PORTADAS = [
  { idioma: "es", plantilla: "index.html", destino: "index.html" },
  { idioma: "fr", plantilla: "fr/index.html", destino: "fr/index.html" },
];
export const DIR_SALIDA = "dist";
export const DIR_EXPORTACION = "out";

const CAMPOS_SECCION = ["ruta", "proyecto", "nombre", "descripcion"];
const PATRON_RUTA = /^(\/[a-z0-9-]+)+$/;
const PATRON_WORKER = /^ododex-[a-z0-9-]+$/;
const PATRON_SEGMENTO_PAGINA = /^([a-z0-9-]+|\*)$/;
const PATRON_CLAVE_ENTORNO = /^[A-Z_][A-Z0-9_]*$/;
const PATRON_VALOR_ENTORNO = /^[A-Za-z0-9._-]*$/;
const PATRON_EXPORTACION = /^[a-z0-9-]+$/;
const PATRON_SCRIPT_BUILD = /^[a-z0-9:-]+$/;
const SCRIPT_BUILD_POR_DEFECTO = "build";
const PREFIJO_WORKER = "ododex-";
const OPCION_SOLO = "--solo";
const COMODIN_SEGMENTO = "*";
const SEPARADOR_RUTA = "/";
const EXTENSION_HTML = ".html";
const EXTENSION_RSC = ".txt";
const PREFIJO_RSC_NEXT = "__next";
const PATRON_ORIGEN =/^(https:\/\/[^\s/]+|http:\/\/localhost(:\d+)?)\/*$/;
const PATRON_ADSENSE = /^(?:ca-)?pub-(\d{16})$/;
const PATRON_UNIDAD_ADSENSE = /^[0-9]{10}$/;
const ADSENSE_ID_CERTIFICACION = "f08c47fec0942fa0";
const PREFIJO_DIR_NEXT = "__next.";
const SEPARADOR_SEGMENTO_NEXT = ".";
const BYTES_POR_MIB = 1024 * 1024;
const EXTENSIONES_PUBLICABLES = [".html", ".xml", ".txt"];
const PATRONES_ORIGEN_DESARROLLO = ["http://localhost", "http://127.0.0.1", "http://0.0.0.0"];
const NOMBRE_PAGINA_404 = "404.html";
const NOMBRE_PAGINA_NO_ENCONTRADA = "_not-found";
const MAX_EJEMPLOS_SALIDA_PRODUCCION = 5;
const AVISO_COMPILAR = "Compila con npm run build en ododex-sitio, no copies out/ a mano.";

/**
 * @typedef {{ ruta: string, proyecto: string, nombre: string, descripcion: string,
 *   worker?: string, paginasSoloHtml?: string[], entorno?: Record<string, string>,
 *   exportacion?: string, scriptBuild?: string, enPortada?: boolean, publicada?: boolean }} Seccion
 */

function validarRutaSeccion(ruta, donde) {
  if (!PATRON_RUTA.test(ruta)) {
    throw new Error(
      `${donde}: el campo "ruta" ("${ruta}") debe empezar por "/", ir en minúsculas, sin "..", y no acabar en "/".`,
    );
  }
}

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
  validarRutaSeccion(seccion.ruta, donde);
  validarWorker(seccion.worker, donde);
  validarPaginasSoloHtml(seccion.paginasSoloHtml, donde);
  validarEntorno(seccion.entorno, donde);
  validarTextoOpcional(seccion.exportacion, "exportacion", PATRON_EXPORTACION, donde);
  validarTextoOpcional(seccion.scriptBuild, "scriptBuild", PATRON_SCRIPT_BUILD, donde);
  validarBooleanoOpcional(seccion.enPortada, "enPortada", donde);
  validarBooleanoOpcional(seccion.publicada, "publicada", donde);
}

function validarTextoOpcional(valor, campo, patron, donde) {
  if (valor !== undefined && (typeof valor !== "string" || !patron.test(valor))) {
    throw new Error(`${donde}: el campo "${campo}" ("${valor}") debe ser un texto que cumpla ${patron}.`);
  }
}

function validarBooleanoOpcional(valor, campo, donde) {
  if (valor !== undefined && typeof valor !== "boolean") {
    throw new Error(`${donde}: el campo "${campo}" debe ser true o false.`);
  }
}

function validarEntorno(entorno, donde) {
  if (entorno === undefined) {
    return;
  }
  if (entorno === null || typeof entorno !== "object" || Array.isArray(entorno)) {
    throw new Error(`${donde}: el campo "entorno" debe ser un objeto de variables, por ejemplo {"RECALLS_LANG": "es"}.`);
  }
  for (const [clave, valor] of Object.entries(entorno)) {
    if (!PATRON_CLAVE_ENTORNO.test(clave)) {
      throw new Error(`${donde}: la variable de "entorno" "${clave}" debe cumplir ${PATRON_CLAVE_ENTORNO}.`);
    }
    if (typeof valor !== "string" || !PATRON_VALOR_ENTORNO.test(valor)) {
      throw new Error(
        `${donde}: el valor de la variable "${clave}" debe ser un texto con ${PATRON_VALOR_ENTORNO} (sin espacios ni caracteres de shell).`,
      );
    }
  }
}

/**
 * Carpeta de exportación de una sección dentro de su proyecto ("out" si no indica otra).
 * @param {Seccion} seccion
 * @returns {string}
 */
export function dirExportacionDeSeccion(seccion) {
  return seccion.exportacion ?? DIR_EXPORTACION;
}

/**
 * Comando que compila una sección: "npm run <scriptBuild>" ("build" por defecto).
 * @param {Seccion} seccion
 * @returns {string}
 */
export function comandoCompilacion(seccion) {
  return `npm run ${seccion.scriptBuild ?? SCRIPT_BUILD_POR_DEFECTO}`;
}

function validarWorker(worker, donde) {
  if (worker !== undefined && (typeof worker !== "string" || !PATRON_WORKER.test(worker))) {
    throw new Error(`${donde}: el campo "worker" ("${worker}") debe cumplir ${PATRON_WORKER} (por ejemplo "ododex-gasolineras").`);
  }
}

function validarPaginasSoloHtml(patrones, donde) {
  if (patrones === undefined) {
    return;
  }
  if (!Array.isArray(patrones)) {
    throw new Error(`${donde}: el campo "paginasSoloHtml" debe ser un array de patrones como "gasolinera/*".`);
  }
  for (const patron of patrones) {
    const segmentos = typeof patron === "string" ? patron.split(SEPARADOR_RUTA) : [];
    if (segmentos.length === 0 || !segmentos.every((segmento) => PATRON_SEGMENTO_PAGINA.test(segmento))) {
      throw new Error(
        `${donde}: el patrón "${patron}" de "paginasSoloHtml" no es válido. Usa segmentos [a-z0-9-]+ o "*" separados por "/".`,
      );
    }
  }
}

function leerJsonSecciones(ficheroConfig) {
  try {
    return JSON.parse(fs.readFileSync(ficheroConfig, "utf8"));
  } catch (error) {
    throw new Error(
      `No se pudo leer ${ficheroConfig} (${error.message}). Comprueba que existe y que es un JSON válido.`,
    );
  }
}

/**
 * Lee y valida el fichero de secciones.
 * @param {string} ficheroConfig Ruta del JSON de configuración.
 * @returns {Seccion[]}
 */
export function leerSecciones(ficheroConfig) {
  const secciones = leerJsonSecciones(ficheroConfig);
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
 * Contenido de robots.txt con un sitemap por sección publicada (`publicada !== false`).
 * @param {string} origen
 * @param {Seccion[]} secciones
 * @returns {string}
 */
export function textoRobots(origen, secciones) {
  const sitemaps = secciones
    .filter((s) => s.publicada !== false)
    .map((s) => `Sitemap: ${origen}${s.ruta}/sitemap.xml`);
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
 * Sustituye MARCADOR_ADSENSE por el script de AdSense (o por nada si no hay cliente).
 * La portada y la 404 de la raíz son HTML fijo: sin esto, ododex.com/ no lleva el
 * script que AdSense busca para verificar el sitio. Valida el cliente como textoAdsTxt.
 * @param {string} html
 * @param {string | undefined} clienteAdsense
 * @returns {string}
 */
export function insertarAdsense(html, clienteAdsense) {
  const lineaAdsTxt = textoAdsTxt(clienteAdsense);
  const script =
    lineaAdsTxt === null
      ? ""
      : `<script async src="${URL_SCRIPT_ADSENSE}?client=ca-pub-${PATRON_ADSENSE.exec(clienteAdsense.trim())[1]}" crossorigin="anonymous"></script>`;
  return html.replaceAll(MARCADOR_ADSENSE, () => script);
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
 * Indica si la sección va en la portada de un idioma: su ruta empieza por `/<idioma>/`,
 * `enPortada !== false` y `publicada !== false`.
 * @param {Seccion} seccion
 * @param {string} idioma
 * @returns {boolean}
 */
export function seccionEnPortada(seccion, idioma) {
  return seccion.ruta.startsWith(`/${idioma}/`) && seccion.enPortada !== false && seccion.publicada !== false;
}

/**
 * Rellena la plantilla de portada con las secciones del idioma y el origen.
 * @param {string} plantilla
 * @param {Seccion[]} secciones
 * @param {string} origen
 * @param {string} [idioma] Idioma de la portada ("es" por defecto).
 * @returns {string}
 */
export function generarPortada(plantilla, secciones, origen, idioma = IDIOMA_POR_DEFECTO) {
  for (const marcador of [MARCADOR_SECCIONES, MARCADOR_ORIGEN]) {
    if (!plantilla.includes(marcador)) {
      throw new Error(`La plantilla de portada no contiene el marcador ${marcador}.`);
    }
  }
  const tarjetas = secciones
    .filter((seccion) => seccionEnPortada(seccion, idioma))
    .map(tarjetaSeccion)
    .join("\n");
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
  if (!fs.existsSync(indice)) {
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

function esPaginaDeError(rutaRelativa) {
  const segmentos = rutaRelativa.split(path.sep);
  return segmentos.at(-1) === NOMBRE_PAGINA_404 || segmentos.some((s) => s.startsWith(NOMBRE_PAGINA_NO_ENCONTRADA));
}

// Devuelve los motivos por los que un fichero no es publicable (vacío si está bien).
function motivosDeFichero(fichero, rutaRelativa, scriptAdsense) {
  const extension = path.extname(fichero);
  if (!EXTENSIONES_PUBLICABLES.includes(extension)) {
    return [];
  }
  const contenido = fs.readFileSync(fichero, "utf8");
  const motivos = [];
  if (PATRONES_ORIGEN_DESARROLLO.some((patron) => contenido.includes(patron))) {
    motivos.push("contiene un origen de desarrollo (localhost)");
  }
  const exigeScript = scriptAdsense !== null && extension === EXTENSION_HTML && !esPaginaDeError(rutaRelativa);
  if (exigeScript && !contenido.includes(scriptAdsense)) {
    motivos.push("no incluye el script de AdSense");
  }
  return motivos;
}

function mensajeSalidaNoProduccion(dirSeccion, afectados) {
  const ejemplos = afectados.slice(0, MAX_EJEMPLOS_SALIDA_PRODUCCION).map((linea) => `  - ${linea}`).join("\n");
  const sobrantes = afectados.length - MAX_EJEMPLOS_SALIDA_PRODUCCION;
  const resto = sobrantes > 0 ? `\n  (y ${sobrantes} más)` : "";
  return `La salida de ${dirSeccion} no es de producción: ${afectados.length} fichero(s) afectados:\n${ejemplos}${resto}\n${AVISO_COMPILAR}`;
}

/**
 * Revisa los ficheros publicables (.html, .xml, .txt) de una sección ya ensamblada y lanza un Error si
 * alguno contiene un origen de desarrollo (http://localhost, http://127.0.0.1, http://0.0.0.0) o, con
 * `clienteAdsense` no vacío, si una página .html que no es de error (404.html, _not-found) no incluye
 * el script `adsbygoogle.js?client=<clienteAdsense>`. Lee los ficheros de uno en uno.
 * El mensaje lista como mucho 5 ficheros (rutas relativas a `dirSeccion`), el total y cómo corregirlo.
 * @param {string} dirSeccion Carpeta a revisar.
 * @param {string | undefined} clienteAdsense "ca-pub-<16 dígitos>" o "pub-<16 dígitos>"; vacío no exige script.
 * @returns {{ revisados: number }}
 */
export function comprobarSalidaProduccion(dirSeccion, clienteAdsense) {
  const scriptAdsense =
    textoAdsTxt(clienteAdsense) === null
      ? null
      : `adsbygoogle.js?client=ca-pub-${PATRON_ADSENSE.exec(clienteAdsense.trim())[1]}`;
  const afectados = [];
  let revisados = 0;
  const pendientes = [dirSeccion];
  while (pendientes.length > 0) {
    const directorio = pendientes.pop();
    for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
      const completa = path.join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        pendientes.push(completa);
        continue;
      }
      revisados += 1;
      const rutaRelativa = path.relative(dirSeccion, completa);
      const motivos = motivosDeFichero(completa, rutaRelativa, scriptAdsense);
      if (motivos.length > 0) {
        afectados.push(`${rutaRelativa.split(path.sep).join(SEPARADOR_RUTA)}: ${motivos.join(" y ")}`);
      }
    }
  }
  if (afectados.length > 0) {
    throw new Error(mensajeSalidaNoProduccion(dirSeccion, afectados));
  }
  return { revisados };
}

function estaEstrictamenteDentro(base, ruta) {
  const relativa = path.relative(base, ruta);
  return relativa !== "" && relativa !== ".." && !relativa.startsWith(`..${path.sep}`) && !path.isAbsolute(relativa);
}

// Compara también las rutas reales del padre de dist y de la base: un enlace simbólico no debe sacar dist de la base.
function padreDeDistEstaEnBase(distAbsoluto, baseAbsoluta) {
  const padre = path.dirname(distAbsoluto);
  if (!fs.existsSync(padre) || !fs.existsSync(baseAbsoluta)) {
    return true;
  }
  const padreReal = fs.realpathSync(padre);
  const baseReal = fs.realpathSync(baseAbsoluta);
  return padreReal === baseReal || estaEstrictamenteDentro(baseReal, padreReal);
}

function vaciarDist(dist, dirBase) {
  const distAbsoluto = path.resolve(dist);
  const baseAbsoluta = path.resolve(dirBase);
  const dentroDeBase =
    estaEstrictamenteDentro(baseAbsoluta, distAbsoluto) && padreDeDistEstaEnBase(distAbsoluto, baseAbsoluta);
  if (!path.basename(distAbsoluto).startsWith(DIR_SALIDA) || !dentroDeBase) {
    throw new Error(
      `Me niego a vaciar "${distAbsoluto}": su nombre debe empezar por "${DIR_SALIDA}" y estar dentro de "${baseAbsoluta}".`,
    );
  }
  fs.rmSync(distAbsoluto, { recursive: true, force: true });
  fs.mkdirSync(distAbsoluto, { recursive: true });
}

function copiarRaiz(dirRaiz, dist) {
  const plantillas = new Set(PORTADAS.map((portada) => path.resolve(dirRaiz, portada.plantilla)));
  fs.cpSync(dirRaiz, dist, { recursive: true, filter: (origen) => !plantillas.has(path.resolve(origen)) });
}

function leerPlantillaPortada(dirRaiz, portada) {
  const fichero = path.join(dirRaiz, portada.plantilla);
  if (!fs.existsSync(fichero)) {
    throw new Error(`Falta la plantilla de portada ${portada.plantilla} en ${dirRaiz}: crea ese fichero para el idioma "${portada.idioma}".`);
  }
  return fs.readFileSync(fichero, "utf8");
}

function generarPortadas(dirRaiz, secciones, origen) {
  return PORTADAS.map((portada) => ({
    destino: portada.destino,
    html: generarPortada(leerPlantillaPortada(dirRaiz, portada), secciones, origen, portada.idioma),
  }));
}

function escribirPortadas(portadas, dir) {
  for (const { destino, html } of portadas) {
    const fichero = path.join(dir, destino);
    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    fs.writeFileSync(fichero, html);
  }
}

function recolectarMovimientosNext(directorio, movimientos) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (!entrada.isDirectory()) {
      continue;
    }
    const completa = path.join(directorio, entrada.name);
    if (!entrada.name.startsWith(PREFIJO_DIR_NEXT)) {
      recolectarMovimientosNext(completa, movimientos);
      continue;
    }
    for (const fichero of listarFicheros(completa)) {
      const segmentos = path.relative(completa, fichero).split(path.sep);
      const nombre = [entrada.name, ...segmentos].join(SEPARADOR_SEGMENTO_NEXT);
      movimientos.push({ origen: fichero, destino: path.join(directorio, nombre), dirNext: completa });
    }
  }
}

/**
 * Convierte los ficheros de directorios `__next.*` anidados en ficheros planos
 * (`a/__next.x/$y/__PAGE__.txt` pasa a `a/__next.x.$y.__PAGE__.txt`), como los pide el navegador.
 * Si algún destino ya existe lanza Error sin mover nada. Devuelve el número de ficheros movidos.
 * @param {string} dirSeccion
 * @returns {number}
 */
export function aplanarSegmentosNext(dirSeccion) {
  const movimientos = [];
  recolectarMovimientosNext(dirSeccion, movimientos);
  const destinos = new Set();
  for (const { destino } of movimientos) {
    if (fs.existsSync(destino) || destinos.has(destino)) {
      throw new Error(`No se puede aplanar: el destino ${destino} ya existe. Revisa la compilación de la sección.`);
    }
    destinos.add(destino);
  }
  for (const { origen, destino } of movimientos) {
    fs.renameSync(origen, destino);
  }
  for (const dirNext of new Set(movimientos.map((movimiento) => movimiento.dirNext))) {
    fs.rmSync(dirNext, { recursive: true, force: true });
  }
  return movimientos.length;
}

/**
 * Nombre de worker sin el prefijo "ododex-" (ododex-gasolineras pasa a gasolineras).
 * @param {string} worker
 * @returns {string}
 */
export function sufijoDeWorker(worker) {
  return worker.startsWith(PREFIJO_WORKER) ? worker.slice(PREFIJO_WORKER.length) : worker;
}

/**
 * Carpeta de salida de un Worker: "dist" para el principal, "dist-<sufijo>" para los demás.
 * @param {string | undefined} worker
 * @returns {string}
 */
export function dirSalidaDeWorker(worker) {
  return worker === undefined ? DIR_SALIDA : `${DIR_SALIDA}-${sufijoDeWorker(worker)}`;
}

function patronCoincide(patron, segmentos) {
  const partes = patron.split(SEPARADOR_RUTA);
  return (
    partes.length === segmentos.length &&
    partes.every((parte, indice) => parte === COMODIN_SEGMENTO || parte === segmentos[indice])
  );
}

function listarRutasHtml(dirSeccion) {
  return listarFicheros(dirSeccion)
    .filter((fichero) => fichero.endsWith(EXTENSION_HTML))
    .map((fichero) =>
      path.relative(dirSeccion, fichero).split(path.sep).join(SEPARADOR_RUTA).slice(0, -EXTENSION_HTML.length),
    );
}

function quitarRscDePagina(base) {
  fs.rmSync(`${base}${EXTENSION_RSC}`, { force: true });
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return;
  }
  const ajeno = fs.readdirSync(base).find((nombre) => !nombre.startsWith(PREFIJO_RSC_NEXT));
  if (ajeno !== undefined) {
    throw new Error(
      `No se puede quitar el RSC de ${base}: el directorio contiene "${ajeno}", que no es de precarga. ` +
        `Revisa los patrones de "paginasSoloHtml".`,
    );
  }
  fs.rmSync(base, { recursive: true, force: true });
}

/**
 * Deja solo el HTML de las páginas que cumplen algún patrón: borra su `<P>.txt` y su directorio `<P>/`
 * (datos RSC que solo usa la navegación interna). Devuelve el número de páginas tratadas.
 * @param {string} dirSeccion
 * @param {string[]} patrones Segmentos literales o "*", relativos a la sección y sin ".html".
 * @returns {number}
 */
export function quitarRscDePaginas(dirSeccion, patrones) {
  const paginas = listarRutasHtml(dirSeccion).filter((pagina) =>
    patrones.some((patron) => patronCoincide(patron, pagina.split(SEPARADOR_RUTA))),
  );
  for (const pagina of paginas) {
    quitarRscDePagina(path.join(dirSeccion, ...pagina.split(SEPARADOR_RUTA)));
  }
  return paginas.length;
}

function exigirCampoTexto(config, campo, ficheroConfig) {
  if (typeof config?.[campo] !== "string") {
    throw new Error(`${ficheroConfig}: falta el campo "${campo}" o no es un texto (puede ser "").`);
  }
}

/**
 * Valida la unidad de anuncio de AdSense: vacía (sin anuncios manuales) o 10 dígitos.
 * @param {string} unidad
 * @returns {string}
 */
export function validarUnidadAdsense(unidad) {
  if (unidad !== "" && !PATRON_UNIDAD_ADSENSE.test(unidad)) {
    throw new Error(
      `Unidad de AdSense no válida: "${unidad}". Son 10 dígitos: créala en AdSense (Anuncios, Por unidad de anuncio, ` +
        `Anuncios display, adaptable) y copia el "data-ad-slot" del código.`,
    );
  }
  return unidad;
}

/**
 * Lee la configuración de producción y aplica SITE_ORIGIN, ADSENSE_CLIENT y ADSENSE_SLOT si no están vacías.
 * @param {string} ficheroConfig
 * @param {Record<string, string | undefined>} [entorno]
 * @returns {{ origen: string, clienteAdsense: string, unidadAdsense: string }}
 */
export function leerProduccion(ficheroConfig, entorno = process.env) {
  const config = leerJsonSecciones(ficheroConfig);
  exigirCampoTexto(config, "origen", ficheroConfig);
  exigirCampoTexto(config, "clienteAdsense", ficheroConfig);
  exigirCampoTexto(config, "unidadAdsense", ficheroConfig);
  return {
    origen: normalizarOrigen(entorno.SITE_ORIGIN || config.origen),
    clienteAdsense: entorno.ADSENSE_CLIENT || config.clienteAdsense,
    unidadAdsense: validarUnidadAdsense(entorno.ADSENSE_SLOT || config.unidadAdsense),
  };
}

/**
 * Devuelve la ruta indicada tras "--solo", o undefined si la opción no está.
 * @param {string[]} argumentos
 * @returns {string | undefined}
 */
export function leerOpcionSolo(argumentos) {
  const indice = argumentos.indexOf(OPCION_SOLO);
  if (indice === -1) {
    return undefined;
  }
  const valor = argumentos[indice + 1];
  if (valor === undefined || valor.startsWith("--")) {
    throw new Error(`Falta la ruta tras ${OPCION_SOLO}. Ejemplo: ${OPCION_SOLO} /es/gasolineras`);
  }
  return valor;
}

// El grupo del Worker principal (clave undefined) va siempre primero y existe aunque no tenga secciones.
function agruparPorWorker(secciones) {
  const grupos = new Map([[undefined, []]]);
  for (const seccion of secciones) {
    if (!grupos.has(seccion.worker)) {
      grupos.set(seccion.worker, []);
    }
    grupos.get(seccion.worker).push(seccion);
  }
  return grupos;
}

function seleccionarGrupos(grupos, secciones, solo) {
  if (solo === undefined) {
    return [...grupos.entries()];
  }
  const objetivo = secciones.find((seccion) => seccion.ruta === solo);
  if (!objetivo) {
    const rutas = secciones.map((seccion) => seccion.ruta).join(", ");
    throw new Error(`La sección "${solo}" no está en config/secciones.json. Rutas disponibles: ${rutas}.`);
  }
  return [[objetivo.worker, grupos.get(objetivo.worker)]];
}

function exigirSeccionesCompiladas(secciones, dirBase) {
  secciones.forEach((seccion, indice) => {
    validarRutaSeccion(seccion.ruta, `Sección ${indice}`);
    const indiceOut = path.join(dirBase, seccion.proyecto, dirExportacionDeSeccion(seccion), "index.html");
    if (!fs.existsSync(indiceOut)) {
      throw new Error(
        `Falta compilar ${seccion.ruta}: no existe ${indiceOut}; compila la sección (${comandoCompilacion(seccion)} en ${seccion.proyecto}) antes de ensamblar.`,
      );
    }
  });
}

function copiarSecciones(secciones, dirBase, dir) {
  for (const seccion of secciones) {
    const destino = path.join(dir, ...seccion.ruta.split(SEPARADOR_RUTA));
    copiarSeccion(path.join(dirBase, seccion.proyecto, dirExportacionDeSeccion(seccion)), dir, seccion.ruta);
    aplanarSegmentosNext(destino);
    if (seccion.paginasSoloHtml) {
      quitarRscDePaginas(destino, seccion.paginasSoloHtml);
    }
  }
}

function insertarAdsenseEnRaiz(dir, clienteAdsense) {
  for (const nombre of PAGINAS_RAIZ_CON_ADSENSE) {
    const fichero = path.join(dir, nombre);
    // La 404 de la raíz es opcional (una raíz mínima puede no tenerla).
    if (!fs.existsSync(fichero)) continue;
    fs.writeFileSync(fichero, insertarAdsense(fs.readFileSync(fichero, "utf8"), clienteAdsense));
  }
}

function ensamblarPrincipal({ grupo, todas, dirBase, dirRaiz, dir, origen, adsTxt, clienteAdsense }) {
  const portadas = generarPortadas(dirRaiz, todas, origen);
  vaciarDist(dir, dirBase);
  copiarRaiz(dirRaiz, dir);
  escribirPortadas(portadas, dir);
  insertarAdsenseEnRaiz(dir, clienteAdsense);
  copiarSecciones(grupo, dirBase, dir);
  fs.writeFileSync(path.join(dir, "robots.txt"), textoRobots(origen, todas));
  fs.writeFileSync(path.join(dir, "_headers"), textoHeaders(grupo));
  if (adsTxt !== null) {
    fs.writeFileSync(path.join(dir, "ads.txt"), adsTxt);
  }
}

function ensamblarWorkerPropio({ grupo, dirBase, dir }) {
  vaciarDist(dir, dirBase);
  copiarSecciones(grupo, dirBase, dir);
  fs.writeFileSync(path.join(dir, "_headers"), textoHeaders(grupo));
}

/**
 * Ensambla las carpetas de salida (una por Worker) con la raíz y las secciones compiladas.
 * Con `solo` regenera únicamente la carpeta del Worker de esa sección.
 * @param {{ secciones: Seccion[], dirBase: string, dirRaiz: string, dist: string,
 *   origen: string, clienteAdsense?: string, solo?: string }} opciones
 * @returns {{ workers: { worker: string | undefined, dir: string, ficheros: number }[],
 *   secciones: number, adsTxt: boolean }}
 */
export function ensamblar({ secciones, dirBase, dirRaiz, dist, origen, clienteAdsense, solo }) {
  const origenNormalizado = normalizarOrigen(origen);
  const adsTxt = textoAdsTxt(clienteAdsense);
  const grupos = seleccionarGrupos(agruparPorWorker(secciones), secciones, solo);
  exigirSeccionesCompiladas(
    grupos.flatMap(([, grupo]) => grupo),
    dirBase,
  );
  const dirPadre = path.dirname(path.resolve(dist));
  const workers = grupos.map(([worker, grupo]) => {
    const esPrincipal = worker === undefined;
    const dir = esPrincipal ? dist : path.join(dirPadre, dirSalidaDeWorker(worker));
    if (esPrincipal) {
      ensamblarPrincipal({ grupo, todas: secciones, dirBase, dirRaiz, dir, origen: origenNormalizado, adsTxt, clienteAdsense });
    } else {
      ensamblarWorkerPropio({ grupo, dirBase, dir });
    }
    comprobarSalidaProduccion(dir, clienteAdsense);
    return { worker, dir, ficheros: comprobarLimitesPages(dir) };
  });
  const ensambladas = grupos.reduce((total, [, grupo]) => total + grupo.length, 0);
  const generaAds = adsTxt !== null && grupos.some(([worker]) => worker === undefined);
  return { workers, secciones: ensambladas, adsTxt: generaAds };
}
