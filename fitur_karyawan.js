/* =====================================================================
   FITUR MANAJEMEN KARYAWAN - Sari Kedele Subang
   File terpisah. Muat SETELAH app.js:
     <script src="app.js"></script>
     <script src="fitur_karyawan.js"></script>

   Cara kerja: daftar karyawan (ID absen, nama, nama di mesin, divisi, gaji,
   status) disimpan di tabel master_salary. Setiap pindah halaman, EMPLOYEE_MAP
   milik app.js diisi ulang dari tabel itu, jadi seluruh kode lama otomatis
   memakai data terbaru tanpa mengubah app.js.
   Sebelum migrasi (kolom no_absen belum ada/terisi) daftar bawaan app.js dipakai.
   ===================================================================== */

// Salinan daftar bawaan app.js (untuk "Isi Data Awal"). Diambil sebelum ada perubahan.
const EMP_MAP_ORIGINAL = JSON.parse(JSON.stringify(EMPLOYEE_MAP));
const KY_FIELDS = ['gaji_pokok', 'jabatan', 'prestasi', 'kesehatan', 'zakat', 'kebersihan_loyalitas'];
const KY_LABEL = { gaji_pokok: 'Gaji Pokok', jabatan: 'Jabatan', prestasi: 'Prestasi', kesehatan: 'Kesehatan', zakat: 'Zakat', kebersihan_loyalitas: 'Kebersihan/Loyalitas' };
const KY_SQL = `alter table master_salary
  add column if not exists no_absen text,
  add column if not exists nama_absen text,
  add column if not exists aktif boolean not null default true,
  add column if not exists tgl_keluar date,
  add column if not exists bonus_khusus boolean not null default false;
notify pgrst, 'reload schema';`;
let _kyQ = '', _kyAll = false;

const kyId = e => String(e.no_absen == null ? '' : e.no_absen).trim();
const kyMigrated = () => { const m = DB.masterSalary || []; return m.length > 0 && 'no_absen' in m[0]; };
const kyHasIds = () => (DB.masterSalary || []).some(e => kyId(e));

// ---------- Isi ulang EMPLOYEE_MAP dari database ----------
function syncEmployeeMap() {
  if (!kyHasIds()) return; // belum dimigrasi: pakai daftar bawaan
  Object.keys(EMPLOYEE_MAP).forEach(k => delete EMPLOYEE_MAP[k]);
  const list = (DB.masterSalary || []).filter(kyId);
  // Nonaktif dulu, lalu aktif menimpa: riwayat lama tetap terbaca & ID yang dipakai ulang mengikuti karyawan aktif
  [...list.filter(e => e.aktif === false), ...list.filter(e => e.aktif !== false)].forEach(e => {
    EMPLOYEE_MAP[kyId(e)] = {
      absenName: String(e.nama_absen || e.nama).trim().toUpperCase(),
      masterName: String(e.nama).trim().toUpperCase()
    };
  });
}

// Versi resolveEmployeeId tanpa pengecualian nama yang ditulis permanen
window.resolveEmployeeId = function (record) {
  if (!record) return null;
  const direct = record.no_absen || record.nomor || record.id_absen || record.id_karyawan;
  if (direct && EMPLOYEE_MAP[String(direct).trim()]) return String(direct).trim();
  const clean = String(record.nama || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const [id, v] of Object.entries(EMPLOYEE_MAP)) {
    if (clean === v.absenName.replace(/[^A-Z0-9]/g, '') || clean === v.masterName.replace(/[^A-Z0-9]/g, '')) return id;
  }
  return null;
};

// ---------- Penyesuaian gaji: karyawan nonaktif & bonus khusus per karyawan ----------
const _gcplOrig = window.getCalculatedPayrollList;
window.getCalculatedPayrollList = function (sDate, eDate, fDept) {
  if (!kyHasIds()) return _gcplOrig(sDate, eDate, fDept);
  const all = DB.masterSalary;
  // Yang sudah keluar hanya ikut jika tanggal keluarnya jatuh di/setelah awal periode (gaji terakhir)
  const pool = all.filter(e => e.aktif !== false || (e.tgl_keluar && sDate && formatDate(e.tgl_keluar) >= sDate));
  let rows;
  DB.masterSalary = pool;
  try { rows = _gcplOrig(sDate, eDate, fDept); } finally { DB.masterSalary = all; }
  return rows.map(r => {
    const emp = pool.find(e => cleanText(e.nama) === cleanText(r.nama));
    const bonus = emp && emp.bonus_khusus ? Number(DEFAULT_BONUS_LAIN) : 0;
    const gross = r.pokok + r.jabatan + r.prestasi + r.kesehatan + r.jamKerja + r.zakat + r.loyalitas + bonus;
    return { ...r, lainLain: bonus, gajiBersih: Math.max(0, gross - (r.kasbon + r.cicilan)) };
  });
};

