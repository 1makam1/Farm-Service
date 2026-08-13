'use strict';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en-US');

const CATS = [
  { id: 'styles', label: 'Fighting Styles' },
  { id: 'swords', label: 'Swords' },
  { id: 'guns', label: 'Guns' },
  { id: 'materials', label: 'Materials' },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.id, c.label]));
const RANK = { Mythical: 2, Legendary: 1 };

let items = [];
let activeCat = 'all';
let query = '';
let sortMode = '';

function applySort(list) {
  const arr = [...list];
  if (sortMode === 'price_asc') arr.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  else if (sortMode === 'price_desc') arr.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  else if (sortMode === 'rarity')
    arr.sort((a, b) => (RANK[b.rarity] - RANK[a.rarity]) || (b.price - a.price) || a.name.localeCompare(b.name));
  return arr; // natural order (by category)
}

function render() {
  const q = query.toLowerCase().trim();
  const list = applySort(items.filter((it) => {
    if (activeCat !== 'all' && it.category !== activeCat) return false;
    if (q && !(it.name.toLowerCase().includes(q) || (CAT_LABEL[it.category] || '').toLowerCase().includes(q))) return false;
    return true;
  }));

  const g = document.getElementById('gallery');
  g.innerHTML = list.map((it) => `
    <div class="g-item" onclick="this.classList.toggle('open')" title="Click for details">
      <div class="g-head">
        <span class="badge g-rare ${it.rarity === 'Mythical' ? 'cancelled' : 'done'}">${esc(it.rarity)}</span>
      </div>
      <div class="g-img-wrap">
        <img class="g-img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
      </div>
      <div class="g-body">
        <div class="g-name">${esc(it.name)}</div>
        <div class="g-price">${fmt(it.price)} THB</div>
        <div class="g-cost">${esc(it.cost || '')}</div>
        ${it.note ? `<div class="g-note">${esc(it.note)}</div>` : ''}
      </div>
    </div>`).join('');

  document.getElementById('galEmpty').classList.toggle('hidden', list.length > 0);
}

async function loadItems() {
  try {
    const r = await fetch('/api/items');
    if (!r.ok) throw new Error('API unavailable');
    const j = await r.json();
    items = j.items || [];
  } catch (e) {
    // Offline / static hosting fallback: use the bundled item list.
    items = (typeof GALLERY_ITEMS !== 'undefined' ? GALLERY_ITEMS : []).map((it) => ({
      id: it.id || it.name, name: it.name, category: it.cat, rarity: it.rarity,
      price: it.price, image: it.img, cost: it.cost || '', note: it.note || '',
    }));
  }
  render();
}

document.getElementById('catPills').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#catPills button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  render();
});

document.getElementById('galSearch').addEventListener('input', (e) => {
  query = e.target.value;
  render();
});

document.getElementById('sortSel').addEventListener('change', (e) => {
  sortMode = e.target.value;
  render();
});

loadItems();
