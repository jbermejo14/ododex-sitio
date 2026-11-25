# 13. Auditoría de negocio y SEO de toda la red (23/11/2026)

Auditoría hecha el 23/11/2026 sobre lo que está **en producción**: rastreo de los sitemaps de las 18 secciones publicadas, unas 450 páginas analizadas (30-40 por sección, una por plantilla y el resto al azar), cabeceras y código de los repositorios. Completa las auditorías 09 y 10 y la estrategia 11; no las repite.

Las cifras de demanda, competencia y RPM son **estimaciones** basadas en el sector, no mediciones: la red no tiene analítica ni acceso compartido a Search Console. La primera recomendación de negocio es precisamente medir.

---

> **Actualización del mismo día (23/11/2026):** resueltos y desplegados los P0 de AdSense y canonical de `/fr/zfe`, `/fr/carte-grise`, `/fr/controle-technique`, `/fr/peages`, `/fr/permis-points`, `/es/multas` e `/es/impuestos` (multas e impuestos fusionando la versión local con la de GitHub), y la canonical `<!-- ORIGEN -->` de « Sobre nosotros » y « Contacto ». La guardia de producción detecta ya salidas sin AdSense, con `localhost` o con marcadores sin sustituir. También `/fr/radars` (§3.2): délit ≥ 50 km/h, sin « officiel », con AdSense.

## Estado (25/11/2026)

| Punto | Estado |
|---|---|
| §3.1 y §3.2: P0 de multas, impuestos, radars y AdSense/`localhost` en Francia | Resuelto y desplegado (23/11) |
| §3.3 Guardia de producción | Hecha: falla con páginas sin AdSense, con `localhost` o con marcadores de plantilla sin sustituir |
| §3.3 GitHub Actions | Pendiente |
| §3.3 Una rama por repo | Pendiente en `multas-dgt` (su `main` de GitHub está atrasado; la versión buena está en `fix/seo-legal-audit`) |
| §7.3 en las 6 webs francesas nuevas: títulos ≤ 65 (casi todos ≤ 60) en francés y con artículos de departamento, descripciones 120-160, imagen OG en todas las páginas, sin « officiel » referido a la web, openGraph propio en las páginas legales, descripciones de autopista redactadas a mano | Resuelto y desplegado (25/11) |
| §7.5 Reglas legales con pruebas en radars y permis-points: délit ≥ 50 km/h, excesos < 20 km/h según el límite (no el tipo de vía), 20-49 km/h con recuperación de 3 años | Resuelto y desplegado (25/11) |
| §7.1 Analítica (Cloudflare Web Analytics), Bing Webmaster | Pendiente (titular, en los paneles) |
| §7.1 Search Console | Verificación DNS presente; datos en espera |
| §4 Afiliación | Pendiente (alta del titular) |
| §7.2 Enlaces entre webs francesas por departamento | Pendiente |
| §7.3 Imagen OG en las webs españolas y prix-carburants | Desplegado (25/11) en las portadas de gasolineras, ZBE, llamadas a revisión, /en/recalls, eléctrico vs gasolina y ZaraBus (cambios hechos en GitHub el 21-22/11 y fusionados con los enlaces de red), en todas las páginas de ITV y prix-carburants. Pendiente: páginas internas de gasolineras, ZBE y las que redefinen openGraph sin imagen; puntos de recarga (no compila: memoria) |
| §7.3 Títulos > 60 y descripciones > 160 en gasolineras, llamadas a revisión, /en/recalls y ZBE (miles de páginas) | Pendiente |
| es-itv en GitHub | Pendiente: el repo no tiene remoto |
| §7.4 Poda | A los 90 días de datos de Search Console |
| §7.5 Fecha de « última revisión legal » visible | Pendiente |
| §5 Ampliaciones y §6 países | Pendiente |

## 1. Resumen ejecutivo

1. **El mayor problema no es de SEO, es de proceso.** Se trabaja desde dos equipos y se despliega a mano. En producción había, a fecha de hoy:
   - 6 webs francesas sin AdSense y `/fr/zfe` con canonical y sitemap en `http://localhost:3000` (**corregido hoy** en 5 de ellas; `/fr/radars` pendiente);
   - `/es/multas` y `/es/impuestos`, las dos webs con mejor RPM de la red, **con canonical en `localhost:3000` y sin AdSense** (pendiente: hay dos versiones divergentes de cada una, ver §3).
   Mientras esto pueda pasar, cualquier mejora de SEO se puede perder en el siguiente despliegue.
