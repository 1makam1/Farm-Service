'use strict';
/* Download all gallery item images to public/img/items/ so the site does not
   depend on the wiki/CDN being reachable. Skips files that already exist.
   Usage: node scripts/download-images.js */
const fs = require('fs');
const path = require('path');

const INDEX = 'scripts/item-images.json';
const OUT_DIR = path.join('public', 'img', 'items');

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

if (!fs.existsSync(INDEX)) {
  console.error('Missing ' + INDEX + ' — run scripts/fetch-images.js first.');
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const data = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 BloxFarmGallery/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
}

(async () => {
  let ok = 0, skipped = 0, failed = 0;
  const jobs = [];
  for (const cat of Object.keys(data)) {
    for (const [name, url] of Object.entries(data[cat])) {
      if (!url) { console.error('MISSING URL:', cat, name); failed++; continue; }
      jobs.push([cat, name, url]);
    }
  }
  for (const [cat, name, url] of jobs) {
    const file = path.join(OUT_DIR, slug(name) + '.png');
    if (fs.existsSync(file)) { skipped++; continue; }
    try {
      await download(url, file);
      ok++;
    } catch (e) {
      failed++;
      console.error('FAILED:', name, '->', e.message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`Done: ${ok} downloaded, ${skipped} already existed, ${failed} failed.`);
})().catch((e) => { console.error(e); process.exit(1); });
