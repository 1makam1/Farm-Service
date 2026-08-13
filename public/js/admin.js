'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSTATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const PSTATUSES = ['pending', 'in_progress', 'done'];
const CURRENCIES = ['THB', 'USD', 'EUR', 'GBP', 'PHP', 'INR', 'IDR', 'BRL', 'MXN'];
const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', completed: 'Completed', cancelled: 'Cancelled' };

let customers = [];
let draft = null;          // full customer object being edited (mutated by inputs)
let filter = '';
let listTimer = null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function toast(msg, err) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = 'toast'), 2600);
}

async function api(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

// ---------------------------------------------------------------- auth flow
async function checkAuth() {
  const { admin } = await api('/api/admin/me');
  if (admin) showDash();
  else showLogin();
}

function showLogin() {
  $('loginView').classList.remove('hidden');
  $('dashView').classList.add('hidden');
}
function showDash() {
  $('loginView').classList.add('hidden');
  $('dashView').classList.remove('hidden');
  refreshList();
}

// ---------------------------------------------------------------- list
async function refreshList() {
  try {
    const { customers: list } = await api('/api/admin/customers');
    customers = list;
    renderList();
  } catch (e) {
    if (e.message === 'Not authorized') showLogin();
    else toast(e.message, true);
  }
}

function renderList() {
  const f = filter.toLowerCase();
  const rows = customers
    .filter((c) => !f || c.robloxUsername.toLowerCase().includes(f))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  $('countLabel').textContent = `${customers.length} total · ${rows.length} shown`;
  $('customerList').innerHTML = rows.length
    ? rows.map((c) => `
      <button class="result-item ${draft && draft.id === c.id ? 'active' : ''}" onclick="selectCustomer('${esc(c.id)}')">
        <div>
          <div class="ri-name">${esc(c.robloxUsername)}</div>
          <div class="ri-svc">${esc(c.service)}</div>
        </div>
        <div class="ri-right">
          <span class="badge ${esc(c.status)}">${STATUS_LABEL[c.status] || esc(c.status)}</span>
          <span class="ri-time">${c.doneCount}/${c.progressCount} steps · ${fmtDate(c.updatedAt)}</span>
        </div>
      </button>`).join('')
    : '<div class="empty">No orders yet. Click “+ New Order” to add one.</div>';
}

// ---------------------------------------------------------------- editor
window.newCustomer = function () {
  draft = { robloxUsername: '', service: '', price: '', currency: 'THB', status: 'pending', notes: '', progress: [] };
  renderEditor();
};

window.selectCustomer = async function (id) {
  try {
    const { customer } = await api('/api/customers/' + encodeURIComponent(id));
    draft = customer;
    renderEditor();
    renderList(); // highlight selection
  } catch (e) {
    toast(e.message, true);
  }
};

function renderEditor() {
  if (!draft) {
    $('editorTitle').textContent = 'Select an order to edit';
    $('editorBody').innerHTML = '<div class="empty">Pick an order from the list, or create a new one.</div>';
    $('deleteBtn').classList.add('hidden');
    return;
  }
  $('editorTitle').textContent = draft.id ? `Editing ${draft.robloxUsername || 'order'}` : 'New order';
  $('deleteBtn').classList.toggle('hidden', !draft.id);
  $('editorBody').innerHTML = `
    <div class="form-row">
      <div><label>Roblox username *</label><input type="text" id="edName" value="${esc(draft.robloxUsername)}" placeholder="e.g. Bloxxer123"></div>
      <div><label>Service *</label><input type="text" id="edService" value="${esc(draft.service)}" placeholder="e.g. Max Level 1 → 2600"></div>
    </div>
    <div class="form-row-3">
      <div><label>Price</label><input type="text" id="edPrice" value="${esc(draft.price)}" placeholder="e.g. 15"></div>
      <div><label>Currency</label><select id="edCurrency">${CURRENCIES.map((c) => `<option value="${c}" ${draft.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label>Status</label><select id="edStatus">${CSTATUSES.map((s) => `<option value="${s}" ${draft.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>
    </div>
    <div><label>Notes (shown to customer)</label><textarea id="edNotes" placeholder="Order details, payment status, etc.">${esc(draft.notes)}</textarea></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px">
      <h3 style="margin:0">Progress steps</h3>
      <button class="btn btn-small" onclick="addStep()">+ Add step</button>
    </div>
    <div id="progressList" style="margin-top:10px"></div>
    <div style="margin-top:18px;display:flex;gap:10px">
      <button class="btn btn-primary" onclick="saveDraft()">Save order</button>
      <button class="btn btn-ghost" onclick="draft=null;renderEditor();">Cancel</button>
    </div>`;

  bindEditor();
  renderProgress();
}

function bindEditor() {
  $('edName').addEventListener('input', (e) => (draft.robloxUsername = e.target.value));
  $('edService').addEventListener('input', (e) => (draft.service = e.target.value));
  $('edPrice').addEventListener('input', (e) => (draft.price = e.target.value));
  $('edCurrency').addEventListener('change', (e) => (draft.currency = e.target.value));
  $('edStatus').addEventListener('change', (e) => (draft.status = e.target.value));
  $('edNotes').addEventListener('input', (e) => (draft.notes = e.target.value));
}

function renderProgress() {
  const list = $('progressList');
  if (!list) return;
  list.innerHTML = draft.progress.length
    ? draft.progress.map((p, i) => `
      <div class="edit-progress-item">
        <div class="inputs">
          <input type="text" value="${esc(p.label)}" placeholder="Step label, e.g. Level 1 → 700" data-i="${i}" data-f="label">
          <input type="text" value="${esc(p.note)}" placeholder="Note (shown to customer)" data-i="${i}" data-f="note">
        </div>
        <select data-i="${i}" data-f="status">${PSTATUSES.map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
        <button class="btn btn-danger btn-small" onclick="removeStep(${i})" title="Delete step">✕</button>
      </div>`).join('')
    : '<div class="empty">No steps yet. Click “+ Add step” to break the work into trackable milestones.</div>';

  list.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = draft.progress[+el.dataset.i];
      p[el.dataset.f] = el.value;
    });
  });
}

