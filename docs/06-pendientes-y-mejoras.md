# 6. Pendientes y mejoras

## Riesgos abiertos (prioridad alta)

### 1. Trabajo sin copia en GitHub (resuelto el 18/11/2026)

**Resuelto:** el 18/11/2026 se subieron todas las ramas, y `ododex-sitio` tiene ahora remoto en `github.com/jbermejo14/ododex-sitio` (público). Queda pendiente fusionar las ramas en `main`. Al terminar cada tarea hay que hacer `git push`. Situación antes de subirlo:

| Proyecto | Rama | Commits sin subir |
|---|---|---|
| ododex-sitio | master | **todo** (no tiene remoto) |
| gasolineras | feature/seo-programatico-nextjs | 32 (la rama no existe en GitHub) |
| zbe-map | refactor/zbe-reglas-oficiales-seo | 15 |
| multas-dgt | fix/seo-legal-audit | 9 |
| recalls-web | feature/nextjs-migration | 6 |
| charger-map | feature/nextjs-migration | 6 |
| calculadora-impuestos | feature/nextjs-migration | 3 |

Si el disco falla, se pierde casi todo el trabajo publicado. **Acción:**
1. Ejecutar `git push -u origin <rama>` en cada proyecto.
2. Crear un repositorio privado para `ododex-sitio` y subirlo.
3. Después, fusionar cada rama publicada en `main` para que `main` sea lo que está en producción.

### 2. Dependencia del PC del titular

- Todo se compila en esta máquina, con apaños para Windows (WASM de Tailwind, webpack, aplanado de segmentos).
- Si se cambia de PC, hay que reinstalar Node, clonar y ejecutar `npm install` en cada proyecto, copiar los `config/titular.json` y ejecutar `npx wrangler login`.
- **Mejora:** compilar en GitHub Actions (Linux, sin los apaños) y desplegar con un token de Cloudflare guardado como secreto. Además automatizaría gasolineras gratis con un cron diario. Ver [07-hoja-de-ruta.md](07-hoja-de-ruta.md).

### 3. Gasolineras depende de un clic diario

- Si un día no se actualiza, los precios quedan con un día de retraso. La web muestra la fecha de los datos, pero conviene no fallar muchos días seguidos.
- La solución de fondo es la automatización con GitHub Actions del punto anterior.

## Tareas del titular (no las puede hacer Claude)

- [ ] **Cloudflare → SSL/TLS → Edge Certificates:** activar "Always Use HTTPS".
- [ ] **Cloudflare → DNS:**
  - crear un registro `AAAA`, nombre `www`, contenido `100::`, con proxy;
  - crear la regla "Redirect from WWW to root" (Rules → plantillas).
- [ ] **AdSense:**
  - esperar la aprobación del sitio;
  - desactivar el anuncio ancla en móvil (Anuncios → Por sitio);
  - opcional: laterales solo en escritorio;
  - configurar el mensaje de consentimiento del EEE (Privacidad y mensajes).
- [ ] **Google Search Console:**
  - dar de alta `ododex.com` (verificación por DNS en Cloudflare);
  - enviar los sitemaps de cada sección. Están enumerados en `https://ododex.com/robots.txt`.
- [ ] **Afiliación:**
  - darse de alta en Awin (compramostucoche, Línea Directa) y en carVertical;
  - pasar los códigos.
- [ ] **Limpieza:** borrar los ficheros sueltos de un subagente en `multas-dgt`: `.claude/launch.json`, `_t.mjs` y `_t2.mjs`.
- [ ] **Diario:** pulsar "Actualizar gasolineras".
- [ ] **Enero:** revisar si hay nuevas tablas de impuestos en el BOE.

## Deuda técnica transversal

- **Componentes copiados entre proyectos** (Header, Footer, AdSlot, legal.ts...): un cambio de marca o de legales obliga a tocar seis repos. Más adelante se podría crear un paquete común (por ejemplo, un workspace npm o un submódulo). No se hizo porque las webs venían de proyectos distintos y la duplicación aún es manejable: hoy son seis copias, así que la abstracción ya empieza a estar justificada.
- **Fechas de los textos legales:** `FECHA_TEXTOS_LEGALES` está en cada web; conviene unificarlas al revisar los legales.
- **Ramas:** las ramas publicadas no son `main`. Hay que fusionarlas y dejar `main` = producción.
- **Restos de código antiguo:**
  - Prisma en zbe-map (solo scripts antiguos);
  - la rama `seo-legal-radares` en multas-dgt;
  - posible `@tailwindcss/turbopack` sin usar.
- **`tsconfig.tsbuildinfo`** sin ignorar en gasolineras: añadirlo a `.gitignore`.
- **Tiempo de compilación total** de unos 30-60 min: se podría paralelizar en `construir.mjs`, vigilando la memoria.
- **Tamaño de gasolineras** (~1 GB por despliegue): vigilar el límite de ficheros si crece el número de estaciones (16 300 de 20 000).
- **Datos de ZBE a mano:** 152 ciudades. Revisarlas cada 120 días es trabajo; se podría hacer una lista de fuentes por ciudad y un recordatorio.

## Mejoras por web

### Toda la red
- Imágenes Open Graph (`og:image`) por sección y, si es posible, por página (generadas en la compilación).
- Analítica respetuosa con la privacidad: Cloudflare Web Analytics, que es gratis y sin cookies.
- Auditoría Lighthouse (rendimiento, accesibilidad, SEO) de una página de cada tipo.
- Enlaces cruzados entre secciones. Por ejemplo:
  - de la ficha de una ciudad ZBE a sus gasolineras y puntos de recarga;
  - de la calculadora de ITP a llamadas a revisión del modelo.
- Portada con buscador o accesos más visuales.
- Páginas "Sobre Ododex" y "Contacto" (refuerzan la confianza para AdSense).

### Multas
- Más infracciones además de la velocidad (alcohol, móvil, ITV...).
- Revisar si las fichas de radar merecen contenido suficiente para indexarlas.

### Impuestos
- Bloque de carVertical junto al cálculo del ITP, cuando haya código.
- Impuesto de circulación (IVTM) por municipio: ver el prompt `15-es-ivtm.md`.

### Gasolineras
- Automatizar la actualización diaria.
- Gráficas de evolución de precios por provincia.

### ZBE
- Más ciudades, a medida que aprueben ordenanzas.
- Activar los bloques de afiliado (compramostucoche, seguros) cuando haya códigos.

### Puntos de recarga
- `fitBounds` del mapa al elegir una provincia en el explorador de la portada.
- Filtro por tipo de conector y potencia en las páginas de provincia.

### Llamadas a revisión
- Automatizar la descarga del XML de Safety Gate si existe un enlace estable.
- Bloque de carVertical ("comprueba si tu coche tiene revisiones pendientes").
