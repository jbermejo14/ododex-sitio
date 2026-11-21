# Prompt de Optimización SEO: es-itv (/es/itv)

## Contexto del Proyecto
Repositorio: `es-itv` (rama `main`).
Publicado en: `https://ododex.com/es/itv` (Worker `ododex-itv`).
363 URLs en sitemap: periodicidad de 21 tipos de vehículos según RD 920/2017, mapa OpenStreetMap de centros autorizados, 52 provincias, municipios con múltiples centros y 373 fichas individuales.

## Problemas Detectados en la Auditoría
1. **Fichas de Centros con Poco Contenido (*Thin Content*):**
   Centros como `/es/itv/centros/asturias/llanera` o `/es/itv/centro/itv-reinosa-w1488761773` cuentan con entre 115 y 310 palabras. Si el centro carece de horario o teléfono en OpenStreetMap, la página queda muy desprovista de valor.
2. **Cero Enlaces Cruzados hacia el Resto de Ododex:**
   La portada cuenta con 40 enlaces internos, pero ninguno hacia otras secciones relacionadas (multas por ITV caducada, ZBE de la comunidad autónoma o gasolineras del municipio).
3. **Título de Portada sin Identidad de Marca:**
   `ITV en España: cada cuánto se pasa, precio y centros` (52 chars) omite `| Ododex`.

## Tareas a Realizar

1. **Enriquecer Fichas de Centro Individual (`app/centro/[slug]/page.tsx`):**
   - Añadir una guía estructurada de preparación: *"Qué revisar antes de acudir a esta estación de ITV"*:
     - Documentación obligatoria (Ficha técnica / Tarjeta ITV y Permiso de circulación).
     - Comprobaciones visuales previas (alumbrado, dibujo de neumáticos mín. 1,6 mm, cinturones, retrovisores).
     - Tarifas oficiales aplicables en la comunidad autónoma correspondiente (coche diésel, gasolina y moto).
   - Elevar el contenido mínimo de cada ficha a >400 palabras útiles.

2. **Integrar Enlaces Cruzados:**
   - En la sección normativa y en las tarifas por comunidad:
     - Enlace hacia `/es/multas/multas/circular-con-itv-caducada` (*"¿Cuál es la multa por circular con la ITV caducada o desfavorable?"*).
     - Enlace hacia `/es/zbe` (*"Comprueba si la ZBE de tu municipio exige distintivo ambiental al pasar la ITV"*).

3. **Metadatos y Marca:**
   - Modificar el título de la portada en `app/layout.tsx` para incluir `| Ododex`.
   - Incorporar `openGraph.images: ['/es/itv/og.png']`.

## Criterios de Aceptación
- Las fichas individuales de centro superan las 350 palabras de texto visible.
- Presencia de enlaces contextuales hacia `/es/multas` y `/es/zbe`.
- `npm test` pasa satisfactoriamente (394 pruebas).
