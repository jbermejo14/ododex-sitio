import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_SALIDA } from "../lib/ensamblado.mjs";
import { crearServidor } from "../lib/servidorLocal.mjs";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", DIR_SALIDA);
const PUERTO_POR_DEFECTO = 8788;
const PUERTO_MINIMO = 1;
const PUERTO_MAXIMO = 65535;
const DIRECCION_LOCAL = "127.0.0.1";
const CODIGO_ERROR = 1;

function fallar(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(CODIGO_ERROR);
}

function leerPuerto() {
  const puerto = Number(process.env.PORT || PUERTO_POR_DEFECTO);
  if (!Number.isInteger(puerto) || puerto < PUERTO_MINIMO || puerto > PUERTO_MAXIMO) {
    fallar(`PORT="${process.env.PORT}" no es válido. Usa un entero entre ${PUERTO_MINIMO} y ${PUERTO_MAXIMO}.`);
  }
  return puerto;
}

if (!fs.existsSync(DIST)) {
  fallar(`no existe ${DIST}. Ejecuta npm run build antes de previsualizar.`);
}

const puerto = leerPuerto();
const servidor = crearServidor(DIST);

servidor.on("error", (error) => {
  fallar(`no se pudo escuchar en el puerto ${puerto} (${error.message}). Cambia PORT o libera el puerto.`);
});

servidor.listen(puerto, DIRECCION_LOCAL, () => {
  console.log(`Sirviendo ${DIST} en http://localhost:${puerto}`);
});
