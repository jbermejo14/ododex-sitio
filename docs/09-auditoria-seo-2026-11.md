# 9. Auditoría SEO (18/11/2026)

Auditoría por muestreo de la web en producción. Para cada tipo de página de cada sitemap se descargaron dos URLs (unas 210 en total) y se midió:

- estado HTTP, `title`, `description`, `canonical`, `robots`, `h1` y número de `h2`;
- palabras de texto visible en `<main>`;
- enlaces internos únicos;
- JSON-LD y `og:image`;
- peso del HTML;
- **parecido entre dos páginas del mismo tipo:** coincidencia de grupos de 5 palabras (Jaccard). Un parecido alto con poco texto indica páginas de plantilla con poco contenido propio.

Hay que tener en cuenta que el parecido incluye el texto común de la plantilla (avisos, migas), así que es orientativo.

## Resumen

**Lo técnico está bien.** Todas las páginas muestreadas:

- devuelven 200 y la 404 real devuelve 404;
- tienen canonical correcto, un solo `h1`, y title y description;
- llevan `lastmod` en los sitemaps;
- tienen `hreflang` es/en/x-default entre llamadas a revisión y recalls.

**El problema es el contenido de las páginas más numerosas.** Unas 54 000 URLs están en los sitemaps, y casi 30 000 son fichas de gasolinera, de punto de recarga o de campaña, con unas 150-250 palabras cada una. Google puede tratarlas como "contenido a escala de poco valor" e indexar solo una parte.

**Hay un fallo visible** en unas 10 000 páginas de llamadas a revisión. Ver P0.

## Medidas por tipo de página

| Tipo | Páginas | Palabras | Enlaces internos | Parecido | Valoración |
|---|---|---|---|---|---|
| multas: portada | 1 | 3 736 | 179 | — | Bien |
| multas: `/multas/<infracción>` | 28 | ~380 | ~57 | 23 % | Bien |
| multas: `/radares/<provincia>` | 43 | ~220 | ~70 | 13 % | Aceptable |
| multas: `/radares/<prov>/<carretera>` | 361 | **137** | 56 | 37 % | Flojo |
| impuestos: portada | 1 | 1 466 | 30 | — | Bien (sin JSON-LD) |
| impuestos: ITP por comunidad | 19 | ~1 050 | 24 | 68 % | Bien (parecido alto pero con mucho texto) |
| impuestos: matriculación y guías | 7 | 330-700 | ~27 | 26-62 % | Bien |
| gasolineras: provincia | 52 | ~750 | 69-121 | 5 % | Bien |
| gasolineras: municipio | 3 256 | 234-300 | ~20 | 14 % | Aceptable |
| gasolineras: **gasolinera** | **11 530** | **~145** | **8** | 17 % | **Flojo** |
| gasolineras: histórico | 85 | ~400 | 7 | 22 % | Aceptable |
| ZBE: portada | 1 | 254 | **6** | — | Pocos enlaces |
| ZBE: `/<ciudad>` | 152 | ~300 | 11 | — | Aceptable |
| ZBE: **`/<ciudad>/<etiqueta>`** | ~760 | ~260 | 11 | **67 %** | **Casi duplicadas** |
| ZBE: `/etiqueta-dgt/*/*` | 174 | ~335 | 33 | 51 % | Aceptable |
| puntos de recarga: provincia | 51 | ~335 | 51-66 | 11 % | Aceptable |
| puntos de recarga: municipio | 2 120 | 166-1 011 | 29-57 | 9 % | Aceptable (los pueblos pequeños, flojos) |
| puntos de recarga: operador | 160 | ~185 | 27 | 51 % | Flojo |
| puntos de recarga: **punto** | **12 114** | **~155** | 17 | **55 %** | **Flojo** |
| llamadas a revisión: marca | 660 (×2 idiomas) | 180-410 | 7-16 | 22 % | Aceptable, con fallo P0 |
| llamadas a revisión: modelo | 4 432 (×2) | ~210 | **8** | 33 % | Flojo, con fallo P0 |
| llamadas a revisión: campaña | 6 307 (×2) | ~245 | 8-9 | 40 % | Flojo |

Ninguna página tiene `og:image`.

## P0: fallos que hay que corregir ya

> **Estado a 18/11/2026.**
> - **Corregidos y publicados:** los puntos 1 y 4 (recalls-web, commit `493731b`, desplegado). La traducción afecta a riesgos, países y tipo de vehículo.
> - **Pendiente de la próxima importación de Safety Gate:** el partido de modelos con comas dentro de paréntesis. El normalizador ya está corregido, pero hay que volver a importar los datos.
> - **Pendiente:** unificar las marcas duplicadas (`opel-opel-vauxhall`).
> - **Dependen del titular:** los puntos 2 y 3.

