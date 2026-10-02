/* =====================================================================
   FITUR TAMBAHAN MODUL PENGELUARAN - Sari Kedele Subang
   File terpisah: JANGAN ditempel ke JS utama. Cukup muat SETELAH JS utama:

     <script src="app.js"></script>               <!-- JS utama (tidak diubah) -->
     <script src="fitur_pengeluaran.js"></script> <!-- file ini -->

   (ganti app.js dengan nama file JS utama Anda)
   Untuk menonaktifkan fitur: hapus/komentari baris script di atas.
   ===================================================================== */

const EXP_CATS = ['PASAR', 'CIKUDA', 'SKF', 'LAIN-LAIN'];
const EXP_DRAFT_KEY = 'subang_expense_draft';

// ---------- Indeks barang dari riwayat DB.expenses ----------
let _itemIdx = null, _itemIdxSrc = null;

function getItemIndex() {
  if (_itemIdx && _itemIdxSrc === DB.expenses) return _itemIdx;
  const map = new Map();
  [...(DB.expenses || [])]
    .sort((a, b) => formatDate(a.tanggal).localeCompare(formatDate(b.tanggal)))
    .forEach(r => {
      const key = cleanText(r.sumber);
      if (!key) return;
      const it = map.get(key) || { nama: r.sumber, count: 0, prices: [] };
      it.count++;
      it.nama = r.sumber; it.kategori = r.kategori; it.sub = r.sub_kategori; it.satuan = r.satuan;
      const h = Number(r.harga_satuan || 0);
      if (h > 0) it.prices.push(h);
      map.set(key, it);
    });
  _itemIdx = map; _itemIdxSrc = DB.expenses;
  return map;
}

// Median 5 harga terakhir: tahan terhadap 1 salah ketik di riwayat
function refPrice(prices) {
  const p = prices.slice(-5).sort((a, b) => a - b);
  if (!p.length) return 0;
  const m = Math.floor(p.length / 2);
  return p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2;
}

function priceCheck(prices, harga) {
  const ref = refPrice(prices);
  if (!ref || !harga) return null;
  const pct = Math.round(((harga - ref) / ref) * 100);
  if (Math.abs(pct) < 30) return null;
  return { pct, ref, level: (pct >= 100 || pct <= -50) ? 'bad' : 'warn' };
}

function alertText(c) {
  return `${c.level === 'bad' ? '🚨' : '⚠'} ${c.pct > 0 ? 'Naik' : 'Turun'} ${Math.abs(c.pct)}% dari harga biasa ${money(Math.round(c.ref))}`;
}

// ---------- Dropdown auto-suggest ----------
let _sgBox = null, _sgItems = [], _sgSel = 0, _sgInput = null;

function sgBox() {
  if (_sgBox) return _sgBox;
  _sgBox = document.createElement('div');
  _sgBox.style.cssText = 'position:fixed;z-index:9999;display:none;max-height:300px;overflow-y:auto;background:var(--input-bg,#fff);color:var(--text);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);';
  _sgBox.addEventListener('mousedown', e => {
    const d = e.target.closest('[data-i]');
    if (d) { e.preventDefault(); sgPick(Number(d.dataset.i)); }
  });
  document.body.appendChild(_sgBox);
  window.addEventListener('scroll', sgHide, true);
  return _sgBox;
}

function sgHide() { if (_sgBox) _sgBox.style.display = 'none'; }

function sgMark() {
  [..._sgBox.children].forEach((el, i) => {
    el.style.background = i === _sgSel ? 'rgba(0,122,255,0.15)' : '';
  });
}

