// Worker del autobús de Zaragoza: sirve los estáticos de la sección y hace de proxy de los tiempos
// reales. Origen principal: la web pública de Avanza (HTML en ISO-8859-1); respaldo: la API de
// DNDzgz. Ninguno envía cabeceras CORS. Se despliega sin empaquetar (no_bundle).

const URL_AVANZA = "https://zaragoza-pasobus.avanzagrupo.com/frm_esquemaparadatime.php?poste=";
const URL_DNDZGZ = "https://api.dndzgz.com/services/bus/";
const PREFIJO_API = "/es/zaragoza-bus/api/";
const PREFIJO_RUTA_POSTE = `${PREFIJO_API}poste/`;
const PREFIJO_RUTA_GPS = `${PREFIJO_API}gps/`;
const URL_GPS_AVANZA = "https://gps.avanzabus.com/index.php/zaragoza/fRefrescaEmpresaExternos";
const USER_AGENT_GPS = "Ododex/1.0 (+https://ododex.com/es/zaragoza-bus)";
const TIPO_FORMULARIO = "application/x-www-form-urlencoded";
const METODO_ORIGEN_GPS = "POST";
// Clave GET sintética de la Cache API: los POST no se cachean, así que se guarda por poste.
const URL_CLAVE_CACHE_GPS = "https://ododex.com/es/zaragoza-bus/cache/gps/";
const PATRON_POSTE = /^\d{1,5}$/;
const TIEMPO_MAXIMO_MS = 5000;
// El sistema GPS de Avanza tarda de 3 a 6 s en responder (medido el 2026-11-20); debe quedar por
// debajo de los 8 s que espera el cliente.
const TIEMPO_MAXIMO_GPS_MS = 7000;
const TTL_CACHE_ORIGEN_S = 20;
const OPCIONES_ORIGEN_TIEMPOS = { cf: { cacheTtl: TTL_CACHE_ORIGEN_S, cacheEverything: true } };
const MAX_AGE_RESPUESTA_S = 15;
const METODO_PERMITIDO = "GET";
const ORIGEN_AVANZA = "avanza";
const ORIGEN_DNDZGZ = "dndzgz";

const CODIFICACION_AVANZA = "iso-8859-1";
const MARCA_CABECERA_POSTE = "POSTE:";
// Tres primeras celdas class="digital" de una fila: línea, destino y tiempo.
const PATRON_FILA = /<tr>\s*<td class="digital">([\s\S]*?)<\/td>\s*<td class="digital">([\s\S]*?)<\/td>\s*<td class="digital">([\s\S]*?)<\/td>/g;
const PATRON_ENTIDAD = /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi;
const ENTIDADES_BASICAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const BASE_DECIMAL = 10;
const BASE_HEXADECIMAL = 16;
const MAXIMO_PUNTO_DE_CODIGO = 0x10ffff;

const TIPO_JSON = "application/json; charset=utf-8";
// Los errores no se cachean: el siguiente intento debe volver a consultar el origen.
const CABECERAS_ERROR = { "content-type": TIPO_JSON, "x-robots-tag": "noindex", "cache-control": "no-store" };
const CABECERAS_OK = { ...CABECERAS_ERROR, "cache-control": `public, max-age=${MAX_AGE_RESPUESTA_S}` };

const ESTADO_OK = 200;
const ESTADO_PETICION_INVALIDA = 400;
const ESTADO_NO_ENCONTRADO = 404;
const ESTADO_METODO_NO_PERMITIDO = 405;
const ESTADO_ORIGEN_FALLIDO = 502;

const MENSAJE_POSTE_INVALIDO = "El poste debe ser un número de uno a cinco dígitos.";
const MENSAJE_NO_ENCONTRADO = "Ruta de la API no encontrada.";
const MENSAJE_METODO = "Método no permitido: usa GET.";
const MENSAJE_ORIGEN = "No se pudo obtener los tiempos del autobús. Inténtalo de nuevo en unos segundos.";
const MENSAJE_ORIGEN_GPS = "No se pudo obtener la posición de los autobuses. Inténtalo de nuevo en unos segundos.";

const PATRON_FILA_GPS = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const PATRON_CELDA_GPS = /<td class="td_info2">([\s\S]*?)<\/td>/g;
const PATRON_NBSP = /&nbsp;?/gi;
const PATRON_ESPACIOS = /\s+/g;
const PATRON_MINUTOS = /^(\d+)\s*min\.?$/i;
const PATRON_KILOMETROS = /^(\d+)\s*kms?\.?$/i;
const PATRON_NUMERICO = /^\d+$/;
const SEPARADOR_LINEA_DESTINO = "->";
const MARCA_ICONO_POSTE = "bus_rojo";
const CELDAS_POR_FILA_GPS = 4;

