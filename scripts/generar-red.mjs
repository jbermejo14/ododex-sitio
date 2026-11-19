import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirSalidaDeWorker, leerSecciones, seccionEnPortada } from "../lib/ensamblado.mjs";
import {
  PATRON_TITULO_GASOLINERAS,
  PATRON_TITULO_RECARGA,
  SECCION_ELECTRICO,
  SECCION_GASOLINERAS,
  SECCION_ITV,
  SECCION_MULTAS,
  SECCION_RECARGA,
  SECCION_ZBE,
  VERSION_RED,
  extraerRutasSitemap,
  generarEnlaces,
  nombreDeTitulo,
} from "../lib/red.mjs";

const DIR_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECCIONES_CON_ENLACES = [SECCION_GASOLINERAS, SECCION_RECARGA, SECCION_ITV, SECCION_MULTAS, SECCION_ELECTRICO, SECCION_ZBE];
/** Secciones sin las que la red no tiene sentido: la referencia de todos los emparejamientos. */
const SECCIONES_OBLIGATORIAS = [SECCION_GASOLINERAS];
/** Sección de municipios → patrón de su <title>. */
const PATRONES_NOMBRE = [
  { seccion: SECCION_GASOLINERAS, patron: PATRON_TITULO_GASOLINERAS },
  { seccion: SECCION_RECARGA, patron: PATRON_TITULO_RECARGA },
];
const SEGMENTOS_RUTA_MUNICIPIO = 3;
const PREFIJO_MUNICIPIO = "provincia";
const BYTES_CABECERA_HTML = 4096;
const IDIOMA_RED = "es";
const INDENTACION_JSON = 2;
const CODIGO_ERROR = 1;

/**
 * Rutas del sitemap compilado de una sección.
 * @param {string} dirBase Raíz del proyecto.
 * @param {{ruta: string, worker?: string}} seccion
 * @returns {string[]} Vacío si el sitemap no existe (con aviso) y la sección no es obligatoria.
 */
export function leerRutasDeSeccion(dirBase, seccion) {
  const fichero = path.join(dirBase, dirSalidaDeWorker(seccion.worker), seccion.ruta, "sitemap.xml");
  if (!fs.existsSync(fichero)) {
    if (SECCIONES_OBLIGATORIAS.includes(seccion.ruta)) {
      throw new Error(`Falta ${fichero}: compila ${seccion.ruta} antes de generar la red.`);
    }
    console.warn(`Aviso: falta ${fichero}; ${seccion.ruta} no recibirá ni dará enlaces. Compila la sección y repite.`);
    return [];
  }
  return extraerRutasSitemap(fs.readFileSync(fichero, "utf8"));
}

function leerEnlacesZbe(ficheroZbe) {
  if (!fs.existsSync(ficheroZbe)) {
    console.warn(`Aviso: falta ${ficheroZbe}; no habrá enlaces a ZBE.`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(ficheroZbe, "utf8"));
  } catch (error) {
    throw new Error(`${ficheroZbe} no es un JSON válido: ${error.message}`);
  }
}

function rutasPorSeccion(dirBase, secciones) {
  const rutas = {};
  for (const ruta of SECCIONES_CON_ENLACES) {
    const seccion = secciones.find((candidata) => candidata.ruta === ruta);
    if (seccion === undefined) {
      throw new Error(`La sección ${ruta} no está en config/secciones.json.`);
    }
    rutas[ruta] = leerRutasDeSeccion(dirBase, seccion);
  }
  return rutas;
}

function leerCabeceraHtml(fichero) {
  const descriptor = fs.openSync(fichero, "r");
  try {
    const buffer = Buffer.alloc(BYTES_CABECERA_HTML);
    const leidos = fs.readSync(descriptor, buffer, 0, BYTES_CABECERA_HTML, 0);
    return buffer.toString("utf8", 0, leidos);
  } finally {
    fs.closeSync(descriptor);
  }
}

function esRutaDeMunicipio(ruta, seccion) {
  const segmentos = ruta.slice(seccion.length + 1).split("/");
  return segmentos.length === SEGMENTOS_RUTA_MUNICIPIO && segmentos[0] === PREFIJO_MUNICIPIO;
}

/**
 * Nombre de cada municipio según el <title> de su HTML compilado: ruta de página → nombre.
 * Un HTML ausente o sin título reconocible se omite: el nombre se deducirá del slug.
 */