2. **No hay analítica.** Ni Cloudflare Web Analytics ni Google Analytics; no se sabe qué páginas traen visitas ni cuánto rinde cada web. Sin eso, decidir dónde invertir es adivinar.
3. **Unas 90 000 URLs en un dominio de una semana.** Es mucho para la autoridad que tiene ododex.com. Google indexará despacio y con criterio; una parte de las fichas (puntos de recarga, campañas de revisión, estaciones) puede quedarse sin indexar o considerarse contenido de poco valor a escala. Hay que medir y podar, no seguir multiplicando URLs.
4. **La exactitud legal es un riesgo real en temas YMYL** (multas, puntos, impuestos). Hoy hay errores publicados: `/fr/radars` dice que ≥ 50 km/h es contravención de 1 500 € (es delito desde el 29/12/2025) y `/fr/permis-points` no tiene la fila de ≥ 50 km/h. Varias webs se presentan como « officiel » sin serlo.
5. **Lo que funciona:** la base técnica es buena (estático en Cloudflare, rápido, datos estructurados ricos, datos oficiales únicos y actualizados a diario en carburantes). Las webs de carburantes (ES y FR) son el activo principal: mucho volumen, intención recurrente y miles de páginas con datos propios.
6. **Expansión:** sí a más países, pero como **líneas de producto replicables** (carburantes, multas, ZBE, inspección técnica, impuestos, peajes, recalls) y con una condición de entrada por país. Antes de abrir Reino Unido, consolidar España y Francia (proceso, analítica, exactitud).

---

## 2. Estado de la red en producción

| Sección | URLs | AdSense | Problema principal | Prioridad |
|---|---:|---|---|---|
| `/es/multas` | 434 | **No** | Canonical y sitemap en `localhost:3000` | **P0** |
| `/es/impuestos` | 27 | **No** | Canonical de **todas** las páginas a `http://localhost:3000` (raíz) | **P0** |
| `/es/itv` | 363 | Sí (1 bloque) | Títulos > 60 en un tercio | P2 |
| `/es/gasolineras` | 14 919 | Sí (2) | Descripciones > 160 (25/30) | P2 |
| `/es/electrico-vs-gasolina` | 53 | Sí (1) | Plantilla casi idéntica por provincia | P3 |
| `/es/zbe` | 1 089 | Sí (2) | Títulos > 60 (27/30); 174 combinaciones etiqueta-ciudad | P2 |
| `/es/tranvia-zaragoza` | 1 | Sí (1) | Una sola página | — |
| `/es/zaragoza-bus` | 2 | No (decisión) | — | — |
| `/es/puntos-recarga` | 14 447 | Sí (2) | 12 114 fichas de punto con poco valor de búsqueda | P2 |
| `/es/llamadas-revision` | 11 400 | Sí (2) | 6 307 fichas de campaña muy delgadas (p10: 200 palabras) | P2 |
| `/en/recalls` | 11 400 | Sí (2) | Mismo contenido que la versión española; poca demanda | P3 |
| `/fr/prix-carburants` | 15 655 | Sí (2) | **Aislada**: no enlaza a ninguna otra web francesa ni la enlazan | P1 |
| `/fr/zfe` | 11 | Sí (corregido hoy) | Solo 11 páginas | P2 |
| `/fr/carte-grise` | 23 | Sí (corregido hoy) | Títulos con « \| Ododex \| Ododex »; descripciones > 160 (23/23) | P1 |
| `/fr/radars` | 106 | **No** | Baremo ≥ 50 km/h desfasado; « officiel »; sin AdSense hasta recompilar | **P0** |
| `/fr/controle-technique` | 109 | Sí (corregido hoy) | Títulos > 60 (27/30); HTML de 212 KB | P2 |
| `/fr/peages` | 51 | Sí (corregido hoy) | Pocas rutas (26 trayectos); fichas de autopista de ~210 palabras | P2 |
| `/fr/permis-points` | 138 | Sí (corregido hoy) | Falta la fila ≥ 50 km/h; « officiel »; afiliación de stages sin activar | P1 |

