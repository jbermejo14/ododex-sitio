# Documentación de la red Ododex

Documentación general de la red de webs **Ododex** (`https://ododex.com`): qué hay hecho, cómo está montado, cómo se opera y qué queda por hacer. Está pensada para que una sesión nueva de Claude Code, o cualquier persona, pueda continuar el trabajo sin conocer la historia previa.

Estado a **18 de noviembre de 2026**.

## Cómo leer esta documentación

| Fichero | Para qué sirve |
|---|---|
| [01-vision-y-negocio.md](01-vision-y-negocio.md) | Qué es Ododex, cómo gana dinero, marca y público. |
| [02-arquitectura.md](02-arquitectura.md) | Cómo encaja todo: dominio, DNS, Workers de Cloudflare, rutas, ensamblado y límites. |
| [03-proyectos.md](03-proyectos.md) | Ficha de cada web: ruta, repositorio, rama, Worker, datos, pruebas y particularidades. |
| [04-operaciones.md](04-operaciones.md) | Recetario: compilar, publicar, actualizar datos, añadir una sección, AdSense y resolución de problemas. |
| [05-convenciones.md](05-convenciones.md) | Reglas de código, flujo de trabajo con subagentes, estilo visual, legales, anuncios y seguridad. |
| [06-pendientes-y-mejoras.md](06-pendientes-y-mejoras.md) | Riesgos abiertos, tareas del titular, deuda técnica y mejoras por web. |
| [07-hoja-de-ruta.md](07-hoja-de-ruta.md) | Webs y funciones futuras, en orden de prioridad recomendado. |
| [08-historial-de-decisiones.md](08-historial-de-decisiones.md) | Qué se decidió, cuándo y por qué, incluidas las opciones descartadas. |
| [09-auditoria-seo-2026-11.md](09-auditoria-seo-2026-11.md) | Auditoría SEO por muestreo de producción (18/11/2026): fallos, páginas flojas y mejoras priorizadas. |
| [10-auditoria-seo-red-completa-2026-11.md](10-auditoria-seo-red-completa-2026-11.md) | Auditoría SEO completa de toda la red (21/11/2026): diagnóstico web a web, fallos P0 y plan de acción. |
| [11-estrategia-monetizacion-adsense-y-trafico.md](11-estrategia-monetizacion-adsense-y-trafico.md) | Plan de monetización publicitaria (AdSense), optimización de RPM, captación de tráfico masivo y afiliación. |
| [12-proyectos-francia.md](12-proyectos-francia.md) | Documentación técnica y fichas de los 7 servicios desplegados en Francia (/fr/). |

Si tienes prisa, lee primero la sección **"Riesgos abiertos"** de [06-pendientes-y-mejoras.md](06-pendientes-y-mejoras.md) y después [04-operaciones.md](04-operaciones.md).

## Resumen en diez líneas

1. Ododex es una red de webs de datos de vehículos para España, bajo un único dominio `ododex.com` con rutas `/es/<sección>`; `/uk/...` queda reservado para Reino Unido.
2. Se monetiza con Google AdSense (cliente `ca-pub-2749781881817715`, aprobación de Google pendiente) y, en el futuro, con afiliación.
3. Todo es **estático** (Next.js con `output: 'export'`) y se sirve gratis desde **Cloudflare Workers con recursos estáticos**.
4. El proyecto `ododex-sitio` compila cada web, ensambla la raíz del dominio y despliega en varios Workers.
5. Hay siete secciones publicadas: multas, impuestos, gasolineras, ZBE, puntos de recarga, llamadas a revisión (en español) y recalls (en inglés).
6. Gasolineras se actualiza **a mano cada día** con el acceso directo del escritorio "Actualizar gasolineras".
7. El resto de datos (RIPREE, Safety Gate, ZBE, radares) se refrescan a mano cuando haga falta.
8. Cada web es un repositorio git propio dentro de `C:\Users\Usuario\Desktop\pruebas`; `ododex-sitio` no tiene remoto.
9. **Riesgo principal:** muchos commits no están subidos a GitHub; si se pierde el disco, se pierde el trabajo.
10. El titular no ejecuta comandos: los lanza Claude Code, y el titular solo autoriza en el navegador o en los paneles de Cloudflare y AdSense.

## Documentos relacionados fuera de esta carpeta

- [../ARCHITECTURE.md](../ARCHITECTURE.md): contrato técnico de `ododex-sitio` (ensamblado, Workers, anuncios).
- [../README.md](../README.md): uso de `ododex-sitio` y pasos de la primera publicación en Cloudflare.
- `../../brand/README.md`: guía de marca y logos.
- `../../negocio/afiliados-es.md`: estudio de programas de afiliación en España.
- `../../prompts/README.md`: prompts preparados para crear webs nuevas.
- `ARCHITECTURE.md` y `README.md` de cada proyecto: el detalle técnico de cada web.
