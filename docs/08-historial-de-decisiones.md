# 8. Historial de decisiones

Registro de las decisiones importantes, con su motivo y las alternativas descartadas. Ordenado por fecha.

## 17/11/2026

| Decisión | Motivo | Descartado |
|---|---|---|
| Marca **Ododex**, estilo de calculadora-impuestos para toda la red | Una marca común da confianza y permite enlazar entre webs | Un nombre distinto por web |
| **Un solo dominio** con rutas `/es/<sección>` | Concentra la autoridad SEO; un solo AdSense y un solo `ads.txt` | Subdominios o dominios por web |
| Dominio comprado en **Arsys**, DNS movido a **Cloudflare** | Ya estaba comprado; Cloudflare da DNS, HTTPS y hosting gratis | Hosting de Arsys |
| **Cloudflare Workers con recursos estáticos** (no Pages) | Cloudflare integró Pages en Workers; `wrangler pages project create` acabó creando un Worker | Pages con subida manual o conexión a GitHub (el titular no puede ejecutar comandos ni crear carpetas en el panel) |
| Todo **estático** (`output: 'export'`), sin API | Gratis e ilimitado; sin servidor que mantener | Plan de pago de Workers (5 $/mes) |
| **Varios Workers** con routes de zona | Límite de 20 000 ficheros por Worker en el plan gratuito | Un Worker único o el plan de pago |
| Páginas de detalle **solo HTML** | Reduce a un tercio los ficheros de las secciones grandes | Menos páginas (pierde SEO) |
| `workers_dev: false` | Evita contenido duplicado en `*.workers.dev` | — |
| Fichas de radar de multas con **noindex** | Contenido fino; podían perjudicar al dominio | Indexarlas |
| Gasolineras actualizada **a mano cada día** con un acceso directo | Gratis; el titular lo acepta | Servidor de pago con actualización automática |
| Descarga de MITECO **una vez por compilación** | Cada worker de Next la descargaba (lento y con fallos) | ISR o peticiones en la compilación |
| `next build --webpack` y Tailwind en WASM | Windows Application Control bloquea los binarios nativos | Turbopack |
| Llamadas a revisión en **español e inglés** (dos compilaciones) | Los datos son europeos; el inglés abre otro público | Solo español |
| Textos de riesgo de Safety Gate en **su idioma original** | Traducirlos podría inventar o desvirtuar información de seguridad | Traducción automática |
| CARTO fuera, **OSM y Esri** | CARTO empezó a exigir clave de API | Pagar CARTO |

## 18/11/2026

| Decisión | Motivo | Descartado |
|---|---|---|
| **AdSense** en toda la red (`ca-pub-2749781881817715`) | Monetización base | — |
| Script de AdSense también en la **portada y la 404 de la raíz** | Google verifica el sitio en la portada | Solo en las secciones |
| **Bloques manuales** (`AdSlot`, unidad 8745518895), de 1 a 3 por página | Los automáticos solo ponían el ancla (0 in-page) | Solo anuncios automáticos |
| **Sin anuncio ancla en móvil** | Al titular le parece abusivo | Ancla en todos los dispositivos |
| Bloques de afiliado **ocultos sin código** (se quita "Tasación" en ZBE) | No mostrar huecos vacíos ni enlaces sin comisión | Bloques de relleno |
| ZBE: **sin vehículo por defecto** | Un Audi A4 preseleccionado confundía | Valor por defecto |
| ZBE: selector de **marca, combustible y año** | La etiqueta depende del combustible y la fecha, no del modelo; la lista de modelos era incompleta (solo el Serie 3 en BMW) | Catálogo completo de modelos |
| ZBE: **matrícula solo como atajo del año**; pregunta el combustible solo si es ambiguo | No hay API gratuita de matrículas; el titular no quiere enlazar a la DGT | API de pago o enlace a la sede de la DGT |
| ZBE: `/etiqueta-dgt` como **calculadora** | El enlace del menú llevaba a un caso fijo (gasolina de 2018) sin sentido | — |
| ZBE: quitar GeoJSON y las ubicaciones fijas de Zaragoza y Huesca; añadir "Mi ubicación" | Botones de desarrollo sin valor para el usuario | — |
| ZBE: selector de **varias ciudades** (hasta 4) | Petición del titular para comparar | — |
| Domicilio del titular en el aviso legal (en `config/titular.json`) | Lo exige la LSSI | — |
| Siguiente web: **puntos de recarga** (charger-map) | Ya tenía datos completos (RIPREE) y encaja con ZBE | vehicle-stats (menos dinero), UK (bloqueadas) |
| Puntos de recarga: `mapa.json` compacto (menos de 1,5 MB) | El mapa nacional necesita todos los puntos sin API | Peticiones a una API |
| Documentación central en `ododex-sitio/docs` | Poder continuar desde otra sesión o tras exportar | — |

