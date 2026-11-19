// Worker del autobús de Zaragoza: sirve los estáticos de la sección y hace de proxy de los tiempos
// reales. Origen principal: la web pública de Avanza (HTML en ISO-8859-1); respaldo: la API de
// DNDzgz. Ninguno envía cabeceras CORS. Se despliega sin empaquetar (no_bundle).

const URL_AVANZA = "https://zaragoza-pasobus.avanzagrupo.com/frm_esquemaparadatime.php?poste=";
const URL_DNDZGZ = "https://api.dndzgz.com/services/bus/";
const PREFIJO_API = "/es/zaragoza-bus/api/";
const PREFIJO_RUTA_POSTE = `${PREFIJO_API}poste/`;
const PATRON_POSTE = /^\d{1,5}$/;
const TIEMPO_MAXIMO_MS = 5000;
const TTL_CACHE_ORIGEN_S = 20;
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

/** Pide una URL con tiempo máximo y sin cabeceras del usuario; lanza si falla, expira o no responde 2xx. */
async function pedirOrigen(url, leerCuerpo) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  try {
    const respuesta = await fetch(url, {
      cf: { cacheTtl: TTL_CACHE_ORIGEN_S, cacheEverything: true },
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

/** Resuelve una petición bajo /api/ (el método ya se ha validado). */
function responderApi(ruta) {
  if (!ruta.startsWith(PREFIJO_RUTA_POSTE)) {
    return respuestaError(ESTADO_NO_ENCONTRADO, MENSAJE_NO_ENCONTRADO);
  }
  const poste = ruta.slice(PREFIJO_RUTA_POSTE.length);
  if (!PATRON_POSTE.test(poste)) {
    return respuestaError(ESTADO_PETICION_INVALIDA, MENSAJE_POSTE_INVALIDO);
  }
  return responderPoste(poste);
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
