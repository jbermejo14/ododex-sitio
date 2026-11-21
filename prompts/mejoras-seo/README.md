# Prompts de Optimización SEO por Web (Red Ododex)

Colección de playbooks técnicos preparados para ser ejecutados por agentes de inteligencia artificial o desarrolladores. Cada prompt describe el contexto del repositorio, los fallos y riesgos detectados en la auditoría del 21/11/2026, los archivos a modificar y los criterios de aceptación con pruebas.

## Índice de Prompts

| # | Archivo | Proyecto / Ruta | Objetivo Principal |
|:---:|---|---|---|
| **01** | [01-ododex-sitio-root.md](01-ododex-sitio-root.md) | `ododex-sitio` (`/` y `/fr`) | Páginas E-E-A-T (`/sobre-nosotros`, `/contacto`), canonical `/fr`, sitemap index maestro, hreflang y favicon PNG. |
| **02** | [02-gasolineras.md](02-gasolineras.md) | `gasolineras` (`/es/gasolineras`) | Conectar `red-enlaces.json` a cargadores/ZBE, sanear `lastmod` falso masivo y recortar meta description. |
| **03** | [03-charger-map.md](03-charger-map.md) | `charger-map` (`/es/puntos-recarga`) | Aligerar payload HTML inicial de portada (411 KB → <80 KB) y enlaces cruzados locales. |
| **04** | [04-zbe-map.md](04-zbe-map.md) | `zbe-map` (`/es/zbe`) | `noindex` en CERO/ECO de las 51 ciudades en tramitación para frenar canibalización y acortar títulos desbordados (>90 chars). |
| **05** | [05-calculadora-impuestos.md](05-calculadora-impuestos.md) | `calculadora-impuestos` (`/es/impuestos`) | Implementar schema `FAQPage` en guías/ITP y cruzar enlaces hacia llamadas a revisión. |
| **06** | [06-multas-dgt.md](06-multas-dgt.md) | `multas-dgt` (`/es/multas`) | Acortar títulos de carreteras (>70 chars) y enriquecer con calculadora de exceso dinámico. |
| **07** | [07-electrico-vs-gasolina.md](07-electrico-vs-gasolina.md) | `electrico-vs-gasolina` (`/es/electrico-vs-gasolina`) | Reducir similitud del 63% entre provincias con cálculos de ahorro y posición en ranking de precio. |
| **08** | [08-es-itv.md](08-es-itv.md) | `es-itv` (`/es/itv`) | Enriquecer fichas de centro con consejos pre-ITV y enlazar a multas por ITV caducada. |
| **09** | [09-recalls-web.md](09-recalls-web.md) | `recalls-web` (`/es/llamadas-revision` y `/en/recalls`) | Reducir peso de portadas (475 KB → <100 KB) y ampliar meta descriptions breves. |
| **10** | [10-zarabus-y-zaratram.md](10-zarabus-y-zaratram.md) | `zarabus` y `zaratram-live` | Generar páginas estáticas por poste/línea para captar tráfico local long-tail, headings semánticos y schema `WebApplication`. |
| **11** | [11-prix-carburants-fr.md](11-prix-carburants-fr.md) | `fr-gasolineras` (`/fr/prix-carburants`) | Desescapar entidades `&#x27;` en títulos y configurar Open Graph con tarjeta grande. |
| **12** | [12-vehicle-stats.md](12-vehicle-stats.md) | `vehicle-stats` (futura `/es/estadisticas-dgt`) | Plan de adaptación de `dgt-pulse.es` a Ododex para captar enlaces de prensa de alta autoridad. |

## Cómo Utilizar estos Prompts

1. Abre una sesión de trabajo situada en el repositorio correspondiente (o en el directorio padre de los repositorios).
2. Pega el contenido íntegro del prompt seleccionado.
3. El agente o desarrollador ejecutará las modificaciones, correrá los tests unitarios y verificará que el build siga exportando limpiamente con `output: 'export'`.
