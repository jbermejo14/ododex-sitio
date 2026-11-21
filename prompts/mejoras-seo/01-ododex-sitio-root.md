# Prompt de Optimización SEO: ododex-sitio (Raíz y Ensamblador)

## Contexto del Proyecto
`ododex-sitio` es el ensamblador principal de la red Ododex. Genera la raíz (`/`), la portada francesa (`/fr`), el archivo `robots.txt`, `ads.txt`, `_headers`, la página de error `404.html` y ensambla los sitemaps de todas las webs hermanas exportadas por Next.js.

## Problemas Detectados en la Auditoría
1. **Canónica y Redirección en `/fr`:** `https://ododex.com/fr` devuelve una redirección temporal 307 a `/fr/`, pero `raiz/fr/index.html` declara canonical hacia `https://ododex.com/fr` sin barra final.
2. **Falta de Hreflang en `<head>`:** La portada raíz y la portada francesa no declaran `<link rel="alternate" hreflang="es" ...>` ni `<link rel="alternate" hreflang="fr" ...>` en el `<head>`.
3. **Ausencia de Páginas de Entidad (E-E-A-T):** No existen páginas de `/sobre-nosotros` ni `/contacto`. Las páginas legales de la raíz enlazan a `/es/multas/aviso-legal`. Esto penaliza la confianza de marca y bloquea la aprobación de AdSense.
4. **Sitemap Index Maestro Inexistente:** `robots.txt` lista los 12 sitemaps individuales, pero no existe un archivo `https://ododex.com/sitemap.xml` que funcione como índice maestro `<sitemapindex>`.
5. **Favicon sólo en SVG:** Solo se declara `/ododex-favicon.svg`. Los rastreadores móviles de Google Search requieren favicon PNG (48x48, 96x96 o 192x192 px) o favicon.ico para mostrar el icono en los snippets de resultados.
6. **Falta de `og:image`:** La raíz no tiene declarada imagen Open Graph ni Twitter Card.

## Tareas a Realizar

1. **Corregir Canonical en `raiz/fr/index.html`:**
   - Cambiar `<link rel="canonical" href="<!-- ORIGEN -->/fr">` por `<link rel="canonical" href="<!-- ORIGEN -->/fr/">`.
   - Añadir en `<head>` de `raiz/index.html` y `raiz/fr/index.html`:
     ```html
     <link rel="alternate" hreflang="es" href="<!-- ORIGEN -->/">
     <link rel="alternate" hreflang="fr" href="<!-- ORIGEN -->/fr/">
     <link rel="alternate" hreflang="x-default" href="<!-- ORIGEN -->/">
     ```

2. **Crear Páginas de Entidad E-E-A-T:**
   - Crear `raiz/sobre-nosotros.html`: Explicar qué es Ododex (portal independiente de utilidades del automóvil), fuentes oficiales empleadas (BOE, DGT, MITECO, Safety Gate, Ministerio de Economía francés) y compromiso de transparencia.
   - Crear `raiz/contacto.html`: Formulario o correo de contacto directo para incidencias, rectificaciones o sugerencias.
   - Enlazar ambas páginas en el footer de `raiz/index.html` y `raiz/404.html`.

3. **Crear Generador de Sitemap Index Maestro:**
   - Crear `scripts/generar-sitemap-index.mjs` que construya `dist/sitemap.xml` agrupando todos los sitemaps de las secciones configuradas en `config/secciones.json`.
   - Incluir `Sitemap: https://ododex.com/sitemap.xml` en la cabecera de `robots.txt`.

4. **Incorporar Favicon PNG y Meta Tags Open Graph:**
   - Añadir `raiz/brand/ododex-og.png` y enlazar en `<head>`:
     ```html
     <meta property="og:image" content="<!-- ORIGEN -->/brand/ododex-og.png">
     <meta property="og:image:width" content="1200">
     <meta property="og:image:height" content="630">
     <meta name="twitter:card" content="summary_large_image">
     <meta name="twitter:image" content="<!-- ORIGEN -->/brand/ododex-og.png">
     ```
   - Añadir favicon PNG (`/ododex-favicon-48.png`, `/ododex-favicon-192.png`) y `<link rel="apple-touch-icon" href="/ododex-favicon-192.png">`.

## Criterios de Aceptación
- `npm test` pasa al 100% (208 pruebas sin regresiones).
- `dist/` ensambla con `dist/sitemap.xml`, `dist/sobre-nosotros.html` y `dist/contacto.html`.
- `npm run preview` valida cabeceras 200 y enlaces canónicos sin bucles.