Común a todas las secciones: **ninguna página de sección tiene `og:image`** (solo las portadas `/` y `/fr/`), lo que excluye Google Discover y empobrece cómo se ven al compartirlas. `http`→`https` y `www`→raíz ya redirigen con 301; `ads.txt` es correcto; las portadas tienen hreflang y páginas « Sobre nosotros » y « Contacto ».

---

## 3. Incidencias urgentes (P0)

### 3.1 Multas e impuestos sin AdSense y con canonical en localhost

El Worker principal (`ododex`), que sirve `/`, `/fr/`, `/es/multas` y `/es/impuestos`, se redesplegó desde el otro equipo con compilaciones hechas sin las variables de producción. Google trata una canonical a `localhost` como inválida y, en impuestos, todas las páginas declaran la misma canonical: es probable que solo indexe una o ninguna.

**Bloqueo:** cada repositorio tiene dos versiones divergentes.

| Repo | Versión en GitHub (otro equipo) | Versión local (este equipo) |
|---|---|---|
| `calculadora-impuestos` | `origin/main` (22/11): AdSense, FAQPage, imagen OG y rebrand, **construida sobre la base del 16/11**: no tiene la ruta `/es/impuestos`, los legales ni el resto de la migración | `feature/nextjs-migration` (19/11): migración completa a Ododex, títulos SEO, enlaces de red. 2 commits sin subir |
| `multas-dgt` | `origin/fix/seo-legal-audit` (21/11): títulos de carretera, baremo y OG | La misma rama con 2 commits propios (títulos ≤ 65 y enlaces de red) que se solapan |

Hay que **elegir una versión base por repo y fusionar la otra encima**, recompilar con `construir.mjs` y redesplegar el Worker principal. La guardia añadida hoy impide volver a publicar una salida así.

### 3.2 `/fr/radars`

- Baremo desfasado: dice « contravention de 5e classe, amende jusqu'à 1 500 € » para ≥ 50 km/h. Desde el 29/12/2025 es **délit**: amende forfaitaire délictuelle de 300 € (250 € minorée, 600 € majorée) o tribunal (3 750 €, 3 meses de prisión).
- « Simulateur officiel » en el título y la portada.
- Sin AdSense hasta recompilar (bloqueado por una caché vieja en `radars-fr/.next`).
- La lógica correcta del delito está en la rama local `version-local-2026-11-19` de `radars-fr` (`lib/speed-fine.ts`, con 33 pruebas).

### 3.3 Proceso de despliegue

Hoy se han encontrado 8 webs publicadas con salidas de desarrollo. La causa es estructural: dos equipos, despliegue manual y ramas que divergen. Medidas:

1. **Una sola fuente de verdad:** la rama `main` de GitHub de cada web. Nada se despliega desde una rama local sin subir.
2. **Despliegue solo con `npm run build` y `npm run deploy`** en `ododex-sitio` (la guardia lo exige desde hoy).
3. **GitHub Actions** (fase C de la hoja de ruta): compilar en Linux y desplegar desde la nube. Elimina también los apaños de Windows (esbuild, lightningcss, SWC) y la actualización diaria manual de gasolineras.

---

## 4. Enfoque de negocio

### 4.1 Cómo gana dinero la red y cuánto puede ganar

Ingresos de AdSense ≈ páginas vistas × RPM / 1 000. Con RPM orientativos de motor en España y Francia:

| Escenario (páginas vistas al mes) | RPM 3 € (carburantes, recarga) | RPM 8 € (multas, impuestos, carte grise) |
|---|---:|---:|
| 30 000 | 90 € | 240 € |
| 100 000 | 300 € | 800 € |
| 500 000 | 1 500 € | 4 000 € |

Conclusiones:

- **El volumen viene de carburantes; el dinero por visita, de trámites y sanciones.** Hay que tener las dos cosas: carburantes atrae visitas recurrentes y autoridad; multas, impuestos, carte grise, puntos y contrôle technique monetizan mejor.
- **La afiliación pesa más que AdSense con poco tráfico.** Un stage de récupération de points paga 20-45 € por reserva; un trámite de carte grise, 15-30 €; un informe de historial (carVertical), comisión por venta. Con 1 000 visitas al mes a las páginas de stages y una conversión del 1 %, son 200-450 € al mes, más que AdSense con 50 000 páginas vistas. Ninguna afiliación está activa todavía.
- **Redes premium** (Ezoic, Mediavine, Raptive) cuando se pase de 50 000-100 000 sesiones al mes: suben el RPM de forma notable.

### 4.2 Riesgos del modelo

| Riesgo | Por qué | Mitigación |
|---|---|---|
| Contenido a escala de poco valor | ~90 000 URLs en un dominio nuevo, muchas fichas de plantilla. La política de Google contra el « scaled content abuse » apunta exactamente a esto | Medir en Search Console y no indexar o fusionar lo que en 90 días no tenga impresiones |
| Errores legales (YMYL) | Multas, puntos e impuestos cambian cada año; un error resta confianza y posiciones | Reglas legales en código con pruebas; revisión legal anual por país con fecha visible en la página |
| Afirmarse « officiel » / « oficial » | Engaña al usuario y AdSense lo puede considerar tergiversación | Quitarlo de títulos y textos; decir siempre « données officielles de… » |
| Dependencia de AdSense | Una sola cuenta para toda la red: un problema de políticas en una web afecta a todas | Afiliación desde ya; webs nuevas de otros nichos en otro dominio |
| Mantenimiento lineal | Cada web y cada país añaden actualizaciones de datos y revisión legal | Automatizar (CI, crons) antes de crecer; priorizar datos que se actualizan solos |
| Operación desde dos equipos | Origen de todas las incidencias P0 de hoy | §3.3 |

### 4.3 Prioridades de negocio

1. **Asegurar** (esta semana): P0, proceso, analítica y Search Console.
2. **Monetizar lo que ya hay**: afiliación de stages (FR), carte grise (FR), historial de vehículo (ES impuestos y recalls). Darse de alta lleva días; implementarla, horas.
3. **Profundizar en ES y FR** antes de abrir más países: enlazado entre webs, títulos, imagen OG, poda de fichas sin tráfico, contenido estacional.
4. **Abrir Reino Unido** cuando España y Francia cumplan la condición de entrada de §6.3.

---

## 5. Web a web

Formato: **negocio** (demanda, competencia, monetización, veredicto) y **técnico** (hallazgos y acciones).

### España

#### `/es/gasolineras` — activo principal (invertir)
- **Negocio:** búsquedas enormes y recurrentes (« gasolineras baratas en [ciudad] », « precio gasolina hoy »). Competencia: Geoportal del MITECO, dieselogasolina, preciogasolina, apps. RPM bajo (2-6 €), pero el volumen y la recurrencia lo compensan y dan autoridad al dominio.
- **Técnico:** 14 919 URLs, datos estructurados ricos (`GasStation`, `Offer`), 2 bloques. Descripciones > 160 en 25 de 30. Sin `og:image`. Actualización diaria manual (unos 10 min).
- **Acciones:** acortar descripciones; imagen OG; automatizar la actualización con GitHub Actions; página diaria « precio de la gasolina hoy » con la variación frente a ayer (Discover y enlaces); comprobar en Search Console cuántas de las 11 525 fichas de gasolinera se indexan.

#### `/es/multas` — mejor RPM (arreglar y potenciar)
- **Negocio:** « multa por exceso de velocidad », « cuántos puntos quita… », « radares en la A-2 ». Competencia: DGT, autopista.es, RACE, abogados. RPM alto (7-15 €; anunciantes: recursos de multas, seguros). Afiliación posible: abogados de recursos.
- **Técnico:** **P0** (canonical localhost, sin AdSense). Páginas de carretera delgadas (~150 palabras, según la auditoría 10). Ruta redundante `/multas/multas/<infracción>`.
- **Acciones:** P0; enriquecer las carreteras (tramos, límites, radares cercanos, calculadora precargada); ampliar las 28 infracciones (las búsquedas « multa por… » son muchas y de cola larga).