// Rekap libur: sembunyikan karyawan nonaktif yang tidak punya data pada rentang tanggal itu
const _liburOrig = window.renderLiburList;
window.renderLiburList = function () {
  _liburOrig();
  if (!kyHasIds()) return;
  const act = new Set((DB.masterSalary || []).filter(e => e.aktif !== false).map(kyId));
  const off = new Set((DB.masterSalary || []).filter(e => e.aktif === false).map(kyId));
  document.querySelectorAll('#liburTableBody tr').forEach(tr => {
    const c = tr.children;
    if (c.length < 4) return;
    const id = c[0].textContent.trim();
    if (off.has(id) && !act.has(id) && parseInt(c[2].textContent) === 0 && parseInt(c[3].textContent) === 0) tr.remove();
  });
};

// Ubah nama dari tabel lama di Pengaturan -> arahkan ke menu yang ikut memperbarui data terkait
const _editInlineOrig = window.editInline;
window.editInline = function (table, id, field, cur) {
  if (kyMigrated() && table === 'master_salary' && field === 'nama') {
    showToast('Ubah nama lewat menu Manajemen Karyawan agar kasbon & cicilan ikut diperbarui.');
    return;
  }
  return _editInlineOrig(table, id, field, cur);
};

// ---------- Halaman Manajemen Karyawan ----------
const _showPageOrig2 = window.showPage;
window.showPage = function (page) {
  syncEmployeeMap();
  _showPageOrig2(page);
  if (page === 'karyawan') setTimeout(renderKaryawanPage, 100);
};

function renderKaryawanPage() {
  const el = $('content');
  if (!el) return;
  el.innerHTML = `
  <div class="top"><div>
    <div class="title">Manajemen Karyawan</div>
    <div class="subtitle">ID, nama, divisi, gaji & status. Perubahan langsung tersimpan ke database</div>
  </div></div>
  <div id="kyBody" style="padding-bottom:120px;"></div>`;
  kyRenderBody();
}

function kyRenderBody() {
  const body = $('kyBody');
  if (!body) return;
  if (!kyMigrated()) {
    body.innerHTML = `
    <div class="panel" style="border-left:4px solid #d97706;">
      <div class="panel-title">Langkah 1: Siapkan Database (sekali saja)</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:10px;">Jalankan SQL berikut di Supabase &gt; SQL Editor, lalu muat ulang aplikasi. Data lama tidak berubah.</p>
      <pre style="font-size:12px;overflow-x:auto;background:var(--input-bg);padding:10px;border-radius:8px;border:1px solid var(--line);">${escapeHtml(KY_SQL)}</pre>
      <button class="btn btn-secondary" style="margin-top:10px;" onclick="navigator.clipboard.writeText(KY_SQL).then(()=>showToast('SQL disalin.'))">Salin SQL</button>
    </div>`;
    return;
  }
  const noId = (DB.masterSalary || []).filter(e => !kyId(e)).length;
  body.innerHTML = `
    ${noId ? `<div class="panel" style="border-left:4px solid #d97706;">
      <div class="panel-title">Langkah 2: Isi Data Awal</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:10px;">${noId} karyawan belum punya ID absen. Tombol ini mengisi ID & nama mesin absen dari daftar lama di app.js (dicocokkan lewat nama), lalu melaporkan yang tidak cocok.</p>
      <button class="btn btn-primary" onclick="kySeed()">Isi Data Awal dari Daftar Lama</button></div>` : ''}
    <div class="panel">
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary" onclick="kyEdit('new')">+ Tambah Karyawan</button>
        <input type="text" placeholder="Cari nama, ID, atau divisi..." value="${escapeHtml(_kyQ)}" oninput="_kyQ=this.value;kyRenderList()" style="padding:12px;border:1px solid var(--line);border-radius:8px;font-size:16px;background:var(--input-bg);color:var(--text);">
        <label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input type="checkbox" ${_kyAll ? 'checked' : ''} onchange="_kyAll=this.checked;kyRenderList()"> Tampilkan yang sudah keluar</label>
      </div>
    </div>
    <div id="kyForm"></div>
    <div id="kyList" style="display:flex;flex-direction:column;gap:8px;"></div>`;
  kyRenderList();
}

