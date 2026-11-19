# Arquitectura: sitio ododex.com en Cloudflare Pages

## 1. Objetivo y alcance

Publicar `ododex.com` como un único sitio estático en Cloudflare Pages. El sitio junta:

- la **raíz** (`/`): portada de la red, `robots.txt`, `ads.txt`, `404.html` y cabeceras;
- cada **sección**: la exportación estática (`out/`) de una web Next.js de la carpeta hermana, copiada bajo su ruta base (`/es/multas`, `/es/impuestos`).

Este proyecto:

- compila cada sección con las variables de producción;
- ensambla la carpeta `dist/`;
- la sirve en local imitando a Cloudflare Pages, para verificarla;
- la sube con `wrangler deploy` como "static assets" de un Worker (`wrangler.jsonc`).

> **Nota (17/11/2026):** Cloudflare ha integrado Pages en Workers. `wrangler pages project create` ya crea un Worker con recursos estáticos, así que el sitio se publica como Worker `ododex` con `assets.directory = "dist"`, `html_handling = "auto-trailing-slash"` y `not_found_handling = "404-page"`, que reproducen las reglas de la sección siguiente. Los límites y `_headers` funcionan igual. Donde este documento dice "Pages", léase "recursos estáticos de Workers".

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
    "deploy": "wrangler deploy",
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

---

## 6. Ampliación: varios Workers, páginas solo HTML y actualización de una sección

### 6.1 Motivo

Gasolineras (`../gasolineras`, ruta `/es/gasolineras`) tiene unas 15 000 páginas. En el plan gratuito cada Worker admite 20 000 ficheros. Por eso:

- gasolineras se publica en un **Worker propio** (`ododex-gasolineras`), con su carpeta de salida y su configuración de wrangler;
- de sus páginas de gasolinera y de municipio se publica **solo el HTML**;
- el titular la actualiza a diario, solo esa sección, con doble clic.

Cuando `ododex.com` esté en Cloudflare, una *route* `ododex.com/es/gasolineras*` llevará esas peticiones al Worker de gasolineras. Las routes se ejecutan antes que el dominio personalizado del Worker principal. Hasta entonces se prueba en su URL `*.workers.dev`, bajo `/es/gasolineras`.

### 6.2 Configuración

`config/secciones.json`: cada sección admite dos campos opcionales.

- `"worker"`: nombre del Worker propio. Si no se indica, la sección va al Worker principal.
- `"paginasSoloHtml"`: lista de patrones de ruta de página, relativos a la sección y sin `.html`. Cada segmento es literal o `*` (un segmento cualquiera). Ejemplo: `["gasolinera/*", "provincia/*/*"]`.

```json
{
  "ruta": "/es/gasolineras",
  "proyecto": "../gasolineras",
  "nombre": "Gasolineras",
  "descripcion": "Precio de la gasolina y el diésel hoy en cada gasolinera de España.",
  "worker": "ododex-gasolineras",
  "paginasSoloHtml": ["gasolinera/*", "provincia/*/*"]
}
```

`config/produccion.json`, en git, porque no tiene secretos: `{ "origen": "https://ododex.com", "clienteAdsense": "" }`. Las variables de entorno `SITE_ORIGIN` y `ADSENSE_CLIENT`, si existen, tienen prioridad.

### 6.3 Ensamblado (`lib/ensamblado.mjs`)

Nuevas funciones públicas:

```js
/** Carpeta de salida de un Worker: DIR_SALIDA ("dist") para el principal,
 *  `${DIR_SALIDA}-${sufijo}` para los demás, donde sufijo es el nombre del worker sin el
 *  prefijo "ododex-" (ododex-gasolineras → dist-gasolineras). */
export function dirSalidaDeWorker(worker | undefined) → string

/** Para cada página <dirSeccion>/<P>.html cuya ruta P cumpla algún patrón: borra <P>.txt si
 *  existe y el directorio <P>/ si existe. Lanza Error si ese directorio contiene algo que no
 *  empiece por "__next" (se borraría contenido real). Devuelve las páginas tratadas. */
export function quitarRscDePaginas(dirSeccion, patrones) → number

/** Lee config/produccion.json y aplica las variables de entorno.
 *  Devuelve { origen, clienteAdsense }. */
export function leerProduccion(ficheroConfig, entorno = process.env) → object
```

