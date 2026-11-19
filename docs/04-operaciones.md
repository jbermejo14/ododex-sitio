# 4. Operaciones (recetario)

Todos los comandos se ejecutan desde `C:\Users\Usuario\Desktop\pruebas\ododex-sitio`, salvo que se indique otra cosa. En la práctica los lanza Claude Code. En Git Bash, antepón `export MSYS_NO_PATHCONV=1;` a cualquier comando con rutas `/es/...`, porque si no Git Bash las convierte en rutas de Windows. Ver "Resolución de problemas".

## Requisitos de la máquina

- Windows 11, Node.js LTS y npm.
- Git y sesión de GitHub, para subir los repositorios.
- wrangler: se instala solo con `npm install` (versión fijada 4.157.0).
- Sesión de Cloudflare en wrangler: `npx wrangler login`, que abre el navegador para que el titular autorice. Comprobar con `npx wrangler whoami`.
- `config/titular.json` en cada web (fuera de git). Si falta, copia `config/titular.example.json` y rellénalo; las páginas legales muestran "[pendiente]" en los campos vacíos.

## Tareas habituales

### Actualizar gasolineras (cada día)

- **Titular:** doble clic en "Actualizar gasolineras" en el escritorio. Al terminar, pulsa una tecla.
- **Equivalente por comando:** `npm run actualizar:gasolineras`. Compila y despliega gasolineras y, a continuación, electrico-vs-gasolina (sus medias salen del mismo volcado).
- Si falla la descarga de MITECO (la API a veces tarda o devuelve error), basta con repetirlo más tarde. La web sigue mostrando los precios del día anterior.

### Compilar y publicar todo

```bash
npm run build      # compila las 7 secciones y ensambla dist/ y dist-*/  (largo: ~30-60 min)
npm test           # pruebas del ensamblador
npm run preview    # http://localhost:8788 para revisar
npm run deploy     # publica todos los Workers
```

### Compilar y publicar una sola sección

```bash
export MSYS_NO_PATHCONV=1
npm run build -- --solo /es/zbe
npm run deploy -- --solo /es/zbe
```

Si la sección va en el Worker principal (`/es/multas`, `/es/impuestos`), `--solo` recompila esa web, pero el despliegue sube el Worker `ododex` entero: las demás partes de `dist/` deben estar ya presentes.

Para reensamblar sin recompilar (por ejemplo, tras cambiar la portada): `npm run build:sin-compilar`.

### Refrescar datos de otras secciones

| Sección | Comando en el proyecto | Frecuencia sugerida |
|---|---|---|
| Puntos de recarga | `npm run import-chargers` (charger-map) | Mensual |
| Llamadas a revisión | Descargar el XML de Safety Gate y `npm run import` (recalls-web) | Mensual o quincenal |
| ZBE | Revisar las ordenanzas y editar `data/zbe-cities.json`; actualizar `lastVerified` | Antes de 120 días (lo exige una prueba) |
| Multas (radares) | Descargar el XML del NAP a `scripts/sample.xml` y `node scripts/build-radars-dataset.mjs` (multas-dgt) | Trimestral |
| Multas (infracciones) | Revisar las normas del BOE y actualizar la fecha de verificación en `src/data/infractions.ts` | Antes de 365 días (lo exige una prueba) |
| Impuestos | Tablas del BOE de precios medios y tipos del ITP | Cada enero |
| Eléctrico vs gasolina (tarifas de recarga) | Editar `data/charging-prices.json` y su `updated_at` (electrico-vs-gasolina) | Cuando cambien las tarifas; revisar cada trimestre |

Después de refrescar: pruebas del proyecto, `npm run build -- --solo <ruta>` y `npm run deploy -- --solo <ruta>` en ododex-sitio.

### Añadir una sección nueva

1. **En la web:** aplicar el patrón común (ver [02-arquitectura.md](02-arquitectura.md), "Cada web"):
   - `basePath` igual a la ruta;
   - `output: 'export'`;
   - sin API;
   - `site.ts`, marca, legales, `AdSenseScript`, `ConsentSettingsButton`, `AdSlot` e `InternalLink` si hay páginas solo HTML.
   El mejor modelo para copiar es `charger-map` o `gasolineras`.
2. **Comprobar el número de ficheros:** `out/` debe tener menos de 20 000. Si no:
   - añadir `paginasSoloHtml`;
   - o reducir páginas.
3. **Añadir la entrada a `config/secciones.json`.** Con `worker` si la sección es grande. El Worker principal tiene sitio de sobra solo para webs pequeñas.
4. **Si lleva Worker propio,** crear `wrangler.<sufijo>.jsonc` copiando uno existente y cambiando:
   - `name`;
   - `assets.directory`;
   - `routes[0].pattern`.
5. **Probar:** `npm test` (las pruebas validan `secciones.json`), `npm run build -- --solo <ruta>` y `npm run preview`.
6. **Publicar:** `npm run deploy -- --solo <ruta>`. Las routes nuevas tardan **unos 2 minutos** en propagarse; mientras tanto la ruta devuelve la 404 del Worker principal.
7. **Verificar en producción:** portada, una página de detalle, la 404, el sitemap y los legales.
8. **Mantener la documentación al día:** actualizar esta carpeta `docs/` y la memoria del proyecto.

### Añadir o cambiar anuncios

- **Cliente y unidad:** se editan en `config/produccion.json`. Recompilar todo y desplegar.
- **Huecos:** cada web coloca `<AdSlot />` en su código. El contrato está en la sección 8 de `../ARCHITECTURE.md`:
  - de 1 a 3 por página;
  - nunca en legales ni en la 404;
  - con la etiqueta "Publicidad".