function kyRenderList() {
  const box = $('kyList');
  if (!box) return;
  const q = cleanText(_kyQ);
  const list = [...(DB.masterSalary || [])]
    .filter(e => (_kyAll || e.aktif !== false) && (!q || cleanText([e.nama, e.nama_absen, e.no_absen, e.departemen].join(' ')).includes(q)))
    .sort((a, b) => (Number(a.no_absen) || 999) - (Number(b.no_absen) || 999) || String(a.nama).localeCompare(String(b.nama)));
  box.innerHTML = list.length ? list.map(e => {
    const off = e.aktif === false, id = kyId(e);
    return `<div class="panel" style="margin:0;padding:12px;cursor:pointer;${off ? 'opacity:.6;' : ''}" onclick="kyEdit('${e.id}')">
      <div style="display:flex;gap:10px;align-items:center;">
        <div style="min-width:40px;height:40px;border-radius:50%;background:${id ? 'var(--wa-primary)' : '#d97706'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;">${id ? escapeHtml(id) : '?'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;">${escapeHtml(e.nama)}</div>
          <div style="font-size:12px;color:var(--muted);">${escapeHtml(e.departemen || '-')} • mesin: ${escapeHtml(e.nama_absen || '-')}</div>
        </div>
        <span class="badge ${off ? 'badge-danger' : id ? 'badge-success' : 'badge-danger'}">${off ? 'Keluar' : id ? 'Aktif' : 'Belum ada ID'}</span>
      </div></div>`;
  }).join('') : '<div class="panel" style="text-align:center;color:var(--muted);">Tidak ada karyawan.</div>';
}

function kyInput(id, label, value, type = 'text', extra = '') {
  return `<div class="field"><label>${label}</label>
    <input id="${id}" type="${type}" value="${escapeHtml(String(value == null ? '' : value))}" ${extra} style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:15px;background:var(--input-bg);color:var(--text);"></div>`;
}