Cambios en `leerSecciones`: valida `worker`, que debe cumplir `/^ododex-[a-z0-9-]+$/`, y `paginasSoloHtml`, que debe ser un array de cadenas con segmentos `[a-z0-9-]+` o `*`.

Cambios en `ensamblar({ ..., solo })`:

- Agrupa las secciones por Worker y genera una carpeta por Worker con `dirSalidaDeWorker`.
- Carpeta principal (`dist/`): raíz, portada, `robots.txt` (con los sitemaps de **todas** las secciones, también las de otros Workers), `_headers` y `ads.txt`, más las secciones sin `worker`. La portada enlaza todas las secciones.
- Carpeta de cada Worker propio: solo sus secciones y un `_headers` con sus bloques de `_next/static`. No lleva raíz ni portada; su 404 es la de la sección.
- Por sección, en este orden: `copiarSeccion`, `aplanarSegmentosNext`, `quitarRscDePaginas` (si tiene `paginasSoloHtml`).
- `comprobarLimitesPages` se aplica a **cada** carpeta de salida.
- Con `solo: "<ruta>"`, solo se regenera la carpeta del Worker de esa sección, y la carpeta principal no se toca. Si esa sección va en el Worker principal, se regenera `dist/` entero, porque es una sola carpeta. Una `solo` que no está en el config da error.
- La protección de vaciado de 3.2 se aplica a cada carpeta: el nombre debe empezar por `dist`.
- Devuelve `{ workers: [{ worker, dir, ficheros }], secciones, adsTxt }`.

### 6.4 Scripts

- `scripts/construir.mjs`:
  - acepta `--solo <ruta>`: compila solo esa sección y ensambla con `solo`;
  - lee el origen y AdSense con `leerProduccion`.
- `scripts/desplegar.mjs` (nuevo): por cada Worker afectado (todos, o el de `--solo`), ejecuta `npx wrangler deploy --config <fichero>` con `spawnSync` y `shell: true`, sin interpolar datos externos.
  - El Worker principal usa `wrangler.jsonc`.
  - Cada Worker propio usa `wrangler.<sufijo>.jsonc`, que tiene que existir; si no, da error.
  - Termina con código 1 y un mensaje claro si algo falla.
- `wrangler.gasolineras.jsonc`: `name: "ododex-gasolineras"`, `assets.directory: "dist-gasolineras"`, `html_handling: "auto-trailing-slash"`, `not_found_handling: "404-page"` y la misma `compatibility_date`. Las `routes` se añadirán cuando el dominio esté en Cloudflare; el README lo explica.
- `package.json`:
  - `"deploy": "node scripts/desplegar.mjs"`;
  - `"actualizar:gasolineras": "node scripts/construir.mjs --solo /es/gasolineras && node scripts/desplegar.mjs --solo /es/gasolineras"`.
- `.gitignore`: `dist-*/`.
- `Actualizar gasolineras.bat`, en la raíz del proyecto:
  1. cambia a su propia carpeta con `cd /d "%~dp0"`;
  2. muestra "Actualizando precios de gasolineras…";
  3. ejecuta `npm run actualizar:gasolineras`;
  4. muestra un aviso de éxito o de error según `%ERRORLEVEL%`;
  5. termina con `pause`, para que el titular vea el resultado.

  Lo copia la sesión principal al escritorio como acceso directo.
- `scripts/previsualizar.mjs`: sirve `dist/` y, bajo la ruta de cada sección con Worker propio, su carpeta. Así se ve en local como quedará con las routes. Lo resuelve `crearServidor(dist, montajes)`, donde `montajes` es `[{ prefijo: "/es/gasolineras", dir: <abs dist-gasolineras> }]` y la ruta se resuelve sobre esa carpeta conservando la URL completa.

### 6.5 Criterios de aceptación

