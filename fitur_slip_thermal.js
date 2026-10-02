/* =====================================================================
   FITUR CETAK SLIP GAJI - PRINTER THERMAL (struk 58mm / 80mm)
   File terpisah. Muat SETELAH app.js:
     <script src="app.js"></script>
     <script src="fitur_slip_thermal.js"></script>

   Menambah di Daftar Gaji > Cetak Slip PDF:
   - pilihan lebar kertas + tombol "Cetak Semua Slip (Thermal)"
   - ikon cetak di pojok tiap slip untuk mencetak satu karyawan
   Memakai dialog cetak browser, jadi printer apa pun yang terpasang
   (USB di komputer, atau Bluetooth di HP lewat aplikasi RawBT) bisa dipakai.
   Slip PDF A4 yang lama tidak berubah.
   ===================================================================== */

const THERMAL_KEY = 'subang_thermal_w';

function thermalWidth() { return localStorage.getItem(THERMAL_KEY) === '80' ? '80' : '58'; }

function thermalSlipHtml(emp, periodMonth, printDate) {
  const fmt = n => (n < 0 ? '-' : '') + formatNum(Math.abs(n));
  const row = (label, val, force) => (val || force)
    ? `<div class="r"><span>${label}</span><span>${fmt(val)}</span></div>` : '';
  const totalPendapatan = emp.pokok + emp.jabatan + emp.prestasi + emp.kesehatan + emp.jamKerja + emp.zakat + emp.loyalitas + emp.lainLain;
  const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;
  return `
  <div class="slip">
    <div class="c b">RUMAH MAKAN TAHU SUMEDANG</div>
    <div class="c b">SARI KEDELE</div>
    <div class="c s">UNIT SUBANG</div>
    <div class="hr"></div>
    <div class="c b">SLIP GAJI ${escapeHtml(periodMonth)}</div>
    <div class="hr"></div>
    <div class="r"><span>Nama</span><span class="b">${escapeHtml(emp.nama)}</span></div>
    <div class="r"><span>Posisi</span><span>${escapeHtml(emp.departemen || '-')}</span></div>
    <div class="hr"></div>
    <div class="b">PENDAPATAN (Rp)</div>
    ${row('Gaji Pokok', emp.pokok, true)}
    ${row('Jabatan', emp.jabatan)}
    ${row('Prestasi', emp.prestasi)}
    ${row('Kesehatan', emp.kesehatan)}
    ${row('Jam Kerja', emp.jamKerja)}
    ${row('Zakat', emp.zakat)}
    ${row('Kebersihan/Loyalitas', emp.loyalitas)}
    ${row('Lain-lain', emp.lainLain)}
    <div class="r b top"><span>Jumlah</span><span>${fmt(totalPendapatan)}</span></div>
    ${totalPotongan ? `
    <div class="b" style="margin-top:4px;">POTONGAN (Rp)</div>
    ${row('Kasbon', emp.kasbon)}
    ${row('BPJS', emp.bpjs)}
    ${row('Cicilan', emp.cicilan)}
    <div class="r b top"><span>Jumlah</span><span>${fmt(totalPotongan)}</span></div>` : ''}
    <div class="hr dbl"></div>
    <div class="r b big"><span>GAJI DITERIMA</span><span>Rp ${fmt(emp.gajiBersih)}</span></div>
    <div class="hr dbl"></div>
    <div class="c s" style="margin-top:3px;">${escapeHtml(printDate)}</div>
  </div>`;
}

window.thermalPrintSlips = function (idx) {
  const sDate = $('slipStartDate')?.value;
  const eDate = $('slipEndDate')?.value;
  const fDept = $('slipFilterDept')?.value || 'ALL';
  const printDate = $('slipPrintDate')?.value || '';
  let list = getCalculatedPayrollList(sDate, eDate, fDept);
  if (typeof idx === 'number') list = list.slice(idx, idx + 1);
  if (!list.length) { showToast('Tidak ada slip untuk dicetak.'); return; }

  const periodMonth = sDate
    ? new Date(sDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase() : '';
  const w = thermalWidth();
  const contentMm = w === '80' ? 72 : 48;
  const fs = w === '80' ? 13 : 11;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Slip Gaji</title>
  <style>
    @page { size: ${w}mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .slip { width: ${contentMm}mm; margin: 0 auto; padding: 3mm 0 12mm; font-size: ${fs}px; line-height: 1.3; page-break-after: always; }
    .slip:last-child { page-break-after: auto; }
    .c { text-align: center; } .b { font-weight: 800; } .s { font-size: ${fs - 2}px; }
    .r { display: flex; justify-content: space-between; gap: 6px; margin: 1px 0; }
    .r span:first-child { flex: 1; } .r span:last-child { text-align: right; white-space: nowrap; }
    .hr { border-top: 1px dashed #000; margin: 4px 0; } .hr.dbl { border-top: 2px solid #000; }
    .top { border-top: 1px dashed #000; margin-top: 2px; padding-top: 2px; }
    .big { font-size: ${fs + 2}px; }
  </style></head><body>
  ${list.map(e => thermalSlipHtml(e, periodMonth, printDate)).join('')}
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('Pop-up diblokir. Izinkan pop-up untuk situs ini lalu coba lagi.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = () => win.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
};

// Tombol & pilihan lebar kertas di tab "Cetak Slip PDF"
const _showPayrollSubOrig = window.showPayrollSub;
window.showPayrollSub = function (type) {
  _showPayrollSubOrig(type);
  if (type !== 'slips') return;
  const pdfBtn = document.querySelector('button[onclick="exportSlipsToPDF()"]');
  if (!pdfBtn) return;
  pdfBtn.insertAdjacentHTML('afterend', `
    <div style="display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px dashed var(--line);">
      <label style="font-size:13px;font-weight:700;">Printer Thermal - Lebar Kertas:</label>
      <select id="thermalWidth" onchange="localStorage.setItem('${THERMAL_KEY}', this.value)" style="padding:12px;border:1px solid var(--line);border-radius:8px;width:100%;background:var(--input-bg);color:var(--text);">
        <option value="58">58 mm (struk kecil)</option>
        <option value="80">80 mm (struk besar)</option>
      </select>
      <button class="btn btn-secondary" onclick="thermalPrintSlips()">🖨️ Cetak Semua Slip (Thermal)</button>
      <div style="font-size:11.5px;color:var(--muted);">Atau ketuk ikon 🖨️ di pojok kanan atas tiap slip untuk mencetak satu karyawan.</div>
    </div>`);
  $('thermalWidth').value = thermalWidth();
};

// Ikon cetak per slip (diabaikan saat slip diekspor ke PDF)
const _renderSlipPagesOrig = window.renderSlipPages;
window.renderSlipPages = function () {
  _renderSlipPagesOrig();
  document.querySelectorAll('#slipPrintContainer .slip-card').forEach((card, i) => {
    card.style.position = 'relative';
    card.insertAdjacentHTML('beforeend',
      `<button type="button" data-html2canvas-ignore="true" onclick="thermalPrintSlips(${i})" aria-label="Cetak thermal" style="position:absolute;top:4px;right:4px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 6px;font-size:12px;cursor:pointer;">🖨️</button>`);
  });
};
