/* =====================================================================
   FITUR LAPORAN HARIAN - Sari Kedele Subang
   File terpisah. Muat SETELAH app.js (dan fitur_pengeluaran.js):

     <script src="app.js"></script>
     <script src="fitur_pengeluaran.js"></script>
     <script src="fitur_laporan_harian.js"></script>   <!-- file ini -->

   Halaman memakai ulang loadReport() dan loadExpenseReport() milik app.js,
   jadi tampilan gambar laporan SAMA persis dengan yang sekarang.
   ===================================================================== */

const LH_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const LH_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let _lhFiles = null, _lhGen = 0;

// "LAPORAN KEUANGAN HARIAN *Jumat, 2 Oktober 2026*"  (tanda * = tebal di WhatsApp)
function lhCaption(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `LAPORAN KEUANGAN HARIAN *${LH_HARI[d.getDay()]}, ${d.getDate()} ${LH_BULAN[d.getMonth()]} ${d.getFullYear()}*`;
}

function renderLaporanHarian() {
  const el = $('content');
  if (!el) return;
  const inputStyle = 'padding:12px;border:1px solid var(--line);border-radius:8px;font-size:16px;background:var(--input-bg);color:var(--text);';
  el.innerHTML = `
  <div class="top">
    <div>
      <div class="title">Laporan Harian</div>
      <div class="subtitle">Pendapatan & Pengeluaran, siap dibagikan</div>
    </div>
  </div>
  <div class="panel">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <label style="font-weight:700;">Pilih Tanggal Laporan:</label>
      <input type="date" id="lhDate" value="${today()}" onchange="lhLoad()" style="${inputStyle}">
      <input type="hidden" id="reportDate">
      <input type="hidden" id="expenseReportDate">
      <div id="lhStatus" style="font-size:13px;line-height:1.7;"></div>
      <button class="btn btn-success" id="lhShareBtn" onclick="lhShare()" disabled>Menyiapkan gambar...</button>
      <button class="btn btn-secondary" onclick="lhDownload()"><i class="fa-solid fa-download"></i> Unduh Kedua Gambar</button>
    </div>
  </div>
  <div class="panel">
    <div class="panel-title">Laporan Pendapatan</div>
    <div id="reportResult"></div>
  </div>
  <div class="panel" style="padding-bottom:120px;">
    <div class="panel-title">Laporan Pengeluaran</div>
    <div id="expenseReportResult"></div>
  </div>`;
  lhLoad();
}

async function lhLoad() {
  const date = $('lhDate')?.value;
  if (!date) return;
  $('reportDate').value = date;
  $('expenseReportDate').value = date;
  loadReport();
  loadExpenseReport();

  // Status kelengkapan data hari itu
  const has = list => (list || []).some(r => normalizeDate(r.tanggal) === date);
  const nExp = (DB.expenses || []).filter(r => normalizeDate(r.tanggal) === date).length;
  $('lhStatus').innerHTML = [['ESB', has(DB.sales)], ['Konter', has(DB.counter)], ['Posisi Kas', has(DB.cash)]]
    .map(([n, ok]) => `<span style="margin-right:12px;white-space:nowrap;color:${ok ? 'var(--success)' : 'var(--danger)'};">${ok ? '✓' : '✗'} ${n}</span>`)
    .join('') + `<span style="white-space:nowrap;">• ${nExp} item pengeluaran</span>`;

  // Siapkan gambar di latar belakang supaya tombol Bagikan langsung bekerja saat diketuk
  const btn = $('lhShareBtn');
  btn.disabled = true;
  btn.textContent = 'Menyiapkan gambar...';
  _lhFiles = null;
  const gen = ++_lhGen;
  try {
    await new Promise(r => setTimeout(r, 80));
    const files = [];
    for (const [id, prefix] of [['captureDailyReport', 'LAPORAN_PENDAPATAN_'], ['captureExpenseReport', 'LAPORAN_PENGELUARAN_']]) {
      const target = $(id);
      if (!target || gen !== _lhGen) return;
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      files.push(new File([blob], prefix + date + '.png', { type: 'image/png' }));
    }
    if (gen !== _lhGen) return;
    _lhFiles = files;
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Bagikan ke WhatsApp';
  } catch (err) {
    console.error(err);
    if ($('lhShareBtn')) $('lhShareBtn').textContent = 'Gagal menyiapkan gambar, pilih ulang tanggal';
  }
}

function lhShare() {
  if (!_lhFiles) { showToast('Gambar belum siap.'); return; }
  const caption = lhCaption($('lhDate').value);
  // Salin caption (cadangan jika WhatsApp tidak menampilkannya). Tanpa await agar izin share tetap valid.
  if (navigator.clipboard) navigator.clipboard.writeText(caption).catch(() => {});

  if (navigator.canShare && navigator.canShare({ files: _lhFiles })) {
    navigator.share({ files: _lhFiles, text: caption })
      .then(() => showToast('Caption juga sudah disalin. Tempel jika tidak muncul di WhatsApp.'))
      .catch(e => { if (e.name !== 'AbortError') showToast('Gagal membagikan: ' + e.message); });
  } else {
    lhDownload();
    showToast('Perangkat tidak mendukung bagikan langsung. Gambar diunduh, caption disalin.');
  }
}

function lhDownload() {
  if (!_lhFiles) { showToast('Gambar belum siap.'); return; }
  _lhFiles.forEach((f, i) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, i * 400));
}

// Daftarkan halaman baru ke navigasi yang sudah ada
const _showPageOrig = window.showPage;
window.showPage = function (page) {
  _showPageOrig(page);
  if (page === 'laporan_harian') setTimeout(renderLaporanHarian, 100);
};
