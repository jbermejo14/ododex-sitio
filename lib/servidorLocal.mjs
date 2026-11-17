import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ESTADO_OK = 200;
const ESTADO_NO_ENCONTRADO = 404;
const ESTADO_METODO_NO_PERMITIDO = 405;
const TIPO_POR_DEFECTO = "application/octet-stream";
const CHARSET_TEXTO = "; charset=utf-8";
const METODOS_PERMITIDOS = ["GET", "HEAD"];

const TIPOS_MIME = {
  ".html": `text/html${CHARSET_TEXTO}`,
  ".css": `text/css${CHARSET_TEXTO}`,
  ".js": `text/javascript${CHARSET_TEXTO}`,
  ".json": `application/json${CHARSET_TEXTO}`,
  ".txt": `text/plain${CHARSET_TEXTO}`,
  ".xml": `application/xml${CHARSET_TEXTO}`,
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".map": "application/json",
};

function esFichero(ruta) {
  return fs.existsSync(ruta) && fs.statSync(ruta).isFile();
}

function estaDentro(dist, ruta) {
  const relativa = path.relative(dist, ruta);
  return !relativa.startsWith("..") && !path.isAbsolute(relativa);
}

function buscarPagina404(dist, directorio) {
  let actual = directorio;
  while (estaDentro(dist, actual)) {
    const candidata = path.join(actual, "404.html");
    if (esFichero(candidata)) {
      return candidata;
    }
    if (actual === dist) {
      break;
    }
    actual = path.dirname(actual);
  }
  return null;
}

function decodificarRuta(rutaUrl) {
  try {
    return decodeURIComponent(rutaUrl);
  } catch {
    // Una secuencia %xx malformada es una petición inválida: se trata como ruta inexistente.
    return null;
  }
}

/**
 * Resuelve una ruta URL al fichero que serviría Cloudflare Pages.
 * @param {string} dist Ruta absoluta de dist.
 * @param {string} rutaUrl Ruta de la URL, sin query.
 * @returns {{ fichero: string | null, estado: 200 | 404 }}
 */
export function resolverRuta(dist, rutaUrl) {
  const decodificada = decodificarRuta(rutaUrl);
  if (decodificada === null || decodificada.includes("\0")) {
    return { fichero: null, estado: ESTADO_NO_ENCONTRADO };
  }
  const sinBarraFinal = decodificada.replace(/\/+$/, "");
  const objetivo = path.resolve(dist, "." + sinBarraFinal);
  if (!estaDentro(dist, objetivo)) {
    return { fichero: null, estado: ESTADO_NO_ENCONTRADO };
  }
  for (const candidato of [objetivo, `${objetivo}.html`, path.join(objetivo, "index.html")]) {
    if (esFichero(candidato)) {
      return { fichero: candidato, estado: ESTADO_OK };
    }
  }
  return { fichero: buscarPagina404(dist, objetivo), estado: ESTADO_NO_ENCONTRADO };
}

/**
 * Tipo MIME según la extensión del fichero.
 * @param {string} fichero
 * @returns {string}
 */
export function tipoMime(fichero) {
  return TIPOS_MIME[path.extname(fichero).toLowerCase()] ?? TIPO_POR_DEFECTO;
}

function responderTexto(respuesta, estado, texto) {
  respuesta.writeHead(estado, { "Content-Type": `text/plain${CHARSET_TEXTO}` });
  respuesta.end(texto);
}

function responderFichero(peticion, respuesta, fichero, estado) {
  const contenido = fs.readFileSync(fichero);
  respuesta.writeHead(estado, {
    "Content-Type": tipoMime(fichero),
    "Content-Length": contenido.length,
  });
  respuesta.end(peticion.method === "HEAD" ? undefined : contenido);
}

/**
 * Crea un servidor HTTP que sirve dist al estilo de Cloudflare Pages.
 * @param {string} dist Ruta absoluta de dist.
 * @returns {http.Server}
 */
export function crearServidor(dist) {
  return http.createServer((peticion, respuesta) => {
    if (!METODOS_PERMITIDOS.includes(peticion.method)) {
      respuesta.setHeader("Allow", METODOS_PERMITIDOS.join(", "));
      responderTexto(respuesta, ESTADO_METODO_NO_PERMITIDO, "Método no permitido");
      return;
    }
    const rutaUrl = new URL(peticion.url, "http://localhost").pathname;
    const { fichero, estado } = resolverRuta(dist, rutaUrl);
    if (fichero === null) {
      responderTexto(respuesta, estado, "No encontrado");
      return;
    }
    responderFichero(peticion, respuesta, fichero, estado);
  });
}
