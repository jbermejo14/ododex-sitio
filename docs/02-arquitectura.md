# 2. Arquitectura de la red

## Vista general

```
Arsys (registrador)  ──NS──▶  Cloudflare (DNS + proxy + HTTPS)
                                   │
              ┌────────────────────┼─────────────────────────────────────┐
              │ Routes de zona (se evalúan ANTES que el dominio)          │
              │   ododex.com/es/gasolineras*       → Worker ododex-gasolineras
              │   ododex.com/es/electrico-vs-gasolina* → Worker ododex-electrico-vs-gasolina
              │   ododex.com/es/itv*               → Worker ododex-itv
              │   ododex.com/es/zbe*               → Worker ododex-zbe
              │   ododex.com/es/zaragoza-bus*      → Worker ododex-zaragoza-bus (con proxy de tiempos)
              │   ododex.com/es/tranvia-zaragoza*  → Worker ododex-tranvia-zaragoza (con proxy de tiempos)
              │   ododex.com/es/puntos-recarga*    → Worker ododex-puntos-recarga
              │   ododex.com/es/llamadas-revision* → Worker ododex-llamadas-revision
              │   ododex.com/en/recalls*           → Worker ododex-recalls
              │   ododex.com/fr/prix-carburants*   → Worker ododex-prix-carburants
              │   ododex.com/fr/zfe*               → Worker ododex-zfe
              │   ododex.com/fr/radars*            → Worker ododex-radars
              │ Dominio personalizado (todo lo demás)                     │
              │   ododex.com                       → Worker ododex
              │       /                  portada (raiz/)
              │       /fr                portada francesa (raiz/fr/)
              │       /es/multas         multas-dgt
              │       /es/impuestos      calculadora-impuestos
              │       /robots.txt, /ads.txt, /_headers, /404.html
              └──────────────────────────────────────────────────────────┘
```

Todo son **Workers con recursos estáticos** ("static assets"). No hay código de servidor: cada Worker sirve únicamente ficheros. Cloudflare integró Pages en Workers, así que se publica con `wrangler deploy` y no con Pages.

## Por qué varios Workers

El plan gratuito permite **20 000 ficheros por versión de Worker** y 25 MiB por fichero. Las webs grandes (gasolineras, puntos de recarga, llamadas a revisión, ZBE) generan miles de páginas cada una, y juntas no caben. Por eso:

- el Worker principal `ododex` lleva la portada y las secciones pequeñas (multas e impuestos);
- cada sección grande va en su propio Worker, enganchado a `ododex.com` con una **route de zona** (`ododex.com/es/<sección>*`).

Recuento aproximado de ficheros por Worker:

| Worker | Contenido | Ficheros |
|---|---|---|
| `ododex` | portada, /es/multas, /es/impuestos | unos 2 000 |
| `ododex-gasolineras` | /es/gasolineras | ~16 300 (~1 GB) |
| `ododex-puntos-recarga` | /es/puntos-recarga | ~15 643 |
| `ododex-llamadas-revision` | /es/llamadas-revision | ~14 733 |
| `ododex-recalls` | /en/recalls | ~14 733 |
| `ododex-prix-carburants` | /fr/prix-carburants | ~18 050 |
| `ododex-zbe` | /es/zbe | ~6 621 |
| `ododex-electrico-vs-gasolina` | /es/electrico-vs-gasolina | ~334 (Worker propio para actualizarlo cada día sin redesplegar el principal) |
| `ododex-itv` | /es/itv | ~3 000 |
| `ododex-zfe` | /fr/zfe | ~132 (Worker propio para publicar y cambiar sus datos sin redesplegar el principal) |
| `ododex-radars` | /fr/radars | ~148 con el extracto (Worker propio, como zfe) |
| `ododex-zaragoza-bus` | /es/zaragoza-bus | 73 (Worker propio con código: proxy de tiempos reales Avanza → DNDzgz) |
| `ododex-tranvia-zaragoza` | /es/tranvia-zaragoza | ~40 (Worker propio con código: proxy de tiempos reales del tranvía → DNDzgz; solo `/api/*` ejecuta código) |

`comprobarLimitesPages` (en `lib/ensamblado.mjs`) falla el ensamblado si una salida supera 20 000 ficheros o algún fichero supera 25 MiB.

## Páginas "solo HTML" (`paginasSoloHtml`)

Next.js exporta, por cada página, el `.html` y además ficheros `.txt` de RSC y de segmentos de precarga, lo que triplica el número de ficheros. Para caber en el límite, las páginas de detalle muy numerosas se publican **solo como HTML**:

