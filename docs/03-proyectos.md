# 3. Fichas de proyecto

Cada web es un repositorio git independiente dentro de `C:\Users\Usuario\Desktop\pruebas`. La rama indicada es la que está **publicada** en producción; ninguna se ha fusionado aún en `main`. Los números de pruebas son los de la última ejecución (18/11/2026).

> Para el detalle técnico de cada una, lee su `ARCHITECTURE.md` y su `README.md`. Esta ficha resume lo que hace falta para operarla.

---

## ododex-sitio — ensamblador

| | |
|---|---|
| Repositorio | Local, **sin remoto**. Rama `master`. |
| Pruebas | `npm test` (node --test), 99 pruebas |
| Función | Compilar todas las webs, ensamblar la raíz y desplegar los Workers |

Ver [02-arquitectura.md](02-arquitectura.md).

---

## multas-dgt — /es/multas

| | |
|---|---|
| URL | https://ododex.com/es/multas |
| Repositorio | `github.com/jbermejo14/multas-dgt`; rama publicada `fix/seo-legal-audit` (también existen `main` y `seo-legal-radares`) |
| Worker | `ododex` (principal) |
| Pruebas | 97 (`npm test`, con tsx; `"type": "module"`) |
| Datos | Cuadro de infracciones de velocidad (Ley de Tráfico, BOE), 28 infracciones y radares del NAP de la DGT (DATEX II) |

**Qué ofrece:**
- calculadora de multas por velocidad (importe y puntos según el límite y la velocidad medida, con el margen del cinemómetro);
- fichas de infracciones;
- mapa de radares con datos de la DGT y 737 páginas de radar por provincia y carretera.

**Particularidades:**
- Las fichas de radar tienen `noindex` y no están en el sitemap, porque son contenido fino. Se decidió así en la auditoría SEO.
- Ahí se detectó el fallo de cascada de Leaflet (mapas de 2 px). Ver [05-convenciones.md](05-convenciones.md).
- Basura sin borrar que dejó un subagente: `multas-dgt/.claude/launch.json`, `_t.mjs` y `_t2.mjs`. El titular puede borrarla a mano.

**Actualizar datos:**
- **Radares:**
  1. Descargar `https://nap.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml` en `multas-dgt/scripts/sample.xml`.
  2. Ejecutar `node scripts/build-radars-dataset.mjs`, que regenera `src/data/dgt-radars.json`.
  3. Ejecutar `npm test`.
- **Infracciones:** están en `src/data/infractions.ts`, cada una con enlace al BOE y fecha de verificación. **Una prueba falla si alguna lleva más de 365 días sin verificar.** Cuando falle, hay que revisar la norma y actualizar la fecha.

---

## calculadora-impuestos — /es/impuestos

| | |
|---|---|
| URL | https://ododex.com/es/impuestos |
| Repositorio | GitHub; rama `feature/nextjs-migration` |
| Worker | `ododex` (principal) |
| Pruebas | 190 |
| Datos | Tablas del IEDMT (impuesto de matriculación) y del ITP por comunidad autónoma, más los coeficientes de depreciación de Hacienda (BOE) |

**Qué ofrece:**
- calculadora del impuesto de matriculación;
- calculadora del ITP de coches de segunda mano por comunidad.

**Particularidades:**
- Es la web de referencia del **estilo visual**: los tokens CSS de todas las demás salen de aquí.
- Es la candidata natural para la afiliación con carVertical (informe del coche usado junto al ITP).

**Actualizar datos:** cada año cambian las tablas de valores fiscales del BOE (orden HFP de precios medios de venta) y, a veces, los tipos autonómicos. Hay que revisarlos cada enero.

---

## prix-carburants-fr — /fr/prix-carburants

