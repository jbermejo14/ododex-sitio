import fs from "node:fs";
import path from "node:path";

export const MAX_FICHEROS_PAGES = 20000;
export const MAX_BYTES_FICHERO_PAGES = 25 * 1024 * 1024;
export const MARCADOR_SECCIONES = "<!-- SECCIONES -->";
export const MARCADOR_ORIGEN = "<!-- ORIGEN -->";
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
const ADSENSE_ID_CERTIFICACION = "f08c47fec0942fa0";
const PREFIJO_DIR_NEXT = "__next.";
const SEPARADOR_SEGMENTO_NEXT = ".";
const BYTES_POR_MIB = 1024 * 1024;

/**
 * @typedef {{ ruta: string, proyecto: string, nombre: string, descripcion: string,
 *   worker?: string, paginasSoloHtml?: string[], entorno?: Record<string, string>,
 *   exportacion?: string, scriptBuild?: string, enPortada?: boolean }} Seccion
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
  validarEnPortada(seccion.enPortada, donde);
}

function validarTextoOpcional(valor, campo, patron, donde) {
  if (valor !== undefined && (typeof valor !== "string" || !patron.test(valor))) {
    throw new Error(`${donde}: el campo "${campo}" ("${valor}") debe ser un texto que cumpla ${patron}.`);
  }
}

function validarEnPortada(enPortada, donde) {
  if (enPortada !== undefined && typeof enPortada !== "boolean") {
    throw new Error(`${donde}: el campo "enPortada" debe ser true o false.`);
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
 * Rellena la plantilla de portada con las secciones y el origen. Omite las que tienen `enPortada: false`.
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
  const tarjetas = secciones
    .filter((seccion) => seccion.enPortada !== false)
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
  const indice = path.resolve(dirRaiz, "index.html");
  fs.cpSync(dirRaiz, dist, { recursive: true, filter: (origen) => path.resolve(origen) !== indice });
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
 * Lee la configuración de producción y aplica SITE_ORIGIN y ADSENSE_CLIENT si no están vacías.
 * @param {string} ficheroConfig
 * @param {Record<string, string | undefined>} [entorno]
 * @returns {{ origen: string, clienteAdsense: string }}
 */
export function leerProduccion(ficheroConfig, entorno = process.env) {
  const config = leerJsonSecciones(ficheroConfig);
  exigirCampoTexto(config, "origen", ficheroConfig);
  exigirCampoTexto(config, "clienteAdsense", ficheroConfig);
  return {
    origen: normalizarOrigen(entorno.SITE_ORIGIN || config.origen),
    clienteAdsense: entorno.ADSENSE_CLIENT || config.clienteAdsense,
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

function ensamblarPrincipal({ grupo, todas, dirBase, dirRaiz, dir, origen, adsTxt }) {
  const plantilla = fs.readFileSync(path.join(dirRaiz, "index.html"), "utf8");
  const portada = generarPortada(plantilla, todas, origen);
  vaciarDist(dir, dirBase);
  copiarRaiz(dirRaiz, dir);
  fs.writeFileSync(path.join(dir, "index.html"), portada);
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
      ensamblarPrincipal({ grupo, todas: secciones, dirBase, dirRaiz, dir, origen: origenNormalizado, adsTxt });
    } else {
      ensamblarWorkerPropio({ grupo, dirBase, dir });
    }
    return { worker, dir, ficheros: comprobarLimitesPages(dir) };
  });
  const ensambladas = grupos.reduce((total, [, grupo]) => total + grupo.length, 0);
  const generaAds = adsTxt !== null && grupos.some(([worker]) => worker === undefined);
  return { workers, secciones: ensambladas, adsTxt: generaAds };
}
