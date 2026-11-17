import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_SALIDA, ensamblar, leerSecciones, normalizarOrigen, textoAdsTxt } from "../lib/ensamblado.mjs";

const DIR_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN_POR_DEFECTO = "https://ododex.com";
const FLAG_SIN_COMPILAR = "--sin-compilar";
const CODIGO_ERROR = 1;

function compilarSeccion(seccion, origen, clienteAdsense) {
  const resultado = spawnSync("npm run build", {
    cwd: path.resolve(DIR_BASE, seccion.proyecto),
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: origen,
      NEXT_PUBLIC_ADSENSE_CLIENT: clienteAdsense,
    },
  });
  if (resultado.error) {
    throw new Error(`No se pudo lanzar la compilación de ${seccion.ruta} en ${seccion.proyecto}: ${resultado.error.message}`);
  }
  if (resultado.status !== 0) {
    throw new Error(`Falló la compilación de ${seccion.ruta} en ${seccion.proyecto}`);
  }
}

function mostrarResumen(resumen) {
  console.log(`Ficheros: ${resumen.ficheros}`);
  console.log(`Secciones: ${resumen.secciones}`);
  console.log(`ads.txt: ${resumen.adsTxt ? "generado" : "no generado"}`);
}

function avisarAdsenseVacio(sinCompilar) {
  const consecuencia = sinCompilar
    ? "No se genera ads.txt; las secciones ya compiladas no cambian."
    : "No se genera ads.txt y las secciones se compilan sin AdSense.";
  console.warn(`Aviso: ADSENSE_CLIENT está vacía. ${consecuencia}`);
}

function construir() {
  const sinCompilar = process.argv.includes(FLAG_SIN_COMPILAR);
  const origen = normalizarOrigen(process.env.SITE_ORIGIN || ORIGEN_POR_DEFECTO);
  const clienteAdsense = process.env.ADSENSE_CLIENT || "";
  const secciones = leerSecciones(path.join(DIR_BASE, "config", "secciones.json"));

  // Se valida antes de compilar para no perder minutos de compilación por un valor mal escrito.
  textoAdsTxt(clienteAdsense);
  if (clienteAdsense === "") {
    avisarAdsenseVacio(sinCompilar);
  }
  if (!sinCompilar) {
    secciones.forEach((seccion) => compilarSeccion(seccion, origen, clienteAdsense));
  }
  mostrarResumen(
    ensamblar({
      secciones,
      dirBase: DIR_BASE,
      dirRaiz: path.join(DIR_BASE, "raiz"),
      dist: path.join(DIR_BASE, DIR_SALIDA),
      origen,
      clienteAdsense,
    }),
  );
}

try {
  construir();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(CODIGO_ERROR);
}
