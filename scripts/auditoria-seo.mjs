// Auditoría SEO por muestreo: agrupa las URLs de cada sitemap por tipo de página,
// descarga dos de cada tipo y mide SEO técnico, volumen de texto y parecido entre ellas.
import fs from 'node:fs';

const ORIGIN = 'https://ododex.com';
const SITEMAPS = [
  '/es/multas', '/es/impuestos', '/es/gasolineras', '/es/zbe',
  '/es/puntos-recarga', '/es/llamadas-revision', '/en/recalls',
];
const SAMPLES_PER_TYPE = 2;
const SHINGLE_SIZE = 5;

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 auditoria-seo' } });
  return { status: response.status, body: await response.text() };
}

function pageType(section, url) {
  const rest = url.slice(ORIGIN.length + section.length).replace(/\/$/, '');
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return `${section} (home)`;
  return `${section}/${parts[0]}${parts.length > 1 ? '/' + parts.slice(1).map(() => '*').join('/') : ''}`;
}

function pick(list, count) {
  if (list.length <= count) return list;
  const step = Math.floor(list.length / (count + 1));
  return Array.from({ length: count }, (_, i) => list[step * (i + 1)]);
}

function match(html, regex) {
  const found = html.match(regex);
  return found ? found[1].trim() : null;
}

function visibleText(html) {
  const main = match(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(text) {
  const words = text.toLowerCase().split(' ').filter(Boolean);
  const set = new Set();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) set.add(words.slice(i, i + SHINGLE_SIZE).join(' '));
  return set;
}

function jaccard(a, b) {
  let common = 0;
  for (const item of a) if (b.has(item)) common++;
  const union = a.size + b.size - common;
  return union === 0 ? 0 : common / union;
}

function analyse(url, status, html) {
  const text = visibleText(html);
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)].map((m) => m[1]);
  const internal = links.filter((href) => href.startsWith('/') || href.startsWith(ORIGIN));
  const jsonLdTypes = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((m) => [...m[1].matchAll(/"@type":"([^"]+)"/g)].map((t) => t[1]));
  return {
    url,
    status,
    title: match(html, /<title>([^<]*)<\/title>/i),
    titleLength: (match(html, /<title>([^<]*)<\/title>/i) ?? '').length,
    description: match(html, /<meta name="description" content="([^"]*)"/i),
    canonical: match(html, /<link rel="canonical" href="([^"]*)"/i),
    robots: [...html.matchAll(/<meta name="robots" content="([^"]*)"/gi)].map((m) => m[1]),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()),
    h2Count: (html.match(/<h2[\s>]/gi) ?? []).length,
    words: text.split(' ').filter(Boolean).length,
    internalLinks: internal.length,
    uniqueInternalLinks: new Set(internal).size,
    ogImage: /property="og:image"/.test(html),
    jsonLdTypes: [...new Set(jsonLdTypes)],
    htmlKb: Math.round(html.length / 1024),
    shingles: shingles(text),
  };
}

const report = [];
for (const section of SITEMAPS) {
  const sitemap = await fetchText(`${ORIGIN}${section}/sitemap.xml`);
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const groups = new Map();
  for (const url of urls) {
    const type = pageType(section, url);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(url);
  }
  for (const [type, list] of groups) {
    const pages = [];
    for (const url of pick(list, SAMPLES_PER_TYPE)) {
      const { status, body } = await fetchText(url);
      pages.push(analyse(url, status, body));
    }
    const similarity = pages.length === 2 ? jaccard(pages[0].shingles, pages[1].shingles) : null;
    report.push({
      type,
      count: list.length,
      similarity: similarity === null ? null : Math.round(similarity * 100),
      pages: pages.map(({ shingles: _ignored, ...rest }) => rest),
    });
  }
}

fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
for (const group of report) {
  const p = group.pages[0];
  console.log(
    [group.type, group.count, `parecido ${group.similarity ?? '-'}%`,
      `palabras ${group.pages.map((x) => x.words).join('/')}`,
      `enlaces ${group.pages.map((x) => x.uniqueInternalLinks).join('/')}`,
      `h2 ${p.h2Count}`, `title ${p.titleLength}`, `desc ${p.description ? p.description.length : 'NO'}`,
      `canon ${p.canonical === p.url ? 'ok' : p.canonical}`, `robots ${p.robots.join('|') || '-'}`,
      `h1 ${p.h1.length}`, `og:image ${p.ogImage ? 'sí' : 'no'}`, `ld ${p.jsonLdTypes.join(',') || '-'}`,
      `${p.htmlKb} KB`, `status ${group.pages.map((x) => x.status).join('/')}`].join(' | '),
  );
}
