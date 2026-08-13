'use strict';
/* In-memory mock of the Supabase PostgREST kv_store endpoint, for local testing. */
const http = require('http');
const PORT = parseInt(process.env.PORT || '3998', 10);
const store = new Map();

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (!p.endsWith('/kv_store')) {
    res.writeHead(404); return res.end('{}');
  }
  let body = '';
  for await (const c of req) body += c;

  if (req.method === 'GET') {
    const key = u.searchParams.get('key');
    const val = store.get(key.replace(/^eq\./, ''));
    const rows = val === undefined ? [] : [{ key: key.replace(/^eq\./, ''), value: val }];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  }
  if (req.method === 'POST') {
    const rows = JSON.parse(body || '[]');
    for (const r of rows) store.set(r.key, r.value);
    console.log('[mock] upsert keys:', rows.map((r) => r.key).join(', '));
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(rows));
  }
  res.writeHead(405); res.end('{}');
});

server.listen(PORT, '127.0.0.1', () => console.log(`[mock-postgrest] listening on ${PORT}, ${store.size} keys`));