| | |
|---|---|
| URL | https://ododex.com/fr/prix-carburants |
| Repositorio | Local (rama `master`), sin remoto en GitHub todavía |
| Worker | `ododex-prix-carburants` |
| Ficheros | ~17 500 (15 500 páginas + 1 056 particiones de histórico) |
| Datos | Flujo instantáneo de data.economie.gouv.fr (unas 9 800 estaciones) y ficheros anuales de donnees.roulez-eco.fr (histórico desde 2016) |

**Qué ofrece (en francés):** lo mismo que gasolineras para Francia: buscador con mapa, páginas por departamento y municipio, ficha por estación (precios con fecha, horario, servicios, histórico) y páginas de histórico por Francia, región y departamento.

**Cómo se construye:**
- Port de `gasolineras`; contrato en `prix-carburants-fr/ARCHITECTURE.md`.
- `npm run build` ejecuta `preparar-datos` (descarga el flujo a `data/cache/prix-snapshot.json` y genera `public/datos/stations.json`).
- `npm run historique` descarga los zips anuales y genera `data/historique/` y `public/historique-stations/` (nada de eso está en git; se regenera desde la fuente). Tras la primera vez solo reprocesa el año en curso (~10 s).
- Fichas `station/*` y municipios `departement/*/*` solo HTML.
- `enPortada: false`: la portada de ododex.com está en español.

**Actualización diaria:** incluida al final de `npm run actualizar:gasolineras` (`historique:fr`, compilación y despliegue de `/fr/prix-carburants`).

**Particularidades:**
- Los datos franceses no traen la marca de la estación: no hay logos ni filtro de marca.
- El titular reside en España: las mentions légales aplican derecho español y citan la AEPD y la CNIL.

---

## zfe-fr — /fr/zfe

| | |
|---|---|
| URL | https://ododex.com/fr/zfe (sin publicar) |
| Repositorio | github.com/jbermejo14/fr-zbe (rama `main`) |
| Worker | `ododex-zfe` |
| Ficheros | ~132 |
| Datos | `public/datos/aires.geojson` con el esquema de la Base Nationale des ZFE (transport.data.gouv.fr). **Ahora mismo, datos de ejemplo** |

**Qué ofrece (en francés):** calculadora de la vignette Crit'Air (voiture, utilitaire, deux-roues; año o norma Euro), acceso a las 10 ZFE principales, mapa Leaflet con los perímetros y una página por ciudad (`/fr/zfe/<ville>`) con tabla de vignettes, horarios, próximas etapas y FAQ.

**Cómo se construye:**
- Equivalente francés de `zbe-map`; contrato en `zfe-fr/ARCHITECTURE.md`.
- Sin descarga en la compilación: el GeoJSON está en el repositorio.
- `npm test` usa `node --test` con un cargador propio (`tests/support/ts-loader.mjs`): esbuild, y por tanto tsx, está bloqueado en este equipo.
- `enPortada: false`: la portada de ododex.com está en español.

**Particularidades:**
- Mientras `AIRES_DATA_IS_SAMPLE` sea `true` (`lib/zfe-source.ts`), todas las páginas muestran « Données d'exemple » y llevan `noindex, follow`. Para pasar a datos oficiales, ver "Sustituir los datos de ejemplo" en `zfe-fr/README.md`.
- Mismo `config/titular.json` que el resto de webs (copiado a mano, fuera de git).

---

## gasolineras — /es/gasolineras

| | |
|---|---|
| URL | https://ododex.com/es/gasolineras |
| Repositorio | GitHub; rama `feature/seo-programatico-nextjs`, **sin rama remota (nunca subida)** |
| Worker | `ododex-gasolineras` |
| Ficheros | ~16 296 (~1 GB) |
| Pruebas | 174 |
| Datos | API REST de precios de carburantes del MITECO (Geoportal), unas 12 000 estaciones |

**Qué ofrece:**
- precio de cada carburante hoy en cada gasolinera;
- páginas por provincia y municipio;
- ficha por estación con su histórico.