- en `config/secciones.json`, `paginasSoloHtml` lista patrones (`gasolinera/*`, `provincia/*/*`, `punto/*`, `campana/*`, `marca/*/*`);
- `quitarRscDePaginas` borra de la salida los `.txt` de esas rutas;
- dentro de cada web, los enlaces a esas rutas usan el componente `InternalLink`, que produce un `<a>` normal y no un `<Link>` de Next. Así el navegador no pide el RSC que ya no existe. `isHtmlOnlyRoute(path)` en `src/lib/site.ts` decide cuándo, y una prueba prohíbe `<Link>` hacia esas rutas.

## Fallo de Next en Windows: segmentos como carpetas

En Windows, Next 16 escribe los ficheros de precarga de segmentos como carpetas (`__next.radares/$d$provincia/__PAGE__.txt`) en vez de como nombres con puntos. `aplanarSegmentosNext` los aplana al ensamblar. Sin esto, la navegación en cliente pide ficheros que no existen.

## Proyecto `ododex-sitio` (el ensamblador)

Es el único sitio desde el que se compila y publica. Estructura:

```
ododex-sitio/
├── ARCHITECTURE.md            contrato técnico (secciones 1-8)
├── README.md                  uso y primera publicación
├── docs/                      esta documentación
├── config/
│   ├── secciones.json         lista de secciones (ruta, proyecto, worker, ...)
│   └── produccion.json        origen, cliente y unidad de AdSense
├── lib/
│   ├── ensamblado.mjs         lógica pura de ensamblado (probada)
│   └── servidorLocal.mjs      servidor de previsualización (probado)
├── scripts/
│   ├── construir.mjs          compila cada web y ensambla (flags --solo, --sin-compilar)
│   ├── desplegar.mjs          wrangler deploy de cada Worker (flag --solo)
│   └── previsualizar.mjs      sirve dist/ y dist-* en http://localhost:8788
├── raiz/                      portada, 404.html, estilos.css, logos
├── tests/                     node --test (99 pruebas)
├── wrangler.jsonc             Worker ododex (dominio personalizado)
├── wrangler.<sección>.jsonc   un fichero por Worker de sección
└── Actualizar gasolineras.bat acceso para la actualización diaria
```

### `config/secciones.json`: campos de cada sección

| Campo | Obligatorio | Significado |
|---|---|---|
| `ruta` | sí | Ruta base pública, igual al `basePath` de la web (`/es/multas`). |
| `proyecto` | sí | Carpeta del proyecto, relativa a `ododex-sitio`. |
| `nombre`, `descripcion` | sí | Texto de la tarjeta en la portada. |
| `worker` | no | Si existe, la sección va en su propio Worker y su salida en `dist-<sufijo>/`. Si no, va dentro de `dist/`. |
| `paginasSoloHtml` | no | Patrones de rutas publicadas sin RSC. |
| `entorno` | no | Variables extra para la compilación (ej. `RECALLS_LANG`). |
| `exportacion` | no | Carpeta de salida de Next si no es `out` (ej. `out-es`). |
| `scriptBuild` | no | Script de npm a ejecutar si no es `build` (ej. `build:es`). |
| `enPortada` | no | `false` para no mostrarla en la portada de su idioma (recalls en inglés). |
| `publicada` | no | `false` mientras la web no esté publicada: se ensambla, pero no sale en portadas ni en `robots.txt` (hoy `/fr/zfe` y `/fr/radars`). |
| `anuncios` | no | `false` si la sección no lleva anuncios (hoy `/es/zaragoza-bus`): la guardia de salida no le exige el script de AdSense, pero sigue vigilando `localhost` y marcadores sin sustituir. Por defecto `true`. |

### `config/produccion.json`

```json
{ "origen": "https://ododex.com", "clienteAdsense": "ca-pub-2749781881817715", "unidadAdsense": "8745518895" }
```

`construir.mjs` pasa estos valores a cada compilación como `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADSENSE_CLIENT` y `NEXT_PUBLIC_ADSENSE_SLOT`.

### Qué hace `npm run build`

1. Lee `secciones.json` y `produccion.json`.
2. Para cada sección (o solo una con `--solo /es/gasolineras`), ejecuta `npm run <scriptBuild>` en su proyecto con las variables anteriores. Con `--sin-compilar` se salta este paso y reutiliza la salida existente.
3. Copia la salida a `dist/<ruta>` o a `dist-<sufijo>/<ruta>`.
4. Aplana los segmentos de Next y quita el RSC de las páginas solo HTML.
5. Genera la portada a partir de `raiz/index.html` (tarjetas de secciones), `robots.txt` (con un sitemap por sección), `ads.txt` y `_headers`. Inserta el script de AdSense en lugar del marcador `<!-- ADSENSE -->` de la portada y de la 404.
6. Comprueba los límites de ficheros.

### Qué hace `npm run deploy`

Ejecuta `npx wrangler deploy --config wrangler.<sufijo>.jsonc` para cada Worker (o solo uno con `--solo`). Requiere tener la sesión de wrangler iniciada (`npx wrangler login`, que abre el navegador para autorizar).

