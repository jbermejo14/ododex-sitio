// Genera el sitemap.xml maestro (Sitemap Index) que reúne los sitemaps de todas las secciones.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerProduccion, leerSecciones, DIR_SALIDA } from '../lib/ensamblado.mjs';

const DIR_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function generarSitemapIndexXml(origen, secciones) {
  const hoy = new Date().toISOString().split('T')[0];
  const sitemaps = secciones
    .filter((s) => s.publicada !== false)
    .map((s) => `  <sitemap>\n    <loc>${origen}${s.ruta}/sitemap.xml</loc>\n    <lastmod>${hoy}</lastmod>\n  </sitemap>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>\n`;
}

export function escribirSitemapIndex(dirDist, origen, secciones) {
  const contenido = generarSitemapIndexXml(origen, secciones);
  const fichero = path.join(dirDist, 'sitemap.xml');
  fs.writeFileSync(fichero, contenido, 'utf8');
  return fichero;
}

// Ejecución directa si se llama por línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { origen } = leerProduccion(path.join(DIR_BASE, 'config', 'produccion.json'));
  const secciones = leerSecciones(path.join(DIR_BASE, 'config', 'secciones.json'));
  const dist = path.join(DIR_BASE, DIR_SALIDA);
  
  if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist, { recursive: true });
  }
  
  const fichero = escribirSitemapIndex(dist, origen, secciones);
  console.log(`Sitemap Index maestro generado en: ${fichero}`);
}
