'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', completed: 'Completed', cancelled: 'Cancelled' };

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toast(msg, err) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = 'toast'), 2600);
}

async function api(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

async function doSearch() {
  const q = $('search').value.trim();
  if (q.length < 2) return toast('Type at least 2 letters of the username', true);
  try {
    const { customers } = await api('/api/search?q=' + encodeURIComponent(q));
    const list = $('resultsList');
    $('results').classList.remove('hidden');
    $('detail').classList.add('hidden');
    if (!customers.length) {
      list.innerHTML = '<div class="empty">No orders found for that username. Double-check the spelling (case doesn\'t matter).</div>';
      return;
    }
    list.innerHTML = customers.map((c) => `
      <button class="result-item" onclick="openOrder('${esc(c.id)}')">
        <div>
          <div class="ri-name">${esc(c.robloxUsername)}</div>
          <div class="ri-svc">${esc(c.service)}</div>
        </div>
        <div class="ri-right">
          <span class="badge ${esc(c.status)}">${STATUS_LABEL[c.status] || esc(c.status)}</span>
          <span class="ri-time">Updated ${fmtDate(c.updatedAt)}</span>
        </div>
      </button>`).join('');
  } catch (e) {
    toast(e.message, true);
  }
}

window.openOrder = async function (id) {
  try {
    const { customer: c } = await api('/api/customers/' + encodeURIComponent(id));
    renderDetail(c);
    $('detail').classList.remove('hidden');
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    toast(e.message, true);
  }
};

function renderDetail(c) {
  const progress = c.progress || [];
  const done = progress.filter((p) => p.status === 'done').length;
  const pct = progress.length ? Math.round((done / progress.length) * 100) : 0;
  const priceText = c.price ? `${esc(c.price)} ${esc(c.currency || '')}` : '—';
  const canSeePrice = c.status !== 'cancelled';

  $('detailBody').innerHTML = `
    <div class="card">
      <div class="detail-head">
        <h2>${esc(c.robloxUsername)}</h2>
        <span class="badge ${esc(c.status)}">${STATUS_LABEL[c.status] || esc(c.status)}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><div class="k">Service</div><div class="v">${esc(c.service)}</div></div>
        ${canSeePrice ? `<div class="meta-box"><div class="k">Price</div><div class="v">${priceText}</div></div>` : ''}
        <div class="meta-box"><div class="k">Order placed</div><div class="v">${fmtDate(c.createdAt)}</div></div>
        <div class="meta-box"><div class="k">Last updated</div><div class="v">${fmtDate(c.updatedAt)}</div></div>
      </div>
      ${c.notes ? `<p style="color:var(--muted)">${esc(c.notes)}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px">
        <strong>Progress — ${done}/${progress.length} steps done (${pct}%)</strong>
        <span class="badge in_progress">${pct}%</span>
      </div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
      <div style="margin-top:14px">
        ${progress.length ? progress.map((p) => `
          <div class="progress-step">
            <div class="step-dot ${esc(p.status)}"></div>
            <div class="step-body">
              <div class="sl">${esc(p.label)}</div>
              ${p.note ? `<div class="sn">${esc(p.note)}</div>` : ''}
              <div class="st">Updated ${fmtDate(p.updatedAt)}</div>
            </div>
            <span class="badge ${esc(p.status)} step-status">${STATUS_LABEL[p.status] || esc(p.status)}</span>
          </div>`).join('') : '<div class="empty">No progress steps added yet — check back soon!</div>'}
      </div>
    </div>`;
}

$('search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
$('searchBtn').addEventListener('click', doSearch);