- `npm test` pasa, con estas pruebas nuevas:
  - `dirSalidaDeWorker`;
  - `quitarRscDePaginas`: patrón con `*`, la página de provincia no se toca, error si el directorio tiene contenido real;
  - `leerProduccion` con y sin variables de entorno;
  - `leerSecciones` con `worker` o `paginasSoloHtml` inválidos;
  - `ensamblar` con dos Workers, comprobando que `robots.txt` lista los tres sitemaps y que `solo` no toca `dist/`;
  - el servidor con montajes.
- `npm run build:sin-compilar` sigue funcionando con las secciones compiladas. Si el `out/` de gasolineras aún no existe, el error dice qué sección compilar.

---

## 7. Ampliación: secciones compiladas por idioma (llamadas a revisión)

### 7.1 Motivo

`../recalls-web` se compila dos veces, una por idioma, con la variable `RECALLS_LANG`:

- con `es`, exporta en `out-es/` bajo `/es/llamadas-revision`;
- con `en`, exporta en `out-en/` bajo `/en/recalls`.

Cada idioma va en su propio Worker. La sección inglesa no es de España, así que no debe salir en la portada española.

### 7.2 Configuración

Campos opcionales nuevos de cada sección en `config/secciones.json`:

- `"entorno"`: objeto de variables de entorno adicionales para su compilación. Claves `[A-Z_][A-Z0-9_]*`; valores de texto `[A-Za-z0-9._-]*`, sin espacios ni caracteres de shell.
- `"exportacion"`: nombre de la carpeta de exportación dentro del proyecto, `[a-z0-9-]+`. Por defecto `DIR_EXPORTACION` (`"out"`).
- `"enPortada"`: booleano, por defecto `true`. Con `false`, la sección no sale en la portada. Sí sale su sitemap en `robots.txt`.

Secciones nuevas:

```json
{
  "ruta": "/es/llamadas-revision",
  "proyecto": "../recalls-web",
  "nombre": "Llamadas a revisión",
  "descripcion": "Campañas de llamada a revisión de coches y motos publicadas en Safety Gate, por marca y modelo.",
  "worker": "ododex-llamadas-revision",
  "entorno": { "RECALLS_LANG": "es" },
  "exportacion": "out-es",
  "paginasSoloHtml": ["campana/*", "marca/*/*"]
},
{
  "ruta": "/en/recalls",
  "proyecto": "../recalls-web",
  "nombre": "Vehicle recalls",
  "descripcion": "EU Safety Gate vehicle recall campaigns by make and model.",
  "worker": "ododex-recalls",
  "entorno": { "RECALLS_LANG": "en" },
  "exportacion": "out-en",
  "paginasSoloHtml": ["campana/*", "marca/*/*"],
  "enPortada": false
}
```

### 7.3 Cambios

- `leerSecciones` valida los tres campos con mensajes claros.
- `construir.mjs`:
  - compila cada sección con su `entorno` sumado al de producción;
  - si dos secciones comparten `proyecto`, cada una se compila por separado con su entorno, mediante `npm run build:<idioma>` si `entorno.RECALLS_LANG` existe, o `npm run build` en los demás casos. Para no meter lógica de un proyecto concreto aquí, se añade un campo opcional `"scriptBuild"` (por defecto `"build"`, `[a-z0-9:-]+`), y estas dos secciones usan `"build:es"` y `"build:en"`.
- `copiarSeccion`, `exigirSeccionesCompiladas` y demás usan `<proyecto>/<exportacion>`.
- `generarPortada` solo enlaza las secciones con `enPortada !== false`.
- Nuevos ficheros `wrangler.llamadas-revision.jsonc` (`name: "ododex-llamadas-revision"`, `assets.directory: "dist-llamadas-revision"`) y `wrangler.recalls.jsonc` (`name: "ododex-recalls"`, `assets.directory: "dist-recalls"`). Los dos llevan `html_handling: "auto-trailing-slash"`, `not_found_handling: "404-page"`, la misma `compatibility_date`, `workers_dev: false`, `preview_urls: false` y su route: `ododex.com/es/llamadas-revision*` y `ododex.com/en/recalls*` (`zone_name: "ododex.com"`).
- `raiz/404.html`: enlace a `/es/llamadas-revision`.
- README: tabla de secciones y nota sobre `entorno`, `exportacion`, `scriptBuild` y `enPortada`.

