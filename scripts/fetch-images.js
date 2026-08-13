'use strict';
/* One-time helper: fetch official Blox Fruits wiki image URLs for the gallery.
   Usage: node scripts/fetch-images.js > scripts/item-images.json */
const fs = require('fs');

const ITEMS = {
  styles: [
    'Superhuman', 'Death Step', 'Sharkman Karate', 'Electric Claw',
    'Dragon Talon', 'Godhuman', 'Sanguine Art',
  ],
  swords: [
    'Bisento', 'Buddy Sword', 'Canvander', 'Dark Dagger', 'Dragonheart',
    'Fox Lamp', 'Koko', 'Midnight Blade', 'Oroshi', 'Pole (1st Form)',
    'Pole (2nd Form)', 'Rengoku', 'Saber', 'Saishi', 'Shark Anchor',
    'Shizu', 'Spikey Trident', 'Tushita', 'Yama', 'Cursed Dual Katana',
    'Hallow Scythe', 'Triple Dark Blade', 'True Triple Katana',
  ],
  guns: [
    'Bazooka', 'Dragonstorm', 'Kabucha', 'Venom Bow', 'Skull Guitar',
  ],
  materials: [
    'Azure Ember', 'Celestial Token', 'Dinosaur Bones', 'Hearts',
    'Leviathan Scale', 'Meteorite', 'Oni Token', 'Summer Token',
    'Terror Eyes', 'Volt Capsule', 'Alucard Fragment', 'Confetti',
    'Dark Fragment', 'Dragon Egg', 'Leviathan Heart', 'Mirror Fractal',
    'Monster Magnet', 'Nightmare Catcher', 'Volcanic Magnet',
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function imageFor(title) {
  const url = 'https://blox-fruits.fandom.com/api.php?action=query&titles=' +
    encodeURIComponent(title) + '&prop=pageimages&piprop=original&format=json&origin=*';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'BloxFarmGallery/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const pages = j.query && j.query.pages || {};
      for (const k in pages) {
        const p = pages[k];
        if (p.original && p.original.source) return p.original.source;
        if (p.thumbnail && p.thumbnail.source) return p.thumbnail.source;
      }
      return null;
    } catch (e) {
      if (attempt === 3) return null;
      await sleep(1000 * attempt);
    }
  }
  return null;
}

(async () => {
  const out = {};
  const all = [];
  for (const cat of Object.keys(ITEMS)) {
    out[cat] = {};
    for (const name of ITEMS[cat]) {
      const img = await imageFor(name);
      out[cat][name] = img;
      all.push([cat, name, img ? 'OK' : 'MISSING']);
      process.stderr.write(all.length + '/54 ' + name + ' -> ' + (img ? 'OK' : 'MISSING') + '\n');
      await sleep(350);
    }
  }
  fs.writeFileSync('scripts/item-images.json', JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