function sgShow(input) {
  const q = cleanText(input.value);
  const box = sgBox();
  if (q.length < 2) return sgHide();
  // Urut: awalan cocok dulu, lalu paling sering dibeli
  const list = [...getItemIndex().entries()]
    .filter(([k]) => k.includes(q))
    .map(([k, it]) => ({ it, s: (k.startsWith(q) ? 100000 : 0) + it.count }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(x => x.it);
  if (!list.length) return sgHide();

  _sgItems = list; _sgSel = 0; _sgInput = input;
  const r = input.getBoundingClientRect();
  const w = Math.max(r.width, 260);
  box.style.width = w + 'px';
  box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  box.style.top = (r.bottom + 2) + 'px';
  box.innerHTML = list.map((it, i) => `
    <div data-i="${i}" style="padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer;display:flex;justify-content:space-between;gap:8px;">
      <div><b>${escapeHtml(it.nama)}</b>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(it.kategori || '-')} • ${escapeHtml(it.sub || '-')} • ${it.count}x</div></div>
      <div style="font-size:12px;white-space:nowrap;">${money(it.prices[it.prices.length - 1] || 0)}</div>
    </div>`).join('');
  box.style.display = 'block';
  sgMark();
}

function sgPick(i) {
  const it = _sgItems[i];
  if (!it || !_sgInput) return;
  const tr = _sgInput.closest('tr');
  const kat = String(it.kategori || '').toUpperCase();
  _sgInput.value = it.nama;
  if (EXP_CATS.includes(kat)) tr.querySelector('.exp-kategori').value = kat;
  tr.querySelector('.exp-sub').value = it.sub || '';
  tr.querySelector('.exp-satuan').value = it.satuan || 'PCS';
  tr.querySelector('.exp-harga').value = it.prices[it.prices.length - 1] || '';
  const q = tr.querySelector('.exp-qty');
  calcExpRow(q);
  sgHide();
  rowCheck(tr);
  q.focus(); q.select();
  expDraftSave();
}

// ---------- Peringatan harga di baris input ----------
function rowCheck(tr) {
  const w = tr.querySelector('.exp-warn');
  if (!w) return;
  const it = getItemIndex().get(cleanText(tr.querySelector('.exp-sumber').value));
  const c = it ? priceCheck(it.prices, Number(tr.querySelector('.exp-harga').value || 0)) : null;
  tr._alert = c;
  w.textContent = c ? alertText(c) : '';
  w.style.color = c ? (c.level === 'bad' ? 'var(--danger)' : '#d97706') : '';
}

function fillRow(tr, k, g, n, q, s, h) {
  tr.querySelector('.exp-kategori').value = k;
  tr.querySelector('.exp-sub').value = g;
  tr.querySelector('.exp-sumber').value = n;
  tr.querySelector('.exp-qty').value = q;
  tr.querySelector('.exp-satuan').value = s;
  tr.querySelector('.exp-harga').value = h;
  calcExpRow(tr.querySelector('.exp-qty'));
  rowCheck(tr);
}

function enhanceRow(tr) {
  const nm = tr.querySelector('.exp-sumber');
  const h = tr.querySelector('.exp-harga');
  h.parentElement.insertAdjacentHTML('beforeend', '<div class="exp-warn" style="font-size:11px;margin-top:4px;font-weight:700;"></div>');
  nm.autocomplete = 'off';

  nm.addEventListener('input', () => { sgShow(nm); rowCheck(tr); });
  nm.addEventListener('blur', () => setTimeout(sgHide, 120));
  nm.addEventListener('keydown', e => {
    const open = _sgBox && _sgBox.style.display === 'block' && _sgInput === nm;
    if (open && e.key === 'ArrowDown') { e.preventDefault(); _sgSel = (_sgSel + 1) % _sgItems.length; sgMark(); }
    else if (open && e.key === 'ArrowUp') { e.preventDefault(); _sgSel = (_sgSel - 1 + _sgItems.length) % _sgItems.length; sgMark(); }
    else if (open && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); sgPick(_sgSel); }
    else if (e.key === 'Escape') sgHide();
    else if (e.key === 'Enter') { e.preventDefault(); const q = tr.querySelector('.exp-qty'); q.focus(); q.select(); }
  });

  h.addEventListener('input', () => rowCheck(tr));
  h.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = tr.nextElementSibling || window.addExpenseRow();
    next.querySelector('.exp-sumber').focus();
  });

  tr.addEventListener('input', expDraftSave);
}

