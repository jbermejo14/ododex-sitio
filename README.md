# ododex-sitio

Publica `ododex.com` en Cloudflare Pages como un único sitio estático:

- **Raíz** (`/`): portada de la red Ododex, `robots.txt`, `ads.txt`, `404.html` y `_headers`.
- **Secciones**: la exportación estática de cada web Next.js hermana, bajo su ruta base.

| Ruta | Proyecto |
|---|---|
| `/es/multas` | `../multas-dgt` |
| `/es/impuestos` | `../calculadora-impuestos` |

Las secciones están en `config/secciones.json`. El diseño completo está en [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Requisitos

- Node.js 20 o superior.
- Las webs hermanas instaladas (`npm install --force` en cada una).
- `config/titular.json` relleno en cada web (datos del aviso legal; ver su README).

```bash
npm install
```

---

## Uso

### Compilar y ensamblar

Compila cada sección con las variables de producción y genera `dist/`:

```bash
ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX npm run build
```

En PowerShell:

```powershell
$env:ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX"; npm run build
```

| Variable | Descripción | Por defecto |
|---|---|---|
| `SITE_ORIGIN` | Origen del sitio. Se pasa a cada web como `NEXT_PUBLIC_SITE_URL` (canonical, sitemap) y se usa en `robots.txt` y la portada | `https://ododex.com` |
| `ADSENSE_CLIENT` | Editor de AdSense (`ca-pub-` y 16 dígitos). Se pasa a cada web como `NEXT_PUBLIC_ADSENSE_CLIENT` y genera `ads.txt`. Vacía: sin AdSense ni `ads.txt` | vacía |

Si las secciones ya están compiladas y solo quieres volver a ensamblar:

```bash
npm run build:sin-compilar
```

Cuidado: un `out/` compilado con `npm run build` dentro de una web, sin estas variables, lleva `http://localhost:3000` en los canonical y no carga AdSense. Para publicar, usa siempre `npm run build` desde aquí.

### Ver en local

```bash
npm run preview
```

Sirve `dist/` en `http://127.0.0.1:8788` (variable `PORT` para cambiarlo), con las mismas reglas de rutas que Cloudflare Pages: `/ruta` → `ruta.html` → `ruta/index.html`, y la `404.html` más cercana.

### Publicar

```bash
npm run deploy
```

Sube `dist/` al proyecto `ododex` de Cloudflare Pages con `wrangler` (versión fijada en `package.json`). La primera vez abre el navegador para iniciar sesión en Cloudflare.

### Pruebas

```bash
npm test
```

Sin red. Cubren el ensamblado (secciones, `robots.txt`, `ads.txt`, `_headers`, portada, copia, aplanado de segmentos, límites de Pages, protección de `dist`) y el servidor local (resolución de rutas, 404, recorrido de directorios, métodos).

---

## Primera publicación en Cloudflare (pasos del titular)

1. **Cuenta y dominio.** Crea una cuenta gratuita en Cloudflare. En "Add a site" añade `ododex.com` con el plan Free. Cloudflare te dará dos *nameservers*.
2. **DNS en Arsys.** En el panel de Arsys, en la gestión del dominio `ododex.com`, cambia los servidores DNS por los dos de Cloudflare. Puede tardar de minutos a 24 horas. Cloudflare avisa por correo cuando el dominio está activo.
3. **Proyecto de Pages.** En Cloudflare: "Workers & Pages" → "Create" → "Pages" → "Upload assets". Nombre del proyecto: `ododex`. No subas nada desde el panel: admite pocos ficheros y el sitio tiene unos 7 400. Sal y usa `npm run deploy`.
4. **Primer despliegue.** Aquí: `npm run build` (con `ADSENSE_CLIENT` si ya tienes cuenta de AdSense) y `npm run deploy`. El sitio queda en `https://ododex.pages.dev`.
5. **Dominio personalizado.** En el proyecto `ododex` → "Custom domains", añade `ododex.com` y después `www.ododex.com`. Cloudflare crea los registros DNS.
6. **Redirección de www.** En el dominio `ododex.com` → "Rules" → "Redirect Rules", crea una regla: si el host es `www.ododex.com`, redirige con 301 a `https://ododex.com` conservando la ruta y la consulta.
7. **Comprobación tras el primer despliegue:**
   - `https://ododex.com/es/multas` carga sin redirección a `/es/multas/` (`curl -I`, estado 200).
   - Navegar entre páginas no deja errores 404 en la consola del navegador.
   - `https://ododex.com/robots.txt` lista los sitemaps.
   - `https://ododex.com/no-existe` y `https://ododex.com/es/multas/no-existe` devuelven 404 con su página.
8. **Search Console.** Añade la propiedad de dominio `ododex.com`. La verificación por DNS se hace en Cloudflare. Envía los sitemaps de cada sección: `https://ododex.com/es/multas/sitemap.xml` y `https://ododex.com/es/impuestos/sitemap.xml`.
9. **AdSense.** Da de alta `ododex.com`, activa los anuncios automáticos y crea el mensaje de consentimiento de la UE en "Privacidad y mensajes". Después recompila con `ADSENSE_CLIENT` y vuelve a desplegar para que se generen el script y `ads.txt`.

---

## Notas

- **Segmentos de precarga de Next en Windows.** Next 16.4 en Windows exporta los ficheros de precarga como carpetas (`__next.radares/$d$provincia/__PAGE__.txt`) en lugar del nombre con puntos que pide el navegador (`__next.radares.$d$provincia.__PAGE__.txt`). `aplanarSegmentosNext` lo corrige en `dist/`. En Linux no hay nada que corregir y la función no hace nada.
- **Límites del plan gratuito de Pages:** 20 000 ficheros por despliegue y 25 MiB por fichero. El ensamblado falla con un mensaje claro si se superan. Hoy el sitio tiene unos 7 400 ficheros. Cada web nueva suma los suyos.
- **Añadir una sección:** su web debe exportar con `output: "export"` y `basePath` igual a la ruta. Añádela a `config/secciones.json` y escribe a mano su enlace en `raiz/404.html`. La portada, `robots.txt` y `_headers` se generan solos.
