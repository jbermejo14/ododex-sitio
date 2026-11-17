# Arquitectura: sitio ododex.com en Cloudflare Pages

## 1. Objetivo y alcance

Publicar `ododex.com` como un único sitio estático en Cloudflare Pages. El sitio junta:

- la **raíz** (`/`): portada de la red, `robots.txt`, `ads.txt`, `404.html` y cabeceras;
- cada **sección**: la exportación estática (`out/`) de una web Next.js de la carpeta hermana, copiada bajo su ruta base (`/es/multas`, `/es/impuestos`).

Este proyecto:

- compila cada sección con las variables de producción;
- ensambla la carpeta `dist/`;
- la sirve en local imitando a Cloudflare Pages, para verificarla;
- la sube con `wrangler pages deploy`.

Fuera de alcance:

- Cambiar las webs de las secciones. Ya exportan con `output: "export"` y su `basePath`.
- Configurar el panel de Cloudflare: DNS, dominio personalizado y redirección de `www`. Es tarea del titular y se documenta en el README.
- Analítica y despliegue automático desde git.

### Contexto

- Webs: `../multas-dgt` (basePath `/es/multas`) y `../calculadora-impuestos` (basePath `/es/impuestos`). Las dos tienen `npm run build`, que genera `out/`. Esa compilación lee `NEXT_PUBLIC_SITE_URL` (origen, p. ej. `https://ododex.com`) y `NEXT_PUBLIC_ADSENSE_CLIENT` (`ca-pub-` y 16 dígitos, o vacío).
- Dentro de `out/` las rutas no llevan la ruta base: `out/index.html` es la portada de la sección, `out/radares.html` es `/es/multas/radares`. Los enlaces internos apuntan a `/es/multas` sin barra final.
- Marca: `../brand/` (logos SVG y `README.md` con colores y eslogan). Estilo visual: tokens de `../calculadora-impuestos/app/globals.css`.
- Límites de Cloudflare Pages (plan gratuito): 20 000 ficheros por despliegue y 25 MiB por fichero. Hoy la suma es de unos 7 400 ficheros.

### Reglas de Cloudflare Pages que hay que imitar en local

Para una petición `GET /ruta`:

1. Si `dist/ruta` es un fichero, se sirve.
2. Si no, y existe `dist/ruta.html`, se sirve ese fichero.
3. Si no, y `dist/ruta/` es un directorio con `index.html`, se sirve `index.html`.
4. Si no, se busca `404.html` en el directorio de la ruta y en cada uno de sus padres hasta `dist/`, y se sirve el primero que se encuentre con estado 404.
5. Si tampoco hay ninguno, se responde 404 con texto plano.

La barra final se trata igual que la ruta sin barra. No se imitan las redirecciones de URL "bonitas" de Pages. Hay que verificar ese comportamiento en el primer despliegue real; el README lo indica.

## 2. Estructura

```
ododex-sitio/
  config/secciones.json     Secciones que se publican
  raiz/                     Ficheros fijos de la raíz (portada, 404, estilos, logos)
  lib/ensamblado.mjs        Lógica de ensamblado (sin efectos fuera de las rutas que recibe)
  lib/servidorLocal.mjs     Resolución de rutas al estilo Pages y servidor HTTP local
  scripts/construir.mjs     CLI: compila las secciones y ensambla dist/
  scripts/previsualizar.mjs CLI: sirve dist/ en local
  tests/*.test.mjs          Pruebas sin red
  dist/                     Salida (fuera de git)
```

JavaScript ESM (`.mjs`) con JSDoc, sin TypeScript ni dependencias de ejecución. Node 20 o superior. Única dependencia de desarrollo: `wrangler`, versión exacta `4.157.0`.

`package.json`:

```json
{
  "name": "ododex-sitio",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/construir.mjs",
    "build:sin-compilar": "node scripts/construir.mjs --sin-compilar",
    "preview": "node scripts/previsualizar.mjs",
    "deploy": "wrangler pages deploy dist --project-name ododex",
    "test": "node --test \"tests/**/*.test.mjs\""
  },
  "devDependencies": { "wrangler": "4.157.0" }
}
```

