import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { comprobarSalidaProduccion, dirSalidaDeWorker, leerOpcionSolo, leerProduccion, leerSecciones, sufijoDeWorker } from "../lib/ensamblado.mjs";

const DIR_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_WRANGLER_PRINCIPAL = "wrangler.jsonc";
const NOMBRE_WORKER_PRINCIPAL = "ododex";
const CODIGO_ERROR = 1;

function ficheroWrangler(worker) {
  return worker === undefined ? CONFIG_WRANGLER_PRINCIPAL : `wrangler.${sufijoDeWorker(worker)}.jsonc`;
}

// El principal va primero; después, cada Worker propio una sola vez.
function workersAfectados(secciones, solo) {
  if (solo === undefined) {
    return [undefined, ...new Set(secciones.map((s) => s.worker).filter((worker) => worker !== undefined))];
  }
  const objetivo = secciones.find((seccion) => seccion.ruta === solo);
  if (!objetivo) {
    throw new Error(`La sección "${solo}" no está en config/secciones.json.`);
  }
  return [objetivo.worker];
}

function exigirPreparado(worker, clienteAdsense) {
  const config = path.join(DIR_BASE, ficheroWrangler(worker));
  if (!fs.existsSync(config)) {
    throw new Error(`Falta ${config}. Crea la configuración de wrangler del Worker ${worker ?? NOMBRE_WORKER_PRINCIPAL}.`);
  }
  const salida = path.join(DIR_BASE, dirSalidaDeWorker(worker));
  if (!fs.existsSync(salida)) {
    throw new Error(`No existe ${salida}. Ejecuta npm run build antes de desplegar.`);
  }
  // Frena también salidas copiadas a mano sin pasar por construir.mjs.
  comprobarSalidaProduccion(salida, clienteAdsense);
}

// Los datos del comando salen de nombres validados por leerSecciones, no de entrada externa.
function desplegarWorker(worker) {
  const fichero = ficheroWrangler(worker);
  const resultado = spawnSync(`npx wrangler deploy --config ${fichero}`, { cwd: DIR_BASE, shell: true, stdio: "inherit" });
  if (resultado.error) {
    throw new Error(`No se pudo lanzar wrangler para ${fichero}: ${resultado.error.message}`);
  }
  if (resultado.status !== 0) {
    throw new Error(`Falló el despliegue con ${fichero}. Revisa el mensaje de wrangler (¿sesión iniciada con npx wrangler login?).`);
  }
}

function desplegar() {
  const secciones = leerSecciones(path.join(DIR_BASE, "config", "secciones.json"));
  const workers = workersAfectados(secciones, leerOpcionSolo(process.argv));
  const { clienteAdsense } = leerProduccion(path.join(DIR_BASE, "config", "produccion.json"));
  workers.forEach((worker) => exigirPreparado(worker, clienteAdsense));
  workers.forEach(desplegarWorker);
}

try {
  desplegar();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(CODIGO_ERROR);
}