### Configuración común de los Workers (`wrangler*.jsonc`)

- `assets.directory`: `dist` o `dist-<sufijo>`.
- `assets.html_handling: "auto-trailing-slash"`.
- `assets.not_found_handling: "404-page"`: sirve la `404.html` más cercana.
- `workers_dev: false` y `preview_urls: false`: no hay URLs `*.workers.dev` públicas.
- `ododex`: `routes: [{ pattern: "ododex.com", custom_domain: true }]`.
- Secciones: `routes: [{ pattern: "ododex.com/es/<sección>*", zone_name: "ododex.com" }]`.
- wrangler fijado en `4.157.0` en `devDependencies`.

## Cada web (patrón común)

Todas las webs publicadas siguen el mismo patrón, aunque vengan de proyectos distintos:

- **Next.js 16.4.6 App Router**, React 19.3.0 y Tailwind 4.3.3 (por PostCSS).
- `next.config.ts`: `output: 'export'`, `basePath: '/es/<sección>'`, `trailingSlash` según la web e `images.unoptimized`.
- **Sin rutas API ni servidor:** los datos se generan en la compilación (JSON en `public/datos/` o importados en el código) y la lógica interactiva corre en el navegador.
- Rutas dinámicas con `generateStaticParams`, `dynamicParams = false` y sin `revalidate`.
- `src/lib/site.ts` con `SITE_NAME`, `SECTION_NAME`, `BASE_PATH`, `getSiteUrl()`, `absoluteUrl()`, `assetPath()` y, si aplica, `isHtmlOnlyRoute()`.
- `sitemap.ts` con `force-static`; `robots.txt` **no** lo sirve cada web, sino la raíz.
- Canonical, `og:url` y JSON-LD con `absoluteUrl` (dominio de producción).
- Componentes comunes copiados entre proyectos (no hay paquete compartido): `Header`, `Footer`, `BrandLogo`, `Breadcrumbs`, `AdSenseScript`, `ConsentSettingsButton`, `AdSlot` e `InternalLink`.
- Mapas con Leaflet y teselas OpenStreetMap y Esri (CARTO exige clave de API desde 2026).

## DNS y HTTPS

- Los nameservers de Arsys apuntan a Cloudflare.
- Se borraron los registros importados de Arsys (provocaban el error 525).
- HTTPS: certificado universal de Cloudflare.
- **Pendiente del titular:** activar "Always Use HTTPS" y crear `www` (registro AAAA `100::` con proxy y regla "Redirect from WWW to root"). Ver [06-pendientes-y-mejoras.md](06-pendientes-y-mejoras.md).

## Mapa de carpetas del espacio de trabajo

`C:\Users\Usuario\Desktop\pruebas` (no es un repositorio git):

| Carpeta | Qué es | Estado |
|---|---|---|
| `ododex-sitio` | Ensamblador y despliegue | Publicado |
| `multas-dgt` | /es/multas | Publicado |
| `calculadora-impuestos` | /es/impuestos | Publicado |
| `gasolineras` | /es/gasolineras | Publicado (actualización diaria) |
| `zbe-map` | /es/zbe | Publicado |
| `electrico-vs-gasolina` | /es/electrico-vs-gasolina | Publicado (se actualiza con gasolineras) |
| `es-itv` | /es/itv | Centros ITV (OSM), calculadora de fechas y tarifas por comunidad |
| `charger-map` | /es/puntos-recarga | Publicado |
| `recalls-web` | /es/llamadas-revision y /en/recalls | Publicado |
| `prix-carburants-fr` | /fr/prix-carburants (Francia, en francés) | Publicado (actualización diaria con gasolineras) |
| `zfe-fr` | /fr/zfe (Francia, en francés) | Integrada en el ensamblado; sin publicar (datos de ejemplo) |
| `radars-fr` | /fr/radars (Francia, en francés) | Integrada en el ensamblado; sin publicar (extracto de radares de 2018) |
| `zarabus` | /es/zaragoza-bus (autobús urbano de Zaragoza) | Publicada el 19/11/2026 |
| `zaratram-live` | /es/tranvia-zaragoza (tranvía de Zaragoza, L1) | Integrada en el ensamblado |
| `vehicle-stats` | Estadísticas del parque (microdatos DGT) | Sin publicar |
| `uk-petrostation` | Gasolineras de Reino Unido | Sin publicar (sin datos reales) |
| `uk-ulez-map` | ULEZ de Londres | Sin publicar (necesita clave DVLA y servidor) |
| `brand` | Guía de marca y logos | — |
| `negocio` | Estudios de negocio (afiliación) | — |
| `prompts` | Prompts para crear webs nuevas | — |
| `.claude/launch.json` | Configuraciones de previsualización (`ododex-preview`, puerto 8788) | — |