`.gitignore`: `node_modules/`, `dist/`, `.wrangler/`, `.env*`.

## 3. Módulos

### 3.1 Configuración de secciones (`config/secciones.json`)

```json
[
  {
    "ruta": "/es/multas",
    "proyecto": "../multas-dgt",
    "nombre": "Multas y radares",
    "descripcion": "Calcula multas por velocidad y puntos del carnet, y consulta los radares de la DGT."
  },
  {
    "ruta": "/es/impuestos",
    "proyecto": "../calculadora-impuestos",
    "nombre": "Impuestos de vehículos",
    "descripcion": "Calcula el impuesto de matriculación y el ITP de coches de segunda mano."
  }
]
```

`proyecto` es relativo a la carpeta `ododex-sitio`.

### 3.2 Ensamblado (`lib/ensamblado.mjs`)

Responsabilidad: transformar las secciones compiladas y la raíz en `dist/`.

Interfaz pública:

```js
/** @typedef {{ ruta: string, proyecto: string, nombre: string, descripcion: string }} Seccion */

/** Lee y valida config/secciones.json. Lanza Error con el fichero, el índice y el campo si:
 *  - no es un array no vacío;
 *  - falta un campo o no es texto;
 *  - `ruta` no cumple /^(\/[a-z0-9-]+)+$/ (empieza por "/", sin barra final, minúsculas);
 *  - hay rutas repetidas. */
export function leerSecciones(ficheroConfig) → Seccion[]

/** Origen del sitio sin barra final. Lanza Error si no es una URL https:// u http://localhost. */
export function normalizarOrigen(origen) → string

/** Contenido de robots.txt: "User-agent: *", "Allow: /", línea en blanco y una línea
 *  "Sitemap: <origen><ruta>/sitemap.xml" por sección, en el orden del config. Termina en "\n". */
export function textoRobots(origen, secciones) → string

/** Acepta "ca-pub-" o "pub-" seguido de 16 dígitos. Devuelve
 *  "google.com, pub-<16 dígitos>, DIRECT, f08c47fec0942fa0\n"; null si el valor está vacío o
 *  no existe. Lanza Error si hay valor pero no tiene el formato. */
export function textoAdsTxt(clienteAdsense) → string | null

/** Contenido de _headers para Pages: por cada sección, un bloque
 *  "<ruta>/_next/static/*" con "  Cache-Control: public, max-age=31536000, immutable".
 *  Al final, un bloque "/*" con
 *  "  X-Content-Type-Options: nosniff" y
 *  "  Referrer-Policy: strict-origin-when-cross-origin". */
export function textoHeaders(secciones) → string

/** Sustituye en la plantilla de portada el marcador <!-- SECCIONES --> por un enlace
 *  <a class="link-card" href="<ruta>"> por sección, con nombre y descripción escapados.
 *  También <!-- ORIGEN --> por el origen (para canonical y og:url).
 *  Lanza Error si falta alguno de los dos marcadores. */
export function generarPortada(plantilla, secciones, origen) → string

/** Copia <dirOut> (out/ de una sección) a <dist><ruta>/ y además copia <dirOut>/index.html
 *  a <dist><ruta>.html. Así /es/multas se sirve sin redirección a /es/multas/: los enlaces
 *  internos de Next usan la ruta sin barra final.
 *  Lanza Error si <dirOut> o su index.html no existen, con el aviso "compila la sección". */
export function copiarSeccion(dirOut, dist, ruta) → void

/** Corrige en <dirSeccion> los ficheros de precarga por segmentos que Next exporta mal en
 *  Windows. El navegador pide `<ruta>/__next.radares.$d$provincia.__PAGE__.txt` (segmentos
 *  unidos con puntos). Next 16.4 en Windows los escribe como carpetas
 *  (`__next.radares/$d$provincia/__PAGE__.txt`), porque su conversión solo sustituye "/" y la
 *  ruta trae "\".
 *  Para cada directorio cuyo nombre empiece por "__next.", mueve cada fichero que contenga
 *  al directorio padre de ese "__next.*", con su ruta relativa unida por puntos tras el
 *  nombre del directorio, y borra el directorio. Ejemplo:
 *  `a/__next.radares/$d$provincia/__PAGE__.txt` → `a/__next.radares.$d$provincia.__PAGE__.txt`.
 *  Si el destino ya existe, lanza Error. Sin esos directorios (compilación en Linux) no hace
 *  nada. Devuelve el número de ficheros movidos. */
export function aplanarSegmentosNext(dirSeccion) → number

/** Recorre dist y lanza Error si hay más de MAX_FICHEROS_PAGES (20000) ficheros o alguno
 *  supera MAX_BYTES_FICHERO_PAGES (25 MiB). El mensaje dice cuál y cuánto.
 *  Devuelve el número de ficheros. */
export function comprobarLimitesPages(dist) → number

/** Orquesta: vacía y recrea `dist`; copia `dirRaiz` (salvo index.html, que se genera con
 *  generarPortada a partir de raiz/index.html); llama a copiarSeccion y después a
 *  aplanarSegmentosNext sobre <dist><ruta> por sección; escribe
 *  robots.txt, _headers y, si textoAdsTxt no es null, ads.txt; comprueba los límites.
 *  Devuelve { ficheros, secciones: n, adsTxt: boolean }. */
export function ensamblar({ secciones, dirBase, dirRaiz, dist, origen, clienteAdsense }) → object
```

