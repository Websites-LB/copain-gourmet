// Copies every photo the site uses from Copain's Dinesty image host into site/img/,
// as WebP with metadata stripped, and points index.html at the local copies.
// Safe to run again: it only downloads what is missing.
//   node tools/fetch-images.mjs
// Run it after tools/build-menu.mjs whenever the menu changes.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', 'site');
const sourcesPath = path.join(here, 'photo-sources.json');
const CDN = 'https://dzrcs9j4kefci.cloudfront.net/';
const MENU_WIDTHS = [128, 400]; // list thumbnail, hover preview
const remote = (src, w) => `${CDN}${w}x0/filters:no_upscale():quality(70):format(webp):strip_exif()/${src}`;
const idOf = (src) => path.basename(src).replace(/\.\w+$/, '');
const local = (src, w) => `img/${w}/${idOf(src)}.webp`;
const exists = (p) => access(p).then(() => true, () => false);

// 1. index.html: swap remote photo URLs for local ones, remembering where each came from
let sources = (await exists(sourcesPath)) ? JSON.parse(await readFile(sourcesPath, 'utf8')) : {};
let html = await readFile(path.join(site, 'index.html'), 'utf8');
const remoteUrl = /https:\/\/dzrcs9j4kefci\.cloudfront\.net\/(\d+)x0\/filters:[^/]+\/([\w-]+\/[\w-]+\.\w+)/g;
html = html
  .split('\n')
  .map((line) => {
    if (line.includes('og:image')) return line; // social previews need an absolute address
    return line.replace(remoteUrl, (_, w, src) => {
      sources[idOf(src)] = src;
      return local(src, w);
    });
  })
  .filter((line) => !line.includes('rel="preconnect" href="https://dzrcs9j4kefci'))
  .join('\n');
await writeFile(path.join(site, 'index.html'), html);
await writeFile(sourcesPath, JSON.stringify(sources, null, 2) + '\n');

// 2. what is needed: photos named in index.html, plus every menu photo at two sizes
const wanted = new Map(); // local path -> remote url
for (const [, w, id] of html.matchAll(/img\/(\d+)\/([\w-]+)\.webp/g)) {
  if (!sources[id]) throw new Error(`No known source for img/${w}/${id}.webp`);
  wanted.set(`img/${w}/${id}.webp`, remote(sources[id], w));
}
const menuJs = await readFile(path.join(site, 'data', 'menu.js'), 'utf8');
const menu = JSON.parse(menuJs.slice(menuJs.indexOf('{'), menuJs.lastIndexOf('}') + 1));
for (const cat of Object.values(menu).flat()) {
  for (const item of cat.items) {
    if (!item.i) continue;
    for (const w of MENU_WIDTHS) wanted.set(local(item.i, w), remote(item.i, w));
  }
}

// 3. download what is missing, a few at a time (the host drops connections under bursts)
async function fetchOne(file, url) {
  const dest = path.join(site, file);
  if (await exists(dest)) return 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('not an image');
      const body = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, body);
      return body.length;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${file}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}

const queue = [...wanted];
let bytes = 0, fetched = 0;
const failed = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = queue.shift()); ) {
    try {
      const n = await fetchOne(...job);
      if (n) { bytes += n; fetched++; }
    } catch (err) { failed.push(err.message); }
  }
}));

console.log(`${wanted.size} photos needed, ${fetched} downloaded (${(bytes / 1024 / 1024).toFixed(1)} MB), ${failed.length} failed`);
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1; }
