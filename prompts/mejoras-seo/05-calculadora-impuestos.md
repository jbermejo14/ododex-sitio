# Prompt de Optimización SEO: calculadora-impuestos (/es/impuestos)

## Contexto del Proyecto
Repositorio: `calculadora-impuestos` (rama `main` / `feature/nextjs-migration`).
Publicado en: `https://ododex.com/es/impuestos` (Worker principal `ododex`).
27 URLs en sitemap: calculadora de matriculación (IEDMT), calculadora de transferencia (ITP) y guías autonómicas detalladas con referencias al BOE.

## Problemas Detectados en la Auditoría
1. **Ausencia de Schema `FAQPage`:** Las guías de trámites (`/guia/documentacion-tramitar`) y las páginas de ITP por comunidad autónoma contienen bloques estructurados de preguntas frecuentes de gran calidad (plazos, modelos 620/621, exenciones), pero no están enriquecidas con JSON-LD `FAQPage`. Se pierde la posibilidad de ganar fragmentos enriquecidos en las SERPs de Google.
2. **Oportunidad de Enlazado Contextual Desaprovechada:** Quien calcula el ITP para comprar un coche de segunda mano tiene máxima probabilidad de querer conocer si el vehículo tiene llamadas a revisión pendientes de seguridad. No hay enlaces a `/es/llamadas-revision`.
3. **Falta de `og:image`:** No existe previsualización social.

## Tareas a Realizar

1. **Implementar Marcado JSON-LD `FAQPage`:**
   - En las páginas de comunidad (`app/itp-coche-segunda-mano/[comunidad]/page.tsx`):
     - Mapear las preguntas frecuentes de la comunidad (ej. *"¿Qué plazo hay para pagar el ITP en [Comunidad]?"*, *"¿Se presenta el modelo 620 o 621?"*) al schema estándar `FAQPage` con sus respectivos `Question` y `Answer`.
   - En las guías (`app/guia/[slug]/page.tsx`):
     - Añadir `FAQPage` sobre los trámites de cambio de titularidad de la DGT.

2. **Crear Bloque de Enlazado Cruzado con Llamadas a Revisión:**
   - En el pie del simulador de ITP y en las guías de compra de segunda mano, añadir una tarjeta destacada:
     *"¿Vas a comprar este coche? Comprueba si tiene campañas de seguridad pendientes en la UE"*
     - Enlace a `/es/llamadas-revision` con anchor text descriptivo.

3. **Metadatos y Red:**
   - Añadir `openGraph.images: ['/es/impuestos/og.png']` en `app/layout.tsx`.
   - Comprobar que todos los títulos terminan con el sufijo oficial `| Ododex`.

## Criterios de Aceptación
- Las URLs de ITP y Guías muestran el objeto `@type: "FAQPage"` válido en la herramienta de prueba de resultados enriquecidos de Google.
- Se mantiene el 100% de los 190 tests unitarios del proyecto.
