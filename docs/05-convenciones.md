# 5. Convenciones

## Principios

Se programa como si el proyecto fuera a mantenerlo durante diez años otro equipo. Las normas completas están en el `CLAUDE.md` global del titular ("CodingSkillz"). Resumen:

- Legible y simple antes que ingenioso. Explícito antes que implícito.
- Solo lo pedido: nada de funciones "por si acaso".
- Pocas dependencias, con versión fijada. Tecnología estándar.
- **Identificadores en inglés; comentarios, documentación y textos de la web en español.**
- En un repositorio existente mandan sus convenciones.
- Ante una ambigüedad, se pregunta antes de diseñar.

## Flujo de trabajo con Claude Code

1. **Investigar:** leer el código y las convenciones; preguntar si hay dudas.
2. **Diseñar:** la sesión principal escribe o actualiza `ARCHITECTURE.md`, que es el contrato. Contiene objetivo y alcance, módulos con su interfaz, orden y criterios de aceptación.
3. **Implementar módulo a módulo:**
   - el subagente `implementador` (modelo sonnet) escribe el módulo y sus pruebas;
   - la sesión principal comprueba `git status --short` contra la lista de ficheros permitidos;
   - ejecuta ella misma las pruebas;
   - el subagente `revisor` (sonnet) revisa;
   - se corrige y se hace commit.
4. **Integrar:** la sesión principal conecta las piezas, compila, lo revisa en pantalla (navegador integrado, claro y oscuro, 375 y 1280 px) y actualiza README y ARCHITECTURE.
5. **Entregar:** informe honesto de qué funciona, qué no se ha probado y qué queda.

### Seguridad con subagentes

- El encargo lista las **rutas exactas** que puede tocar. Debe decir que no borre, mueva, renombre ni restaure otros ficheros, y que no ejecute `git clean`, `git stash`, `git checkout --`, `git restore`, `git reset`, `git add` ni `git commit`.
- Los hooks `~/.claude/hooks/destructive_guard.py` (borrados y git destructivo) y `secret_guard.py` (literales tipo contraseña en pruebas) protegen todas las sesiones. No se rodean.
- Lo que no está commiteado se puede perder: commit por módulo en cuanto pasan las pruebas.

### Commits

- Mensaje en español y descriptivo.
- Terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Publicar o desplegar requiere la autorización del titular. Ya la dio para ododex.com y para cada sección que pidió.

## Datos personales

- `config/titular.json` (nombre, NIF, correo y domicilio del titular) **nunca va a git** y nunca se envía a servicios externos.
- Las webs no guardan datos de usuarios. La ubicación (ZBE, puntos de recarga) se usa solo en el navegador.

## Estilo visual

- **Tokens CSS** (copiados de calculadora-impuestos), expuestos a Tailwind con `@theme inline`:
  - fondos: `bg-bg`, `bg-surface` y `bg-elevated`;
  - bordes: `border-line`;
  - texto: `text-fg`, `text-muted` y `text-secondary`;
  - acento: `text-accent` y `bg-accent-soft`.
- **Prohibido:**
  - colores de paleta sueltos (`orange-500`, `#FF6B00` a mano...);
  - degradados.
  Las pruebas de cada web lo comprueban. Excepciones aprobadas por el titular: `zarabus` (paleta roja propia) y `zaratram-live` (paleta oscura propia, sin tema claro).
- **Tema:**
  - atributo `data-theme` en `<html>`;
  - `localStorage['ododex-theme']`;
  - script anti-parpadeo en el `<head>`.
- **Clases de componentes** (`.card`, `.btn`, `.ad-slot`...): en `@layer components`.
- **Cascada:**
  - todo CSS de terceros (Leaflet, MarkerCluster) va en `@layer base` y sin dimensiones. Una regla fuera de capa gana a cualquier utilidad de Tailwind;
  - los contenedores de mapa llevan `isolate`.
- **Responsive:**
  - sin desbordamiento horizontal a 375 px (`min-w-0`, `break-words` en textos largos);
  - objetivos táctiles de al menos 44 px (`min-h-11`).
- **Contraste:** WCAG AA en los dos temas.

## SEO

- Canonical, `og:url` y JSON-LD con la URL absoluta de producción (`absoluteUrl`).
- Un sitemap por sección. `robots.txt` está en la raíz y los enumera todos.
- Las páginas finas o casi duplicadas (fichas de radar) llevan `noindex` y van fuera del sitemap.
- Los legales llevan `noindex, follow`.
- **Una sola meta `robots` por página:** no se pone una global en el layout que contradiga la de la 404.
- Títulos y descripciones únicos por página, generados a partir de los datos.

## Páginas legales

- Están en todas las webs: `/aviso-legal`, `/privacidad` y `/cookies`.
- Se generan con `src/lib/legal.ts`:
  - `getTitular()` lee `config/titular.json`;
  - `camposPendientes` y `valorOPendiente` muestran "[pendiente]" si falta un dato;
  - `FECHA_TEXTOS_LEGALES` es la fecha de última revisión.
- **Contenido:**
  - fuente de los datos y aviso de que no es oficial;
  - carácter orientativo de las calculadoras;
  - teselas de mapas;
  - AdSense con consentimiento (CMP de Google);
  - el botón "Gestionar cookies" (`ConsentSettingsButton`, `googlefc.showRevocationMessage`).

## Anuncios (`AdSlot`)

Contrato completo en la sección 8 de `../ARCHITECTURE.md`.

- `AdSenseScript` solo se carga si `NEXT_PUBLIC_ADSENSE_CLIENT` tiene el formato `ca-pub-` seguido de 16 dígitos.
- `AdSlot` se pinta solo si además `NEXT_PUBLIC_ADSENSE_SLOT` tiene 10 dígitos.
- Aspecto:
  - etiqueta visible "Publicidad";
  - hueco reservado (clase `.ad-slot`) para no provocar saltos de maquetación.
- **Ubicación:**
  - como máximo 3 por página;
  - tras el contenido principal y al final;
  - nunca en legales ni en la 404.
- **Afiliados:** se muestran solo con código configurado, marcados como publicidad y con `rel="sponsored nofollow"`.

## Pruebas

- **Cada web:** `npm test`.
  - El runner es `node --test` con tsx o vitest, según el proyecto.
  - Cubren:
    - la lógica (calculadoras, normas de etiquetas);
    - las URLs (`site.ts`);
    - los enlaces solo HTML;
    - la marca y los colores;
    - los legales;
    - `AdSlot`;
    - la ausencia de `/api/`, `cartocdn` o nombres antiguos.
- **Sin red** en las pruebas: se usan fixtures.
- `npx tsc --noEmit` debe pasar.
- **ododex-sitio:** 99 pruebas del ensamblado y del servidor local.
