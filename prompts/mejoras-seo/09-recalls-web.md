# Prompt de Optimización SEO: recalls-web (/es/llamadas-revision y /en/recalls)

## Contexto del Proyecto
Repositorio: `recalls-web` (rama `feature/nextjs-migration`).
Publicado en: `https://ododex.com/es/llamadas-revision` (Worker `ododex-llamadas-revision`) y `https://ododex.com/en/recalls` (Worker `ododex-recalls`).
11.400 URLs por idioma (660 marcas, 4.432 modelos y 6.307 campañas Safety Gate de la Comisión Europea).

## Problemas Detectados en la Auditoría
1. **Peso Excesivo del HTML en Portada (475 KB en ES / 470 KB en EN):**
   Las portadas renderizan de golpe el listado completo de todas las marcas y fabricantes de la Unión Europea. Esto dispara el peso del documento estático, penalizando el Largest Contentful Paint (LCP) y el tiempo de bloqueo en dispositivos móviles.
2. **Meta Descriptions Demasiado Breves:**
   En español mide 96 caracteres y en inglés 78 caracteres. No explotan las búsquedas de alertas de seguridad del fabricante, llamadas a taller ni campañas oficiales.
3. **Pocas Conexiones Internas en Fichas de Modelo (~8 enlaces):**
   Las páginas de modelo (`/marca/[marca]/[modelo]`) solo muestran sus propias campañas, sin enlazar a otros modelos de la misma marca ni a campañas del mismo año.
4. **Falta de `og:image`:** Sin imagen Open Graph.

## Tareas a Realizar

1. **Aligerar el HTML de las Portadas (`src/app/page.tsx`):**
   - Renderizar de forma estática en el servidor únicamente las **30 marcas de mayor volumen de matriculación** (Toyota, Volkswagen, Seat, Peugeot, Renault, Ford, etc.).
   - Para el resto de fabricantes minoritarios, implementar un buscador cliente con carga diferida del índice de marcas, o un índice alfabético colapsado, reduciendo el HTML inicial a menos de 70 KB.

2. **Ampliar Meta Descriptions:**
   - Español (~145 caracteres):
     `"Consulta las llamadas a revisión y alertas de seguridad de coches y motos oficiales de la UE (Safety Gate). Historial de campañas por marca y modelo."`
   - Inglés (~145 caracteres):
     `"Check official EU Safety Gate vehicle recall campaigns and safety alerts by make and model. Verify if your car or motorbike has active manufacturer recalls."`

3. **Enriquecer Enlazado Interno en Fichas de Modelo:**
   - En `src/app/marca/[marca]/[modelo]/page.tsx`, añadir una sección inferior:
     *"Otros modelos de [Marca] con campañas registradas"* con enlaces directos a sus modelos hermanos.
   - Enlazar a la calculadora de ITP de Ododex (`/es/impuestos`).

4. **Metadatos y Red Social:**
   - Añadir `openGraph.images: ['/es/llamadas-revision/og.png']` en ES y `['/en/recalls/og.png']` en EN.

## Criterios de Aceptación
- El tamaño del HTML de las portadas se reduce de >470 KB a <100 KB.
- Se mantiene la integridad estricta del etiquetado `hreflang` bidireccional ES/EN y `x-default`.
- `npm test` pasa satisfactoriamente (69 pruebas).
