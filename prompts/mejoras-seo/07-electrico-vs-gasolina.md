# Prompt de Optimización SEO: electrico-vs-gasolina (/es/electrico-vs-gasolina)

## Contexto del Proyecto
Repositorio: `electrico-vs-gasolina` (rama `main`).
Publicado en: `https://ododex.com/es/electrico-vs-gasolina` (Worker `ododex-electrico-vs-gasolina`).
53 URLs en sitemap: portada general y 52 páginas provinciales que cruzan precios medios del MITECO del día con tarifas de recarga de vehículos eléctricos.

## Problemas Detectados en la Auditoría
1. **Título de la Portada Desbordado y sin Marca:**
   El título actual mide 70 caracteres: `Coche eléctrico o gasolina: coste por km en España (noviembre de 2026)`. No incluye el sufijo `| Ododex` y se corta en las SERPs.
2. **Duplicidad Elevada entre las 52 Páginas Provinciales (63% de Similitud):**
   Las páginas de provincia (`/es/electrico-vs-gasolina/[provincia]`) reproducen el mismo bloque genérico de preguntas y calculadora, cambiando únicamente el valor numérico del precio medio de combustible en esa provincia.
3. **Falta de `og:image`:** Sin previsualización gráfica social.

## Tareas a Realizar

1. **Optimizar Título y Meta Description de la Portada (`app/page.tsx`):**
   - Nuevo título conciso:
     `Coche eléctrico o gasolina: coste por km hoy | Ododex` (52 caracteres).
   - Meta description (145 caracteres):
     `"Calcula cuánto cuesta el kilómetro con coche eléctrico frente a gasolina o diésel con los precios medios de hoy en España. Simulador de amortización."`

2. **Diferenciación de Contenido en Páginas Provinciales (`app/[provincia]/page.tsx`):**
   - Incorporar un párrafo de análisis calculado dinámicamente para cada provincia:
     - Posición de la provincia en el ranking nacional de coste de combustible (ej. *"Cádiz se sitúa como la 12.ª provincia más barata de España en gasolina 95"*).
     - Diferencia de ahorro anual recorriendo 15.000 km frente a la media nacional de España.
     - Operador de recarga pública predominante en esa provincia.
   - Con esta capa de datos calculados, la similitud de Jaccard bajará por debajo del 30%, eliminando el riesgo de plantilla duplicada.

3. **Metadatos y Red Social:**
   - Añadir `openGraph.images: ['/es/electrico-vs-gasolina/og.png']` en `app/layout.tsx`.
   - Asegurar que todas las páginas provinciales terminan con `| Ododex`.

## Criterios de Aceptación
- La portada muestra un título ≤ 60 caracteres con `| Ododex`.
- Las 52 páginas provinciales contienen un análisis diferencial contextualizado.
- `npm test` pasa sin fallos (150 pruebas).
