# Prompt de Optimización SEO: charger-map (/es/puntos-recarga)

## Contexto del Proyecto
Repositorio: `charger-map` (rama `feature/nextjs-migration`).
Publicado en: `https://ododex.com/es/puntos-recarga` (Worker `ododex-puntos-recarga`).
Censo RIPREE del MITECO con 14.447 URLs (12.114 puntos de recarga, 2.120 municipios, 51 provincias y 160 operadores).

## Problemas Detectados en la Auditoría
1. **Sobrecarga de HTML en la Portada (411 KB):** La página de inicio incrusta el censo completo y el mapa de provincias en el HTML inicial. Esto genera un DOM excesivamente pesado que penaliza las métricas Core Web Vitals (INP y LCP en móvil).
2. **Pueblos con un Solo Punto de Recarga:** La página del municipio y la ficha del punto tienen un contenido casi idéntico (~160 palabras), con riesgo de ser clasificadas como contenido duplicado o thin content.
3. **Ausencia de Enlazado Cruzado (`red-enlaces.json`):** Los municipios no enlazan a las gasolineras ni a las ZBE de su localidad.
4. **Falta de `og:image`:** Sin imagen social Open Graph.

## Tareas a Realizar

1. **Aligerar el Payload de la Portada (`src/app/page.tsx`):**
   - No volcar en el HTML inicial los datos pesados de los 12.000 puntos.
   - Servir el explorador provincial y el buscador cargando los datos de forma diferida (`fetch('/datos/mapa.json')` en cliente) tras la hidratación, reduciendo el HTML estático de la portada a menos de 60 KB.

2. **Diferenciar Municipios Pequeños:**
   - En municipios con 1 o 2 cargadores, enriquecer la página municipal con contexto provincial:
     - Distancia y tiempo estimado al cargador rápido (≥50 kW) más cercano.
     - Operadores predominantes en la comarca.
     - Enlace a la comparativa de coste `/es/electrico-vs-gasolina/[provincia]`.

3. **Integrar Enlaces Cruzados Locales:**
   - Consumir `ODODEX_RED_ENLACES` durante el build.
   - En las páginas municipales (`/provincia/[provincia]/[municipio]`), mostrar la tarjeta:
     *"Movilidad y combustible en [Municipio]"* enlazando a:
     - Gasolineras del municipio (`/es/gasolineras/provincia/...`).
     - ITV más cercana de la provincia.

4. **Metadatos y Schema:**
   - Asegurar que `ChargingStation` en `src/app/punto/[slug]/page.tsx` incluye:
     - `connectorType` (Mennekes, CCS2, CHAdeMO).
     - `maximumOutput` (kW).
     - `openingHoursSpecification`.
   - Incorporar `openGraph.images: ['/es/puntos-recarga/og.png']`.

## Criterios de Aceptación
- El tamaño del HTML de la portada pasa de >400 KB a <80 KB.
- Fichas de punto y municipios mantienen schemas JSON-LD válidos en el validador de Schema.org.
- Enlaces cruzados hacia `/es/gasolineras` presentes en páginas de municipio.
