'use strict';
/*
 * BloxFarm Tracker — customer order/progress tracker for a Blox Fruits service.
 * Zero dependencies: plain Node.js HTTP server, JSON file storage.
 *
 * Run:  node server.js        (then open http://localhost:3000)
 * Env:  PORT (default 3000), HOST (default 127.0.0.1), ADMIN_PASSWORD
 * Config/data are stored in ./data (created on first run).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// DATA_DIR can be overridden (e.g. Render persistent disk mounted at /var/data)
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'accounts.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const SESSION_DAYS = 7;
const MAX_BODY = 1 * 1024 * 1024; // 1 MB

const CUSTOMER_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const PROGRESS_STATUSES = ['pending', 'in_progress', 'done'];
const CURRENCIES = ['THB', 'USD', 'EUR', 'GBP', 'PHP', 'INR', 'IDR', 'BRL', 'MXN'];

// ---------------------------------------------------------------------------
// Config & data persistence
// ---------------------------------------------------------------------------

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('[warn] Could not parse data/config.json, regenerating...');
    }
  }
  const cfg = {
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  console.log('==============================================================');
  console.log(' [!] Created data/config.json');
  console.log(' [!] Default admin password is: admin123');
  console.log(' [!] CHANGE IT NOW: edit data/config.json (adminPassword) and restart,');
  console.log('     or start with:  ADMIN_PASSWORD=yourpass node server.js');
  console.log('==============================================================');
  return cfg;
}

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

const config = loadConfig();

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('[error] Could not parse data/accounts.json — starting fresh after backing up.');
      fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak-' + Date.now());
    }
  }
  const seed = { customers: [demoCustomer()] };
  saveData(seed);
  return seed;
}

function saveData(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function demoCustomer() {
  const now = new Date().toISOString();
  return {
    id: 'demo-0001',
    robloxUsername: 'DemoPlayer123',
    service: 'Max Level 1 → 2600 + Buddha Mastery',
    price: '15',
    currency: 'USD',
    status: 'in_progress',
    notes: 'This is a sample order. Delete it from the admin dashboard and add your real customers.',
    createdAt: now,
    updatedAt: now,
    progress: [
      { id: 'demo-p1', label: 'Level 1 → 700 (Sea 1)', status: 'done', note: 'Completed in 6h', updatedAt: now },
      { id: 'demo-p2', label: 'Level 700 → 1500 (Sea 2)', status: 'done', note: 'Completed in 9h', updatedAt: now },
      { id: 'demo-p3', label: 'Level 1500 → 2600 (Sea 3)', status: 'in_progress', note: 'Roughly 40% done', updatedAt: now },
      { id: 'demo-p4', label: 'Buddha Mastery 0 → 600', status: 'pending', note: '', updatedAt: now },
    ],
  };
}

let data = loadData();

// ---------------------------------------------------------------------------
// Items store (admin-managed catalog, seeded from the bundled items.js)
// ---------------------------------------------------------------------------

function seedItemsFromBundle() {
  try {
    const src = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'items.js'), 'utf8');
    const m = src.match(/GALLERY_ITEMS = (\[.*?\]);/s);
    if (!m) return [];
    const arr = JSON.parse(m[1]);
    return arr.map((it) => ({
      id: crypto.randomUUID(),
      name: it.name,
      category: it.cat,
      rarity: it.rarity,
      price: Number(it.price) || 0,
      image: it.img || '',
      cost: it.cost || '',
      note: it.note || '',
      enabled: true,
    }));
  } catch (e) {
    console.error('[warn] Could not seed items from public/js/items.js:', e.message);
    return [];
  }
}

function loadItems() {
  if (fs.existsSync(ITEMS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'));
    } catch (e) {
      console.error('[error] Could not parse data/items.json — starting fresh after backing up.');
      fs.copyFileSync(ITEMS_FILE, ITEMS_FILE + '.bak-' + Date.now());
    }
  }
  const seed = { items: seedItemsFromBundle() };
  saveItems(seed);
  return seed;
}

function saveItems(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = ITEMS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, ITEMS_FILE);
}

let itemData = loadItems();

// ---------------------------------------------------------------------------
// Services store (admin-managed service list, seeded with defaults)
// ---------------------------------------------------------------------------

const DEFAULT_SERVICES = [
  ['Leveling 1 → 700 (Sea 1)', '12'],
  ['Leveling 700 → 1,500 (Sea 2)', '24'],
  ['Leveling 1,500 → 2,600 (Sea 3)', '36'],
  ['Full leveling 1 → 2,600 (max)', '70'],
  ['Fruit mastery 0 → 600', '24'],
  ['Sword mastery 0 → 600', '24'],
  ['Gun mastery 0 → 600', '24'],
  ['Fighting style mastery 0 → 600', '24'],
  ['Raid carry (per raid, fragments farmed for you)', '3'],
  ['Full awakening — 50 raids (Dough / Phoenix / etc.)', '120'],
  ['Buddha awakening', '70'],
  ['Race V4 unlock', '80'],
  ['Bounty / Honor farming (per 1M)', '20'],
  ['Sea Events farming (per hour)', '20'],
  ['Boss farming / drops (per hour)', '20'],
  ['Material farming (per 99 stack)', '12 – 160'],
];

function loadServices() {
  if (fs.existsSync(SERVICES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SERVICES_FILE, 'utf8'));
    } catch (e) {
      console.error('[error] Could not parse data/services.json — starting fresh after backing up.');
      fs.copyFileSync(SERVICES_FILE, SERVICES_FILE + '.bak-' + Date.now());
    }
  }
  const seed = {
    services: DEFAULT_SERVICES.map(([name, price]) => ({
      id: crypto.randomUUID(), name, price, enabled: true,
    })),
  };
  saveServices(seed);
  return seed;
}

function saveServices(next) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SERVICES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, SERVICES_FILE);
}

let serviceData = loadServices();

function cleanService(body, existing) {
  const s = existing ? { ...existing } : {};
  const errs = [];

  s.name = String(body.name !== undefined ? body.name : (existing && existing.name) || '').trim();
  if (!s.name) errs.push('name is required');

  s.price = String(body.price !== undefined ? body.price : (existing && existing.price) || '').trim();
  s.enabled = body.enabled !== undefined ? !!body.enabled : (existing ? existing.enabled !== false : true);

  return { service: s, errs };
}

const ITEM_CATEGORIES = ['styles', 'swords', 'guns', 'materials'];
const ITEM_RARITIES = ['Legendary', 'Mythical'];

function cleanItem(body, existing) {
  const it = existing ? { ...existing } : {};
  const errs = [];

  it.name = String(body.name !== undefined ? body.name : (existing && existing.name) || '').trim();
  if (!it.name) errs.push('name is required');

  if (body.category !== undefined) it.category = String(body.category);
  else if (!it.category) it.category = 'swords';
  if (!ITEM_CATEGORIES.includes(it.category)) errs.push('Invalid category');

  if (body.rarity !== undefined) it.rarity = String(body.rarity);
  else if (!it.rarity) it.rarity = 'Legendary';
  if (!ITEM_RARITIES.includes(it.rarity)) errs.push('Invalid rarity');

  const priceNum = body.price !== undefined ? Number(body.price) : (existing && Number(existing.price)) || 0;
  it.price = isNaN(priceNum) || priceNum < 0 ? 0 : Math.round(priceNum);

  it.image = String(body.image !== undefined ? body.image : (existing && existing.image) || '').trim();
  it.cost = String(body.cost !== undefined ? body.cost : (existing && existing.cost) || '').trim();
  it.note = String(body.note !== undefined ? body.note : (existing && existing.note) || '').trim();
  it.enabled = body.enabled !== undefined ? !!body.enabled : (existing ? existing.enabled !== false : true);

  return { item: it, errs };
}

// ---------------------------------------------------------------------------
// Auth (HMAC-signed cookie, no session store needed)
// ---------------------------------------------------------------------------

function sign(str) {
  return crypto.createHmac('sha256', config.sessionSecret).update(str).digest('base64url');
}

function makeToken() {
  const payload = Buffer.from(
    JSON.stringify({ a: true, exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000 })
  ).toString('base64url');
  return payload + '.' + sign(payload);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return obj && obj.a === true && obj.exp > Date.now();
  } catch (e) {
    return false;
  }
}

function getCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAdmin(req) {
  return verifyToken(getCookies(req).fb_session);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

function publicCustomer(c) {
  // Public view intentionally includes full progress (that's the point of a tracker).
  return {
    id: c.id,
    robloxUsername: c.robloxUsername,
    service: c.service,
    status: c.status,
    price: c.price,
    currency: c.currency,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    progress: (c.progress || []).map((p) => ({
      id: p.id,
      label: p.label,
      status: p.status,
      note: p.note || '',
      updatedAt: p.updatedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Validation & normalization
// ---------------------------------------------------------------------------

function cleanCustomer(body, existing) {
  const c = existing ? { ...existing } : {};
  const errs = [];

  c.robloxUsername = String(body.robloxUsername || (existing && existing.robloxUsername) || '').trim();
  c.service = String(body.service || (existing && existing.service) || '').trim();
  c.price = String(body.price !== undefined ? body.price : (existing && existing.price) || '').trim();

  if (body.currency !== undefined) c.currency = String(body.currency);
  else if (!c.currency) c.currency = 'THB';
  if (!CURRENCIES.includes(c.currency)) c.currency = 'THB';

  if (body.status !== undefined) c.status = String(body.status);
  else if (!c.status) c.status = 'pending';
  if (!CUSTOMER_STATUSES.includes(c.status)) errs.push('Invalid status');

  c.notes = String(body.notes !== undefined ? body.notes : (existing && existing.notes) || '').trim();

  if (!c.robloxUsername) errs.push('robloxUsername is required');
  if (!c.service) errs.push('service is required');

  if (body.progress !== undefined) {
    if (!Array.isArray(body.progress)) errs.push('progress must be an array');
    else {
      c.progress = body.progress.map((p) => ({
        id: String(p.id || crypto.randomUUID()),
        label: String(p.label || '').trim() || 'Untitled step',
        status: PROGRESS_STATUSES.includes(p.status) ? p.status : 'pending',
        note: String(p.note || '').trim(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));
    }
  }
  if (!c.progress) c.progress = [];

  return { customer: c, errs };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  const method = req.method;

  try {
    // ---- Static / pages ----
    if (method === 'GET' && (p === '/' || p === '/index.html')) return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
    if (method === 'GET' && p === '/admin') return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    if (method === 'GET' && p === '/prices') return sendFile(res, path.join(PUBLIC_DIR, 'prices.html'));

    const staticMatch = p.match(/^\/(css|js|img)\/(.+)$/);
    if (method === 'GET' && staticMatch) {
      const filePath = path.resolve(PUBLIC_DIR, staticMatch[1], staticMatch[2]);
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath)) return sendFile(res, filePath);
      return json(res, 404, { error: 'Not found' });
    }
    if (method === 'GET' && p === '/favicon.ico') {
      res.writeHead(204); return res.end();
    }

    // ---- Public API ----
    if (method === 'GET' && p === '/api/search') {
      const q = String(u.searchParams.get('q') || '').trim().toLowerCase();
      if (q.length < 2) return json(res, 200, { customers: [] });
      const matches = data.customers
        .filter((c) => c.robloxUsername.toLowerCase().includes(q))
        .map((c) => ({
          id: c.id,
          robloxUsername: c.robloxUsername,
          service: c.service,
          status: c.status,
          updatedAt: c.updatedAt,
        }));
      return json(res, 200, { customers: matches });
    }

    const customerMatch = p.match(/^\/api\/customers\/([\w-]+)$/);
    if (method === 'GET' && customerMatch) {
      const c = data.customers.find((x) => x.id === customerMatch[1]);
      if (!c) return json(res, 404, { error: 'Order not found' });
      return json(res, 200, { customer: publicCustomer(c) });
    }

    // ---- Public item catalog (enabled items only) ----
    if (method === 'GET' && p === '/api/items') {
      const list = itemData.items
        .filter((i) => i.enabled !== false)
        .map((i) => ({
          id: i.id, name: i.name, category: i.category, rarity: i.rarity,
          price: i.price, image: i.image, cost: i.cost || '', note: i.note || '',
        }));
      return json(res, 200, { items: list });
    }

    // ---- Public service list (enabled only) ----
    if (method === 'GET' && p === '/api/services') {
      const list = serviceData.services
        .filter((s) => s.enabled !== false)
        .map((s) => ({ id: s.id, name: s.name, price: s.price }));
      return json(res, 200, { services: list });
    }

    // ---- Auth ----
    if (method === 'POST' && p === '/api/login') {
      const body = await readBody(req);
      if (sha256(body.password || '') === sha256(config.adminPassword)) {
        const token = makeToken();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `fb_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`,
        });
        return res.end(JSON.stringify({ ok: true }));
      }
      return json(res, 401, { error: 'Wrong password' });
    }

    if (method === 'POST' && p === '/api/logout') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'fb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (method === 'GET' && p === '/api/admin/me') {
      return json(res, 200, { admin: isAdmin(req) });
    }

    // ---- Admin-only API ----
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return json(res, 401, { error: 'Not authorized' });

      if (method === 'GET' && p === '/api/admin/customers') {
        const list = data.customers.map((c) => ({
          id: c.id,
          robloxUsername: c.robloxUsername,
          service: c.service,
          price: c.price,
          currency: c.currency,
          status: c.status,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          progressCount: (c.progress || []).length,
          doneCount: (c.progress || []).filter((x) => x.status === 'done').length,
        }));
        return json(res, 200, { customers: list });
      }

      const adminCustomerMatch = p.match(/^\/api\/admin\/customers\/([\w-]+)$/);
      const adminProgressMatch = p.match(/^\/api\/admin\/customers\/([\w-]+)\/progress\/([\w-]+)$/);

      if (method === 'POST' && p === '/api/admin/customers') {
        const body = await readBody(req);
        const { customer, errs } = cleanCustomer(body, null);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        const now = new Date().toISOString();
        customer.id = crypto.randomUUID();
        customer.createdAt = now;
        customer.updatedAt = now;
        data.customers.unshift(customer);
        saveData(data);
        return json(res, 201, { customer: publicCustomer(customer) });
      }

      if (method === 'PUT' && adminCustomerMatch) {
        const idx = data.customers.findIndex((x) => x.id === adminCustomerMatch[1]);
        if (idx < 0) return json(res, 404, { error: 'Order not found' });
        const body = await readBody(req);
        const { customer, errs } = cleanCustomer(body, data.customers[idx]);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        customer.updatedAt = new Date().toISOString();
        data.customers[idx] = customer;
        saveData(data);
        return json(res, 200, { customer: publicCustomer(customer) });
      }

      if (method === 'DELETE' && adminCustomerMatch) {
        const before = data.customers.length;
        data.customers = data.customers.filter((x) => x.id !== adminCustomerMatch[1]);
        if (data.customers.length === before) return json(res, 404, { error: 'Order not found' });
        saveData(data);
        return json(res, 200, { ok: true });
      }

      // Convenience: add a progress item without sending the whole customer
      if (method === 'POST' && adminProgressMatch && p.endsWith('/progress/' + adminProgressMatch[2])) {
        // unused pattern; progress items are managed through PUT on the customer.
      }

      if (method === 'POST' && p.match(/^\/api\/admin\/customers\/([\w-]+)\/progress$/)) {
        const id = p.match(/^\/api\/admin\/customers\/([\w-]+)\/progress$/)[1];
        const c = data.customers.find((x) => x.id === id);
        if (!c) return json(res, 404, { error: 'Order not found' });
        const body = await readBody(req);
        const item = {
          id: crypto.randomUUID(),
          label: String(body.label || '').trim() || 'Untitled step',
          status: PROGRESS_STATUSES.includes(body.status) ? body.status : 'pending',
          note: String(body.note || '').trim(),
          updatedAt: new Date().toISOString(),
        };
        c.progress.push(item);
        c.updatedAt = item.updatedAt;
        saveData(data);
        return json(res, 201, { item });
      }

      // ---- Item catalog management (add / edit / delete / enable-disable) ----
      if (method === 'GET' && p === '/api/admin/items') {
        return json(res, 200, { items: itemData.items });
      }

      if (method === 'POST' && p === '/api/admin/items') {
        const body = await readBody(req);
        const { item, errs } = cleanItem(body, null);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        item.id = crypto.randomUUID();
        itemData.items.push(item);
        saveItems(itemData);
        return json(res, 201, { item });
      }

      const adminItemMatch = p.match(/^\/api\/admin\/items\/([\w-]+)$/);
      if (method === 'PUT' && adminItemMatch) {
        const idx = itemData.items.findIndex((x) => x.id === adminItemMatch[1]);
        if (idx < 0) return json(res, 404, { error: 'Item not found' });
        const body = await readBody(req);
        const { item, errs } = cleanItem(body, itemData.items[idx]);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        itemData.items[idx] = item;
        saveItems(itemData);
        return json(res, 200, { item });
      }

      if (method === 'DELETE' && adminItemMatch) {
        const before = itemData.items.length;
        itemData.items = itemData.items.filter((x) => x.id !== adminItemMatch[1]);
        if (itemData.items.length === before) return json(res, 404, { error: 'Item not found' });
        saveItems(itemData);
        return json(res, 200, { ok: true });
      }

      // ---- Service management (add / edit / delete / enable-disable / reorder) ----
      if (method === 'GET' && p === '/api/admin/services') {
        return json(res, 200, { services: serviceData.services });
      }

      if (method === 'PUT' && p === '/api/admin/services/order') {
        const body = await readBody(req);
        const ids = Array.isArray(body.ids) ? body.ids : [];
        if (ids.length !== serviceData.services.length || !ids.every((id) => serviceData.services.some((s) => s.id === id))) {
          return json(res, 400, { error: 'Invalid service order' });
        }
        serviceData.services = ids.map((id) => serviceData.services.find((s) => s.id === id));
        saveServices(serviceData);
        return json(res, 200, { ok: true });
      }

      if (method === 'POST' && p === '/api/admin/services') {
        const body = await readBody(req);
        const { service, errs } = cleanService(body, null);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        service.id = crypto.randomUUID();
        serviceData.services.push(service);
        saveServices(serviceData);
        return json(res, 201, { service });
      }

      const adminServiceMatch = p.match(/^\/api\/admin\/services\/([\w-]+)$/);
      if (method === 'PUT' && adminServiceMatch) {
        const idx = serviceData.services.findIndex((x) => x.id === adminServiceMatch[1]);
        if (idx < 0) return json(res, 404, { error: 'Service not found' });
        const body = await readBody(req);
        const { service, errs } = cleanService(body, serviceData.services[idx]);
        if (errs.length) return json(res, 400, { error: errs.join('; ') });
        serviceData.services[idx] = service;
        saveServices(serviceData);
        return json(res, 200, { service });
      }

      if (method === 'DELETE' && adminServiceMatch) {
        const before = serviceData.services.length;
        serviceData.services = serviceData.services.filter((x) => x.id !== adminServiceMatch[1]);
        if (serviceData.services.length === before) return json(res, 404, { error: 'Service not found' });
        saveServices(serviceData);
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: 'Unknown admin route' });
    }

    return json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) return json(res, 400, { error: e.message || 'Bad request' });
    res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BloxFarm Tracker running →  http://${HOST}:${PORT}`);
  console.log(`Public tracker:   http://${HOST}:${PORT}/`);
  console.log(`Admin dashboard:  http://${HOST}:${PORT}/admin`);
  console.log(`Price list page:  http://${HOST}:${PORT}/prices`);
});