1. **Plantilla sin rellenar en llamadas a revisión.**
   - **Qué se ve:** las páginas de marca y de modelo muestran literalmente "Campañas que afectan al {brand} {model}" y "Historial de campañas de {brand}". En inglés pasa lo mismo.
   - **Alcance:** unas 10 000 páginas.
   - **Causa:** `recalls-web/src/app/marca/[marca]/[modelo]/page.tsx:197` (y su equivalente en la página de marca) usa el texto del diccionario sin sustituir `{brand}` ni `{model}`.
   - **Corrección:** sustituirlos y añadir una prueba que falle si una página generada contiene `{` seguido de una palabra y `}`.
2. **HTTP no redirige a HTTPS.**
   - **Qué pasa:** `http://ododex.com/` responde 200 con el mismo contenido, así que hay dos versiones de cada URL.
   - **Corrección:** el titular activa "Always Use HTTPS" en Cloudflare.
3. **`www.ododex.com` no resuelve.**
   - **Corrección:** el titular crea el registro y la redirección (ver [06-pendientes-y-mejoras.md](06-pendientes-y-mejoras.md)).
4. **Etiquetas en inglés en las páginas en español de llamadas a revisión.**
   - **Qué se ve:**
     - el riesgo ("Fire") aunque en otra parte de la misma página sale "Incendio";
     - la categoría ("Passenger car");
     - el país ("France", "Japan").
   - **Qué traducir:** solo el vocabulario cerrado (riesgos, categorías y países). Los textos descriptivos siguen en su idioma original, como se decidió.
   - **Otro fallo visible:** la miga de pan corta un nombre de modelo ("323 (BG").
   - **Datos de marca:** revisar slugs como `opel-opel-vauxhall` (marca duplicada en los datos).

## P1: dar contenido propio a las páginas masivas

> **Estado a 18/11/2026: gasolinera y punto de recarga, hechos y publicados.** Medidos de nuevo con el mismo script:
>
> | Ficha | Palabras | Enlaces internos | Parecido | Título |
> |---|---|---|---|---|
> | Gasolinera | 145 → **~290** | 8 → **14** | 17 % → **9 %** | 73 → **56** caracteres |
> | Punto de recarga | 155 → **~325** | 17 → **23** | 55 % → **37 %** | 67 → **57** caracteres |
>
> Detalle en la sección S de `gasolineras/ARCHITECTURE.md` y en la 5 de `charger-map/ARCHITECTURE.md`.
>
> **Pendiente:**
> - el texto "menos de 100 m" de gasolineras (commit `0cfd12e`) se publicará con la próxima actualización diaria;
> - el punto final que traen algunos operadores en los datos de RIPREE ("Barcelona.") se sigue mostrando;
> - quedan llamadas a revisión y radares (ZBE hecho el 19/11/2026, ver abajo).

La regla para cada ficha es que tenga al menos una cosa útil que no esté en ninguna otra página, y enlaces a sus vecinas.

### Gasolinera (11 530 páginas)

- **Frase de resumen calculada:** "Es la 3.ª más barata de las 7 de Valdepeñas en diésel, 4,40 € más cara por depósito que la media".
- **Cercanas:** las 5 gasolineras más baratas a menos de 10 km, con enlace. Así se pasa de 8 a ~15 enlaces internos.
- **Enlaces cruzados:** a puntos de recarga del municipio y a la ZBE si la ciudad tiene una.
- **Títulos:**
  - provincia en mayúsculas ("CIUDAD REAL"): formatear como "Ciudad Real";
  - quitar "Precios MITECO Hoy" y usar "Precio hoy";
  - longitud ≤ 60 caracteres.
- **Formato:** coma decimal en todos los precios. Ahora se mezclan "1,601" y "1.634".

### Punto de recarga (12 114 páginas)

- **El `h1` y el título empiezan por el código interno** ("E-A-SantaPola-003"). Mejor algo como: "Punto de recarga Iberdrola en Santa Pola · 22 kW, Tipo 2", con el código en el cuerpo.
- **Cercanos:** puntos cercanos (el más rápido y los más próximos) y resumen del municipio ("1 de los 14 puntos de Santa Pola; el más potente es de 150 kW").
- **Plan B:** si a los 2-3 meses Search Console muestra la mayoría como "Descubierta: actualmente sin indexar", dejar `noindex` en los puntos y concentrar el valor en las páginas de municipio, que son mejores.

### ZBE por ciudad y etiqueta (~760 páginas, 67 % de parecido)

- **Mantener y enriquecer** las combinaciones con dudas reales (B, C y sin etiqueta) con:
  - calendario de fases de esa ciudad;
  - alternativas (aparcamientos disuasorios, transporte);
  - excepciones con detalle;
  - enlaces a gasolineras y puntos de recarga de la ciudad.
- **Cero emisiones y ECO:** donde la respuesta es "puede entrar siempre", valorar `noindex` o canonical a la página de la ciudad.

