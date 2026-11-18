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

**Actualización diaria:** el titular hace doble clic en el acceso directo del escritorio **"Actualizar gasolineras"**, que apunta a `ododex-sitio/Actualizar gasolineras.bat`. Este ejecuta `npm run actualizar:gasolineras`: descarga MITECO, compila solo gasolineras, despliega solo su Worker y espera una tecla. Tarda unos 10 minutos.

**Particularidades:**
- Hay un fichero sin commitear, probablemente `tsconfig.tsbuildinfo`, que es inocuo.
- Cada despliegue sube ~1 GB; wrangler solo sube los ficheros cambiados (por hash), pero cambian casi todas las páginas de precio.

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