**Cómo se construye:**
- `scripts/preparar-datos.ts` descarga MITECO **una sola vez** a `data/cache/miteco-snapshot.json` y genera `public/datos/estaciones.json`. Antes, cada worker de compilación de Next lo descargaba por su cuenta.
- `src/lib/mitecoSnapshot.ts` (`getMitecoData`) lee la instantánea durante la compilación.
- Las fichas de gasolinera (`gasolinera/*`) y de municipio (`provincia/*/*`) son solo HTML; los enlaces van con `InternalLink`.
- El histórico de estaciones sale de `public/historico-estaciones` (572 ficheros), generado con `npm run historico`.

**Actualización diaria:** el titular hace doble clic en el acceso directo del escritorio **"Actualizar gasolineras"**, que apunta a `ododex-sitio/Actualizar gasolineras.bat`. Este ejecuta `npm run actualizar:gasolineras`: descarga MITECO, compila gasolineras y después electrico-vs-gasolina (que toma de ella las medias de precio), despliega sus dos Workers y espera una tecla. Tarda unos 10-12 minutos.

**Particularidades:**
- Hay un fichero sin commitear, probablemente `tsconfig.tsbuildinfo`, que es inocuo.
- Cada despliegue sube ~1 GB; wrangler solo sube los ficheros cambiados (por hash), pero cambian casi todas las páginas de precio.

---

## es-itv — /es/itv

| | |
|---|---|
| URL | https://ododex.com/es/itv |
| Repositorio | local `es-itv` (rama `main`); sin remoto en GitHub todavía |
| Worker | `ododex-itv` |
| Ficheros | ~3 000 (590 páginas) |
| Pruebas | 394 |
| Datos | Centros de OpenStreetMap (ODbL, 373 válidos); periodicidad del RD 920/2017 (`docs/normativa.md`); tarifas por comunidad en `data/tariffs.json` (`docs/tarifas.md`, con fuente y confianza por comunidad) |

**Qué ofrece:**
- calculadora "¿cuándo me toca la ITV?" para 15 tipos de vehículo, con la regla de los 30 días;
- mapa OpenStreetMap con todos los centros y botón "ITV más cercana a mí";
- páginas por provincia (52), municipio (38, solo con 2 o más centros) y centro (373), con cercanos, distancias y tarifa de su comunidad;
- periodicidad por vehículo (15) y por año de matriculación (75), tarifas por comunidad (19) y 6 guías de normativa.

**Particularidades:**
- `data/stations.json` se genera a mano con `npm run import-stations` (necesita el `estaciones.json` de gasolineras para ubicar el municipio); la compilación no usa red ni depende de otra web.
- Las tarifas se revisan cada enero; Murcia sin tarifa verificada, Baleares sin tipo de IVA, Madrid precio libre (solo Applus+).
- Instalación en Windows: `npm install --force --cpu=wasm32`.

---

## electrico-vs-gasolina — /es/electrico-vs-gasolina

| | |
|---|---|
| URL | https://ododex.com/es/electrico-vs-gasolina (publicada el 19/11/2026) |
| Repositorio | `github.com/jbermejo14/electrico-vs-gasolina`; rama `main` |
| Worker | `ododex-electrico-vs-gasolina` |
| Ficheros | ~334 |
| Pruebas | 150 |
| Datos | Medias de gasolina 95 y diésel (MITECO, del `estaciones.json` de gasolineras) y tarifas de recarga por operador en `data/charging-prices.json` (recopiladas a mano por el titular, noviembre de 2026, orientativas) |

**Qué ofrece:**
- calculadora de coste por km, por 100 km y por año: combustión frente a eléctrico, con reparto casa/recarga pública, tarifa de casa, operador y potencia de recarga;
- página por provincia (52) con su precio medio, comparación con la media de España y posición en el ranking;
- ranking de provincias, tabla de tarifas por operador y preguntas frecuentes con cifras calculadas.