- **Formatos automáticos:** se gestionan en el panel de AdSense, en Anuncios → Por sitio → ododex.com:
  - ancla desactivada en móvil;
  - laterales opcionales solo en escritorio.
- **Mensaje de consentimiento UE:** se gestiona en AdSense → Privacidad y mensajes. Es obligatorio para el tráfico del EEE.

### Activar un programa de afiliación

1. El titular se da de alta (Awin, carVertical...) y pasa el código o enlace de afiliado.
2. Se añade como variable `NEXT_PUBLIC_AFFILIATE_<PROGRAMA>_TAG`. El sitio natural es `config/produccion.json` más su paso en `construir.mjs`, igual que `unidadAdsense`.
3. La web muestra el bloque solo si la variable existe. Hay que marcarlo como publicidad y poner `rel="sponsored nofollow"`.
4. Hay que mencionarlo en la política de privacidad y cookies si el programa deja cookies.

### Subir los repositorios a GitHub (copia de seguridad)

En cada proyecto con remoto:

```bash
git push -u origin <rama>
```

`ododex-sitio` no tiene remoto: hay que crear un repositorio **privado** en GitHub y ejecutar `git remote add origin <url>` y `git push -u origin master`. Comprobar antes que `config/titular.json` no está versionado (`git ls-files config`).

## Resolución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| `next build` falla con un error de SWC o "Application Control policy has blocked this file" | Windows bloquea los binarios nativos de SWC y de Tailwind oxide | Compilar siempre con `next build --webpack` (ya está en los scripts). Tailwind usa `@tailwindcss/oxide-wasm32-wasi` 4.3.3 (en `optionalDependencies`). |
| `wrangler deploy` falla con "spawn UNKNOWN" en esbuild | Smart App Control de Windows bloquea `esbuild.exe` (sin firma); visto el 19/11/2026 | `package.json` sustituye esbuild por `esbuild-wasm` con `overrides` (misma versión que pide wrangler). Si se actualiza wrangler y cambia su versión de esbuild, ajustar el override y borrar del lockfile las entradas `node_modules/esbuild` y `node_modules/@esbuild/*` antes de `npm install`, porque npm no cambia un paquete de la misma versión. |
| Tailwind: "Cannot find native binding" | npm no instaló el paquete WASM | Copiar `multas-dgt/node_modules/@tailwindcss/oxide-wasm32-wasi` (y sus dependencias `@napi-rs`, `@emnapi` si faltan) al `node_modules/@tailwindcss/` del proyecto. |
| Faltan clases de Tailwind en el CSS | El escáner WASM no detecta candidatos | El plugin PostCSS del proyecto (`postcss-tailwind-windows.cjs` o `postcss-inline-candidates.cjs`) los inyecta con `@source inline()`. Comprobar que está en `postcss.config.mjs`. |
| Tailwind se queda sin memoria | Escanea ficheros de datos enormes | `@source not "../data";` en `globals.css` (como en charger-map). |
| Un argumento `/es/zbe` llega como `C:/Program Files/Git/es/zbe` | Conversión de rutas de Git Bash | `export MSYS_NO_PATHCONV=1` antes del comando. |
| La navegación interna da 404 en ficheros `.txt` | Página solo HTML enlazada con `<Link>`, o segmentos sin aplanar | Usar `InternalLink`; reensamblar (el ensamblado aplana los segmentos). |
| Un mapa sale con 0 o 2 px de alto | Una regla CSS sin capa (Leaflet) gana a las utilidades de Tailwind, o `flex-1` junto a una altura explícita | CSS de Leaflet en `@layer base` sin `width` ni `height`; contenedor con `isolate` y altura explícita, sin `flex-1`. |
| Las teselas muestran "API KEY REQUIRED" | CARTO exige clave | Usar OSM o Esri. |
| Error 525 en el dominio | Registros DNS antiguos de Arsys | Borrarlos en Cloudflare → DNS. |
| La nueva ruta de sección da 404 tras desplegar | La route aún no se ha propagado | Esperar unos 2 minutos. |
| `wrangler deploy` pide iniciar sesión | Sesión caducada | `npx wrangler login` y que el titular autorice en el navegador. |
| Supera 20 000 ficheros | Demasiadas páginas con RSC | Ampliar `paginasSoloHtml` o separar en otro Worker. |
| Prueba de multas "infracción sin verificar en 365 días" | Normas sin revisar | Revisar el BOE y actualizar la fecha de verificación |
| Prueba de ZBE "ciudad sin verificar en 120 días" | Datos de ordenanzas caducados | Revisar las ordenanzas y actualizar `lastVerified`. |
| El hook bloquea `rm` o `git reset` | `destructive_guard.py` | No rodearlo. Para un fichero versionado, `git rm`; para basura sin versionar, que la borre el titular. |
| El commit falla por "posible secreto" | `secret_guard.py` en las pruebas | Usar la cadena `placeholder` en las pruebas y hacer el commit en un comando aparte. |

## Paneles externos

| Servicio | Para qué | Quién entra |
|---|---|---|
| Arsys | Renovación del dominio y nameservers | Titular |
| Cloudflare (dash.cloudflare.com) | DNS, Workers, routes, HTTPS, analíticas | Titular (y wrangler con su sesión) |
| Google AdSense | Aprobación, unidades, formatos automáticos, consentimiento y pagos | Titular |
| Google Search Console | Sitemaps e indexación (pendiente de dar de alta) | Titular |
| GitHub (jbermejo14) | Repositorios de las webs | Titular |
