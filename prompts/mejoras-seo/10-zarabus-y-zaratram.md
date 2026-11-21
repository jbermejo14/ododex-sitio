# Prompt de Optimización SEO: zarabus y zaratram-live (/es/zaragoza-bus y /es/tranvia-zaragoza)

## Contexto del Proyecto
Repositorios: `zarabus` y `zaratram-live`.
Publicados en: `https://ododex.com/es/zaragoza-bus` (Worker con proxy de tiempos de Avanza/DNDzgz) y `https://ododex.com/es/tranvia-zaragoza` (Worker con tiempos de Línea 1).
Ambas son herramientas en tiempo real de alta utilidad urbana, pero con presencia testimonial en Google (2 URLs en el sitemap de bus, 1 URL en tranvía).

## Problemas Detectados en la Auditoría
1. **Oportunidad de Búsqueda Local Long-Tail Totalmente Desaprovechada:**
   Los usuarios buscan a diario en Google: *"poste 145 zaragoza"*, *"horario bus 33 zaragoza"*, *"paradas tranvia zaragoza"*. Al ser una SPA con búsqueda puramente client-side, Google no tiene ninguna página indexable para postes ni paradas.
2. **Contenido Textual Mínimo (~110-130 palabras):**
   Las páginas apenas tienen texto explicativo, lo que dificulta que Google las posicione en intenciones de búsqueda informativas.
3. **Ausencia de Encabezados Semánticos en Tranvía:**
   La portada de tranvía tiene **0 encabezados `<h2>`**, debilitando su jerarquía semántica.
4. **Falta de Schema `WebApplication` en Autobús:**
   Autobús no incluye ningún dato estructurado JSON-LD en el `<head>`.

## Tareas a Realizar

1. **Estructura de Datos Estáticos por Línea y Parada (Zaragoza Bus):**
   - Utilizar el archivo de snapshot de paradas (`data/stops-snapshot.json`) y recorridos de líneas:
     - Crear páginas estáticas por línea (`/linea/[linea]`, ej. Línea 33, 21, Ci1...) con listado de paradas, enlaces a sus postes y mapa del trazado.
     - Generar páginas de poste para las ~200 paradas más concurridas de la ciudad (`/poste/[numero]`, ej. Plaza Paraíso, Plaza del Pilar, Estación Delicias), con enlace dinámico al tiempo real.
     - Añadir estas páginas al sitemap de `zarabus`.

2. **Mejoras Semánticas en Tranvía de Zaragoza:**
   - En `zaratram-live/src/app/page.tsx`:
     - Añadir encabezados `<h2>`:
       - `<h2>Paradas de la Línea 1 de Tranvía (Mago de Oz - Avenida de la Academia)</h2>`
       - `<h2>Frecuencias y Horarios del Tranvía de Zaragoza</h2>`
       - `<h2>Cómo consultar el próximo tranvía en tiempo real</h2>`
     - Detallar la tabla de frecuencias oficiales por franjas horarias (laborables, sábados y festivos).

3. **Datos Estructurados JSON-LD:**
   - Incorporar en la portada de `zarabus` el schema `WebApplication` con `operatingSystem: "All"`, `applicationCategory: "TravelApplication"`.
   - Incluir schema `TransitStation` en las paradas del tranvía.

4. **Metadatos y Marca:**
   - Asegurar que el título de Autobús incluye `| Ododex`.
   - Añadir `openGraph.images` en ambas aplicaciones.

## Criterios de Aceptación
- La portada de tranvía incorpora al menos 3 encabezados `<h2>` con información de frecuencias.
- El sitemap de autobús amplía su cobertura con rutas informativas de líneas.
- `npm test` en ambos repositorios pasa al 100%.