**Cómo se construye:**
- `npm run build` ejecuta antes `npm run import-fuel`, que lee `../gasolineras/public/datos/estaciones.json` y escribe `data/fuel-prices.json` (fuera de git). Por eso va **después de gasolineras** en `secciones.json`.
- La actualización diaria (`npm run actualizar:gasolineras`) compila y despliega también esta sección, para que las medias sean del mismo día.
- URL de provincia con slug propio (`a-coruna`, `las-palmas`); el enlace a gasolineras usa el slug de MITECO (`coruna-a`).

**Particularidades:**
- RIPREE no publica precios: las tarifas de recarga son datos del titular. Para cambiarlas, editar `data/charging-prices.json` (ver el README del proyecto).
- Instalación en Windows: `npm install --force --cpu=wasm32`.

---

## zbe-map — /es/zbe

| | |
|---|---|
| URL | https://ododex.com/es/zbe |
| Repositorio | GitHub; rama `refactor/zbe-reglas-oficiales-seo` |
| Worker | `ododex-zbe` |
| Ficheros | ~6 621 |
| Pruebas | 146 |
| Datos | `data/zbe-cities.json`, mantenido a mano: 152 ciudades con su ordenanza, fechas y restricciones por etiqueta |

**Qué ofrece:**
- Selector de vehículo: marca, combustible y año. Además, mes para los diésel de 2015 y autonomía eléctrica para los híbridos enchufables, porque la norma de etiquetas lo exige. **No hay vehículo por defecto:** el resultado solo aparece cuando el usuario elige.
- Campo de **matrícula como atajo para el año.** `resolveBadgeFromPlate` en `lib/plate-badge.ts` estima el año por la serie de la matrícula y solo pregunta el combustible si gasolina y diésel darían etiquetas distintas. No se usa ninguna API: no hay ninguna gratuita, y el titular no quiere enlazar a la DGT.
- `/ciudades`: índice de las 152 ciudades agrupadas en 19 comunidades (`canonicalRegion` unifica nombres duplicados).
- Selector de varias ciudades (hasta 4, combobox accesible con ARIA) que muestra información y mapa de cada ZBE.
- Botón "Mi ubicación": `lib/geo.ts` (`nearestZbe`) busca la ZBE más cercana. La posición no sale del navegador.
- `/etiqueta-dgt`: página índice con la calculadora `EtiquetaCalculator` (combustible, año, mes y autonomía, y la etiqueta resultante). Antes el enlace del menú llevaba a un caso fijo (gasolina de 2018).
- Páginas `/[ciudad]` y `/[ciudad]/[etiqueta]`.

**Particularidades:**
- Sin API: toda la lógica corre en el navegador.
- Mapas con teselas OSM y Esri. Se quitaron los botones de GeoJSON y las ubicaciones fijas de Zaragoza y Huesca.
- Los bloques de afiliado (tasación, seguros...) están **ocultos** mientras no haya un `NEXT_PUBLIC_AFFILIATE_*_TAG`.
- Prisma sigue en el proyecto solo para scripts antiguos; la web no lo usa.
- **Una prueba falla si una ciudad lleva más de 120 días sin verificarse** (`lastVerified` en `zbe-cities.json`). Es intencionado: obliga a revisar las ordenanzas. Si falla, hay que verificar esas ciudades y actualizar la fecha, no desactivar la prueba.

---

## charger-map — /es/puntos-recarga

| | |
|---|---|
| URL | https://ododex.com/es/puntos-recarga |
| Repositorio | GitHub; rama `feature/nextjs-migration` |
| Worker | `ododex-puntos-recarga` |
| Ficheros | ~15 643 |
| Pruebas | 90 |
| Datos | Censo RIPREE del MITECO: 12 114 puntos, 2 120 municipios, 51 provincias y 160 operadores |

**Qué ofrece:**
- mapa nacional con clustering;
- explorador por provincia en la portada;
- páginas por provincia, municipio, operador y punto;
- calculadora de recarga (`/calculadora`).

