# 10. Auditoría SEO Completa de la Red Ododex (21/11/2026)

Auditoría SEO técnica, arquitectónica y de contenidos exhaustiva sobre toda la red **Ododex** (`https://ododex.com`). Combina inspección directa del código fuente de cada repositorio con mediciones en producción servidas por Cloudflare Workers.

---

## 1. Cuadro de Mando y Diagnóstico General

| Área SEO | Estado | Puntuación | Veredicto |
|---|:---:|:---:|---|
| **Infraestructura & Servidor** | ⚠️ Atención | 8.2 / 10 | Velocidad extrema con Cloudflare Workers (TTFB < 50ms). Fallos en protocolo (HTTP 200 sin forzar HTTPS, `www` sin registro DNS). |
| **Crawl Budget & Indexabilidad** | ⚠️ Riesgo | 6.5 / 10 | ~70.000 URLs en sitemaps en un dominio nuevo. Desproporción entre páginas masivas de ficha y autoridad del dominio. |
| **Calidad On-Page & Plantillas** | 🟢 Bueno | 7.5 / 10 | Excelentes calculadoras y guías pilares (ITP, multas). Similitud alta (>65%) en combinaciones secundarias (ZBE etiquetas y provincias en eléctrico vs gasolina). |
| **Datos Estructurados (Schema.org)** | 🟢 Bueno | 8.0 / 10 | Gran implementación en fichas locales (`GasStation`, `ChargingStation`, `GovernmentService`, `FAQPage`). Faltan esquemas globales (`WebSite`, autoría). |
| **E-E-A-T & Autoridad de Entidad** | 🔴 Crítico | 5.0 / 10 | Sin páginas de entidad (`/sobre-nosotros`, `/contacto`). Sin autoría explícita. Sin `og:image` en toda la red. Riesgo para AdSense. |

---

## 2. Hallazgos Críticos P0 (Acción Inmediata)

### 🔴 P0.1: `http://ododex.com` responde 200 OK en lugar de redirigir a HTTPS
* **Evidencia:** `curl -I http://ododex.com` devuelve `HTTP/1.1 200 OK` con contenido servido.
* **Impacto:** Duplicación total del dominio, dispersión de PageRank y riesgo de penalización por contenido duplicado.
* **Acción (Titular):** En Cloudflare → **SSL/TLS → Edge Certificates**, activar **"Always Use HTTPS"**.

### 🔴 P0.2: `www.ododex.com` no resuelve en DNS (`NXDOMAIN`)
* **Evidencia:** `curl -I https://www.ododex.com` falla con `Could not resolve host: www.ododex.com`.
* **Impacto:** Pérdida de usuarios y enlaces externos dirigidos a la versión con `www`.
* **Acción (Titular):** En Cloudflare → **DNS**, crear registro `AAAA`, nombre `www`, contenido `100::` (con proxy). En **Rules → Redirect Rules**, crear redirección 301 permanente a `https://ododex.com/$1`.

### 🔴 P0.3: Bucle de redirección 307 y canónica en la portada francesa (`/fr`)
* **Evidencia:**
  1. `https://ododex.com/fr` devuelve redirección temporal `HTTP 307` a `https://ododex.com/fr/`.
  2. `https://ododex.com/fr/` declara en su HTML `<link rel="canonical" href="https://ododex.com/fr">`.
* **Impacto:** Bucle lógico que confunde a los motores de búsqueda y evita la correcta indexación de la portada francesa.
* **Acción (Código):** Corregir la etiqueta canónica en `raiz/fr/index.html` hacia `https://ododex.com/fr/` o asegurar respuesta directa 200.

### 🔴 P0.4: Ausencia total de `og:image` en las ~70.000 páginas de la red
* **Evidencia:** Ni la portada raíz ni ninguna subsección contienen la etiqueta `<meta property="og:image">`.
* **Impacto:** Cero vista previa en redes sociales (WhatsApp, Telegram, Twitter, LinkedIn) y descarte automático para Google Discover. Reducción estimada de CTR social superior al 40%.
* **Acción (Código):** Crear asset Open Graph estándar (`1200x630px`) en `raiz/brand/ododex-og.png` y vincularlo en los layouts.

---

## 3. Estado Detallado por Web del Ecosistema

