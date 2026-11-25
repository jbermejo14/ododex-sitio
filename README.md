# ododex-sitio

> **Documentación general de la red** (estado, arquitectura, operaciones, pendientes y hoja de ruta): [`docs/README.md`](docs/README.md).

Publica `ododex.com` en Cloudflare como un único sitio estático (Worker `ododex` con recursos estáticos; Cloudflare ha integrado Pages en Workers):

- **Raíz** (`/`): portada de la red Ododex, `robots.txt`, `ads.txt`, `404.html` y `_headers`.
- **Secciones**: la exportación estática de cada web Next.js hermana, bajo su ruta base.

| Ruta | Proyecto |
|---|---|
| `/es/multas` | `../multas-dgt` |
| `/es/impuestos` | `../calculadora-impuestos` |
| `/es/gasolineras` | `../gasolineras` (Worker propio) |
| `/es/llamadas-revision` | `../recalls-web`, carpeta `out-es` (Worker propio) |
| `/en/recalls` | `../recalls-web`, carpeta `out-en` (Worker propio; no sale en la portada) |
| `/es/zaragoza-bus` | `../zarabus` (Worker propio con proxy de tiempos; sin publicar) |

Las secciones están en `config/secciones.json`. El diseño completo está en [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Requisitos

- Node.js 20 o superior.
- Las webs hermanas instaladas (`npm install --force` en cada una).
- `config/titular.json` relleno en cada web (datos del aviso legal; ver su README).

```bash
npm install
```

---

## Uso

### Compilar y ensamblar

Compila cada sección con las variables de producción y genera `dist/`:

```bash
ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX npm run build
```

En PowerShell:

```powershell
$env:ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX"; npm run build
```

| Variable | Descripción | Por defecto |
|---|---|---|
| `SITE_ORIGIN` | Origen del sitio. Se pasa a cada web como `NEXT_PUBLIC_SITE_URL` (canonical, sitemap) y se usa en `robots.txt` y la portada | `https://ododex.com` |
| `ADSENSE_CLIENT` | Editor de AdSense (`ca-pub-` y 16 dígitos). Se pasa a cada web como `NEXT_PUBLIC_ADSENSE_CLIENT` y genera `ads.txt`. Vacía: sin AdSense ni `ads.txt` | vacía |
| `ADSENSE_SLOT` | Unidad de anuncio display adaptable (`data-ad-slot`, 10 dígitos). Se pasa a cada web como `NEXT_PUBLIC_ADSENSE_SLOT`. Vacía: las webs no pintan bloques de anuncio | vacía |

Si las secciones ya están compiladas y solo quieres volver a ensamblar:

```bash
npm run build:sin-compilar
```

Cuidado: un `out/` compilado con `npm run build` dentro de una web, sin estas variables, lleva `http://localhost:3000` en los canonical y no carga AdSense. Para publicar, usa siempre `npm run build` desde aquí.

### Ver en local

```bash
npm run preview
```

Sirve `dist/` en `http://127.0.0.1:8788` (variable `PORT` para cambiarlo), con las mismas reglas de rutas que Cloudflare Pages: `/ruta` → `ruta.html` → `ruta/index.html`, y la `404.html` más cercana.

### Publicar

```bash
npm run deploy
```

Sube cada carpeta de salida a su Worker con `wrangler deploy` (versión fijada en `package.json`; configuración en `wrangler.jsonc` y `wrangler.<nombre>.jsonc`). Solo sube los ficheros que han cambiado. La primera vez hay que iniciar sesión con `npx wrangler login`.

### Varios Workers y páginas solo HTML

Gasolineras (`/es/gasolineras`) tiene unas 15 000 páginas y el plan gratuito admite 20 000 ficheros por Worker, así que va en su propio Worker (`ododex-gasolineras`) con su carpeta de salida (`dist-gasolineras/`) y su configuración (`wrangler.gasolineras.jsonc`). Se indica en `config/secciones.json` con dos campos opcionales:

- `worker`: nombre del Worker propio (`ododex-<nombre>`). Sin él, la sección va al Worker principal.
- `paginasSoloHtml`: patrones de página, relativos a la sección y sin `.html` (`gasolinera/*`, `provincia/*/*`; `*` vale por un segmento). De esas páginas solo se publica el HTML: se quitan sus datos RSC (`<página>.txt` y `<página>/`).

`npm run build` genera `dist/` (raíz, portada, `robots.txt` con los sitemaps de todas las secciones y las secciones del Worker principal) y una carpeta `dist-<nombre>/` por Worker propio. `npm run deploy` despliega todos los Workers; la configuración de wrangler de cada Worker propio debe llamarse `wrangler.<nombre>.jsonc`. `npm run preview` sirve `dist/` y, bajo la ruta de cada sección con Worker propio, su carpeta, como quedará con las routes.

El origen, el cliente y la unidad de AdSense por defecto están en `config/produccion.json` (`origen`, `clienteAdsense`, `unidadAdsense`). `SITE_ORIGIN`, `ADSENSE_CLIENT` y `ADSENSE_SLOT` tienen prioridad si no están vacías.

### Secciones compiladas por idioma

`../recalls-web` se compila dos veces, una por idioma (`RECALLS_LANG`), y cada idioma va en su Worker (`ododex-llamadas-revision` y `ododex-recalls`, con `wrangler.llamadas-revision.jsonc` y `wrangler.recalls.jsonc`). Para eso hay cuatro campos opcionales más en `config/secciones.json`:

- `entorno`: variables de entorno extra para compilar la sección, sumadas a las de producción. Claves `[A-Z_][A-Z0-9_]*`; valores `[A-Za-z0-9._-]*`.
- `exportacion`: carpeta de exportación dentro del proyecto (por defecto `out`). Dos secciones del mismo proyecto pueden usar carpetas distintas.
- `scriptBuild`: script de npm que compila la sección (por defecto `build`; aquí `build:es` y `build:en`).
- `enPortada`: con `false`, la sección no sale en la portada de su idioma, pero su sitemap sí está en `robots.txt`.
- `publicada`: con `false`, la sección se compila y ensambla, pero no sale en ninguna portada ni en `robots.txt` (para webs aún sin publicar, como `/fr/zfe`).
- `anuncios`: booleano, por defecto `true`. Con `false`, la sección no lleva anuncios (decisión editorial, como `/es/zaragoza-bus`) y la guardia de producción no exige en sus páginas el script de AdSense; sigue rechazando `localhost` y marcadores sin sustituir.
- Portadas por idioma: `/` lista las secciones `/es/…` y `/fr` las `/fr/…` (plantillas `raiz/index.html` y `raiz/fr/index.html`; ver la sección 9 de `ARCHITECTURE.md`).

Antes de ensamblar hay que compilar `../recalls-web` (`npm run build` de este proyecto lo hace). Si falta una carpeta de exportación, el error dice qué sección y qué comando.

### Actualizar solo gasolineras

Los precios cambian a diario. Haz doble clic en `Actualizar gasolineras.bat` (o ejecuta `npm run actualizar:gasolineras`): compila solo `/es/gasolineras`, regenera solo `dist-gasolineras/` y despliega solo `ododex-gasolineras`. No toca el Worker principal. Las opciones `--solo /es/gasolineras` de `scripts/construir.mjs` y `scripts/desplegar.mjs` permiten hacer lo mismo con otra sección. No lo ejecutes si no quieres publicar.

### Enlaces entre secciones

`npm run red` lee los `sitemap.xml` ya compilados (`dist*/…`) y los datos de `../zbe-map`, y escribe `config/red-enlaces.json` (se versiona). `construir.mjs` pasa su ruta a cada web en `ODODEX_RED_ENLACES`. Se ejecuta a mano tras una compilación completa; no forma parte de la actualización diaria. Detalle en ARCHITECTURE.md, sección 10.

### Pruebas

```bash
npm test
```

Sin red. Cubren el ensamblado (secciones, `robots.txt`, `ads.txt`, `_headers`, portada, copia, aplanado de segmentos, límites de Pages, protección de `dist`) y el servidor local (resolución de rutas, 404, recorrido de directorios, métodos).

---

## Primera publicación en Cloudflare (pasos del titular)

1. **Cuenta y dominio.** Crea una cuenta gratuita en Cloudflare. En "Add a site" añade `ododex.com` con el plan Free. Cloudflare te dará dos *nameservers*.
2. **DNS en Arsys.** En el panel de Arsys, en la gestión del dominio `ododex.com`, cambia los servidores DNS por los dos de Cloudflare. Puede tardar de minutos a 24 horas. Cloudflare avisa por correo cuando el dominio está activo.
3. **Primer despliegue (hecho el 17/11/2026).** `npx wrangler login`, `npm run build` (con `ADSENSE_CLIENT` si ya tienes AdSense) y `npm run deploy`. No hace falta crear nada en el panel: `wrangler deploy` crea el Worker `ododex` y lo publica en una URL `*.workers.dev` de tu cuenta.
4. **Sin uso.** (Antes era el proyecto de Pages; ya no aplica.)
5. **Dominio personalizado.** Cuando el dominio esté activo en Cloudflare: "Workers & Pages" → `ododex` → "Settings" → "Domains & Routes" → "Add" → "Custom domain": `ododex.com` y después `www.ododex.com`. Cloudflare crea los registros DNS. Después puedes desactivar ahí mismo la URL `*.workers.dev`, que incluye el nombre de tu cuenta.
6. **Redirección de www.** En el dominio `ododex.com` → "Rules" → "Redirect Rules", crea una regla: si el host es `www.ododex.com`, redirige con 301 a `https://ododex.com` conservando la ruta y la consulta.
   Para gasolineras: añade a `wrangler.gasolineras.jsonc` `"routes": [{ "pattern": "ododex.com/es/gasolineras*", "zone_name": "ododex.com" }]` y vuelve a desplegar con `npm run deploy`. Las routes se ejecutan antes que el dominio personalizado del Worker principal. Hasta entonces, gasolineras se prueba en la URL `*.workers.dev` de `ododex-gasolineras`, bajo `/es/gasolineras`.
7. **Comprobación tras el primer despliegue:**
   - `https://ododex.com/es/multas` carga sin redirección a `/es/multas/` (`curl -I`, estado 200).
   - Navegar entre páginas no deja errores 404 en la consola del navegador.
   - `https://ododex.com/robots.txt` lista los sitemaps.
   - `https://ododex.com/no-existe` y `https://ododex.com/es/multas/no-existe` devuelven 404 con su página.
8. **Search Console.** Añade la propiedad de dominio `ododex.com`. La verificación por DNS se hace en Cloudflare. Envía los sitemaps de cada sección: `https://ododex.com/es/multas/sitemap.xml` y `https://ododex.com/es/impuestos/sitemap.xml`.
9. **AdSense.** Da de alta `ododex.com`, activa los anuncios automáticos y crea el mensaje de consentimiento de la UE en "Privacidad y mensajes". Después recompila con `ADSENSE_CLIENT` y vuelve a desplegar para que se generen el script y `ads.txt`.

### Bloques de anuncio manuales (AdSense)

Las webs colocan bloques de anuncio en posiciones fijas (ver la sección "Anuncios" del `ARCHITECTURE.md` de cada web). Todos usan la misma unidad:

1. En AdSense: Anuncios, Por unidad de anuncio, Anuncios display, crea una unidad **adaptable** (nombre sugerido: "ododex-display").
2. Copia el `data-ad-slot` (10 dígitos) del código que muestra.
3. Ponlo en `unidadAdsense` de `config/produccion.json` (o en `ADSENSE_SLOT` al compilar) y recompila con `npm run build`.

Sin unidad (o sin cliente) no se pinta ningún bloque. Conviene **desactivar el ancla** en Anuncios, Anuncios automáticos, formatos de anuncio: los bloques manuales la sustituyen.

---

## Notas

- **Segmentos de precarga de Next en Windows.** Next 16.4 en Windows exporta los ficheros de precarga como carpetas (`__next.radares/$d$provincia/__PAGE__.txt`) en lugar del nombre con puntos que pide el navegador (`__next.radares.$d$provincia.__PAGE__.txt`). `aplanarSegmentosNext` lo corrige en `dist/`. En Linux no hay nada que corregir y la función no hace nada.
- **Límites del plan gratuito de Pages:** 20 000 ficheros por despliegue y 25 MiB por fichero. El ensamblado falla con un mensaje claro si se superan. Hoy el sitio tiene unos 7 400 ficheros. Cada web nueva suma los suyos.
- **Añadir una sección:** su web debe exportar con `output: "export"` y `basePath` igual a la ruta. Añádela a `config/secciones.json` y escribe a mano su enlace en `raiz/404.html`. La portada, `robots.txt` y `_headers` se generan solos.
