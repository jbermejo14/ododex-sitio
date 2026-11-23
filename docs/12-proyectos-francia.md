# 12. Proyectos y Expansión en Francia (`/fr/`)

Documentación técnica y operativa completa del despliegue del ecosistema **Ododex Francia** (`https://ododex.com/fr/`), desarrollado en noviembre de 2026.

---

## 🇫🇷 Visión y Arquitectura General en Francia

1. **Dominio & Routing**:
   - Todo se publica bajo `https://ododex.com/fr/<servicio>/` mediante Cloudflare Workers dedicados con enrutamiento de Assets estáticos.
   - El Worker raíz `ododex` sirve la portada francesa `ododex.com/fr/` con los enlaces y tarjetas de todas las herramientas.
2. **Modelo Tecnológico**:
   - 100% estático (`output: 'export'`) en Next.js 16 con App Router.
   - Tiempo de carga sub-50ms en toda Europa gracias a Cloudflare CDN edge caching.
   - Coste de alojamiento: 0 € adicional (dentro del plan gratuito / estándar de Cloudflare).
3. **Monetización Híbrida**:
   - **Google AdSense**: Espacios sin CLS (`min-height: 280px / 250px`) compatibles con TCF v2.2 y modo claro/oscuro.
   - **Afiliación de Alto Ticket**: Comisiones directas por cursos de recuperación de puntos (20 € - 45 €), trámites de carte grise (15 € - 30 €), telepeaje (5 € - 15 €) y citas de ITV.

---

## 📊 Fichas de Proyectos Desplegados en Francia

### 1. prix-carburants-fr — `/fr/prix-carburants`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/prix-carburants](https://ododex.com/fr/prix-carburants) |
| **Repositorio** | `github.com/jbermejo14/fr-gasolineras` (rama `main`) |
| **Worker Cloudflare** | `ododex-prix-carburants` |
| **Datos** | Open Data oficial del Gobierno francés (`prix-carburants.gouv.fr`) con histórico de gasolineras desde 2016. |
| **Monetización** | Tráfico masivo recurrente y Google AdSense. |

---

### 2. zfe-fr — `/fr/zfe`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/zfe](https://ododex.com/fr/zfe) |
| **Repositorio** | `github.com/jbermejo14/fr-zbe` (rama `main`) |
| **Worker Cloudflare** | `ododex-zfe` |
| **Datos** | Base Nationale des ZFE (Ministerio de Transición Ecológica) y normativa oficial de la viñeta Crit'Air 2026 (París, Lyon, Marsella, Toulouse, etc.). |
| **Monetización** | AdSense contextual y guías oficiales de obtención del distintivo ambiental. |

---

### 3. carte-grise-fr — `/fr/carte-grise`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/carte-grise](https://ododex.com/fr/carte-grise) |
| **Repositorio** | `github.com/jbermejo14/carte-grise-fr` (rama `main`) |
| **Worker Cloudflare** | `ododex-carte-grise` |
| **Datos** | Barèmes officiels 2026 du cheval fiscal par région (Y.1), taxe fixe Y.4 (11 €) et acheminement Y.5 (2,76 €), réduction -50% >10 ans. |
| **Monetización** | Afiliación con plataformas de tramitación online de matrícula (15 € a 30 € de comisión por trámite). |

---

### 4. radars-fr — `/fr/radars`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/radars](https://ododex.com/fr/radars) |
| **Repositorio** | `github.com/jbermejo14/radars-fr` (rama `main`) |
| **Worker Cloudflare** | `ododex-radars` |
| **Datos** | 3.350 radares automáticos geolocalizados de la Sécurité Routière y baremo de sanciones del Código de la Ruta 2026 (0 pt <5 km/h). |
| **Monetización** | AdSense automoción + avisadores y dashcams (Coyote, Amazon Associates). |

---

### 5. controle-technique-fr — `/fr/controle-technique`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/controle-technique](https://ododex.com/fr/controle-technique) |
| **Repositorio** | `github.com/jbermejo14/controle-technique-fr` (rama `main`) |
| **Worker Cloudflare** | `ododex-controle-technique` |
| **Datos** | 6.168 centros autorizados por UTAC-OTC y Ministerio de Transportes en los 101 departamentos. Calculador de caducidad (coches y CT2RM motos). |
| **Monetización** | Afiliación de cita previa ITV online (Simplauto, CautoControl). |

---

### 6. peages-fr — `/fr/peages`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/peages](https://ododex.com/fr/peages) |
| **Repositorio** | `github.com/jbermejo14/peages-fr` (rama `main`) |
| **Worker Cloudflare** | `ododex-peages` |
| **Datos** | Tarifas 2026 de las 17 autopistas troncales francesas (APRR, Sanef, ASF, Cofiroute...) para Clases 1, 2 y 5 (motos). Detección de *Péage Flux Libre* en A13 y A79 con aviso legal de pago en 72h. |
| **Monetización** | Afiliación de dispositivos de telepeaje Liber-t (*Ulys Vinci, Bip&Go*) con 5 € a 15 € por alta. |

---

### 7. permis-points-fr — `/fr/permis-points`
| Propiedad | Detalle |
|---|---|
| **URL** | [https://ododex.com/fr/permis-points](https://ododex.com/fr/permis-points) |
| **Repositorio** | `github.com/jbermejo14/permis-points-fr` (rama `main`) |
| **Worker Cloudflare** | `ododex-permis-points` |
| **Datos** | Código de la Ruta 2026: catálogo completo de infracciones, límite legal de 8 puntos por control (Art. L223-2), cálculo de plazos de recuperación automática (6 meses, 2 años, 3 años), alertas Lettre 48N (noveles) y Lettre 48SI (invalidación). Directorio en los 101 departamentos. |
| **Monetización** | **La afiliación más lucrativa de Francia**: Cursos oficiales de recuperación de puntos (*Stages de récupération*), comisiones de **20 € a 45 € netos por reserva**. |

---

## 🛠️ Procedimiento de Despliegue en Cloudflare

Cada servicio dispone de su propio archivo de configuración `wrangler.<servicio>.jsonc` en el repositorio raíz `ododex-sitio`:

```bash
# 1. Compilar la sección en su directorio
cd ../<nombre-proyecto>
npm run build

# 2. Ensamblar en ododex-sitio
cd ../ododex-sitio
rm -rf dist-<nombre> && mkdir -p dist-<nombre>/fr/<nombre>
cp -R ../<nombre-proyecto>/out/* dist-<nombre>/fr/<nombre>/
cp ../<nombre-proyecto>/out/index.html dist-<nombre>/fr/<nombre>.html

# 3. Desplegar el Worker en Cloudflare
npx wrangler deploy --config wrangler.<nombre>.jsonc
```
