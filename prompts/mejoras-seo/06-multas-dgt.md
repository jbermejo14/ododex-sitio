# Prompt de Optimización SEO: multas-dgt (/es/multas)

## Contexto del Proyecto
Repositorio: `multas-dgt` (rama `fix/seo-legal-audit`).
Publicado en: `https://ododex.com/es/multas` (Worker principal `ododex`).
434 URLs en sitemap: calculadora de multas por exceso de velocidad, 28 fichas de infracciones con enlaces al BOE y mapa de radares DGT por provincia y carretera.

## Problemas Detectados en la Auditoría
1. **Títulos Excesivamente Largos en Páginas de Carreteras (361 páginas):**
   Miden entre 72 y 85 caracteres (ejemplo: `Radares DGT en la TF-13 (Santa Cruz de Tenerife): Puntos Kilométricos y Ubicación | Ododex`). Google trunca estos títulos en los resultados.
2. **Páginas de Carreteras con Contenido Flojo (*Thin Content*):**
   Las páginas de carretera (`/es/multas/radares/[provincia]/[carretera]`) tienen una media de apenas 137-160 palabras.
3. **Ruta Redundante en Sitemap:**
   Las infracciones se sirven bajo `/es/multas/multas/[infraccion]`, repitiendo la palabra "multas" dos veces en la ruta.
4. **Falta de `og:image`:** Sin imagen social Open Graph.

## Tareas a Realizar

1. **Ajustar Títulos de Carreteras en `src/app/radares/[provincia]/[carretera]/page.tsx`:**
   - Modificar la función `generateMetadata`:
     - Título anterior: `Radares DGT en ${info.roadName} (${info.provinceName}): Puntos Kilométricos y Ubicación`
     - Nuevo título optimizado (≤58 caracteres antes del template):
       `Radares DGT en la ${info.roadName} (${info.provinceName}): PK y tramos`
       Con el template `%s | Ododex` se mantendrá siempre por debajo de los 65 caracteres.

2. **Enriquecer el Contenido de las Carreteras con la Calculadora:**
   - En cada página de carretera, leer el límite de velocidad más frecuente de sus radares.
   - Insertar una llamada interactiva o enlace a la calculadora:
     *"¿Te han multado en la ${info.roadName}? Comprueba el importe con el 50% de pronto pago y los puntos que pierdes"*, con el límite de esa vía ya preseleccionado en el enlace (`/es/multas?limite=${limiteComun}`).
   - Añadir una tabla con el baremo oficial de sanciones para el límite de esa carretera (ej. tramo de 120 km/h: importes de 100 €, 300 €, 400 €, 500 € y 600 €). Esto elevará el texto único de 150 a más de 350 palabras de gran utilidad.

3. **Metadatos y Red Social:**
   - Añadir `openGraph.images: ['/es/multas/og.png']` en `src/app/layout.tsx`.

## Criterios de Aceptación
- Ningún título de carretera supera los 65 caracteres con el sufijo `| Ododex`.
- El texto visible en las páginas de carretera supera las 300 palabras útiles.
- `npm test` pasa al 100% (97 pruebas).