#### `/es/impuestos` — mejor RPM (arreglar y potenciar)
- **Negocio:** « ITP coche segunda mano [comunidad] », « impuesto de matriculación ». RPM alto (8-18 €). Afiliación natural: informe de historial (carVertical) junto al ITP; gestorías de transferencia.
- **Técnico:** **P0** (todas las páginas con canonical a `http://localhost:3000`, sin AdSense). Solo 27 páginas.
- **Acciones:** P0; después, páginas por modelo de coche (valor fiscal BOE: « ITP Seat León 2018 ») — miles de búsquedas de cola larga con datos oficiales, la ampliación con más retorno de la red española.

#### `/es/itv` — mantener y mejorar
- **Negocio:** « cada cuánto pasa la ITV », « precio ITV [provincia] », « ITV [ciudad] cita ». Volumen medio-alto. Afiliación: cita previa online donde exista.
- **Técnico:** 363 URLs, 1 bloque por página, títulos > 60 en 9 de 30, datos estructurados `AutomotiveBusiness`.
- **Acciones:** títulos; segundo bloque en páginas largas; imagen OG.

#### `/es/zbe` — mantener; picos con cada cambio normativo
- **Negocio:** « ZBE Madrid », « puedo entrar con etiqueta B ». Demanda con picos cuando entra en vigor una zona. RPM medio. Afiliación estudiada: compramostucoche (« tu coche ya no puede entrar »).
- **Técnico:** 1 089 URLs (175 ciudades × 5 etiquetas + 174 combinaciones). Títulos > 60 en 27 de 30. Las combinaciones ciudad-etiqueta se parecen mucho entre sí (auditoría 10: similitud > 65 %).
- **Acciones:** títulos; vigilar en Search Console las combinaciones y no indexar las que no reciban impresiones; activar la afiliación.

#### `/es/puntos-recarga` — podar
- **Negocio:** « puntos de recarga en [ciudad] » tiene demanda; la ficha de cada punto casi no (la gente usa Google Maps o apps como Electromaps). RPM bueno (6-14 €).
- **Técnico:** 14 447 URLs, de ellas 12 114 fichas de punto (p10: 170 palabras).
- **Acciones:** mantener provincia, municipio y operador; valorar `noindex, follow` en las fichas de punto si en 90 días no tienen impresiones, y sacarlas del sitemap. Menos URLs de poco valor mejora el rastreo de las buenas.

#### `/es/llamadas-revision` — podar
- **Negocio:** demanda baja y muy de cola larga (« llamada a revisión Seat León »). RPM medio. Afiliación: carVertical en ficha de modelo.
- **Técnico:** 11 400 URLs; 6 307 fichas de campaña delgadas.
- **Acciones:** reforzar marca y modelo; valorar `noindex` de campañas sueltas o fusionarlas en la ficha de modelo.

#### `/en/recalls` — congelar
- **Negocio:** el mismo contenido europeo en inglés compite con Safety Gate y con webs de Reino Unido y EE. UU. que tienen sus propios datos nacionales. Poca probabilidad de posicionar.
- **Técnico:** 11 400 URLs duplicadas en otro idioma.
- **Acciones:** no invertir. Cuando se abra Reino Unido, sustituir por recalls con datos de la DVSA (Reino Unido) y valorar `noindex` en esta.

#### `/es/electrico-vs-gasolina` — mantener (bajo coste)
- **Negocio:** demanda baja pero buena intención (quien compra coche). Sirve de nodo de enlaces entre carburantes y recarga.
- **Técnico:** 53 páginas casi idénticas por provincia; 1 bloque.
- **Acciones:** pocas; añadir modelos concretos (« coste por km de un Tesla Model 3 frente a un Golf ») si se quiere tráfico.

#### `/es/tranvia-zaragoza` y `/es/zaragoza-bus` — utilidad local
- **Negocio:** usuarios recurrentes y fieles, pero de una sola ciudad y con RPM bajo. No escala a otros países. Útil como marca local y pruebas técnicas.
- **Acciones:** mantenimiento mínimo; el GTFS del tranvía caduca el 31/12/2026.

### Francia

