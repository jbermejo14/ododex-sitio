import path from "node:path";
import { fileURLToPath } from "node:url";
import { crearServidor } from "../lib/servidorLocal.mjs";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PUERTO_POR_DEFECTO = 8788;
const CODIGO_ERROR = 1;

const puerto = Number(process.env.PORT || PUERTO_POR_DEFECTO);
const servidor = crearServidor(DIST);

servidor.on("error", (error) => {
  console.error(`Error: no se pudo escuchar en el puerto ${puerto} (${error.message}). Cambia PORT o libera el puerto.`);
  process.exit(CODIGO_ERROR);
});

servidor.listen(puerto, () => {
  console.log(`Sirviendo ${DIST} en http://localhost:${puerto}`);
});
