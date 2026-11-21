# Prompt de Optimización SEO: gasolineras (/es/gasolineras)

## Contexto del Proyecto
Repositorio: `gasolineras` (rama `feature/seo-programatico-nextjs`).
Publicado en: `https://ododex.com/es/gasolineras` (Worker `ododex-gasolineras`).
Genera unas 15.000 páginas estáticas (52 provincias, ~3.200 municipios y ~11.500 fichas de gasolinera) a partir de la API de precios diarios del MITECO.

## Problemas Detectados en la Auditoría
1. **Meta Description de la portada demasiado larga:** Mide 176 caracteres (`"Consulta el precio de la gasolina 95, diésel y GLP hoy en cada gasolinera de España..."`). Google la trunca en móviles (límite recomendado: 135-155 caracteres).
2. **`lastmod` falso masivo en sitemap:** En `src/app/sitemap.ts`, todas las 14.919 URLs reciben `lastModified: new Date()` en cada compilación diaria. Googlebot detecta que las fichas no han cambiado en su estructura y termina ignorando el `lastmod`.
3. **Desconexión de `red-enlaces.json`:** Las páginas de municipio y fichas de estación no contienen enlaces cruzados hacia los puntos de recarga del mismo municipio (`/es/puntos-recarga/provincia/...`) ni hacia las ZBE correspondientes, perdiendo una red de miles de enlaces internos contextuales.
4. **Falta de `og:image`:** No existe `<meta property="og:image">` en ninguna ficha ni en la portada.

## Tareas a Realizar

1. **Ajustar Metadatos de la Portada (`src/app/layout.tsx` / `page.tsx`):**
   - Reducir meta description a ~145 caracteres:
     `"Precio de la gasolina 95, diésel y GLP hoy en cada gasolinera de España. Encuentra las estaciones más baratas de tu municipio con datos oficiales del MITECO."`
   - Incorporar `openGraph.images: ['/es/gasolineras/og.png']`.

2. **Sanear la Fecha `lastModified` en `src/app/sitemap.ts`:**
   - Para municipios y provincias: usar la fecha real de la última actualización de precios del snapshot MITECO (`data.fecha`).
   - Para fichas individuales de estación: si la estación no ha modificado su precio hoy respecto a su histórico, mantener la fecha de su último cambio de precio registrado.

3. **Integrar el Bloque de Enlaces Cruzados (`red-enlaces.json`):**
   - Leer `process.env.ODODEX_RED_ENLACES` (ruta absoluta generada por `ododex-sitio`) durante la compilación.
   - En las páginas de municipio (`src/app/provincia/[provincia]/[municipio]/page.tsx`), renderizar una sección:
     *"Servicios de movilidad en [Municipio]"*:
     - Enlace a puntos de recarga de ese municipio si existen.
     - Enlace a la ZBE de esa ciudad si existe ordenanza activa.
     - Enlace a la comparativa de coche eléctrico en esa provincia.

4. **Validación de Datos Estructurados:**
   - Comprobar que el schema `GasStation` incluye siempre `priceRange`, `currenciesAccepted: "EUR"` y que los precios de combustible se declaran como `UnitPriceSpecification`.

## Criterios de Aceptación
- `npm test` pasa sin errores.
- Los títulos y descripciones en la portada cumplen con los límites de longitud (título ≤ 60 chars, descripción 120-155 chars).
- Las páginas de municipio renderizan enlaces cruzados válidos hacia `/es/puntos-recarga` y `/es/zbe`.