Notas:

- `dirBase` es la carpeta desde la que se resuelve `seccion.proyecto`. El `out/` de cada sección está en `<dirBase>/<proyecto>/out`.
- Vaciar `dist` solo se permite si su ruta absoluta termina en `dist` y está dentro de `dirBase`. Si no, se lanza Error. Es una protección contra borrar otra carpeta por error.
- Constantes con nombre: `MAX_FICHEROS_PAGES`, `MAX_BYTES_FICHERO_PAGES`, `MARCADOR_SECCIONES`, `MARCADOR_ORIGEN`.

### 3.3 Raíz estática (`raiz/`)

Responsabilidad: la portada y los ficheros comunes de `ododex.com/`.

- `raiz/index.html`: plantilla de la portada, en español (`lang="es"`).
  - `<title>`: "Ododex: los datos de tu coche, claros".
  - `meta description`.
  - `link rel="canonical"` y `og:url` con `<!-- ORIGEN -->/`.
  - `og:site_name` "Ododex".
  - Favicon `/ododex-favicon.svg`.
  - Script de tema idéntico al de las secciones: `localStorage['ododex-theme']`, `data-theme`, con `try/catch`.
  - Cabecera: logo claro y oscuro alternados por CSS según `data-theme`, y botón de tema accesible (`aria-label`, 44 × 44 px).
  - `<main>`: H1 "Los datos de tu coche, claros.", un párrafo que explica qué es Ododex (sitio independiente, no oficial de la DGT ni de Hacienda), y la rejilla `<!-- SECCIONES -->`.
  - Pie: "Ododex" y los enlaces legales de la primera sección (`/es/multas/aviso-legal`, `/es/multas/privacidad` y `/es/multas/cookies`).
  - Sin JavaScript aparte del script de tema y del manejador del botón, en línea y cortos.
- `raiz/404.html`: página de error en español con el mismo estilo, enlace a `/` y a cada sección escrito a mano. `meta robots noindex`.
- `raiz/estilos.css`:
  - tokens de color de los dos temas copiados de `../calculadora-impuestos/app/globals.css` (`:root`/`[data-theme]`);
  - `body`, cabecera, `.link-card`, pie y foco visible;
  - fuente del sistema (`system-ui`), sin descargas;
  - contraste AA y sin desbordamiento horizontal a 375 px.
- Logos: `raiz/brand/ododex-logo-light.svg` y `raiz/brand/ododex-logo-dark.svg`, más `raiz/ododex-favicon.svg`. Son copias sin modificar de `../brand/`.

### 3.4 CLI de construcción (`scripts/construir.mjs`)

Responsabilidad: ejecutar el flujo completo desde la consola.

- Variables de entorno:
  - `SITE_ORIGIN`: por defecto `https://ododex.com`.
  - `ADSENSE_CLIENT`: por defecto vacía.