### 7.4 Criterios de aceptación

- `npm test` pasa, con pruebas de:
  - validación de `entorno`, `exportacion`, `scriptBuild` y `enPortada`;
  - portada sin las secciones con `enPortada: false`;
  - `robots.txt` con todas las secciones;
  - ensamblado de dos secciones del mismo proyecto con distintas carpetas de exportación;
  - el comando de compilación elegido, con una función pura exportada `comandoCompilacion(seccion)` que devuelve `"npm run <scriptBuild>"`.
- `node --check` pasa en todos los scripts.

---

## 8. Bloques de anuncio manuales (AdSense)

### 8.1 Motivo

Los anuncios automáticos de AdSense solo encuentran hueco para el **ancla** (barra fija abajo) en las webs de la red, y el titular la considera abusiva. Se colocan **bloques manuales** en posiciones elegidas, y el titular desactiva el ancla en AdSense (Anuncios → Anuncios automáticos → formatos).

### 8.2 Configuración

- `config/produccion.json` añade `"unidadAdsense": ""`: el identificador de una unidad de anuncio display adaptable creada por el titular en AdSense (`data-ad-slot`, 10 dígitos). La misma unidad se usa en todos los huecos de todas las secciones.
- `leerProduccion` la devuelve como `unidadAdsense`. La variable de entorno `ADSENSE_SLOT` tiene prioridad si no está vacía. Lanza Error si no está vacía y no cumple `/^\d{10}$/`, con un mensaje que diga dónde se obtiene.
- `construir.mjs` la pasa a cada compilación como `NEXT_PUBLIC_ADSENSE_SLOT`, junto a `NEXT_PUBLIC_ADSENSE_CLIENT`.

### 8.3 Componente `AdSlot` (en cada web)

Interfaz igual en las cinco webs, junto a su `AdSenseScript`:

```tsx
/** Hueco de anuncio manual. No renderiza nada si falta un cliente válido
 *  (NEXT_PUBLIC_ADSENSE_CLIENT) o una unidad válida (NEXT_PUBLIC_ADSENSE_SLOT, 10 dígitos). */
export function AdSlot(props: { className?: string }): JSX.Element | null;
```

- Componente de cliente. Renderiza:

  ```html
  <aside aria-label="Publicidad">
    <span>Publicidad</span>
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-…" data-ad-slot="…" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </aside>
  ```

  - El texto "Publicidad" va pequeño y en `text-muted`; lo exige la LSSI (art. 20). En inglés, en recalls-web con `en`, es "Advertisement".
  - Tras montar, ejecuta `(window.adsbygoogle = window.adsbygoogle || []).push({})` una sola vez por instancia (con `useEffect` y una ref que lo evite dos veces en modo estricto). Un error del `push` se registra con `console.error`, sin romper la página.
- Reserva de espacio para evitar saltos de contenido: `min-height` de 280 px en móvil y de 250 px desde `md`, mediante una clase `.ad-slot` en `@layer components` con tokens existentes (fondo `--bg-surface`, borde `--border-color`, radio de las tarjetas). Ancho completo del contenedor y margen vertical como el de las tarjetas.
- Sin colores fijos (las pruebas de colores de cada web lo vigilan).

### 8.4 Dónde van los huecos

Reglas comunes:

- Como máximo **3 por página**. Nunca por encima del primer contenido útil (el titular de la página y su herramienta o resultado principal), nunca dentro de un formulario, una tabla, un mapa o una tarjeta de resultado, y nunca pegados a botones (al menos el margen de una tarjeta).
- Las páginas legales (`/aviso-legal`, `/privacidad`, `/cookies`) y la 404 no llevan anuncios.
- Posiciones típicas:
  1. después del resultado o de la herramienta principal;
  2. entre dos secciones de contenido a mitad de página;
  3. antes del pie, al final del contenido.
- Cada web documenta en su `ARCHITECTURE.md` (sección nueva "Anuncios") qué páginas llevan huecos y dónde.

### 8.5 Criterios de aceptación (en cada web)

