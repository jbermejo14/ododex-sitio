# Prompt de Optimización SEO: zbe-map (/es/zbe)

## Contexto del Proyecto
Repositorio: `zbe-map` (rama `refactor/zbe-reglas-oficiales-seo`).
Publicado en: `https://ododex.com/es/zbe` (Worker `ododex-zbe`).
1.089 URLs en sitemap: 152 ciudades con ordenanza Atlas ZBE, 5 páginas de etiqueta por ciudad (`/[ciudad]/[etiqueta]`) y calculadora `/etiqueta-dgt/[combustible]/[año]`.

## Problemas Detectados en la Auditoría
1. **Canibalización y Alta Similitud en Fichas por Etiqueta (~760 páginas):**
   Las subpáginas por etiqueta de una misma ciudad (`/[ciudad]/cero`, `/[ciudad]/eco`, etc.) presentan entre un **64% y 73% de similitud de texto**.
2. **Las 51 Ciudades con ZBE en Tramitación:**
   En ciudades donde la ordenanza aún no se aplica y no hay restricciones vigentes (Calahorra, Tudela, Teruel, etc.), las páginas de etiqueta CERO y ECO son copias casi exactas de la página principal de la ciudad, repitiendo: *"Un coche con etiqueta 0 CERO puede entrar sin restricciones..."*.
3. **Títulos Desbordados en la Calculadora de Distintivos (`/etiqueta-dgt/*/*`):**
   Miden hasta 93 caracteres (ejemplo: `Etiqueta DGT de un coche Gas (GLP / GNC) de 2026: ¿Qué distintivo le corresponde? | Ododex`). Google trunca más de un tercio del título.
4. **Meta Description de Portada Desmesurada (228 caracteres):**
   La más larga de la red Ododex. Se corta agresivamente en SERPs.

## Tareas a Realizar

1. **Estrategia de Indexación Inteligente (Evitar Thin/Doorway Pages):**
   - En `app/[ciudad]/[badge]/page.tsx`:
     - Para las **51 ciudades cuya ZBE está en tramitación o suspendida** según Atlas ZBE:
       - Para las etiquetas **CERO y ECO** (donde no hay ninguna particularidad): aplicar `<meta name="robots" content="noindex, follow">` o establecer su canonical hacia la página de la ciudad (`/es/zbe/[ciudad]`).
       - Mantener indexadas únicamente las etiquetas con dudas reales (B, C y Sin Etiqueta).
     - En `app/sitemap.ts`: omitir del sitemap las combinaciones marcadas con `noindex`.

2. **Optimizar Títulos de la Calculadora de Etiquetas:**
   - En `app/etiqueta-dgt/[combustible]/[ano]/page.tsx`:
     - Título actual: `Etiqueta DGT de un coche Gas (GLP / GNC) de 2026: ¿Qué distintivo le corresponde? | Ododex` (90 chars).
     - Nuevo formato estándar (≤60 chars):
       `Etiqueta DGT coche Gas (GLP/GNC) de 2026 | Ododex` (50 chars).
       `Etiqueta DGT diésel de 2015: ¿Qué distintivo tiene? | Ododex` (58 chars).

3. **Recortar Meta Description de la Portada (`app/page.tsx`):**
   - Reducir de 228 a ~145 caracteres:
     `"Comprueba si tu coche puede entrar en las ZBE de cada ciudad de España según su etiqueta DGT. Mapa interactivo, ordenanzas, multas y excepciones."`

4. **Metadatos y Red Social:**
   - Añadir `openGraph.images: ['/es/zbe/og.png']` y `twitter:card: 'summary_large_image'`.

## Criterios de Aceptación
- Ningún título en `/etiqueta-dgt/*/*` supera los 60 caracteres.
- Las 102 páginas de CERO/ECO de ciudades en tramitación quedan protegidas de canibalización con `noindex, follow`.
- El sitemap refleja exactamente las páginas indexables (menos de 1.000 URLs).
- `npm test` pasa satisfactoriamente.
