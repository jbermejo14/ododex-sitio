/**
 * Enlaces entre secciones de la red de Ododex (ARCHITECTURE.md, sección 10).
 * Son funciones puras: la lectura de ficheros está en scripts/generar-red.mjs.
 */

export const SECCION_GASOLINERAS = "/es/gasolineras";
export const SECCION_RECARGA = "/es/puntos-recarga";
export const SECCION_ITV = "/es/itv";
export const SECCION_MULTAS = "/es/multas";
export const SECCION_ELECTRICO = "/es/electrico-vs-gasolina";
export const SECCION_ZBE = "/es/zbe";

/** Versión del formato de config/red-enlaces.json. */
export const VERSION_RED = 1;

const SEPARADOR_RUTA = "/";
const SEPARADOR_PALABRAS = "-";
const SEPARADOR_CLAVE = " ";
const SEGMENTOS_PROVINCIA = 2;
const SEGMENTOS_MUNICIPIO = 3;
const PREFIJO_PROVINCIA = "provincia";
const PREFIJO_ITV = "centros";
const PREFIJO_MULTAS = "radares";
const PAGINAS_ZBE_QUE_NO_SON_CIUDAD = new Set(["ciudades", "etiqueta-dgt"]);
const PATRON_LOC = /<loc>\s*([^<]*?)\s*<\/loc>/g;
const PALABRAS_CON_APOSTROFO = new Set(["d", "l"]);
const PATRON_TITULO = /<title>([^<]*)<\/title>/;
const PATRON_ENTIDAD = /&#x([0-9a-f]+);|&#(\d+);|&([a-z]+);/gi;
const ENTIDADES_NOMBRADAS = { amp: "&", quot: '"', lt: "<", gt: ">", apos: "'" };
const PATRON_ARTICULO_FINAL = /^(.+?)(?:, | \()(La|Las|El|Los|Les|Els|A|O|L')\)?$/;

/** Patrones del <title> compilado de las páginas de municipio de cada sección. */
export const PATRON_TITULO_GASOLINERAS = /baratas en (.+?) hoy \(/;
export const PATRON_TITULO_RECARGA = /Recarga en (.+?) \(\d+ /;

/** Palabras que no distinguen un lugar: artículos y conectores de los nombres cooficiales. */
const PALABRAS_VACIAS = new Set(["a", "o", "la", "las", "el", "los", "l", "de", "del", "les", "els", "illes", "i", "y"]);
/** Artículos que, al final del slug (« rozas-de-madrid-las »), pasan al principio del nombre. */
const ARTICULOS = new Set(["a", "o", "la", "las", "el", "los", "l", "les", "els"]);
/** Palabras que van en minúscula salvo al principio del nombre. */
const CONECTORES = new Set(["de", "del", "d", "i", "y", "en", "la", "las", "el", "los", "les", "els"]);

/**
 * Falsos positivos conocidos del emparejamiento por contención, como "<provincia gasolineras>/<slugGas>|<slugRecarga>":
 * son municipios distintos aunque uno de los nombres contenga al otro.
 */
export const EMPAREJAMIENTOS_RECHAZADOS = [
  "cuenca/buenache-de-alarcon|alarcon",
  "granada/benalua-de-las-villas|benalua",
  "zamora/toro|morales-de-toro",
  "segovia/fuentesauco-de-fuentiduena|fuentiduena",
  "navarra/noain-valle-de-elorz-noain-elortzibar|valle-de-elorz-elortzibar",
  "valencia-valencia/castello-de-rugat|castello",
];

/** Nombre oficial en castellano de las 52 provincias, por la clave de provincia de gasolineras. */
export const NOMBRES_PROVINCIA = {
  albacete: "Albacete",
  alicante: "Alicante",
  almeria: "Almería",
  "araba-alava": "Álava",
  asturias: "Asturias",
  avila: "Ávila",
  badajoz: "Badajoz",
  "balears-illes": "Islas Baleares",
  barcelona: "Barcelona",
  bizkaia: "Bizkaia",
  burgos: "Burgos",
  caceres: "Cáceres",
  cadiz: "Cádiz",
  cantabria: "Cantabria",
  "castellon-castello": "Castellón",
  ceuta: "Ceuta",
  "ciudad-real": "Ciudad Real",
  cordoba: "Córdoba",
  "coruna-a": "A Coruña",
  cuenca: "Cuenca",
  gipuzkoa: "Gipuzkoa",
  girona: "Girona",
  granada: "Granada",
  guadalajara: "Guadalajara",
  huelva: "Huelva",
  huesca: "Huesca",
  jaen: "Jaén",
  leon: "León",
  lleida: "Lleida",
  lugo: "Lugo",
  madrid: "Madrid",
  malaga: "Málaga",
  melilla: "Melilla",
  murcia: "Murcia",
  navarra: "Navarra",
  ourense: "Ourense",
  palencia: "Palencia",
  "palmas-las": "Las Palmas",
  pontevedra: "Pontevedra",
  "rioja-la": "La Rioja",
  salamanca: "Salamanca",
  "santa-cruz-de-tenerife": "Santa Cruz de Tenerife",
  segovia: "Segovia",
  sevilla: "Sevilla",
  soria: "Soria",
  tarragona: "Tarragona",
  teruel: "Teruel",
  toledo: "Toledo",
  "valencia-valencia": "Valencia",
  valladolid: "Valladolid",
  zamora: "Zamora",
  zaragoza: "Zaragoza",
};

function palabrasDeSlug(slug) {
  return slug.split(SEPARADOR_PALABRAS).filter((palabra) => palabra !== "");
}

/**
 * Clave de un slug: palabras únicas sin artículos ni conectores, ordenadas y unidas por espacio.
 * @param {string} slug
 * @returns {string}
 */
export function claveLugar(slug) {
  const palabras = new Set(palabrasDeSlug(slug).filter((palabra) => !PALABRAS_VACIAS.has(palabra)));
  return [...palabras].sort().join(SEPARADOR_CLAVE);
}

function contiene(palabrasMayor, palabrasMenor) {
  return palabrasMenor.every((palabra) => palabrasMayor.includes(palabra));
}

/**
 * true si las claves son iguales o si las palabras de una están todas en la otra
 * (« alicante » ⊂ « alacant alicante »). Una clave vacía no identifica ningún lugar: nunca es compatible.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function clavesCompatibles(a, b) {
  if (a === "" || b === "") {
    return false;
  }
  const palabrasA = a.split(SEPARADOR_CLAVE);
  const palabrasB = b.split(SEPARADOR_CLAVE);
  return contiene(palabrasA, palabrasB) || contiene(palabrasB, palabrasA);
}

function emparejarIdenticos(slugsA, slugsB) {
  const enB = new Set(slugsB);
  return new Map(slugsA.filter((slug) => enB.has(slug)).map((slug) => [slug, slug]));
}

function agruparPorClave(slugs) {
  const grupos = new Map();
  for (const slug of slugs) {
    const clave = claveLugar(slug);
    grupos.set(clave, [...(grupos.get(clave) ?? []), slug]);
  }
  return grupos;
}

/** Empareja por clave igual solo si hay exactamente un candidato en cada lado: con colisiones no se adivina. */
function emparejarPorClaveIgual(slugsA, slugsB) {
  const gruposA = agruparPorClave(slugsA);
  const gruposB = agruparPorClave(slugsB);
  const pares = new Map();
  for (const [clave, listaA] of gruposA) {
    const listaB = gruposB.get(clave) ?? [];
    if (clave !== "" && listaA.length === 1 && listaB.length === 1) {
      pares.set(listaA[0], listaB[0]);
    }
  }
  return pares;
}

function candidatosCompatibles(slug, lista) {
  const clave = claveLugar(slug);
  return lista.filter((otro) => clavesCompatibles(clave, claveLugar(otro)));
}

function emparejarPorContencion(restoA, restoB) {
  const pares = new Map();
  for (const slugA of restoA) {
    const candidatos = candidatosCompatibles(slugA, restoB);
    if (candidatos.length === 1 && candidatosCompatibles(candidatos[0], restoA).length === 1) {
      pares.set(slugA, candidatos[0]);
    }
  }
  return pares;
}

/** Pares "slugA|slugB" que se descartan aunque el emparejamiento los proponga. */
function separadorPar(slugA, slugB) {
  return `${slugA}|${slugB}`;
}

function sinRechazados(pares, rechazados) {
  return new Map([...pares].filter(([slugA, slugB]) => !rechazados.has(separadorPar(slugA, slugB))));
}

/**
 * Como `emparejar`, pero separa los pares por slug o clave igual de los de contención.
 * @param {string[]} slugsA
 * @param {string[]} slugsB
 * @param {Set<string>} [rechazados] Pares "slugA|slugB" que no deben emparejarse (falsos positivos conocidos).
 * @returns {{ iguales: Map<string, string>, contencion: Map<string, string> }}
 */
export function emparejarDetallado(slugsA, slugsB, rechazados = new Set()) {
  const identicos = emparejarIdenticos(slugsA, slugsB);
  const libresA = slugsA.filter((slug) => !identicos.has(slug));
  const libresB = slugsB.filter((slug) => !identicos.has(slug));
  const porClave = emparejarPorClaveIgual(libresA, libresB);
  const restoA = libresA.filter((slug) => !porClave.has(slug));
  const usadosB = new Set(porClave.values());
  const restoB = libresB.filter((slug) => !usadosB.has(slug));
  return {
    iguales: sinRechazados(new Map([...identicos, ...porClave]), rechazados),
    contencion: sinRechazados(emparejarPorContencion(restoA, restoB), rechazados),
  };
}

/**
 * Empareja dos listas de slugs: primero slugs idénticos; luego clave igual si hay un único candidato
 * en cada lado; lo que quede, por compatibilidad si es única (una sola candidata en cada sentido).
 * @param {string[]} slugsA
 * @param {string[]} slugsB
 * @param {Set<string>} [rechazados] Pares "slugA|slugB" descartados.
 * @returns {Map<string, string>} slugA → slugB
 */
export function emparejar(slugsA, slugsB, rechazados = new Set()) {
  const { iguales, contencion } = emparejarDetallado(slugsA, slugsB, rechazados);
  return new Map([...iguales, ...contencion]);
}

function ponerMayuscula(palabra) {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

function esApostrofada(palabra, siguiente) {
  return PALABRAS_CON_APOSTROFO.has(palabra) && siguiente !== undefined;
}

/** Mayúscula inicial por palabra; "d"/"l" + palabra se unen con apóstrofo ("d'Alacant"). */
function formatearPalabras(palabras) {
  const resultado = [];
  for (let indice = 0; indice < palabras.length; indice += 1) {
    const palabra = palabras[indice];
    if (esApostrofada(palabra, palabras[indice + 1])) {
      resultado.push(`${palabra}'${ponerMayuscula(palabras[indice + 1])}`);
      indice += 1;
    } else {
      resultado.push(resultado.length > 0 && CONECTORES.has(palabra) ? palabra : ponerMayuscula(palabra));
    }
  }
  return resultado.join(" ");
}

function nombreDeMunicipio(slug) {
  const palabras = palabrasDeSlug(slug);
  const ultima = palabras[palabras.length - 1];
  if (palabras.length < 2 || !ARTICULOS.has(ultima)) {
    return formatearPalabras(palabras);
  }
  const resto = formatearPalabras(palabras.slice(0, -1));
  return PALABRAS_CON_APOSTROFO.has(ultima) ? `${ultima}'${resto}` : `${ponerMayuscula(ultima)} ${resto}`;
}

/** Mueve el artículo final de un nombre compilado al principio: "Rozas, Las" y "Rozas (Las)" → "Las Rozas". */
function normalizarNombreCompilado(nombre) {
  const coincidencia = PATRON_ARTICULO_FINAL.exec(nombre);
  if (!coincidencia) {
    return nombre;
  }
  const separador = coincidencia[2].endsWith("'") ? "" : " ";
  return `${coincidencia[2]}${separador}${coincidencia[1]}`;
}

/**
 * Nombre legible de un lugar. Provincias: tabla NOMBRES_PROVINCIA (clave de gasolineras).
 * Municipios: el nombre leído de la página compilada si se facilita (con el artículo al principio);
 * si no, el deducido del slug (mayúscula inicial por palabra, artículo final al principio).
 * @param {string} slug
 * @param {"provincia"|"municipio"} tipo
 * @param {string} [nombreCompilado] Nombre del municipio tal como lo escribe su web.
 * @returns {string}
 */
export function nombreLugar(slug, tipo, nombreCompilado) {
  if (tipo === "provincia") {
    if (!Object.hasOwn(NOMBRES_PROVINCIA, slug)) {
      throw new Error(`La provincia "${slug}" no está en NOMBRES_PROVINCIA (lib/red.mjs): añádela con su nombre oficial.`);
    }
    return NOMBRES_PROVINCIA[slug];
  }
  if (tipo === "municipio") {
    return nombreCompilado ? normalizarNombreCompilado(nombreCompilado) : nombreDeMunicipio(slug);
  }
  throw new Error(`Tipo de lugar desconocido "${tipo}": use "provincia" o "municipio".`);
}

function decodificarEntidades(texto) {
  return texto.replace(PATRON_ENTIDAD, (entidad, hexadecimal, decimal, nombre) => {
    if (hexadecimal !== undefined) {
      return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
    }
    if (decimal !== undefined) {
      return String.fromCodePoint(Number.parseInt(decimal, 10));
    }
    return ENTIDADES_NOMBRADAS[nombre] ?? entidad;
  });
}

/**
 * Nombre del municipio que figura en el <title> de su página compilada, o undefined si no se reconoce.
 * @param {string} html Primeros bytes del HTML (el <title> está al principio).
 * @param {RegExp} patron Patrón con un grupo de captura sobre el título (PATRON_TITULO_*).
 * @returns {string|undefined}
 */
export function nombreDeTitulo(html, patron) {
  const titulo = PATRON_TITULO.exec(html);
  const coincidencia = titulo ? patron.exec(decodificarEntidades(titulo[1])) : null;
  return coincidencia ? coincidencia[1].trim() : undefined;
}

/**
 * Rutas (sin dominio ni barra final) de las páginas de un sitemap.
 * @param {string} xml
 * @returns {string[]}
 */
export function extraerRutasSitemap(xml) {
  return [...xml.matchAll(PATRON_LOC)].map((coincidencia) => {
    let ruta;
    try {
      ruta = new URL(coincidencia[1]).pathname;
    } catch (error) {
      throw new Error(`Sitemap con un <loc> que no es una URL válida: "${coincidencia[1]}" (${error.message}).`);
    }
    return ruta.length > 1 && ruta.endsWith(SEPARADOR_RUTA) ? ruta.slice(0, -1) : ruta;
  });
}

/** Segmentos de la ruta que cuelgan de la sección ("/es/itv/centros/madrid" → ["centros", "madrid"]). */
function segmentosRelativos(ruta, seccion) {
  if (!ruta.startsWith(`${seccion}${SEPARADOR_RUTA}`)) {
    return [];
  }
  return ruta.slice(seccion.length + 1).split(SEPARADOR_RUTA);
}

/** Slugs de provincia: páginas `<seccion>/<prefijo>/<slug>`, o `<seccion>/<slug>` si prefijo es "". */
function slugsDeProvincias(rutas, seccion, prefijo) {
  const profundidad = prefijo === "" ? 1 : SEGMENTOS_PROVINCIA;
  return rutas
    .map((ruta) => segmentosRelativos(ruta, seccion))
    .filter((segmentos) => segmentos.length === profundidad && (prefijo === "" || segmentos[0] === prefijo))
    .map((segmentos) => segmentos[profundidad - 1]);
}

/** Municipios agrupados por provincia: Map provincia → [municipio]. */
function municipiosPorProvincia(rutas, seccion) {
  const mapa = new Map();
  for (const ruta of rutas) {
    const segmentos = segmentosRelativos(ruta, seccion);
    if (segmentos.length === SEGMENTOS_MUNICIPIO && segmentos[0] === PREFIJO_PROVINCIA) {
      const [, provincia, municipio] = segmentos;
      mapa.set(provincia, [...(mapa.get(provincia) ?? []), municipio]);
    }
  }
  return mapa;
}

function ciudadesZbe(rutas) {
  return new Set(
    rutas
      .map((ruta) => segmentosRelativos(ruta, SECCION_ZBE))
      .filter((segmentos) => segmentos.length === 1 && !PAGINAS_ZBE_QUE_NO_SON_CIUDAD.has(segmentos[0]))
      .map((segmentos) => segmentos[0]),
  );
}

/** Ruta de una página: sección, prefijo opcional ("" si no hay) y slug. */
function rutaDe(seccion, prefijo, slug) {
  return [seccion, prefijo, slug].filter((parte) => parte !== "").join(SEPARADOR_RUTA);
}

/** Clave de un municipio dentro de su sección: "<provincia>/<municipio>". */
function claveMunicipio(provincia, municipio) {
  return `${provincia}${SEPARADOR_RUTA}${municipio}`;
}

/** Descripción de cada tipo de página de provincia: sección, texto y construcción de su ruta. */
const DESTINOS_PROVINCIA = {
  gasolineras: { seccion: SECCION_GASOLINERAS, texto: (lugar) => `Gasolineras en ${lugar}`, ruta: (slug) => rutaDe(SECCION_GASOLINERAS, PREFIJO_PROVINCIA, slug) },
  recarga: { seccion: SECCION_RECARGA, texto: (lugar) => `Puntos de recarga en ${lugar}`, ruta: (slug) => rutaDe(SECCION_RECARGA, PREFIJO_PROVINCIA, slug) },
  electrico: { seccion: SECCION_ELECTRICO, texto: (lugar) => `Coche eléctrico o gasolina en ${lugar}`, ruta: (slug) => rutaDe(SECCION_ELECTRICO, "", slug) },
  itv: { seccion: SECCION_ITV, texto: (lugar) => `Centros ITV en ${lugar}`, ruta: (slug) => rutaDe(SECCION_ITV, PREFIJO_ITV, slug) },
  multas: { seccion: SECCION_MULTAS, texto: (lugar) => `Radares DGT en ${lugar}`, ruta: (slug) => rutaDe(SECCION_MULTAS, PREFIJO_MULTAS, slug) },
};

/** Orden fijo de enlaces de cada página de provincia (10.4), por tipo de página de origen. */
const ORDEN_PROVINCIA = {
  gasolineras: ["recarga", "electrico", "itv", "multas"],
  recarga: ["gasolineras", "electrico", "itv", "multas"],
  itv: ["gasolineras", "recarga", "multas"],
  multas: ["gasolineras", "itv", "recarga"],
  electrico: ["recarga", "gasolineras", "itv"],
};

function emparejarProvincias(rutas) {
  const slugsGas = slugsDeProvincias(rutas[SECCION_GASOLINERAS], SECCION_GASOLINERAS, PREFIJO_PROVINCIA);
  const otras = {
    recarga: slugsDeProvincias(rutas[SECCION_RECARGA], SECCION_RECARGA, PREFIJO_PROVINCIA),
    itv: slugsDeProvincias(rutas[SECCION_ITV], SECCION_ITV, PREFIJO_ITV),
    multas: slugsDeProvincias(rutas[SECCION_MULTAS], SECCION_MULTAS, PREFIJO_MULTAS),
    electrico: slugsDeProvincias(rutas[SECCION_ELECTRICO], SECCION_ELECTRICO, ""),
  };
  const parejas = Object.fromEntries(Object.entries(otras).map(([tipo, slugs]) => [tipo, emparejar(slugsGas, slugs)]));
  return { slugsGas, otras, parejas };
}

/** Slug de cada sección para una provincia de gasolineras: { gasolineras, recarga, ... } (solo las emparejadas). */
function slugsDeProvincia(gas, parejas) {
  const slugs = { gasolineras: gas };
  for (const [tipo, mapa] of Object.entries(parejas)) {
    if (mapa.has(gas)) {
      slugs[tipo] = mapa.get(gas);
    }
  }
  return slugs;
}

/** Destinos de una provincia: tipo → enlace, solo si la página existe en su sitemap. */
function destinosDeProvincia(gas, parejas, existentes) {
  const lugar = nombreLugar(gas, "provincia");
  const destinos = {};
  for (const [tipo, slug] of Object.entries(slugsDeProvincia(gas, parejas))) {
    const descripcion = DESTINOS_PROVINCIA[tipo];
    const href = descripcion.ruta(slug);
    if (existentes.has(href)) {
      destinos[tipo] = { seccion: descripcion.seccion, texto: descripcion.texto(lugar), href };
    }
  }
  return destinos;
}

function agregarEnlaces(enlaces, clave, lista) {
  if (lista.length > 0) {
    enlaces[clave] = lista;
  }
}

function generarEnlacesProvincias(contexto, enlaces) {
  const { slugsGas, parejas, existentes } = contexto;
  for (const gas of slugsGas) {
    const destinos = destinosDeProvincia(gas, parejas, existentes);
    for (const [origen, orden] of Object.entries(ORDEN_PROVINCIA)) {
      if (destinos[origen]) {
        agregarEnlaces(enlaces, destinos[origen].href, orden.filter((tipo) => destinos[tipo]).map((tipo) => destinos[tipo]));
      }
    }
  }
}

/** Ciudad ZBE de cada municipio: Map "<prov>/<muni>" → ciudad, según el campo (fuel o charging). */
function ciudadPorMunicipio(enlacesZbe, campo) {
  const mapa = new Map();
  for (const [ciudad, datos] of Object.entries(enlacesZbe)) {
    if (datos[campo] && !mapa.has(datos[campo])) {
      mapa.set(datos[campo], ciudad);
    }
  }
  return mapa;
}

/** Nombre compilado de un municipio de cada sección, o undefined si no se leyó. */
function nombreMunicipio(contexto, seccion, provincia, municipio) {
  return contexto.nombres[rutaDe(seccion, PREFIJO_PROVINCIA, claveMunicipio(provincia, municipio))];
}

/** Nombre de una ciudad ZBE: el de su municipio en gasolineras o en recarga, o el deducido del slug. */
function nombreCiudadZbe(ciudad, contexto) {
  const { fuel, charging } = contexto.enlacesZbe[ciudad];
  const compilado = [
    fuel && contexto.nombres[rutaDe(SECCION_GASOLINERAS, PREFIJO_PROVINCIA, fuel)],
    charging && contexto.nombres[rutaDe(SECCION_RECARGA, PREFIJO_PROVINCIA, charging)],
  ].find(Boolean);
  return nombreLugar(ciudad, "municipio", compilado);
}

function enlaceZbe(ciudad, contexto) {
  if (ciudad === undefined || !contexto.ciudadesZbe.has(ciudad)) {
    return [];
  }
  contexto.ciudadesEnlazadas.add(ciudad);
  return [{ seccion: SECCION_ZBE, texto: `Zona de bajas emisiones de ${nombreCiudadZbe(ciudad, contexto)}`, href: rutaDe(SECCION_ZBE, "", ciudad) }];
}

function enlacesDeMunicipio(datos, contexto, enlaces) {
  const { provGas, provRec, munGas, munRec, itv } = datos;
  const claveGas = rutaDe(SECCION_GASOLINERAS, PREFIJO_PROVINCIA, claveMunicipio(provGas, munGas));
  const zbeGas = enlaceZbe(contexto.zbeGas.get(claveMunicipio(provGas, munGas)), contexto);
  const listaItv = itv ? [itv] : [];
  if (munRec === undefined) {
    agregarEnlaces(enlaces, claveGas, [...zbeGas, ...listaItv]);
    return;
  }
  const claveRec = rutaDe(SECCION_RECARGA, PREFIJO_PROVINCIA, claveMunicipio(provRec, munRec));
  const zbeRec = enlaceZbe(contexto.zbeRecarga.get(claveMunicipio(provRec, munRec)), contexto);
  // El texto de cada enlace lleva el nombre del destino, tal como lo escribe su propia web.
  const nombreEnRecarga = nombreLugar(munRec, "municipio", nombreMunicipio(contexto, SECCION_RECARGA, provRec, munRec));
  const nombreEnGasolineras = nombreLugar(munGas, "municipio", nombreMunicipio(contexto, SECCION_GASOLINERAS, provGas, munGas));
  const enlaceRecarga = { seccion: SECCION_RECARGA, texto: `Puntos de recarga en ${nombreEnRecarga}`, href: claveRec };
  const enlaceGasolineras = { seccion: SECCION_GASOLINERAS, texto: `Gasolineras en ${nombreEnGasolineras}`, href: claveGas };
  agregarEnlaces(enlaces, claveGas, [enlaceRecarga, ...zbeGas, ...listaItv]);
  agregarEnlaces(enlaces, claveRec, [enlaceGasolineras, ...zbeRec, ...listaItv]);
}

/** Pares "slugGas|slugRec" de la provincia que figuran en EMPAREJAMIENTOS_RECHAZADOS. */
function rechazadosDeProvincia(provGas) {
  const prefijo = `${provGas}${SEPARADOR_RUTA}`;
  return new Set(EMPAREJAMIENTOS_RECHAZADOS.filter((par) => par.startsWith(prefijo)).map((par) => par.slice(prefijo.length)));
}

function generarEnlacesMunicipios(contexto, enlaces, informe) {
  const { slugsGas, parejas, rutas, existentes } = contexto;
  const munGas = municipiosPorProvincia(rutas[SECCION_GASOLINERAS], SECCION_GASOLINERAS);
  const munRec = municipiosPorProvincia(rutas[SECCION_RECARGA], SECCION_RECARGA);
  for (const provGas of slugsGas) {
    const provRec = parejas.recarga.get(provGas);
    const delaProvincia = munGas.get(provGas) ?? [];
    const { iguales, contencion } = emparejarDetallado(delaProvincia, munRec.get(provRec) ?? [], rechazadosDeProvincia(provGas));
    informe.municipiosIguales += iguales.size;
    informe.municipiosContencion += contencion.size;
    informe.municipiosGasolineras += delaProvincia.length;
    const itv = destinosDeProvincia(provGas, parejas, existentes).itv;
    for (const municipio of delaProvincia) {
      const pareja = iguales.get(municipio) ?? contencion.get(municipio);
      enlacesDeMunicipio({ provGas, provRec, munGas: municipio, munRec: pareja, itv }, contexto, enlaces);
    }
  }
}
function informeInicial(slugsGas, otras, parejas) {
  const usados = (tipo) => new Set(parejas[tipo].values());
  return {
    provinciasGasolineras: slugsGas.length,
    provinciasEmparejadas: Object.fromEntries(Object.entries(parejas).map(([tipo, mapa]) => [tipo, mapa.size])),
    provinciasSinPareja: Object.fromEntries(
      Object.entries(otras).map(([tipo, slugs]) => [tipo, slugs.filter((slug) => !usados(tipo).has(slug))]),
    ),
    municipiosGasolineras: 0,
    municipiosIguales: 0,
    municipiosContencion: 0,
    ciudadesZbeEnlazadas: 0,
  };
}

/**
 * Genera el mapa de enlaces entre secciones a partir de las rutas de cada sitemap.
 * @param {object} entrada
 * @param {Record<string, string[]>} entrada.rutas Por ruta de sección (SECCION_*), las rutas
 *   completas de su sitemap, sin barra final. Deben estar las seis secciones (puede ir vacía).
 * @param {Record<string, {fuel: string|null, charging: string|null}>} [entrada.enlacesZbe]
 *   Ciudad ZBE → municipio de gasolineras y de recarga ("<provincia>/<municipio>").
 * @param {Record<string, string>} [entrada.nombres] Ruta de página de municipio → nombre leído de su <title>.
 * @returns {{ enlaces: Record<string, object[]>, informe: object }}
 */
export function generarEnlaces({ rutas, enlacesZbe = {}, nombres = {} }) {
  const { slugsGas, otras, parejas } = emparejarProvincias(rutas);
  const informe = informeInicial(slugsGas, otras, parejas);
  const contexto = {
    slugsGas,
    parejas,
    rutas,
    existentes: new Set(Object.values(rutas).flat()),
    ciudadesZbe: ciudadesZbe(rutas[SECCION_ZBE]),
    zbeGas: ciudadPorMunicipio(enlacesZbe, "fuel"),
    zbeRecarga: ciudadPorMunicipio(enlacesZbe, "charging"),
    ciudadesEnlazadas: new Set(),
    enlacesZbe,
    nombres,
  };
  const enlaces = {};
  generarEnlacesProvincias(contexto, enlaces);
  generarEnlacesMunicipios(contexto, enlaces, informe);
  informe.ciudadesZbeEnlazadas = contexto.ciudadesEnlazadas.size;
  return { enlaces, informe };
}
