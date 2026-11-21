# Prompt de Optimización y Migración SEO: vehicle-stats (/es/estadisticas-dgt)

## Contexto del Proyecto
Repositorio: `vehicle-stats` (rama `feature/ssg-microdatos-dgt`).
Estado actual: Sin publicar en Ododex. Configurado originalmente para el dominio `dgt-pulse.es`.
Contenido: Plataforma de análisis de microdatos oficiales MATRABA de la Dirección General de Tráfico (más de 5,4M de matriculaciones históricas, cuotas por marcas, mapa de etiquetas ambientales y radar fiscal municipal del IVTM).

## Oportunidad SEO de Alto Valor
Esta web es una mina de oro para **estrategia de adquisición de enlaces naturales (*Link Baiting*)** y menciones en medios de comunicación, foros de motor y blogs especializados, lo que aportaría una autoridad de dominio masiva para todo `ododex.com`.

## Bloqueos Actuales
1. **Marca y Dominio Inadecuados:** Todas las URLs, metadata, schema y autoría apuntan a `https://dgt-pulse.es` y "DGT Pulse".
2. **Presencia de Rutas API Dinámicas:** Contiene endpoints `/api/...` incompatibles con el modelo estático `output: 'export'` de Cloudflare Workers.
3. **Falta de Integración con el Patrón Común de Ododex:** Carece de `basePath: '/es/estadisticas-dgt'`, del banner de privacidad unificado y del componente `AdSlot`.

## Tareas a Realizar

1. **Adaptación a Ododex (`next.config.js`):**
   - Configurar `basePath: '/es/estadisticas-dgt'`.
   - Fijar `output: 'export'`.
   - Adaptar `metadataBase` a `new URL('https://ododex.com/es/estadisticas-dgt')`.

2. **Eliminar Rutas API Dinámicas:**
   - Precompilar todas las consultas de datos en archivos JSON estáticos durante el proceso de build en `data/` o `public/datos/`, idéntico al patrón seguido en `gasolineras` y `charger-map`.

3. **Rebranding y Canonicalización:**
   - Sustituir "DGT Pulse" por "Ododex Estadísticas DGT".
   - Template de título: `%s | Ododex`.
   - Enlazar a las calculadoras de Ododex:
     - Desde matriculaciones de híbridos/eléctricos → enlace a `/es/electrico-vs-gasolina`.
     - Desde el análisis fiscal municipal del IVTM → enlace a `/es/impuestos`.

4. **Incorporación al Ensamblador (`ododex-sitio`):**
   - Registrar la sección en `ododex-sitio/config/secciones.json`:
     ```json
     {
       "ruta": "/es/estadisticas-dgt",
       "proyecto": "../vehicle-stats",
       "nombre": "Estadísticas DGT",
       "descripcion": "Estadísticas de matriculaciones del parque automovilístico de España con microdatos oficiales de la DGT."
     }
     ```

## Criterios de Aceptación
- La web compila con `output: 'export'` sin errores de build.
- Se integra en `dist/es/estadisticas-dgt/` al ejecutar `npm run build` en `ododex-sitio`.
- Todos los metadatos y schemas JSON-LD reflejan la marca Ododex y la URL canónica bajo `ododex.com`.