/** Respuesta JSON de error con el mensaje en español. */
function respuestaError(estado, mensaje, cabecerasExtra = {}) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status: estado,
    headers: { ...CABECERAS_ERROR, ...cabecerasExtra },
  });
}

function decodificarCodigo(codigo, base) {
  const valor = Number.parseInt(codigo, base);
  return valor <= MAXIMO_PUNTO_DE_CODIGO ? String.fromCodePoint(valor) : "";
}

/** Decodifica las entidades HTML básicas (&amp; &lt; &gt; &quot; &#39; &apos;) y las numéricas. */
function decodificarEntidades(texto) {
  return texto.replace(PATRON_ENTIDAD, (entidad, hexadecimal, decimal, nombre) => {
    if (hexadecimal !== undefined) return decodificarCodigo(hexadecimal, BASE_HEXADECIMAL);
    if (decimal !== undefined) return decodificarCodigo(decimal, BASE_DECIMAL);
    return ENTIDADES_BASICAS[nombre.toLowerCase()] ?? entidad;
  });
}

/**
 * Extrae las filas de autobús de la página de Avanza.
 * @param {string} html Página ya decodificada.
 * @returns {{ linea: string, destino: string, primero: string }[] | null} null si falta la cabecera «POSTE:»
 * (formato inesperado); lista vacía si el poste no tiene autobuses.
 */
export function extraerFilasAvanza(html) {
  if (typeof html !== "string" || !html.includes(MARCA_CABECERA_POSTE)) {
    return null;
  }
  return [...html.matchAll(PATRON_FILA)].map(([, linea, destino, primero]) => ({
    linea: decodificarEntidades(linea).trim(),
    destino: decodificarEntidades(destino).trim(),
    primero: decodificarEntidades(primero).trim(),
  }));
}

/**
 * Convierte la respuesta de DNDzgz a filas con el formato de Avanza; `primero` es el número de minutos.
 * @param {unknown} datos Cuerpo recibido del origen.
 * @returns {{ linea: string, destino: string, primero: number }[] | null} null si el formato no es { estimates: [...] }.
 */
export function mapearDndzgz(datos) {
  if (datos === null || typeof datos !== "object" || !Array.isArray(datos.estimates)) {
    return null;
  }
  return datos.estimates
    .filter((e) => e !== null && typeof e === "object")
    .filter((e) => typeof e.line === "string" && typeof e.direction === "string")
    .filter((e) => Number.isFinite(e.estimate) && e.estimate >= 0)
    .map((e) => ({ linea: e.line, destino: e.direction, primero: e.estimate }));
}

/**
 * Pide una URL con tiempo máximo y sin cabeceras del usuario; lanza si falla, expira o no responde 2xx.
 * `opciones` añade método, cuerpo o cabeceras propias; por defecto es un GET con caché de borde.
 */
async function pedirOrigen(url, leerCuerpo, opciones = OPCIONES_ORIGEN_TIEMPOS, tiempoMaximoMs = TIEMPO_MAXIMO_MS) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoMaximoMs);
  try {
    const respuesta = await fetch(url, {
      ...opciones,
      signal: controlador.signal,
      // Solo se consultan hosts fijos: una redirección no se sigue y su 3xx cae en el !ok de abajo.
      // El runtime de Workers no admite redirect: "error".
      redirect: "manual",
    });
    if (!respuesta.ok) {
      throw new Error(`El origen respondió ${respuesta.status}.`);
    }
    return await leerCuerpo(respuesta);
  } finally {
    clearTimeout(temporizador);
  }
}

async function leerHtmlAvanza(respuesta) {
  return new TextDecoder(CODIFICACION_AVANZA).decode(await respuesta.arrayBuffer());
}

async function consultarAvanza(poste) {
  const filas = extraerFilasAvanza(await pedirOrigen(`${URL_AVANZA}${poste}`, leerHtmlAvanza));
  if (filas === null) {
    throw new Error("Formato inesperado: falta la cabecera «POSTE:».");
  }
  return filas;
}

async function consultarDndzgz(poste) {
  const filas = mapearDndzgz(await pedirOrigen(`${URL_DNDZGZ}${poste}`, (respuesta) => respuesta.json()));
  if (filas === null) {
    throw new Error("Formato inesperado: falta la lista «estimates».");
  }
  return filas;
}

function respuestaOk(origen, destinos) {
  return new Response(JSON.stringify({ origen, destinos }), { status: ESTADO_OK, headers: CABECERAS_OK });
}