### 1. Portada Raíz (`/` y `/fr`) — `ododex-sitio`
- **Páginas:** 2
- **Palabras:** ~70 (ES) / ~70 (FR)
- **Diagnóstico:** Excelente tiempo de carga (<10 KB), pero contenido textual excesivamente escaso. Faltan etiquetas `<link rel="alternate" hreflang="...">` en el `<head>` y no hay fallback PNG/ICO para el favicon en móviles.
- **Acción:** Enriquecer con descripción de la red, enlaces semánticos a herramientas más consultadas, páginas `/sobre-nosotros` y `/contacto` en el pie y meta hreflang en `<head>`.

### 2. Multas y Radares (`/es/multas`) — Repo: `multas-dgt`
- **URLs en sitemap:** 434
- **Diagnóstico:** Calculadora de velocidad impecable con margen oficial (Orden ICT/155/2020) y 28 infracciones con enlaces al BOE.
- **Puntos débiles:**
  - Títulos de carreteras desbordados (>70 caracteres): `Radares DGT en la TF-13 (Santa Cruz de Tenerife): Ubicación y PK | Ododex`.
  - Páginas de carretera con contenido muy fino (~150 palabras).
  - Ruta redundante en sitemap: `/es/multas/multas/<infraccion>`.
- **Acción:** Acortar títulos de carreteras a ≤60 caracteres, enlazar la calculadora de exceso precargada en cada tramo y renombrar rutas de infracción si procede.

### 3. Impuestos de Vehículos (`/es/impuestos`) — Repo: `calculadora-impuestos`
- **URLs en sitemap:** 27
- **Diagnóstico:** Seccional de máxima calidad editorial. Guías de ITP por comunidad autónoma superan las 1.100 palabras únicas citando normativa foral y BOE.
- **Puntos débiles:** No implementa schema `FAQPage` en preguntas frecuentes y no enlaza a revisiones del modelo para compradores de segunda mano.
- **Acción:** Inyectar marcado JSON-LD `FAQPage` y bloque contextual hacia `/es/llamadas-revision`.

### 4. Gasolineras España (`/es/gasolineras`) — Repo: `gasolineras`
- **URLs en sitemap:** 14.919
- **Diagnóstico:** Generación programática optimizada (fichas pasaron de 145 a ~310 palabras con cálculos comparativos de proximidad y posición en municipio).
- **Puntos débiles:**
  - Meta description de portada larga (176 caracteres).
  - Todas las URLs reciben `lastModified: new Date()` en cada build diario, lo que anula la credibilidad del `lastmod` ante Googlebot.
  - No consume `red-enlaces.json` para cruzar con puntos de recarga e ITV de la misma localidad.
- **Acción:** Corregir meta description, calcular `lastmod` según la fecha real de actualización del precio de la estación y renderizar enlaces cruzados locales.

### 5. Zonas de Bajas Emisiones (`/es/zbe`) — Repo: `zbe-map`
- **URLs en sitemap:** 1.089
- **Diagnóstico:** Datos actualizados con Atlas ZBE (ODbL), calculador de distintivo por matrícula y perímetro oficial en grandes urbes.
- **Puntos débiles:**
  - Similitud elevada (64%-73%) en páginas por etiqueta (`/[ciudad]/[etiqueta]`).
  - Las 51 ciudades con ZBE en tramitación repiten la misma plantilla vacía para CERO y ECO.
  - Títulos de `/etiqueta-dgt/*/*` alcanzan los 90-93 caracteres.
- **Acción:** Añadir `noindex, follow` en CERO y ECO para las 51 ciudades en tramitación, y recortar títulos de la calculadora de etiquetas a ≤60 caracteres.

### 6. Puntos de Recarga (`/es/puntos-recarga`) — Repo: `charger-map`
- **URLs en sitemap:** 14.447
- **Diagnóstico:** Schema `ChargingStation` en 12.114 puntos, títulos mejorados y proximidad calculada.
- **Puntos débiles:** HTML de la portada excesivamente pesado (411 KB) por precargar el censo completo. Fichas de municipios con un único punto tienen escaso contenido diferencial.
- **Acción:** Descargar datos del mapa bajo demanda y cruzar con gasolineras del municipio.