#### `/fr/prix-carburants` — activo principal en Francia (invertir)
- **Negocio:** « prix carburant [ville] », « station essence la moins chère ». Competencia: prix-carburants.gouv.fr, carbu.com, Zagaz, essence.free. Igual que en España: volumen y recurrencia.
- **Técnico:** 15 655 URLs, buenos títulos, datos estructurados ricos, 2 bloques. **No enlaza a ninguna otra web francesa ni la enlazan.**
- **Acciones:** enlazado por departamento con radars, contrôle technique y stages (§7.2); página diaria « prix de l'essence aujourd'hui »; imagen OG en todas las páginas (ya existe en la portada).

#### `/fr/permis-points` — la web con más potencial de ingresos (activar afiliación)
- **Negocio:** « stage récupération de points [ville] » tiene mucha demanda y los centros pagan 20-45 € por reserva. Las 101 páginas de stage por departamento están hechas para eso.
- **Técnico:** 138 URLs, 1 bloque en la mayoría, falta la fila ≥ 50 km/h en el barème, « Simulateur officiel ».
- **Acciones:** alta en un programa de afiliación de stages y botón de reserva en cada departamento (`rel="sponsored"`); corregir el barème con la regla del delito; quitar « officiel ».

#### `/fr/carte-grise` — mucho volumen, mucha competencia (afiliación)
- **Negocio:** « prix carte grise » es de las búsquedas de motor con más volumen en Francia, pero la copan service-public, ANTS y los profesionales habilitados. El dinero está en la afiliación del trámite (15-30 €).
- **Técnico:** 23 páginas; títulos con « | Ododex | Ododex »; las 23 descripciones > 160; mayúsculas a la inglesa (« Prix et Simulation Officielle »); « officielle ».
- **Acciones:** corregir títulos y descripciones; quitar « officiel »; afiliación de trámite; ampliar con páginas por modelo o potencia fiscal (« carte grise 5 CV Île-de-France »).

#### `/fr/radars` — arreglar (P0)
- **Negocio:** « radar fixe [département] », « amende excès de vitesse ». Competencia: radars-auto.com, Coyote, sitios de abogados. RPM alto.
- **Técnico:** P0 (§3.2). Títulos > 60 y descripciones > 160 en casi todas.
- **Acciones:** P0; después, páginas por carretera (« radars A7 »), como en España.

#### `/fr/controle-technique` — buena base (afiliación)
- **Negocio:** « prix contrôle technique [ville] », « contrôle technique pas cher ». Afiliación de reserva online (Simplauto y similares).
- **Técnico:** 109 URLs muy completas (mediana de 1 971 palabras), pero HTML de 212 KB por la carga de datos de React duplicada. Títulos > 60.
- **Acciones:** títulos; aligerar el HTML (no repetir los centros en el payload de React); afiliación; páginas por ciudad grande.

#### `/fr/peages` — ampliar con datos
- **Negocio:** « prix péage Paris Lyon ». Mappy, ViaMichelin y autoroutes.fr dominan la cabeza; la cola larga de trayectos es asequible. Afiliación de telepeaje (5-15 € por alta).
- **Técnico:** 26 trayectos y 17 autopistas; fichas de autopista de ~210 palabras.
- **Acciones:** generar cientos de trayectos entre ciudades con las tarifas oficiales; enriquecer las autopistas (salidas, tramos, áreas); afiliación de badge.

#### `/fr/zfe` — mantener
- **Negocio:** demanda media, con picos regulatorios. Ahora con datos oficiales.
- **Técnico:** 11 páginas, títulos > 60.
- **Acciones:** títulos; más ciudades cuando la Base nationale las publique; enlazar desde carburantes y radars.

---

## 6. Expansión por países

### 6.1 Pensar en líneas de producto, no en webs sueltas

La red ya tiene siete « productos » que se repiten de un país a otro:

| Producto | España | Francia | Fuente típica en otros países |
|---|---|---|---|
| Precio de carburantes | gasolineras | prix-carburants | Datos abiertos diarios: Italia (Mimit), Portugal (DGEG), Austria (E-Control), Alemania (Tankerkönig, con clave), Reino Unido (esquema Fuel Finder) |
| Multas y radares | multas | radars, permis-points | Baremo legal + listas de radares |
| Zonas de bajas emisiones | zbe | zfe | ULEZ/CAZ (Reino Unido), Umweltzonen (Alemania), ZTL (Italia) |
| Inspección técnica | itv | controle-technique | MOT (Reino Unido, historial abierto por API), TÜV/HU (Alemania), revisione (Italia) |
| Impuestos del vehículo | impuestos | carte-grise | VED (Reino Unido), Kfz-Steuer (Alemania), bollo (Italia) |
| Peajes | — | peages | Autostrade (Italia), Vignette (Austria, Suiza) |
| Llamadas a revisión | llamadas-revision | — | DVSA (Reino Unido), KBA (Alemania) |

Cada producto tiene un motor (reglas y datos) y una plantilla. **Llevar un producto a un país nuevo debe costar días, no semanas**, y para eso hace falta extraer las partes comunes (componentes, cargador de pruebas, AdSlot, legales, guardias) a una plantilla única. Hoy cada web es una copia que diverge.

### 6.2 Orden de países

| País | Por qué | Dificultad | Recomendación |
|---|---|---|---|
| **Reino Unido** | RPM 2-3 veces el español; datos abiertos excelentes (historial MOT, DVLA con clave, ULEZ, DVSA recalls); inglés reutilizable | Media: UK GDPR, unidades (mph), libras | **Siguiente**, como querías. Empezar por MOT (historial por matrícula con API gratuita: enorme demanda), edad por matrícula, ULEZ y carburantes |
| **Italia** | Carburantes con datos abiertos diarios casi iguales a los de España y Francia; ZTL; mucha población | Baja | Gran alternativa o el siguiente tras Reino Unido: el producto carburantes se porta casi tal cual |
| **Alemania** | RPM alto; mercado enorme | Alta: competencia fuerte (ADAC, clever-tanken, mehr-tanken), Impressum y DSGVO estrictos, Tankerkönig con clave | Después de Reino Unido e Italia |
| Portugal, Austria, Bélgica | Datos abiertos de carburantes; poca competencia | Baja | Cola rápida para el producto carburantes |

### 6.3 Condición de entrada para un país nuevo

No abrir un país hasta que el anterior cumpla:

1. Despliegue automático (CI) y guardia de producción para todas sus webs.
2. Analítica y Search Console activas desde el primer día.
3. Al menos la mitad de las URLs indexadas y tráfico creciendo tres meses seguidos.
4. Revisión legal fechada de cada web con reglas (multas, impuestos, puntos).

Sin esto, abrir países multiplica el mantenimiento y los errores (como los de hoy) en lugar de los ingresos.

---

## 7. Mejoras técnicas transversales

### 7.1 Medir

- **Cloudflare Web Analytics** (gratis, sin cookies, no necesita consentimiento): activarlo en la zona de Cloudflare.
- **Search Console** con propiedad de dominio (`ododex.com`, verificación DNS) y los 18 sitemaps; revisar cada semana « Páginas » (indexadas y excluidas) y « Rendimiento ».
- **Bing Webmaster Tools** (importa desde Search Console en un clic; Bing también alimenta ChatGPT Search y DuckDuckGo).

### 7.2 Enlazado interno

- España ya tiene la red de enlaces (`red-enlaces.json`): todas las secciones españolas enlazan a otras.
- **Francia no:** extender `red-enlaces.json` a `/fr/` emparejando por departamento: prix-carburants `/departement/<slug>` ↔ radars `/departement/<code>` ↔ controle-technique `/departement/<code>` ↔ permis-points `/stage/<slug>`. Son más de 400 páginas de departamento que se reforzarían entre sí, y carburantes (la web con más páginas) transmitiría autoridad a las que monetizan mejor.

### 7.3 Etiquetas

- Imagen OG por sección (1 200 × 630) en todas las páginas, y `max-image-preview:large` para Discover.
- Títulos ≤ 60 caracteres en itv, zbe, todas las francesas nuevas; descripciones 120-160 en gasolineras, recarga, revisiones y las francesas nuevas.
- En francés, mayúsculas solo al inicio (« Prix de la carte grise en Île-de-France »), no a la inglesa.
- Quitar « officiel / oficial » de títulos y textos.