**Cómo se construye:**
- `scripts/preparar-datos.ts` genera `public/datos/mapa.json` (1,31 MB, formato compacto con tablas `operadores` y `provincias` y puntos `{i,s,la,ln,p,o,v}`) y `public/datos/provincias/<slug>.json`.
- Las fichas de punto y de municipio son solo HTML.

**Particularidades:**
- `globals.css` lleva `@import "tailwindcss" source("../"); @source not "../data";`. **Sin esa exclusión Tailwind se queda sin memoria**, porque escanea los JSON de datos.
- Unos 4 000 puntos daban 404 porque su id tenía mayúsculas; se resolvió con un índice por slug.
- El contenedor del mapa de `HomeExplorer` no debe llevar `flex-1` junto a una altura explícita (salía con 0 px).

**Actualizar datos:** `npm run import-chargers` en `charger-map` y después `npm run build -- --solo /es/puntos-recarga` y `npm run deploy -- --solo /es/puntos-recarga` en `ododex-sitio`.

---

## recalls-web — /es/llamadas-revision y /en/recalls

| | |
|---|---|
| URLs | https://ododex.com/es/llamadas-revision y https://ododex.com/en/recalls |
| Repositorio | GitHub; rama `feature/nextjs-migration` |
| Workers | `ododex-llamadas-revision` (es) y `ododex-recalls` (en) |
| Ficheros | ~14 733 por idioma |
| Pruebas | 69 |
| Datos | Safety Gate de la UE (alertas de vehículos), XML descargado a mano |

**Qué ofrece:** las campañas de llamada a revisión de coches y motos, por marca, por modelo y por campaña.

**Cómo se construye:**
- Se compila dos veces con `RECALLS_LANG`: `build:es` genera `out-es` y `build:en` genera `out-en`. En `secciones.json` son dos secciones con `entorno`, `exportacion` y `scriptBuild`.
- La versión inglesa no sale en la portada (`enPortada: false`).
- Las fichas de campaña y de modelo son solo HTML.

**Particularidades:**
- `cleanSourceText` quita el prefijo "null " que traen 1 734 descripciones de la fuente.
- Los textos de riesgo se muestran en su idioma original a propósito: no se traducen, para no inventar.

**Actualizar datos:**
1. Descargar el XML de Safety Gate a mano desde su web.
2. Ejecutar `npm run import` en `recalls-web` (ver su README para la ruta del fichero).
3. Recompilar y desplegar las dos secciones.

---

## vehicle-stats — sin publicar

- **Repositorio:** GitHub, rama `feature/ssg-microdatos-dgt`, Next 16. Todo subido.
- **Qué es:** estadísticas del parque y de las matriculaciones a partir de los microdatos MATRABA de la DGT, con generación estática.
- **Para publicarla:**
  - hay que quitar 2 rutas API;
  - hay que aplicar el patrón común (basePath, marca, legales, AdSlot).
- **Interés:** monetización baja (tráfico informativo), pero aporta autoridad y enlaces internos.

## uk-petrostation — sin publicar

- **Repositorio:** GitHub, rama `main`, Next 14. Todo subido.
- **Qué es:** gasolineras de Reino Unido.
- **Bloqueo:** no tiene datos reales. Solo hay una instantánea de 854 estaciones sin licencia clara, y el importador de "Fuel Finder" (el esquema oficial de precios del Gobierno británico) nunca se ha ejecutado.
- **Para publicarla:** hay que migrar a Next 16 y aplicar el patrón común.

## uk-ulez-map — sin publicar

- **Repositorio:** GitHub, rama `main`, Next 14. Todo subido.
- **Qué es:** comprobador de la ULEZ de Londres por matrícula.
- **Bloqueo:** necesita una clave de la API DVLA VES y un **servidor** para no exponerla. Eso choca con el modelo estático y gratuito.
- **Alternativa:** sin matrícula, un selector de combustible y año como en ZBE.
- **Idioma:** la interfaz está en inglés.
