# 7. Hoja de ruta

Orden recomendado a 18/11/2026. Lo primero es asegurar lo que ya hay, después monetizar y, al final, crecer.

## Fase A: asegurar (urgente)

1. **Subir todos los repositorios a GitHub** y crear el remoto privado de `ododex-sitio`.
2. **Fusionar en `main`** las ramas publicadas de cada web.
3. **Tareas del titular en Cloudflare:** HTTPS siempre y `www`.
4. **Search Console** con los sitemaps.

## Fase B: monetizar

1. **Aprobación de AdSense:** revisar si Google pide algo más, como contenido, páginas "Sobre" o "Contacto", o política de privacidad.
2. **Afiliación:**
   - darse de alta;
   - añadir las variables `NEXT_PUBLIC_AFFILIATE_*_TAG` a `produccion.json` y `construir.mjs`;
   - colocar los bloques:

   | Web | Afiliado | Sitio |
   |---|---|---|
   | Impuestos | carVertical | Junto al resultado del ITP de segunda mano |
   | ZBE | compramostucoche | Cuando el coche no puede entrar |
   | ZBE, multas | Línea Directa | Bloque de seguros (revisar la normativa de la DGSFP) |
   | Llamadas a revisión | carVertical | Ficha de modelo |

3. **Analítica** (Cloudflare Web Analytics) para saber qué páginas traen tráfico y dónde poner los afiliados.

## Fase C: automatizar

**GitHub Actions** con un workflow por sección:
- `npm ci`;
- compilación en Linux (sin apaños de Windows);
- `wrangler deploy` con `CLOUDFLARE_API_TOKEN` como secreto.

Hay que hacer antes la fase A. Pasos:
1. Mover `ododex-sitio` a un repositorio que pueda clonar las webs, como submódulos o con un clonado en el workflow.
2. Crear `titular.json` desde secretos en el workflow, para que no esté en el repositorio.
3. Programar un cron diario para gasolineras (por ejemplo, a las 7:00, hora de España). Así ya no hace falta el clic diario.
4. Programar crons mensuales para puntos de recarga y radares.

Coste: GitHub Actions es gratuito en repositorios públicos y tiene 2 000 minutos al mes en los privados. Gasolineras tarda unos 10 min al día, unos 300 min al mes.

## Fase D: crecer en España

Webs nuevas, en orden de facilidad. Los prompts están en `../../prompts/`.

| Web | Prompt | Notas |
|---|---|---|
| Estadísticas del parque (vehicle-stats) | — (ya existe) | Quitar 2 rutas API y aplicar el patrón común. Poco dinero, buena autoridad. |
| Año por matrícula | `02-es-anio-matricula.md` | Muy fácil; ZBE ya tiene la tabla de series. Mucho volumen de búsqueda. |
| Valor fiscal por modelo | `11-es-valor-fiscal.md` | Combina con impuestos (mismas tablas del BOE). |
| ITV: calendario, estaciones, precios | `14-es-itv.md` | Mucho tráfico; por fases. |
| IVTM por municipio | `15-es-ivtm.md` | 8 000 municipios; por fases. Vigilar el límite de ficheros (Worker propio). |

## Fase E: abrir `/uk`

| Web | Estado | Qué falta |
|---|---|---|
| uk-ulez-map | Next 14, necesita la API DVLA | Rehacer sin servidor (selector de combustible y año) o aceptar un Worker con código (el plan gratuito permite 100 000 peticiones al día) para la consulta por matrícula. |
| uk-petrostation | Next 14, sin datos | Conseguir datos con licencia (Fuel Finder / CMA), ejecutar el importador y migrar a Next 16. |
| Otras de UK | prompts 01, 03, 04, 05, 10 y 16 | Edad por matrícula, aprobados por centro de examen, VED, multas y fallos de la MOT. Casi todas con datos abiertos y fáciles. |

Para `/uk` hay que decidir:
- si usar `en-GB` y una portada propia en `/uk`;
- cómo encajar AdSense, que es la misma cuenta;
- si hace falta un aviso de privacidad para el Reino Unido (UK GDPR).

## Fase F: otros países de la UE

Prompts 06, 07, 08, 12 y 13: histórico de carburantes UE, CO₂ por modelo, recalls por país, Spritpreise (DE) y prix carburants (FR). Exigen textos en otros idiomas y, en Alemania, una clave de Tankerkönig.