const _addRowOrig = window.addExpenseRow;
window.addExpenseRow = function () {
  _addRowOrig();
  const tr = $('batchExpenseBody')?.lastElementChild;
  if (tr) enhanceRow(tr);
  return tr;
};

// ---------- Draft otomatis (localStorage) ----------
let _dTimer;
function expDraftSave() {
  clearTimeout(_dTimer);
  _dTimer = setTimeout(() => {
    const rows = [...document.querySelectorAll('.expense-input-row')].map(r => ({
      k: r.querySelector('.exp-kategori').value, g: r.querySelector('.exp-sub').value,
      n: r.querySelector('.exp-sumber').value, q: r.querySelector('.exp-qty').value,
      s: r.querySelector('.exp-satuan').value, h: r.querySelector('.exp-harga').value
    })).filter(r => r.n.trim() || r.h);
    try {
      if (rows.length) localStorage.setItem(EXP_DRAFT_KEY, JSON.stringify({ t: $('batchExpenseDate')?.value, rows }));
      else localStorage.removeItem(EXP_DRAFT_KEY);
    } catch (e) { /* abaikan jika storage penuh/diblokir */ }
  }, 400);
}

function expDraftRestore() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(EXP_DRAFT_KEY) || 'null'); } catch (e) { /* abaikan */ }
  if (!d || !d.rows || !d.rows.length) return;
  if (d.t) $('batchExpenseDate').value = d.t;
  $('batchExpenseBody').innerHTML = '';
  d.rows.forEach(x => fillRow(window.addExpenseRow(), x.k, x.g, x.n, x.q, x.s, x.h));
  showToast(`Draft dipulihkan (${d.rows.length} baris)`);
}

// ---------- Import Excel ----------
const EXP_ALIAS = {
  kategori: ['kategori', 'sheet'],
  sub: ['grup', 'sub', 'subkategori', 'group'],
  nama: ['namabarang', 'nama', 'sumber', 'barang', 'item'],
  qty: ['qty', 'jumlah', 'quantity'],
  satuan: ['satuan', 'unit'],
  harga: ['harga', 'hargasatuan', 'price']
};

function pickCol(row, field) {
  for (const k of Object.keys(row)) {
    if (EXP_ALIAS[field].includes(cleanText(k))) return row[k];
  }
  return '';
}

window.downloadExpenseTemplate = function () {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Kategori', 'Grup', 'Nama Barang', 'Qty', 'Satuan', 'Harga'],
    ['PASAR', 'AYAM', 'Ayam Potong', 3, 'Ekor', 35000],
    ['PASAR', 'SAYUR', 'Cabai Merah', 1.5, 'Kg', 60000]
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran');
  XLSX.writeFile(wb, 'TEMPLATE_PENGELUARAN.xlsx');
};