## 19/11/2026

| Decisión | Motivo | Descartado |
|---|---|---|
| Web nueva **electrico-vs-gasolina** en `/es/electrico-vs-gasolina` | Ruta que coincide con la búsqueda más común ("eléctrico vs gasolina") | Página dentro de gasolineras |
| Precios de combustible: **medias de MITECO** del `estaciones.json` de gasolineras | Dato real y diario sin otra descarga | Precios fijos |
| Precios de recarga: **tarifas por operador del titular** (noviembre de 2026), marcadas como orientativas | RIPREE no publica precios | Una tarifa única de ejemplo; API PVPC de REE |
| **Worker propio** y recompilación en la actualización diaria de gasolineras | Medias del mismo día sin redesplegar el Worker principal | Ir en el Worker `ododex` |
| Slug de URL propio (`a-coruna`) en vez del de MITECO (`coruna-a`) | Mejor para SEO | Reutilizar el slug de MITECO |
| Web nueva **es-itv** en `/es/itv` (19/11/2026) | Ruta corta que coincide con la búsqueda "itv" | `/es/centros-itv` |
| Centros ITV de **OpenStreetMap** (fichero aportado por el titular) | Único listado nacional con coordenadas; los registros autonómicos solo existen en 4 comunidades | Fuentes autonómicas por separado |
| Tarifas: oficiales donde hay boletín; en precio libre, **precios publicados por operadores o fuentes secundarias**, marcados | Más útil y mejor para SEO; elegido por el titular | Solo "precio libre, consulta la estación" |
| Ranking de tarifas **sin Madrid, Murcia ni Baleares** | Madrid solo tiene el precio de un operador; Murcia y Baleares no tienen total verificable | Incluirlas con su cifra |
| Calculadora: el tramo nuevo empieza **el día del aniversario**, dicho en la web como criterio propio | La norma no precisa el día exacto | La lectura inclusiva ("hasta 10 años" incluye ese día) |
| Fichas de centro **indexables** aunque falten datos de OSM | Dan distancias, cercanos y tarifa; si Search Console no las indexa, se valorará `noindex` | `noindex` desde el principio |
| Web nueva **zfe-fr** en `/fr/zfe` con **Worker propio** `ododex-zfe` (19/11/2026) | Mismo patrón que la otra sección francesa; se publica y actualiza sus datos sin tocar el Worker principal | Ir en el Worker `ododex` (solo ~132 ficheros) |
| Web nueva **radars-fr** en `/fr/radars` con **Worker propio** `ododex-radars` (19/11/2026) | Mismo patrón que zfe-fr; los datos de radares cambiarán sin tocar el Worker principal | Ir en el Worker `ododex` |
| Radares Francia: exceso **≥ 50 km/h como delito** (AFD 300 €, tribunal hasta 3 750 € y 3 meses) | Es la ley vigente desde el 29/12/2025; elegido por el titular | El baremo antiguo de 1 500 € que pedía el encargo |
| Radares Francia: **marge technique según la velocidad medida** (< 100 → −5 km/h; ≥ 100 → −5 %) | Es la regla oficial de los cinemómetros | Aplicarla según el límite, como decía el encargo |
| Radares Francia: **extracto real del CSV oficial** (13 departamentos, 2018) con aviso y `noindex` | Mejor que datos inventados; la estructura queda lista para el fichero completo | Radares inventados |
| ZFE: **datos de ejemplo con aviso y `noindex`** hasta cargar la Base Nationale des ZFE | No indexar restricciones inventadas; la estructura queda lista para el fichero oficial | Publicar sin aviso; esperar a tener datos para construir la web |
| ZFE: calculadora con la **tabla oficial de deux-roues** y la **clase peor en años frontera** | La tabla simplificada pedida no cubre las motos; sin mes de matriculación, la clase segura es la peor | Aplicar a las motos la tabla de turismos |
