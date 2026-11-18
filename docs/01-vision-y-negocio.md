# 1. Visión y negocio

## Qué es Ododex

Ododex es una red de webs de **datos útiles sobre vehículos**, con herramientas gratuitas y páginas de contenido generadas a partir de datos públicos oficiales. Por ejemplo: cuánto cuesta una multa por velocidad, cuánto se paga de impuesto de matriculación o ITP, qué gasolinera es más barata hoy, si un coche puede entrar en una zona de bajas emisiones, dónde hay un punto de recarga o si un modelo tiene una llamada a revisión.

- **Lema:** "Los datos de tu coche, claros."
- **Dominio:** `ododex.com`, comprado en Arsys el 17/11/2026, con el DNS gestionado en Cloudflare.
- **Estructura de URLs:** `https://ododex.com/<país o idioma>/<sección>`.
  - `/es/...`: webs para España, en español.
  - `/en/recalls`: versión en inglés de las llamadas a revisión (datos europeos).
  - `/uk/...`: reservado para las webs de Reino Unido (aún no publicadas).
- **Portada** (`/`): presenta la marca y enlaza a cada sección.

## Público

Conductores en España que buscan una respuesta concreta en Google: "multa 70 en zona de 50", "ITP coche segunda mano Aragón", "gasolinera más barata en Huesca", "puedo entrar en Madrid ZBE con etiqueta B", "puntos de recarga en Zaragoza", "llamada a revisión Seat León". El tráfico es **SEO orgánico**: la estrategia es tener muchas páginas útiles y bien indexables (SEO programático) generadas a partir de datos oficiales.

## Cómo gana dinero

### AdSense (activo, pendiente de aprobación)

- Cliente: `ca-pub-2749781881817715`.
- Unidad manual: `8745518895` ("ododex-contenido", adaptable).
- `ads.txt` en la raíz: `google.com, pub-2749781881817715, DIRECT, f08c47fec0942fa0`.
- Ambos valores están en `ododex-sitio/config/produccion.json` y se inyectan en cada web al compilar.
- **Estado:** Google aún no ha aprobado el sitio. Hasta entonces los huecos salen vacíos, y es normal.
- **Política de anuncios elegida por el titular:**
  - bloques manuales (`AdSlot`) colocados en sitios naturales: tras el resultado, entre secciones y al final; de 1 a 3 por página;
  - nunca anuncios en las páginas legales ni en la 404;
  - **sin anuncio ancla en móvil**, porque al titular le parece abusivo. En escritorio se puede activar el ancla o los laterales desde el panel de AdSense;
  - los anuncios automáticos solo encontraban hueco para el ancla (0 anuncios in-page), por eso se añadieron los bloques manuales.

### Afiliación (estudiada, sin dar de alta)

El estudio completo está en `../../negocio/afiliados-es.md`. Resumen:

| Programa | Red | Pago | Encaje |
|---|---|---|---|
| carVertical (informes de historial) | Directo | Comisión por venta, cookie de 90 días, pago a partir de 50 € acumulados | Impuestos (ITP de segunda mano), ZBE, llamadas a revisión |
| compramostucoche | Awin | ~100 € por cita válida | ZBE ("tu coche ya no puede entrar: véndelo"), impuestos |
| Línea Directa (seguros) | Awin | ~8 € por lead | Multas, impuestos. Cuidado con la normativa de la DGSFP sobre mediación de seguros. |

Conclusión del estudio: con poco tráfico, un buen afiliado en el sitio adecuado (por ejemplo, carVertical junto al cálculo del ITP de un coche usado) rinde más que un bloque de AdSense; los dos son compatibles.

**Regla:** ningún bloque de afiliado se muestra si no hay un código de afiliado configurado (variables `NEXT_PUBLIC_AFFILIATE_*_TAG`). Así está hecho en ZBE; el bloque "Tasación de tu coche" se quitó hasta tener afiliación.

### Costes

- Dominio: renovación anual en Arsys.
- Hosting: **0 €**, con el plan gratuito de Cloudflare Workers. Las peticiones a recursos estáticos son gratuitas e ilimitadas.
- El titular rechazó pagar 5 $/mes del plan de pago de Workers para tener servidor (por ejemplo, para actualizar gasolineras automáticamente).

## Titular y aspectos legales

- Persona física. Nombre, NIF, correo y domicilio están en `config/titular.json` de cada proyecto, **fuera de git** (contiene datos personales). La plantilla es `config/titular.example.json`.
- El domicilio del aviso legal está en `config/titular.json` (fuera de git).
- `registroMercantil` vacío: correcto para una persona física.
- Cada web tiene aviso legal, privacidad y cookies (`noindex, follow`, fuera del sitemap) y botón de "Gestionar cookies" (CMP de Google).
- Todas las webs dicen claramente que **no son oficiales** y citan la fuente de los datos (DGT, MITECO, BOE, Safety Gate, RIPREE...).

## Marca

La guía completa está en `../../brand/README.md`. Puntos clave:

- **Color de acento:** `#C2410C` en tema claro y `#FF6B00` en tema oscuro. Se usan solo mediante tokens CSS, nunca a mano.
- **Tipografías:** Inter para el texto y JetBrains Mono para cifras y código.
- **Tema claro y oscuro,** con conmutador; la preferencia se guarda en `localStorage['ododex-theme']`.
- **Sin degradados ni colores sueltos de paleta;** las pruebas lo comprueban.
- **Cabecera:** logo Ododex, separador y nombre de la sección.