window.handleExpenseImport = async function (event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const ok = [], err = [];

    rows.forEach((r, i) => {
      const line = i + 2; // baris 1 = header
      const nama = String(pickCol(r, 'nama')).trim();
      const kat = String(pickCol(r, 'kategori')).trim().toUpperCase();
      const sub = String(pickCol(r, 'sub')).trim().toUpperCase();
      const sat = String(pickCol(r, 'satuan')).trim();
      const rawQ = pickCol(r, 'qty'), rawH = pickCol(r, 'harga');
      if (!nama && !kat && rawQ === '' && rawH === '') return; // baris kosong

      const qty = rawQ === '' ? 1 : parseEsbNumber(rawQ);
      const harga = parseEsbNumber(rawH); // otomatis bersihkan "35.000"
      const p = [];
      if (!nama) p.push('nama barang kosong');
      if (!EXP_CATS.includes(kat)) p.push(`kategori "${kat || '-'}" tidak dikenal`);
      if (!(qty > 0)) p.push('qty tidak valid');
      if (!(harga > 0)) p.push('harga kosong/tidak valid');
      if (p.length) err.push({ line, nama: nama || '(tanpa nama)', p: p.join(', ') });
      else ok.push({ kat, sub, nama, qty, sat: sat || 'PCS', harga });
    });

    // Buang baris kosong, lalu isi tabel input (belum disimpan -> bisa direview)
    $('batchExpenseBody').querySelectorAll('tr').forEach(tr => {
      if (!tr.querySelector('.exp-sumber').value.trim() && !tr.querySelector('.exp-harga').value) tr.remove();
    });
    ok.forEach(o => fillRow(window.addExpenseRow(), o.kat, o.sub, o.nama, o.qty, o.sat, o.harga));

    const warn = [...document.querySelectorAll('.expense-input-row')].filter(t => t._alert).length;
    $('expImportReport').innerHTML = `
      <div style="padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:14px;font-size:13px;">
        <b>✓ ${ok.length} baris dimuat</b>, ${err.length} bermasalah${warn ? `, ${warn} harga janggal` : ''}.
        ${err.map(e => `<div style="color:var(--danger);margin-top:4px;">Baris ${e.line} — ${escapeHtml(e.nama)}: ${escapeHtml(e.p)}</div>`).join('')}
        ${err.length ? '<div style="color:var(--muted);margin-top:6px;">Baris bermasalah tidak dimuat. Perbaiki di Excel lalu import ulang, atau tambah manual.</div>' : ''}
      </div>`;
    expDraftSave();
  } catch (err) {
    console.error(err);
    showToast('Gagal membaca file: ' + err.message);
  }
  event.target.value = '';
};

// ---------- Tampilan tab Input: toolbar import + restore draft ----------
const _showExpSubOrig = window.showExpenseSub;
window.showExpenseSub = function (type) {
  _showExpSubOrig(type);
  if (type !== 'input') return;
  const panel = document.querySelector('#expenseSubContent .panel');
  if (!panel) return;
  panel.insertAdjacentHTML('afterbegin', `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <button type="button" class="btn btn-secondary" onclick="$('expImportFile').click()">📥 Import dari Excel</button>
      <button type="button" class="btn btn-secondary" onclick="downloadExpenseTemplate()">📄 Download Template</button>
      <input type="file" id="expImportFile" accept=".xls,.xlsx" style="display:none" onchange="handleExpenseImport(event)">
    </div>
    <div id="expImportReport"></div>`);
  $('batchExpenseDate').addEventListener('change', expDraftSave);
  $('batchExpenseBody').addEventListener('click', expDraftSave); // tombol hapus baris
  expDraftRestore();
};

// ---------- Simpan: peringatan harga ----------
window.submitBatchExpenses = async function () {
  const tanggal = $('batchExpenseDate').value;
  if (!tanggal) { showToast('Tanggal harus diisi.'); return; }
  const trs = [...document.querySelectorAll('.expense-input-row')];
  trs.forEach(rowCheck);

  const bad = trs.filter(r => r._alert && r._alert.level === 'bad');
  if (bad.length) {
    const msg = bad.map(r => `• ${r.querySelector('.exp-sumber').value}: ${alertText(r._alert)}`).join('\n');
    if (!confirm(`Harga berikut sangat janggal:\n\n${msg}\n\nTetap simpan?`)) return;
  }

  const items = [];
  trs.forEach(r => {
    const s = r.querySelector('.exp-sumber').value.trim();
    const n = r.querySelector('.exp-nominal').value;
    if (!s && !n) return;
    items.push({
      tanggal,
      kategori: r.querySelector('.exp-kategori').value,
      sub_kategori: r.querySelector('.exp-sub').value.trim(),
      sumber: s,
      qty: Number(r.querySelector('.exp-qty').value || 1),
      satuan: r.querySelector('.exp-satuan').value.trim() || 'PCS',
      harga_satuan: Number(r.querySelector('.exp-harga').value || 0),
      nominal: Number(n || 0),
      keterangan: '-'
    });
  });

  if (!items.length) { showToast('Tidak ada baris untuk disimpan.'); return; }
  const { error } = await db.from('expenses').insert(items);
  if (error) { showToast('Gagal: ' + error.message); return; }
  try { localStorage.removeItem(EXP_DRAFT_KEY); } catch (e) { /* abaikan */ }
  showToast(`${items.length} pengeluaran disimpan.`);
  loadData('expense');
};