async function responderPoste(poste) {
  let motivoAvanza;
  try {
    return respuestaOk(ORIGEN_AVANZA, await consultarAvanza(poste));
  } catch (error) {
    // Se prueba el respaldo; el motivo se registra por si también falla.
    motivoAvanza = error.message;
  }
  try {
    return respuestaOk(ORIGEN_DNDZGZ, await consultarDndzgz(poste));
  } catch (error) {
    console.warn(`Orígenes del autobús no disponibles (poste ${poste}). Avanza: ${motivoAvanza} DNDzgz: ${error.message}`);
    return respuestaError(ESTADO_ORIGEN_FALLIDO, MENSAJE_ORIGEN);
  }
}

/** Error de formato del origen GPS: se traduce en un 502 con el motivo en el registro. */
class FormatoGpsInesperado extends Error {}

function esObjeto(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/** Coordenadas { latitud, longitud } de una entrada de `maquinas`, o null si no son numéricas. */
function leerCoordenadasGps(entrada) {
  const punto = entrada.coordenadas?.[0];
  if (!esObjeto(punto) || !Number.isFinite(punto.LAT) || !Number.isFinite(punto.LON)) {
    return null;
  }
  return { latitud: punto.LAT, longitud: punto.LON };
}

function esEntradaPoste(entrada) {
  return typeof entrada.icon === "string" && entrada.icon.includes(MARCA_ICONO_POSTE);
}

/** Línea sin ceros a la izquierda si es numérica; si no, tal cual en mayúsculas. */
function normalizarLineaGps(linea) {
  return PATRON_NUMERICO.test(linea) ? String(Number(linea)) : linea.toUpperCase();
}

function limpiarCeldaGps(celda) {
  return decodificarEntidades(celda.replace(PATRON_NBSP, " ")).replace(PATRON_ESPACIOS, " ").trim();
}

function leerNumeroGps(texto, patron, campo) {
  const coincidencia = patron.exec(texto);
  if (coincidencia === null) {
    throw new FormatoGpsInesperado(`Valor de «${campo}» inesperado: «${texto}».`);
  }
  return Number(coincidencia[1]);
}

/** Convierte las 4 celdas de una fila td_info2 en { coche, linea, destino, llegada }. */
function leerFilaGps(celdas) {
  if (celdas.length !== CELDAS_POR_FILA_GPS) {
    throw new FormatoGpsInesperado(`Una fila tiene ${celdas.length} celdas y se esperaban ${CELDAS_POR_FILA_GPS}.`);
  }
  const [coche, lineaDestino, minutos, km] = celdas.map(limpiarCeldaGps);
  const separador = lineaDestino.indexOf(SEPARADOR_LINEA_DESTINO);
  const linea = separador < 0 ? "" : lineaDestino.slice(0, separador).trim();
  const destino = separador < 0 ? "" : lineaDestino.slice(separador + SEPARADOR_LINEA_DESTINO.length).trim();
  if (coche === "" || linea === "" || destino === "") {
    throw new FormatoGpsInesperado(`Fila sin coche, línea o destino: «${lineaDestino}».`);
  }
  return {
    coche,
    linea: normalizarLineaGps(linea),
    destino,
    llegada: { minutos: leerNumeroGps(minutos, PATRON_MINUTOS, "minutos"), km: leerNumeroGps(km, PATRON_KILOMETROS, "km") },
  };
}

/** Filas td_info2 del HTML `info` de un autobús; lanza si no hay ninguna. */
function leerFilasGps(info) {
  if (typeof info !== "string") {
    throw new FormatoGpsInesperado("Un autobús no trae el campo «info».");
  }
  const filas = [...info.matchAll(PATRON_FILA_GPS)]
    .map(([, contenido]) => [...contenido.matchAll(PATRON_CELDA_GPS)].map(([, celda]) => celda))
    .filter((celdas) => celdas.length > 0)
    .map(leerFilaGps);
  if (filas.length === 0) {
    throw new FormatoGpsInesperado("Un autobús no trae ninguna fila de datos.");
  }
  return filas;
}

/** Añade las filas de una entrada al grupo coche+línea+destino, que conserva la posición de la primera. */
function agruparFilasGps(grupos, posicion, filas) {
  for (const { coche, linea, destino, llegada } of filas) {
    const clave = JSON.stringify([coche, linea, destino]);
    if (!grupos.has(clave)) {
      grupos.set(clave, { coche, linea, destino, latitud: posicion.latitud, longitud: posicion.longitud, llegadas: [] });
    }
    grupos.get(clave).llegadas.push(llegada);
  }
}

/**
 * Convierte la respuesta del GPS de Avanza al formato del Worker.
 * @param {unknown} datos JSON recibido del origen.
 * @returns {{ poste: { latitud: number, longitud: number } | null, autobuses: object[] }}
 * @throws {FormatoGpsInesperado} si la estructura no es la esperada.
 */
function mapearGps(datos) {
  if (!esObjeto(datos)) {
    throw new FormatoGpsInesperado("La respuesta no es un objeto.");
  }
  if (datos.maquinas === undefined) {
    return { poste: null, autobuses: [] };
  }
  if (!esObjeto(datos.maquinas)) {
    throw new FormatoGpsInesperado("«maquinas» no es un objeto.");
  }
  let poste = null;
  const grupos = new Map();
  for (const entrada of Object.values(datos.maquinas)) {
    if (!esObjeto(entrada)) {
      throw new FormatoGpsInesperado("Una entrada de «maquinas» no es un objeto.");
    }
    if (esEntradaPoste(entrada)) {
      poste = leerCoordenadasGps(entrada);
      continue;
    }
    const posicion = leerCoordenadasGps(entrada);
    if (posicion === null) {
      throw new FormatoGpsInesperado("Un autobús no tiene coordenadas numéricas.");
    }
    agruparFilasGps(grupos, posicion, leerFilasGps(entrada.info));
  }
  const autobuses = [...grupos.values()].map((grupo) => ({
    ...grupo,
    llegadas: grupo.llegadas.sort((a, b) => a.minutos - b.minutos),
  }));
  return { poste, autobuses };
}

async function consultarGps(poste) {
  const datos = await pedirOrigen(URL_GPS_AVANZA, (respuesta) => respuesta.json(), {
    method: METODO_ORIGEN_GPS,
    headers: { "content-type": TIPO_FORMULARIO, "user-agent": USER_AGENT_GPS },
    body: `poste=${poste}&coche=0`,
  }, TIEMPO_MAXIMO_GPS_MS);
  return mapearGps(datos);
}

/** Guarda la respuesta en la Cache API; un fallo de la caché no debe romper la respuesta. */
async function guardarEnCacheGps(clave, respuesta) {
  try {
    // Se espera al guardado para que termine antes de responder: el handler no recibe `ctx` (waitUntil).
    await caches.default.put(clave, respuesta.clone());
  } catch (error) {
    console.warn(`No se pudo guardar el GPS en caché: ${error.message}`);
  }
}

/** Lee la respuesta guardada; si la caché falla devuelve undefined y se consulta el origen. */
async function leerDeCacheGps(clave) {
  try {
    return await caches.default.match(clave);
  } catch (error) {
    console.warn(`No se pudo leer el GPS de la caché: ${error.message}`);
    return undefined;
  }
}

async function responderGps(posteCrudo) {
  // Sin ceros a la izquierda: 1, 01 y 00001 comparten clave de caché y petición al origen.
  const poste = String(Number(posteCrudo));
  const hayCache = typeof caches !== "undefined";
  const clave = new Request(`${URL_CLAVE_CACHE_GPS}${poste}`);
  if (hayCache) {
    const guardada = await leerDeCacheGps(clave);
    if (guardada) return guardada;
  }
  let respuesta;
  try {
    respuesta = new Response(JSON.stringify(await consultarGps(poste)), { status: ESTADO_OK, headers: CABECERAS_OK });
  } catch (error) {
    console.warn(`GPS de Avanza no disponible (poste ${poste}): ${error.message}`);
    return respuestaError(ESTADO_ORIGEN_FALLIDO, MENSAJE_ORIGEN_GPS);
  }
  if (hayCache) await guardarEnCacheGps(clave, respuesta);
  return respuesta;
}

const RUTAS_API = [
  { prefijo: PREFIJO_RUTA_POSTE, responder: responderPoste },
  { prefijo: PREFIJO_RUTA_GPS, responder: responderGps },
];

/** Resuelve una petición bajo /api/ (el método ya se ha validado). */
function responderApi(ruta) {
  const destino = RUTAS_API.find(({ prefijo }) => ruta.startsWith(prefijo));
  if (destino === undefined) {
    return respuestaError(ESTADO_NO_ENCONTRADO, MENSAJE_NO_ENCONTRADO);
  }
  const poste = ruta.slice(destino.prefijo.length);
  if (!PATRON_POSTE.test(poste)) {
    return respuestaError(ESTADO_PETICION_INVALIDA, MENSAJE_POSTE_INVALIDO);
  }
  return destino.responder(poste);
}

export default {
  /** Atiende /es/zaragoza-bus/api/*; el resto lo delega en los estáticos (env.ASSETS). */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(PREFIJO_API)) {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== METODO_PERMITIDO) {
      return respuestaError(ESTADO_METODO_NO_PERMITIDO, MENSAJE_METODO, { allow: METODO_PERMITIDO });
    }
    return responderApi(pathname);
  },
};