export function leerNombresMunicipios(dirBase, secciones, rutas) {
  const nombres = {};
  for (const { seccion, patron } of PATRONES_NOMBRE) {
    const datos = secciones.find((candidata) => candidata.ruta === seccion);
    for (const ruta of rutas[seccion].filter((candidata) => esRutaDeMunicipio(candidata, seccion))) {
      const fichero = path.join(dirBase, dirSalidaDeWorker(datos.worker), `${ruta}.html`);
      const nombre = fs.existsSync(fichero) ? nombreDeTitulo(leerCabeceraHtml(fichero), patron) : undefined;
      if (nombre !== undefined) {
        nombres[ruta] = nombre;
      }
    }
  }
  return nombres;
}

function seccionesDeLaRed(secciones) {
  return secciones
    .filter((seccion) => seccionEnPortada(seccion, IDIOMA_RED))
    .map(({ ruta, nombre, descripcion }) => ({ ruta, nombre, descripcion }));
}

function leerRedActual(ficheroSalida) {
  if (!fs.existsSync(ficheroSalida)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(ficheroSalida, "utf8"));
  } catch {
    // Un fichero ilegible se sustituye por el nuevo: es una foto regenerable.
    return undefined;
  }
}

function sinCambios(actual, secciones, enlaces) {
  return (
    actual !== undefined &&
    actual.version === VERSION_RED &&
    JSON.stringify(actual.secciones) === JSON.stringify(secciones) &&
    JSON.stringify(actual.enlaces) === JSON.stringify(enlaces)
  );
}

/**
 * Genera config/red-enlaces.json. No reescribe el fichero si los enlaces y las secciones no cambian.
 * @param {{ dirBase: string, ficheroZbe: string, ficheroSalida: string }} opciones
 * @returns {{ informe: object, totalClaves: number, bytes: number, escrito: boolean }}
 */
export function generarRed({ dirBase, ficheroZbe, ficheroSalida }) {
  const secciones = leerSecciones(path.join(dirBase, "config", "secciones.json"));
  const rutas = rutasPorSeccion(dirBase, secciones);
  const nombres = leerNombresMunicipios(dirBase, secciones, rutas);
  const { enlaces, informe } = generarEnlaces({ rutas, enlacesZbe: leerEnlacesZbe(ficheroZbe), nombres });
  const seccionesRed = seccionesDeLaRed(secciones);
  const escrito = !sinCambios(leerRedActual(ficheroSalida), seccionesRed, enlaces);
  if (escrito) {
    const red = { version: VERSION_RED, generado: new Date().toISOString(), secciones: seccionesRed, enlaces };
    fs.writeFileSync(ficheroSalida, `${JSON.stringify(red, null, INDENTACION_JSON)}\n`);
  }
  return { informe, totalClaves: Object.keys(enlaces).length, bytes: fs.statSync(ficheroSalida).size, escrito };
}

function mostrarInforme({ informe, totalClaves, bytes, escrito }) {
  console.log(`Provincias de gasolineras: ${informe.provinciasGasolineras}`);
  for (const [tipo, total] of Object.entries(informe.provinciasEmparejadas)) {
    const sin = informe.provinciasSinPareja[tipo];
    console.log(`  ${tipo}: ${total} emparejadas; sin pareja en gasolineras: ${sin.length ? sin.join(", ") : "ninguna"}`);
  }
  console.log(`Municipios de gasolineras: ${informe.municipiosGasolineras}`);
  console.log(`  emparejados con recarga por slug o clave igual: ${informe.municipiosIguales}`);
  console.log(`  emparejados con recarga por contención: ${informe.municipiosContencion}`);
  console.log(`Ciudades ZBE enlazadas: ${informe.ciudadesZbeEnlazadas}`);
  console.log(`Claves en enlaces: ${totalClaves}; config/red-enlaces.json: ${bytes} bytes`);
  console.log(escrito ? "config/red-enlaces.json actualizado." : "Sin cambios: config/red-enlaces.json no se reescribe.");
}

function principal() {
  mostrarInforme(
    generarRed({
      dirBase: DIR_BASE,
      ficheroZbe: path.resolve(DIR_BASE, "..", "zbe-map", "data", "municipality-links.json"),
      ficheroSalida: path.join(DIR_BASE, "config", "red-enlaces.json"),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(CODIGO_ERROR);
  }
}