// ---------- Dashboard: kartu "Perlu Dicek" ----------
function computeAlerts(ym) {
  const hist = new Map(), out = [];
  [...(DB.expenses || [])]
    .sort((a, b) => formatDate(a.tanggal).localeCompare(formatDate(b.tanggal)))
    .forEach(r => {
      const key = cleanText(r.sumber), h = Number(r.harga_satuan || 0);
      if (!key || h <= 0) return;
      const prev = hist.get(key) || [];
      if (formatDate(r.tanggal).startsWith(ym)) {
        const c = priceCheck(prev, h);
        if (c) out.push({ r, c });
      }
      prev.push(h);
      hist.set(key, prev);
    });
  return out.sort((a, b) => Math.abs(b.c.pct) - Math.abs(a.c.pct));
}

window.editHargaSatuan = async function (id) {
  const r = (DB.expenses || []).find(x => String(x.id) === String(id));
  if (!r) { showToast('Data tidak ditemukan.'); return; }
  const v = prompt(`Harga satuan "${r.sumber}" (${formatDate(r.tanggal)}), qty ${r.qty}:`, r.harga_satuan);
  if (v === null) return;
  const h = parseEsbNumber(v);
  if (!(h > 0)) { showToast('Harga tidak valid.'); return; }
  const { error } = await db.from('expenses')
    .update({ harga_satuan: h, nominal: Math.round(Number(r.qty || 1) * h) })
    .eq('id', r.id);
  if (error) showToast('Gagal: ' + error.message);
  else { showToast('Harga diperbaiki.'); loadData('dashboard'); }
};

const _updDashOrig = window.updateDashboardMetrics;
window.updateDashboardMetrics = function (ym) {
  _updDashOrig(ym);
  if (!ym) return;
  let p = $('priceAlertPanel');
  if (!p) {
    const cards = document.querySelector('#content .cards');
    if (!cards) return;
    cards.insertAdjacentHTML('afterend', '<div class="panel" id="priceAlertPanel" style="border-left:4px solid #d97706;"></div>');
    p = $('priceAlertPanel');
  }
  const list = computeAlerts(ym);
  const rowsHtml = list.slice(0, 10).map(({ r, c }) => `
    <div ${r.id ? `onclick="editHargaSatuan('${r.id}')"` : ''} style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer;font-size:13px;">
      <div><b>${escapeHtml(r.sumber)}</b>
        <div style="font-size:11px;color:var(--muted);">${formatDate(r.tanggal)} • ${escapeHtml(r.kategori)}</div></div>
      <div style="text-align:right;"><b>${money(r.harga_satuan)}</b>
        <div style="font-size:11px;color:${c.level === 'bad' ? 'var(--danger)' : '#d97706'};">${alertText(c)}</div></div>
    </div>`).join('');
  p.innerHTML = `<div class="panel-title">⚠ Perlu Dicek — Harga Janggal</div>` + (list.length
    ? rowsHtml
      + (list.length > 10 ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;">+${list.length - 10} lainnya</div>` : '')
      + '<div style="font-size:11px;color:var(--muted);margin-top:8px;">Ketuk baris untuk memperbaiki harga satuan.</div>'
    : '<div style="color:var(--muted);font-size:13px;padding:6px 0;">Tidak ada harga janggal bulan ini ✓</div>');
};
    