window.kyEdit = function (id) {
  const isNew = id === 'new';
  const e = isNew ? {} : (DB.masterSalary || []).find(x => String(x.id) === String(id));
  if (!e) return;
  const depts = [...new Set((DB.masterSalary || []).map(x => String(x.departemen || '').trim()).filter(Boolean))];
  const off = e.aktif === false;
  const sel = 'width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:15px;background:var(--input-bg);color:var(--text);';
  $('kyForm').innerHTML = `
  <div class="panel" style="border-left:4px solid var(--wa-primary);">
    <div class="panel-title">${isNew ? 'Tambah Karyawan' : 'Ubah Karyawan'}</div>
    <div class="form-grid">
      ${kyInput('ky_nama', 'Nama Lengkap (slip & laporan)', e.nama)}
      ${kyInput('ky_id', 'ID Absen (nomor di mesin)', kyId(e), 'text', 'inputmode="numeric"')}
      ${kyInput('ky_absen', 'Nama di Mesin Absen', e.nama_absen)}
      ${kyInput('ky_dept', 'Divisi', e.departemen, 'text', 'list="kyDepts"')}
      <datalist id="kyDepts">${depts.map(d => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
      ${KY_FIELDS.map(f => kyInput('ky_' + f, KY_LABEL[f] + ' (Rp)', e[f] || 0, 'number', 'min="0"')).join('')}
      <div class="field"><label>Status</label>
        <select id="ky_aktif" style="${sel}"><option value="1" ${off ? '' : 'selected'}>Aktif</option><option value="0" ${off ? 'selected' : ''}>Sudah keluar</option></select></div>
      ${kyInput('ky_keluar', 'Tanggal Keluar (jika sudah keluar)', e.tgl_keluar ? formatDate(e.tgl_keluar) : '', 'date')}
      <div class="field"><label>Bonus Tambahan Khusus</label>
        <select id="ky_bonus" style="${sel}"><option value="0" ${e.bonus_khusus ? '' : 'selected'}>Tidak</option><option value="1" ${e.bonus_khusus ? 'selected' : ''}>Ya (nominal di Pengaturan Sistem)</option></select></div>
    </div>
    <div class="actions" style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-primary" onclick="kySave('${isNew ? 'new' : e.id}')">Simpan</button>
      <button class="btn btn-secondary" onclick="$('kyForm').innerHTML=''">Batal</button>
    </div>
  </div>`;
  $('kyForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.kySave = async function (id) {
  const isNew = id === 'new';
  const old = isNew ? null : (DB.masterSalary || []).find(x => String(x.id) === String(id));
  const v = k => $(k).value.trim();
  const nama = v('ky_nama').toUpperCase(), noAbsen = v('ky_id');
  const aktif = $('ky_aktif').value === '1';
  if (!nama) { showToast('Nama wajib diisi.'); return; }
  if (!noAbsen) { showToast('ID absen wajib diisi.'); return; }

  const others = (DB.masterSalary || []).filter(e => !old || e.id !== old.id);
  if (aktif) {
    const clash = others.find(e => e.aktif !== false && kyId(e) === noAbsen);
    if (clash) { showToast(`ID ${noAbsen} sedang dipakai ${clash.nama}.`); return; }
    const sameName = others.find(e => e.aktif !== false && cleanText(e.nama) === cleanText(nama));
    if (sameName) { showToast('Sudah ada karyawan aktif dengan nama itu.'); return; }
  }
  const notes = [];
  const prevHolder = aktif && others.find(e => e.aktif === false && kyId(e) === noAbsen);
  if (prevHolder) notes.push(`• ID ${noAbsen} pernah dipakai ${prevHolder.nama}. Absensi lama ID ini akan terbaca atas nama karyawan ini.`);
  const idChanged = old && kyId(old) && kyId(old) !== noAbsen;
  const nameChanged = old && old.nama !== nama;
  if (idChanged) notes.push(`• ID berubah ${kyId(old)} → ${noAbsen}: ${(DB.attendance || []).filter(a => String(a.no_absen).trim() === kyId(old)).length} baris absensi ikut diperbarui.`);
  if (nameChanged) notes.push(`• Nama berubah: ${(DB.advances || []).filter(a => a.nama === old.nama).length} kasbon & ${(DB.installments || []).filter(a => a.nama === old.nama).length} cicilan ikut diperbarui.`);
  if (notes.length && !confirm('Perhatian:\n\n' + notes.join('\n') + '\n\nLanjutkan?')) return;

  const payload = {
    nama, no_absen: noAbsen, nama_absen: (v('ky_absen') || nama).toUpperCase(), departemen: v('ky_dept'),
    aktif, tgl_keluar: aktif ? null : (v('ky_keluar') || today()), bonus_khusus: $('ky_bonus').value === '1'
  };
  KY_FIELDS.forEach(f => { payload[f] = Number($('ky_' + f).value || 0); });

  const res = isNew
    ? await db.from('master_salary').insert([payload])
    : await db.from('master_salary').update(payload).eq('id', old.id);
  if (res.error) { showToast('Gagal: ' + res.error.message); return; }

  // Rambatkan perubahan ke tabel lain di Supabase
  const warn = [];
  if (nameChanged) {
    for (const t of ['advances', 'installments']) {
      const r = await db.from(t).update({ nama }).eq('nama', old.nama);
      if (r.error) warn.push(`${t}: ${r.error.message}`);
    }
  }
  if (idChanged) {
    const r = await db.from('attendance').update({ no_absen: noAbsen }).eq('no_absen', kyId(old));
    if (r.error) warn.push(`attendance: ${r.error.message}`);
  }
  if (warn.length) alert('Data karyawan tersimpan, tetapi sebagian pembaruan terkait gagal:\n\n' + warn.join('\n'));
  showToast('Data karyawan disimpan.');
  loadData('karyawan');
};

// ---------- Isi data awal dari daftar lama ----------
window.kySeed = async function () {
  const rows = DB.masterSalary || [];
  let ok = 0;
  const miss = [];
  for (const [id, v] of Object.entries(EMP_MAP_ORIGINAL)) {
    const free = rows.filter(e => !kyId(e));
    const emp = free.find(e => cleanText(e.nama) === cleanText(v.masterName))
      || free.find(e => cleanText(e.nama) === cleanText(v.absenName));
    if (!emp) { if (!rows.some(e => kyId(e) === id)) miss.push(`ID ${id}: ${v.masterName}`); continue; }
    const { error } = await db.from('master_salary')
      .update({ no_absen: id, nama_absen: v.absenName, aktif: true, bonus_khusus: id === '22' })
      .eq('id', emp.id);
    if (error) { alert('Gagal mengisi data awal: ' + error.message); return; }
    emp.no_absen = id; // agar pencocokan berikutnya tidak memakai baris yang sama
    ok++;
  }
  const left = rows.filter(e => !kyId(e)).map(e => e.nama);
  alert(`${ok} karyawan terisi.` +
    (miss.length ? `\n\nDi daftar lama tapi tidak ada di data gaji (tambahkan manual jika masih bekerja):\n${miss.join('\n')}` : '') +
    (left.length ? `\n\nData gaji yang belum punya ID (isi lewat Ubah Karyawan):\n${left.join('\n')}` : ''));
  loadData('karyawan');
};