- Prueba de `AdSlot`:
  - sin cliente o sin unidad, o con valores inválidos, no renderiza nada;
  - con valores válidos (cliente `ca-pub-0000000000000000`, unidad `0000000000`), renderiza `<ins class="adsbygoogle">` con `data-ad-client`, `data-ad-slot`, `data-ad-format="auto"` y el texto "Publicidad".
- Prueba de que ninguna página legal importa `AdSlot`.
- Prueba de que ninguna página pasa de 3 `AdSlot`, contando las apariciones en su fichero y en los componentes de página que use. Si contarlas así no es fiable, basta con un recuento en el HTML exportado durante la verificación.
- `npm test`, `tsc` y build pasan. En el HTML exportado sin unidad configurada no hay ningún `<ins class="adsbygoogle">`.

## 9. Ampliación: portadas por idioma (`/fr`) y secciones sin publicar

Añadida el 2026-11-19 a petición del titular: `https://ododex.com/fr` muestra el listado de webs de Francia, igual que `https://ododex.com/` muestra las de España.

### 9.1 Qué hace y qué no

- La portada española (`/`) lista las secciones cuya `ruta` empieza por `/es/`; la francesa (`/fr`, fichero `dist/fr/index.html`) las que empiezan por `/fr/`. En ambas se omiten las que tienen `enPortada: false` o `publicada: false`.
- `/fr` tiene su propia 404 en francés (`dist/fr/404.html`): con `not_found_handling: "404-page"` Cloudflare sirve la 404 más cercana, así que cualquier `/fr/...` inexistente que llegue al Worker principal la muestra.
- Enlace de idioma: la portada española enlaza a « Version française » (`/fr`) y la francesa a « Versión en español » (`/`).
- Campo nuevo `publicada` en `secciones.json` (booleano, opcional, por defecto `true`). Con `false`, la sección se compila y ensambla como siempre (para poder previsualizarla), pero **no aparece en ninguna portada ni en `robots.txt`**. Se usa para `/fr/zfe` mientras tenga datos de ejemplo.
- No hay portada `/en` (hoy solo existe `/en/recalls`).
- No cambia el diseño: misma hoja `estilos.css`, mismas tarjetas.

### 9.2 Cambios en `lib/ensamblado.mjs`

```js
/** Portadas por idioma: plantilla en raiz/, destino en la salida del Worker principal. */
export const PORTADAS = [
  { idioma: "es", plantilla: "index.html", destino: "index.html" },
  { idioma: "fr", plantilla: "fr/index.html", destino: "fr/index.html" },
];

/** true si la sección va en la portada de ese idioma: ruta /<idioma>/…, enPortada !== false y publicada !== false. */
export function seccionEnPortada(seccion, idioma);

/** Igual que hoy, con el idioma como cuarto parámetro (por defecto "es"): solo tarjetas de seccionEnPortada(s, idioma). */
export function generarPortada(plantilla, secciones, origen, idioma = "es");

/** robots.txt: un Sitemap por sección con publicada !== false (las demás reglas, igual). */
export function textoRobots(origen, secciones);
```

- `validarSeccion`: `publicada`, si existe, debe ser booleano (mensaje como el de `enPortada`).
- `ensamblarPrincipal`: genera las dos portadas (`PORTADAS`), y `copiarRaiz` excluye **todas** las plantillas de `PORTADAS` (ya no solo `index.html`) para no copiarlas con los marcadores sin rellenar.
- `PAGINAS_RAIZ_CON_ADSENSE` incluye `fr/index.html` y `fr/404.html`.
- Si falta la plantilla de una portada: Error que diga qué fichero falta en `raiz/`.

### 9.3 Plantillas nuevas

- `raiz/fr/index.html`: copia de `raiz/index.html` en francés (`lang="fr"`), con:
  - `<title>Ododex : les données de votre voiture, en clair</title>`, descripción, canonical y `og:url` `<!-- ORIGEN -->/fr`, `og:locale` `fr_FR`;
  - H1 « Les données de votre voiture, en clair. » e introducción: « Ododex est un site indépendant de comparateurs et de calculateurs pour les automobilistes en France. Ce n'est pas un site officiel : vérifiez toujours les sources officielles avant de prendre une décision. »;
  - `aria-label` del botón de tema y de la navegación en francés (« Changer de thème clair/sombre », « Sections »);
  - pie con « Mentions légales », « Confidentialité », « Cookies » enlazando a `/fr/prix-carburants/mentions-legales`, `/fr/prix-carburants/confidentialite`, `/fr/prix-carburants/cookies`, y « Versión en español » a `/`;
  - el logo enlaza a `/fr`; marcadores `<!-- ADSENSE -->`, `<!-- SECCIONES -->` y `<!-- ORIGEN -->`.