### 7.4 Poda y presupuesto de rastreo

A los 90 días de tener Search Console: lista de URLs por plantilla con 0 impresiones. Las plantillas con mayoría sin impresiones (probablemente fichas de punto de recarga, campañas de revisión, combinaciones ZBE) pasan a `noindex, follow` y salen del sitemap.

### 7.5 Calidad y exactitud

- Reglas legales en código con pruebas (como `lib/speed-fine.ts` de la rama local de radars-fr) en todas las webs con baremos.
- Fecha de « última revisión legal » visible en cada web con reglas.
- La guardia de producción (§3.3) en todas las salidas, también las españolas.

### 7.6 Rendimiento

En general excelente (estático en Cloudflare). Vigilar el HTML pesado: controle-technique (212 KB de mediana) y zbe (93 KB) repiten datos en el payload de React. No es urgente.

---

## 8. Después de motor: qué nicho

El motor de la red es reutilizable: **datos públicos oficiales → páginas programáticas útiles + calculadoras**, alojadas gratis y monetizadas con anuncios y afiliación. Nichos donde ese motor encaja, ordenados por interés:

| Nicho | Ejemplos | Por qué | Cuidado |
|---|---|---|---|
| **Finanzas personales** | Sueldo neto, IRPF, hipoteca, Euríbor hoy, indemnización por despido, por país | El RPM más alto de AdSense; reglas fiscales por país (el mismo patrón que impuestos y carte grise) | YMYL: exactitud y revisión anual |
| **Vivienda** | Precio del m² por municipio, ITP y plusvalía de vivienda, gastos de compraventa | RPM muy alto; datos abiertos (notariado, INE, catastro); páginas por municipio a escala | Competencia de portales inmobiliarios en la cabeza; la cola larga es asequible |
| **Energía doméstica** | Precio de la luz hoy por horas (REE en España), tarifas reguladas, gas | Tráfico diario recurrente enorme; afiliación de comparadores de tarifas | Datos diarios: exige la automatización |
| Calendarios y festivos | Calendario laboral por municipio | Volumen estacional enorme y casi sin mantenimiento | RPM bajo |

Recomendación: **finanzas personales o vivienda en un dominio y marca nuevos** (Ododex es « los datos de tu coche »; mezclar temas diluye la autoridad temática y concentra el riesgo de AdSense en una cuenta y un dominio), reutilizando la infraestructura de `ododex-sitio`, la plantilla común y el CI. Empezar en España, que es donde ya se domina el idioma y la normativa.

---

## 9. Plan

### Esta semana (asegurar)
1. Decidir la versión base de `calculadora-impuestos` y `multas-dgt`, fusionar, recompilar con `construir.mjs` y redesplegar el Worker principal.
2. `/fr/radars`: borrar la caché `.next`, corregir el baremo (delito ≥ 50) y « officiel », recompilar y desplegar.
3. `/fr/permis-points`: añadir la fila ≥ 50 km/h y quitar « officiel ».
4. Activar Cloudflare Web Analytics y Search Console (dominio) con los 18 sitemaps; Bing Webmaster.

### Mes 1 (monetizar y ordenar)
5. GitHub Actions: compilación y despliegue de cada web desde `main`, con la guardia; cron diario de carburantes ES y FR.
6. Afiliación: stages de puntos (FR), trámite de carte grise (FR), carVertical (ES impuestos y recalls).
7. Imagen OG por sección; títulos y descripciones de las webs señaladas; « officiel » fuera.
8. Red de enlaces francesa por departamento.

### Meses 2-3 (crecer en ES y FR)
9. Impuestos por modelo de coche (ES); péages con cientos de trayectos (FR); radars por carretera (FR); páginas diarias de precio de carburante (ES y FR).
10. Plantilla común extraída de las webs actuales para acelerar nuevos países.
11. Primera poda con datos de Search Console.

### Meses 3-6 (expandir)
12. Reino Unido cuando España y Francia cumplan §6.3: MOT, edad por matrícula, ULEZ, carburantes.
13. Italia con el producto carburantes.
14. Si el tráfico pasa de 50 000 sesiones al mes, solicitar una red premium (Ezoic, Mediavine o Raptive).