> **Estado (19/11/2026): hecho y publicado.** Detalle en las secciones Z7, Z8 y Z9 de `zbe-map/ARCHITECTURE.md`.
>
> - **Z7.** Cada página de ciudad y etiqueta incluye:
>   - una comparación con el resto de España y con su comunidad, con enlaces a las demás ciudades;
>   - enlaces a las gasolineras y a los puntos de recarga del municipio, y a la calculadora de etiqueta.
>
>   Los títulos se quedan en 60 caracteres o menos y las descripciones en 160 o menos (antes, 185-240).
> - **Z8.** Perímetros oficiales de Barcelona, Valencia, Zaragoza y Málaga.
> - **Z9.** Estado real de cada ZBE con datos de **Atlas ZBE** (ODbL 1.0; `data/zbe-cities.json` pasa a ser base derivada bajo ODbL y se cita en el pie):
>   - aviso de estado (se multa, aviso, en tramitación, suspendida…);
>   - reglas por etiqueta;
>   - calendario por ciudad y etiqueta;
>   - multa con pronto pago;
>   - excepciones;
>   - geometría oficial.
>
>   Corrige un error grave de los datos: 51 ciudades sin ZBE en vigor según el MITECO mostraban prohibiciones.
> - **No se ha puesto `noindex`** en CERO y ECO: con el estado y el calendario ya no son copias.
> **Corregido en ZBE el 19/11/2026.**
> | Par de páginas | Palabras | Parecido (antes 67 %) |
> |---|---|---|
> | Sevilla/B frente a Bilbao/B | 410 / 574 | 19 % |
> | Córdoba/C frente a Granada/C | 519 / 419 | 23 % |
> | Madrid/sin etiqueta frente a Zaragoza/sin etiqueta | 605 / 596 | 17 % |
> | Gijón/B frente a Leganés/B (ZBE en tramitación) | 358 / 373 | 47 % |
>
> **Pendiente:**
> - **Las 51 ciudades en tramitación** siguen pareciéndose entre sí (47 %). Si Search Console no las indexa, valorar `noindex` en sus páginas por etiqueta y dejar solo la de la ciudad.
> - **Datos de Atlas ZBE:** se actualizan cada día; hay que reimportarlos de vez en cuando (procedimiento en el README de zbe-map).
> - **Madrid:** el CSV de cámaras de tráfico no es un perímetro. Las cámaras podrían pintarse como puntos.
> - **Valencia:** su portal publica 5 aparcamientos disuasorios de la ZBE, útiles para la sección de "alternativas".

### Llamadas a revisión: modelo y campaña

- **Enlaces:** a otros modelos de la misma marca y a campañas del mismo riesgo o del mismo año. Hoy solo hay 8 enlaces.
- **Resumen en español** de los campos estructurados (riesgo, medida y fecha) encima del texto original en inglés.

### Multas: radares por carretera (361 páginas, 137 palabras)

- **Contenido:** tabla con el punto kilométrico, tipo, sentido y límite de cada radar.
- **Calculadora enlazada:** enlace a la calculadora con ese límite ya elegido ("¿Cuánto es la multa a 140 en este tramo de 120?").
- **Vecinas:** otras carreteras de la provincia.

## P2: retoques

- **Títulos largos** (más de 65 caracteres, Google los corta):
  - infracciones de multas (~95);
  - `/etiqueta-dgt/*/*` (~93);
  - operadores (~89);
  - algunas ZBE (L'Hospitalet, 91).
- **Descripciones largas** (más de 160 caracteres): casi todas las de ZBE (185-240).
- **`og:image` en todas las secciones:** una imagen por sección como mínimo, mejor si se genera por página en la compilación.
- **JSON-LD:** añadirlo en la portada de impuestos y en la de puntos de recarga (`WebApplication` y `BreadcrumbList`).
- **HTML pesado:**
  - portada de llamadas a revisión, 472 KB;
  - portada de puntos de recarga, 407 KB;
  - provincia de gasolineras, 204 KB.

  Paginar o recortar listados y cargar el resto bajo demanda.
- **Portada de ZBE con solo 6 enlaces internos:** enlazar las 20 ciudades más buscadas y `/ciudades`.
- **Enlaces entre secciones:** hoy no hay ninguno. Es la mejora de enlazado con más efecto (ver P1).
- **Páginas "Sobre Ododex" y "Contacto":** dan confianza (E-E-A-T) y ayudan a la aprobación de AdSense.

## Decisión pendiente del titular: robots.txt de Cloudflare

Cloudflare antepone su robots.txt gestionado. Este:

- permite a Googlebot y a los buscadores (`search=yes`);
- **bloquea a los asistentes de IA**, como ChatGPT-User, Perplexity-User, Claude-User y Google-Agent, y a los rastreadores de entrenamiento.

Bloquear el entrenamiento es razonable. Bloquear a los agentes que consultan la web en nombre de un usuario impide que las respuestas de ChatGPT o Perplexity citen Ododex y envíen visitas.

Se cambia en Cloudflare → AI Crawl Control (o "Bots" → "Manage robots.txt"). Es decisión de negocio, no técnica.

## Cómo repetir la auditoría

El script usado está en `scripts/auditoria-seo.mjs`. Ejecución: `node scripts/auditoria-seo.mjs informe.json`. Escribe el detalle en JSON y una línea por tipo de página en la consola. Conviene repetirlo tras cada mejora y compararlo con los datos de Search Console (páginas indexadas por tipo) cuando estén disponibles.