window.addStep = function () {
  draft.progress.push({ id: uuid(), label: '', status: 'pending', note: '' });
  renderProgress();
  const last = $('progressList').querySelector('input[data-i="' + (draft.progress.length - 1) + '"]');
  if (last) last.focus();
};

window.removeStep = function (i) {
  draft.progress.splice(i, 1);
  renderProgress();
};

// ---------------------------------------------------------------- save / delete
window.saveDraft = async function () {
  if (!draft) return;
  if (!draft.robloxUsername.trim()) return toast('Roblox username is required', true);
  if (!draft.service.trim()) return toast('Service is required', true);
  draft.progress = draft.progress.map((p) => ({ ...p, label: p.label.trim() || 'Untitled step' }));
  try {
    if (draft.id) {
      await api('/api/admin/customers/' + encodeURIComponent(draft.id), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      toast('Order updated ✔');
    } else {
      const res = await api('/api/admin/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      draft = res.customer;
      toast('Order created ✔');
    }
    await refreshList();
    renderEditor();
  } catch (e) {
    toast(e.message, true);
  }
};

window.deleteCustomer = async function () {
  if (!draft || !draft.id) return;
  if (!confirm(`Delete the order for "${draft.robloxUsername}"? This cannot be undone.`)) return;
  try {
    await api('/api/admin/customers/' + encodeURIComponent(draft.id), { method: 'DELETE' });
    toast('Order deleted');
    draft = null;
    await refreshList();
    renderEditor();
  } catch (e) {
    toast(e.message, true);
  }
};

// ---------------------------------------------------------------- login / logout
async function doLogin() {
  const pw = $('password').value;
  if (!pw) return toast('Enter the password', true);
  try {
    await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    $('password').value = '';
    showDash();
  } catch (e) {
    toast('Wrong password', true);
  }
}

async function doLogout() {
  try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  draft = null;
  showLogin();
}

// ---------------------------------------------------------------- items tab
const ITEM_CATS = [
  { id: 'styles', label: 'Fighting Styles' },
  { id: 'swords', label: 'Swords' },
  { id: 'guns', label: 'Guns' },
  { id: 'materials', label: 'Materials' },
];

let items = [];
let itemFilter = '';
let newIdCounter = 0;

function switchView(v) {
  const orders = v === 'orders';
  $('tabOrders').classList.toggle('active', orders);
  $('tabItems').classList.toggle('active', v === 'items');
  $('tabServices').classList.toggle('active', v === 'services');
  $('ordersToolbar').classList.toggle('hidden', !orders);
  $('ordersSection').classList.toggle('hidden', !orders);
  $('itemsSection').classList.toggle('hidden', v !== 'items');
  $('servicesSection').classList.toggle('hidden', v !== 'services');
  if (v === 'items') refreshItems();
  if (v === 'services') refreshServices();
}

async function refreshItems() {
  try {
    const { items: list } = await api('/api/admin/items');
    items = list;
    renderItems();
  } catch (e) {
    toast(e.message, true);
  }
}

function rowHTML(it) {
  const id = it.id || '';
  return `
  <div class="item-row" data-id="${esc(id)}">
    <img class="item-thumb" src="${esc(it.image || '')}" alt="" onerror="this.style.visibility='hidden'">
    <input data-f="name" value="${esc(it.name)}" placeholder="Item name">
    <select data-f="category">${ITEM_CATS.map((c) => `<option value="${c.id}" ${it.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
    <select data-f="rarity">${['Legendary', 'Mythical'].map((r) => `<option ${it.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
    <input type="number" data-f="price" value="${esc(it.price)}" min="0" title="Price in THB">
    <input data-f="image" value="${esc(it.image || '')}" placeholder="Image URL or /img/items/x.webp">
    <input data-f="cost" value="${esc(it.cost || '')}" placeholder="How to get (optional)">
    <label class="enabled-toggle" title="Show/hide on the public Prices page"><input type="checkbox" data-f="enabled" ${it.enabled ? 'checked' : ''}> Enabled</label>
    <button class="btn btn-small" data-act="save">Save</button>
    <button class="btn btn-danger btn-small" data-act="del" title="Delete item">✕</button>
  </div>`;
}

function renderItems() {
  const f = itemFilter.toLowerCase();
  const rows = items.filter((i) => !f || i.name.toLowerCase().includes(f));
  $('itemCount').textContent = `${items.length} total · ${rows.length} shown`;
  $('itemsList').innerHTML = rows.length
    ? rows.map(rowHTML).join('')
    : '<div class="empty">No items yet. Click “+ Add Item” to create one.</div>';
}

function findItemByRow(row) {
  return items.find((x) => (x.id || '') === row.dataset.id);
}

$('itemsList').addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const it = findItemByRow(e.target.closest('.item-row'));
  if (!it) return;
  it[f] = f === 'enabled' ? e.target.checked : (f === 'price' ? Number(e.target.value) : e.target.value);
});

$('itemsList').addEventListener('change', (e) => {
  const f = e.target.dataset.f;
  if (!f || f === 'enabled') {
    const it = findItemByRow(e.target.closest('.item-row'));
    if (it && f === 'enabled') it.enabled = e.target.checked;
  }
});

$('itemsList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.item-row');
  const id = row.dataset.id;
  if (btn.dataset.act === 'save') saveItem(id);
  else if (btn.dataset.act === 'del') deleteItem(id);
});

window.addItemRow = function () {
  items.unshift({ id: 'new-' + (++newIdCounter), name: '', category: 'swords', rarity: 'Legendary', price: 0, image: '', cost: '', enabled: true });
  renderItems();
  const first = $('itemsList').querySelector('input[data-f="name"]');
  if (first) first.focus();
};

async function saveItem(id) {
  const it = items.find((x) => (x.id || '') === id);
  if (!it) return;
  if (!it.name.trim()) return toast('Item name is required', true);
  const isNew = String(id).startsWith('new-');
  const payload = {
    name: it.name.trim(), category: it.category, rarity: it.rarity,
    price: it.price, image: it.image, cost: it.cost, note: it.note || '', enabled: it.enabled !== false,
  };
  try {
    if (isNew) {
      const res = await api('/api/admin/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      items = items.map((x) => (x.id === id ? res.item : x));
      toast('Item added ✔');
    } else {
      await api('/api/admin/items/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast('Item saved ✔');
    }
    await refreshItems();
  } catch (e) {
    toast(e.message, true);
  }
}

async function deleteItem(id) {
  if (String(id).startsWith('new-')) {
    items = items.filter((x) => (x.id || '') !== id);
    renderItems();
    return;
  }
  const it = items.find((x) => (x.id || '') === id);
  if (!confirm(`Delete "${it ? it.name : 'this item'}" from the catalog?`)) return;
  try {
    await api('/api/admin/items/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Item deleted');
    await refreshItems();
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------------------------------------------------------------- services tab
let services = [];
let serviceFilter = '';
let newServiceIdCounter = 0;

function serviceRowHTML(s) {
  const id = s.id || '';
  return `
  <div class="service-row" data-id="${esc(id)}">
    <input data-f="name" value="${esc(s.name)}" placeholder="Service name">
    <input data-f="price" value="${esc(s.price)}" placeholder="Price (THB)">
    <label class="enabled-toggle" title="Show/hide on the public Prices page"><input type="checkbox" data-f="enabled" ${s.enabled ? 'checked' : ''}> Enabled</label>
    <button class="btn btn-small" data-act="save">Save</button>
    <button class="btn btn-danger btn-small" data-act="del" title="Delete service">✕</button>
  </div>`;
}

function renderServices() {
  const f = serviceFilter.toLowerCase();
  const rows = services.filter((s) => !f || s.name.toLowerCase().includes(f));
  $('serviceCount').textContent = `${services.length} total · ${rows.length} shown`;
  $('servicesList').innerHTML = rows.length
    ? rows.map(serviceRowHTML).join('')
    : '<div class="empty">No services yet. Click “+ Add Service” to create one.</div>';
}

function findServiceByRow(row) {
  return services.find((x) => (x.id || '') === row.dataset.id);
}

$('servicesList').addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const s = findServiceByRow(e.target.closest('.service-row'));
  if (!s) return;
  s[f] = f === 'enabled' ? e.target.checked : e.target.value;
});

$('servicesList').addEventListener('change', (e) => {
  const f = e.target.dataset.f;
  if (f === 'enabled') {
    const s = findServiceByRow(e.target.closest('.service-row'));
    if (s) s.enabled = e.target.checked;
  }
});

$('servicesList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.service-row');
  const id = row.dataset.id;
  if (btn.dataset.act === 'save') saveService(id);
  else if (btn.dataset.act === 'del') deleteService(id);
});

window.addServiceRow = function () {
  services.unshift({ id: 'new-' + (++newServiceIdCounter), name: '', price: '', enabled: true });
  renderServices();
  const first = $('servicesList').querySelector('input[data-f="name"]');
  if (first) first.focus();
};

async function refreshServices() {
  try {
    const { services: list } = await api('/api/admin/services');
    services = list;
    renderServices();
  } catch (e) {
    toast(e.message, true);
  }
}

async function saveService(id) {
  const s = services.find((x) => (x.id || '') === id);
  if (!s) return;
  if (!s.name.trim()) return toast('Service name is required', true);
  const isNew = String(id).startsWith('new-');
  const payload = { name: s.name.trim(), price: s.price, enabled: s.enabled !== false };
  try {
    if (isNew) {
      const res = await api('/api/admin/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      services = services.map((x) => (x.id === id ? res.service : x));
      toast('Service added ✔');
    } else {
      await api('/api/admin/services/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast('Service saved ✔');
    }
    await refreshServices();
  } catch (e) {
    toast(e.message, true);
  }
}

async function deleteService(id) {
  if (String(id).startsWith('new-')) {
    services = services.filter((x) => (x.id || '') !== id);
    renderServices();
    return;
  }
  const s = services.find((x) => (x.id || '') === id);
  if (!confirm(`Delete "${s ? s.name : 'this service'}"?`)) return;
  try {
    await api('/api/admin/services/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Service deleted');
    await refreshServices();
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------------------------------------------------------------- wire up
$('tabOrders').addEventListener('click', () => switchView('orders'));
$('tabItems').addEventListener('click', () => switchView('items'));
$('tabServices').addEventListener('click', () => switchView('services'));
$('addItemBtn').addEventListener('click', addItemRow);
$('itemFilter').addEventListener('input', (e) => {
  itemFilter = e.target.value;
  clearTimeout(listTimer);
  listTimer = setTimeout(renderItems, 150);
});
$('addServiceBtn').addEventListener('click', addServiceRow);
$('serviceFilter').addEventListener('input', (e) => {
  serviceFilter = e.target.value;
  clearTimeout(listTimer);
  listTimer = setTimeout(renderServices, 150);
});

$('loginBtn').addEventListener('click', doLogin);
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('logoutBtn').addEventListener('click', doLogout);
$('newBtn').addEventListener('click', newCustomer);
$('deleteBtn').addEventListener('click', deleteCustomer);
$('filter').addEventListener('input', (e) => {
  filter = e.target.value;
  clearTimeout(listTimer);
  listTimer = setTimeout(renderList, 150);
});

checkAuth();