- `raiz/fr/404.html`: copia de `raiz/404.html` en francés (« Page introuvable », enlace « Retour à l'accueil » a `/fr`), `noindex`, marcador `<!-- ADSENSE -->`.
- `raiz/index.html`: añade en el pie « Version française » enlazando a `/fr`.

### 9.4 Configuración

- `config/secciones.json`: `/fr/prix-carburants` pierde `enPortada: false` (pasa a la portada francesa); `/fr/zfe` sustituye `enPortada: false` por `publicada: false`. `/en/recalls` sigue con `enPortada: false`.

### 9.5 Criterios de aceptación (`tests/ensamblado.test.mjs`)

- `seccionEnPortada`: `/es/x` en `es` sí y en `fr` no; `/fr/x` al revés; `enPortada: false` y `publicada: false` → no; `/en/x` en ninguna.
- `generarPortada` con idioma `fr` solo pinta las francesas; sin idioma, las españolas (compatibilidad).
- `textoRobots` omite las secciones con `publicada: false`.
- `leerSecciones` rechaza `publicada` no booleano.
- `ensamblar` (con una raíz de prueba que tenga `fr/index.html` y `fr/404.html`): `dist/fr/index.html` existe, tiene las tarjetas francesas, ningún marcador sin rellenar y el script de AdSense; `dist/index.html` no lista secciones `/fr/`.
- `npm test` entero en verde; las pruebas existentes de portada siguen pasando (adaptadas solo si cambian de forma justificada).

## 10. Ampliación: enlaces entre secciones (red de Ododex)

Añadida el 2026-11-19. La auditoría SEO mostró que casi ninguna página enlaza a otra web de la red. Objetivo: que cada página de provincia, municipio o ficha enlace a sus equivalentes en las demás webs españolas, y que todas las webs españolas enlacen a las demás en el pie.

### 10.1 Qué hace y qué no

- `scripts/generar-red.mjs` lee los `sitemap.xml` ya compilados de las secciones (`dist*/…/sitemap.xml`) y escribe `config/red-enlaces.json` (versionado, foto fija; se regenera a mano o en la actualización diaria).
- `construir.mjs` pasa a cada compilación la variable `ODODEX_RED_ENLACES` con la ruta absoluta de ese fichero. Sin la variable o sin el fichero, las webs no pintan enlaces de red (desarrollo local).
- Solo secciones `/es/…` publicadas (`publicada !== false`). Las francesas y `/en/recalls` quedan fuera de esta versión.
- No hay enlaces por comunidad autónoma (impuestos) ni por marca (llamadas a revisión): esas webs solo reciben el pie.

### 10.2 Formato de `config/red-enlaces.json`

```json
{
  "version": 1,
  "generado": "2026-11-19T18:00:00.000Z",
  "secciones": [ { "ruta": "/es/multas", "nombre": "Multas y radares", "descripcion": "…" } ],
  "enlaces": {
    "/es/gasolineras/provincia/alicante": [
      { "seccion": "/es/puntos-recarga", "texto": "Puntos de recarga en Alicante", "href": "/es/puntos-recarga/provincia/alicante-alacant" }
    ]
  }
}
```

- `secciones`: las secciones `/es/` publicadas con `enPortada !== false`, en el orden de `secciones.json` (para el pie).
- `enlaces`: clave = ruta de la página **sin barra final**; valor = enlaces a **otras** secciones, en el orden fijo de 10.4. Rutas desde la raíz del dominio (las webs las pintan con `<a href>` tal cual: son de otra sección, así que no llevan el `basePath` propio).
- `texto`: lo genera el script con el nombre de la sección destino y el nombre del lugar legible (10.3).

### 10.3 Emparejamiento (funciones puras en `lib/red.mjs`, probadas)

```js
/** Clave de un slug: palabras únicas sin artículos ni conectores (a, o, la, las, el, los, l, de, del, les, els, illes, i, y), ordenadas y unidas por espacio. */
export function claveLugar(slug);
/** true si las claves son iguales o si las palabras de una están todas en la otra (« alicante » ⊂ « alacant alicante »). */
export function clavesCompatibles(a, b);
/** Empareja dos listas de slugs: primero por clave igual; lo que quede, por compatibilidad si es única (una sola candidata en cada sentido). Devuelve Map slugA → slugB. */
export function emparejar(slugsA, slugsB);
/** Nombre legible de un slug: palabras con mayúscula inicial salvo artículos; « coruna-a » → « A Coruña » no es deducible: usa la tabla NOMBRES_PROVINCIA (52 provincias, nombre oficial en castellano) para provincias y, para municipios, mayúscula inicial por palabra moviendo el artículo final al principio (« rozas-de-madrid-las » → « Las Rozas de Madrid »). */
export function nombreLugar(slug, tipo);
```

- **Provincias:** las de gasolineras (`/provincia/<p>`) son la referencia; se emparejan con recarga (`/provincia/<p>`), ITV (`/centros/<p>`), multas (`/radares/<p>`) y eléctrico vs gasolina (`/<p>`).
- **Municipios:** dentro de cada pareja de provincias, gasolineras (`/provincia/<p>/<m>`) con recarga (`/provincia/<p>/<m>`).
- **ZBE:** de `../zbe-map/data/municipality-links.json` (ciudad ZBE → municipio de gasolineras y de recarga). Si el fichero no existe, sin enlaces ZBE y aviso.
- El script imprime cuántas provincias y municipios ha emparejado por sección y los que no.

### 10.4 Qué enlaces lleva cada página (orden fijo)

| Página (clave) | Enlaces |
|---|---|
| gasolineras provincia | recarga provincia, eléctrico vs gasolina provincia, ITV centros provincia, radares provincia |
| gasolineras municipio | recarga municipio, ZBE ciudad, ITV centros provincia |
| recarga provincia | gasolineras provincia, eléctrico vs gasolina provincia, ITV centros provincia, radares provincia |
| recarga municipio | gasolineras municipio, ZBE ciudad, ITV centros provincia |
| ITV centros provincia | gasolineras provincia, recarga provincia, radares provincia |
| radares provincia | gasolineras provincia, ITV centros provincia, recarga provincia |
| eléctrico vs gasolina provincia | recarga provincia, gasolineras provincia, ITV centros provincia |

Solo se incluye un enlace si la página destino existe en su sitemap. Las fichas (gasolinera, punto de recarga) usan los enlaces de **su municipio** (la web busca la clave de la página de su municipio).

Textos (`texto`): « Puntos de recarga en {lugar} », « Gasolineras en {lugar} », « Coche eléctrico o gasolina en {lugar} », « Centros ITV en {provincia} », « Radares DGT en {provincia} », « Zona de bajas emisiones de {ciudad} ».

### 10.5 Integración en `construir.mjs` y en la actualización diaria

- `construir.mjs`: añade `ODODEX_RED_ENLACES=<ruta absoluta de config/red-enlaces.json>` al entorno de cada compilación (si el fichero existe).
- `package.json`: script `red` (`node scripts/generar-red.mjs`). No se encadena en la actualización diaria (los municipios con página cambian poco); se ejecuta a mano tras una compilación completa y se versiona el JSON.

### 10.6 Aceptación

- `tests/red.test.mjs`: `claveLugar` (artículos, orden, repetidas), `clavesCompatibles` (contención en ambos sentidos), `emparejar` (iguales, contención única, ambigüedad → sin pareja), `nombreLugar` (provincias de la tabla, artículo final), generación de `enlaces` con sitemaps de prueba en un directorio temporal (orden fijo, sin autoenlace, solo destinos existentes, ZBE opcional).
- Ejecución real: `node scripts/generar-red.mjs` con los `dist*` actuales; informe de emparejados.
