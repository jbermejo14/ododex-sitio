# Prompt de Optimización SEO: prix-carburants-fr (/fr/prix-carburants)

## Contexto del Proyecto
Repositorio: `fr-gasolineras` (rama `main` / `prix-carburants-fr`).
Publicado en: `https://ododex.com/fr/prix-carburants` (Worker `ododex-prix-carburants`).
15.655 URLs en sitemap: 96 departamentos franceses, municipios, estaciones de servicio y páginas de histórico por marca desde 2016 con datos de data.economie.gouv.fr.

## Problemas Detectados en la Auditoría
1. **Entidades HTML Escapadas en Títulos (`&#x27;`):**
   El título de portada y de varias secciones se renderiza como:
   `<title>Prix des carburants aujourd&#x27;hui en France | Ododex</title>`
   Aunque los navegadores lo procesan, en snippets sociales y agregadores externos se muestra literalmente el código escapado.
2. **Aislamiento de la Sección Francesa:**
   Es la única web francesa activa en portada, por lo que no enlaza a ninguna otra sección del dominio.
3. **Falta de `og:image` y Twitter Card tipo `summary`:**
   Actualmente usa `twitter:card: summary` en lugar de `summary_large_image`.

## Tareas a Realizar

1. **Corregir el Escapado de Títulos:**
   - En `src/app/layout.tsx` y `page.tsx`, asegurar que las comillas simples o apóstrofes franceses se emiten como apóstrofe tipográfico estándar (`’` o `'`) sin doble codificación entidad en el generador de Next.js.
   - Ajustar el template de títulos a `%s | Ododex`.

2. **Configuración Social Open Graph:**
   - Crear imagen corporativa francesa: `public/og-fr.png` o `/fr/prix-carburants/og.png`.
   - Añadir en metadata:
     ```typescript
     openGraph: {
       locale: 'fr_FR',
       siteName: 'Ododex',
       images: [{ url: '/fr/prix-carburants/og.png', width: 1200, height: 630 }]
     },
     twitter: {
       card: 'summary_large_image'
     }
     ```

3. **Preparar Enlazado Interno con Futuras Webs Francesas:**
   - Diseñar la estructura para que las estaciones de servicio de departamentos con ZFE activa (ej. Paris 75, Rhône 69, Bouches-du-Rhône 13) tengan el enlace preparado hacia `/fr/zfe/[ville]` una vez se publiquen los datos oficiales.

## Criterios de Aceptación
- Las etiquetas `<title>` y `og:title` muestran el texto limpio sin entidades numéricas visibles.
- `twitter:card` cambia a `summary_large_image`.
- `npm test` pasa sin errores.
