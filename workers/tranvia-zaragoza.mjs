// Worker del tranvía de Zaragoza: sirve los estáticos de la sección y hace de proxy de la API
// de tiempos de DNDzgz, que no envía cabeceras CORS. Se despliega sin empaquetar (no_bundle).

export const URL_ORIGEN = "https://api.dndzgz.com/services/tram/";
export const PREFIJO_API = "/es/tranvia-zaragoza/api/";
export const PREFIJO_RUTA_ANDEN = `${PREFIJO_API}tram/`;
export const PATRON_ANDEN = /^\d{4}$/;
export const TIEMPO_MAXIMO_MS = 5000;
export const TTL_CACHE_ORIGEN_S = 20;
export const MAX_AGE_RESPUESTA_S = 15;
export const METODO_PERMITIDO = "GET";

const TIPO_JSON = "application/json; charset=utf-8";
const CABECERAS_ERROR = { "content-type": TIPO_JSON, "x-robots-tag": "noindex" };
const CABECERAS_OK = { ...CABECERAS_ERROR, "cache-control": `public, max-age=${MAX_AGE_RESPUESTA_S}` };

const ESTADO_OK = 200;
const ESTADO_PETICION_INVALIDA = 400;
const ESTADO_NO_ENCONTRADO = 404;
const ESTADO_METODO_NO_PERMITIDO = 405;
const ESTADO_ORIGEN_FALLIDO = 502;

export const MENSAJE_ANDEN_INVALIDO = "El andén debe ser un número de cuatro cifras.";
export const MENSAJE_NO_ENCONTRADO = "Ruta de la API no encontrada.";
export const MENSAJE_METODO = "Método no permitido: usa GET.";
export const MENSAJE_ORIGEN = "No se pudo obtener los tiempos del tranvía. Inténtalo de nuevo en unos segundos.";

/** Respuesta JSON de error con el mensaje en español. */
function respuestaError(estado, mensaje, cabecerasExtra = {}) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status: estado,
    headers: { ...CABECERAS_ERROR, ...cabecerasExtra },
  });
}

/**
 * Deja solo { direction, estimate } de cada estimación válida (cadena y número finito >= 0).
 * @param {unknown} datos Cuerpo recibido del origen.
 * @returns {{ direction: string, estimate: number }[] | null} null si el formato no es { estimates: [...] }.
 */
export function sanearEstimaciones(datos) {
  if (datos === null || typeof datos !== "object" || !Array.isArray(datos.estimates)) {
    return null;
  }
  return datos.estimates
    .filter((e) => e !== null && typeof e === "object")
    .filter((e) => typeof e.direction === "string" && Number.isFinite(e.estimate) && e.estimate >= 0)
    .map((e) => ({ direction: e.direction, estimate: e.estimate }));
}

/**
 * Pide los tiempos al origen con tiempo máximo. No envía cabeceras de la petición del usuario.
 * @returns {Promise<unknown>} Cuerpo JSON del origen; lanza si falla, expira o no responde 2xx.
 */
async function pedirOrigen(anden) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  try {
    const respuesta = await fetch(`${URL_ORIGEN}${anden}`, {
      cf: { cacheTtl: TTL_CACHE_ORIGEN_S, cacheEverything: true },
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`El origen respondió ${respuesta.status}.`);
    }
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

async function responderAnden(anden) {
  let estimaciones;
  try {
    estimaciones = sanearEstimaciones(await pedirOrigen(anden));
  } catch (error) {
    // Red, tiempo agotado, estado no 2xx o JSON ilegible: el cliente solo necesita saber que el origen falló.
    console.warn(`Origen del tranvía no disponible (andén ${anden}): ${error.message}`);
    return respuestaError(ESTADO_ORIGEN_FALLIDO, MENSAJE_ORIGEN);
  }
  if (estimaciones === null) {
    console.warn(`Formato inesperado del origen del tranvía (andén ${anden}).`);
    return respuestaError(ESTADO_ORIGEN_FALLIDO, MENSAJE_ORIGEN);
  }
  return new Response(JSON.stringify({ estimates: estimaciones }), { status: ESTADO_OK, headers: CABECERAS_OK });
}

/** Resuelve una petición bajo /api/ (el método ya se ha validado). */
function responderApi(ruta) {
  if (!ruta.startsWith(PREFIJO_RUTA_ANDEN)) {
    return respuestaError(ESTADO_NO_ENCONTRADO, MENSAJE_NO_ENCONTRADO);
  }
  const anden = ruta.slice(PREFIJO_RUTA_ANDEN.length);
  if (!PATRON_ANDEN.test(anden)) {
    return respuestaError(ESTADO_PETICION_INVALIDA, MENSAJE_ANDEN_INVALIDO);
  }
  return responderAnden(anden);
}

export default {
  /** Atiende /es/tranvia-zaragoza/api/*; el resto lo delega en los estáticos (env.ASSETS). */
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