- Sin `--sin-compilar`, ejecuta `npm run build` en cada `proyecto`, en secuencia, con `child_process.spawnSync`, `shell: true` (necesario en Windows para `npm`), `stdio: "inherit"` y estas variables de entorno añadidas: `NEXT_PUBLIC_SITE_URL=<origen>` y `NEXT_PUBLIC_ADSENSE_CLIENT=<ADSENSE_CLIENT>`. Si una compilación falla, el proceso termina con código 1 y el mensaje "Falló la compilación de <ruta> en <proyecto>".
- Después llama a `ensamblar` y muestra un resumen: ficheros, secciones y si se generó `ads.txt`.
- Si `ADSENSE_CLIENT` está vacía, avisa de que no se genera `ads.txt` y de que las secciones se compilan sin AdSense.
- Errores: mensaje en español en stderr y código 1. Nunca se silencian.

### 3.5 Servidor local (`lib/servidorLocal.mjs`, `scripts/previsualizar.mjs`)

Responsabilidad: servir `dist/` como lo haría Pages, para verificar antes de subir.

```js
/** Resuelve una ruta URL (sin query) a { fichero, estado } siguiendo las reglas de la
 *  sección 1, o a { fichero: null, estado: 404 }. Decodifica %xx y rechaza (404) cualquier
 *  ruta que salga de dist tras normalizar ("..").
 *  dist es una ruta absoluta. */
export function resolverRuta(dist, rutaUrl) → { fichero: string | null, estado: 200 | 404 }

/** Tipo MIME por extensión: html, css, js, json, txt, xml, svg, png, ico, woff2, webp y map.
 *  Por defecto application/octet-stream. Los de texto llevan "; charset=utf-8". */
export function tipoMime(fichero) → string

/** Crea un http.Server que sirve dist con resolverRuta y tipoMime. Solo GET y HEAD (405 si no). */
export function crearServidor(dist) → http.Server
```

`scripts/previsualizar.mjs` escucha en `PORT` (por defecto 8788) y muestra la URL.

## 4. Orden de implementación

1. `lib/ensamblado.mjs` y `config/secciones.json`, con sus pruebas.
2. `lib/servidorLocal.mjs`, con sus pruebas.
3. `raiz/`.
4. `scripts/construir.mjs` y `scripts/previsualizar.mjs`.

Los módulos 1 y 2 no dependen entre sí.

## 5. Criterios de aceptación

- `npm test` pasa sin red, con pruebas en `tests/ensamblado.test.mjs` y `tests/servidorLocal.test.mjs`. Usan carpetas temporales de `os.tmpdir()` y las borran al terminar. Deben cubrir:
  - `leerSecciones`: válido, array vacío, campo ausente, ruta con barra final, ruta repetida.
  - `textoRobots`: el contenido exacto para las dos secciones.
  - `textoAdsTxt`: `ca-pub-`, `pub-`, vacío, `undefined` e inválido.
  - `generarPortada`: enlaces, escapado de `<` y `&`, y falta de marcador.
  - `copiarSeccion`: genera `<ruta>.html` y `<ruta>/index.html`, y da error sin `out/`.
  - `comprobarLimitesPages`: con límites bajos inyectados como parámetro opcional.
  - `ensamblar`: el árbol completo con dos secciones falsas, y la protección de `dist`.
  - `resolverRuta`: las reglas 1 a 5, la barra final, `%20` y `..`.
  - `crearServidor`: un GET real a `127.0.0.1` en un puerto libre devuelve 200 y 404, y POST devuelve 405.
- `npm run build:sin-compilar`, con los `out/` actuales de las dos webs, genera `dist/` con:
  - `index.html`, `404.html`, `robots.txt` y `_headers`;
  - `es/multas.html`, `es/multas/index.html`, `es/impuestos.html` y `es/impuestos/index.html`.
- Verificación en pantalla (sesión principal), con `npm run preview`:
  - la portada, en claro y oscuro, a 375 y 1280 px;
  - `/es/multas` y `/es/impuestos` cargan con estilos e imágenes;
  - la navegación interna funciona;
  - una ruta inexistente bajo `/es/multas/` devuelve la 404 de multas, y una ruta inexistente en la raíz devuelve la 404 raíz.