### 7. Eléctrico vs Gasolina (`/es/electrico-vs-gasolina`) — Repo: `electrico-vs-gasolina`
- **URLs en sitemap:** 53
- **Diagnóstico:** Excelente comparativa coste/km sincronizada con los precios MITECO del día.
- **Puntos débiles:** Título de portada de 70 caracteres sin `| Ododex`. Las 52 páginas provinciales presentan un 63% de similitud entre sí.
- **Acción:** Sintetizar título y redactar un extracto analítico específico por provincia (diferencia con la media nacional y posición en ranking de precio).

### 8. ITV España (`/es/itv`) — Repo: `es-itv`
- **URLs en sitemap:** 363
- **Diagnóstico:** Buen enfoque normativo (RD 920/2017) y geolocalización de centros OSM.
- **Puntos débiles:** Fichas de centro breves (~115 palabras). Cero enlaces cruzados hacia multas por ITV caducada o ZBE.
- **Acción:** Enriquecer fichas de centro con guía de preparación para inspección y enlazar a multas de tráfico.

### 9. Llamadas a Revisión / Recalls (`/es/llamadas-revision` y `/en/recalls`) — Repo: `recalls-web`
- **URLs en sitemaps:** 11.400 (ES) + 11.400 (EN)
- **Diagnóstico:** Hreflang cruzado perfecto en código y sitemap XML. Error de variables sin rellenar corregido.
- **Puntos débiles:** Portadas masivas (475 KB HTML en ES, 470 KB en EN) con impacto directo en métricas Core Web Vitals (LCP). Meta descriptions de portada muy breves (<96 caracteres).
- **Acción:** Paginación o carga asíncrona de marcas secundarias y ampliación de meta descriptions a 140-155 caracteres.

### 10 y 11. Autobús y Tranvía de Zaragoza (`/es/zaragoza-bus` y `/es/tranvia-zaragoza`) — Repos: `zarabus` y `zaratram-live`
- **URLs en sitemap:** 2 (Bus) / 1 (Tranvía)
- **Diagnóstico:** Gran experiencia en tiempo real, pero nula captación de tráfico orgánico long-tail.
- **Puntos débiles:** No existen páginas estáticas para postes ni paradas. Sin encabezados `<h2>` en tranvía y sin JSON-LD en autobús.
- **Acción:** Generar páginas estáticas por poste y línea ("Tiempo del bus en poste 102"), añadir marcado `WebApplication` y estructurar encabezados semánticos.

### 12. Prix Carburants Francia (`/fr/prix-carburants`) — Repo: `fr-gasolineras`
- **URLs en sitemap:** 15.655
- **Diagnóstico:** Fiel reflejo francés de la web de gasolineras española, con datos de data.economie.gouv.fr y logos de red.
- **Puntos débiles:** Entidades HTML escapadas en títulos (`&#x27;`). Aislada sin enlaces internos a otras secciones francesas.
- **Acción:** Desescapar títulos y preparar el enlazado cruzado hacia ZFE y radares franceses.

### 13. ZFE y Radars Francia (`/fr/zfe` y `/fr/radars`) — Repos: `fr-zbe` y `radars-fr`
- **Diagnóstico:** Desplegadas en producción pero correctamente excluidas con `<meta name="robots" content="noindex, follow">` debido al uso de datos de ejemplo.
- **Acción:** Mantener el `noindex` hasta importar los censos oficiales franceses definitivos.

### 14. Repositorios en Desarrollo (`vehicle-stats`, `uk-petrostation`, `uk-ulez-map`)
- **Diagnóstico:** `vehicle-stats` tiene enorme valor divulgativo pero está atado a la marca `dgt-pulse.es`. Los repositorios del Reino Unido requieren migración a Next 16 y fuentes de datos estables antes de planificar su publicación.

---

## 4. Desconexión Arquitectónica: `red-enlaces.json`

Se constató que `scripts/generar-red.mjs` genera un mapa relacional de **57.526 líneas** (`config/red-enlaces.json`) con cruces entre gasolineras, cargadores, ZBE e ITV de cada municipio de España. Sin embargo, **ninguna de las webs principales consume este archivo**.

Conectar este dataset para renderizar una sección inferior de *"También te puede interesar en [Municipio]"* generará de forma inmediata una malla de **más de 100.000 enlaces internos contextuales**, acelerando drásticamente el rastreo de Googlebot hacia las páginas locales más profundas.
