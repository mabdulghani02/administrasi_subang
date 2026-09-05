const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let DB = {
  sales: [],
  counter: [],
  expenses: [],
  cash: [],
  attendance: [],
  advances: [],
  installments: [],
  masterSalary: []
};

const STANDARD_WORK_HOURS = 11;
const RATE_PER_HOUR = 5000;
let DEFAULT_ALLOWANCE = 15000;
let DEFAULT_BONUS_LAIN = 40000;

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('subang_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
});

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('subang_theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = $('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

function toggleSidebar() {
  const sb = $('appSidebar');
  const ov = $('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('active');
}

const $ = id => document.getElementById(id);

function money(value) {
  const number = Number(value || 0);
  return (number < 0 ? '-Rp ' : 'Rp ') + Math.abs(number).toLocaleString('id-ID');
}

function formatNum(value) {
  const number = Number(value || 0);
  return number === 0 ? '-' : number.toLocaleString('id-ID');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return str.split('T')[0];
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatDate(value) {
  return normalizeDate(value);
}

function parseTimeMinutes(timeVal) {
  if (!timeVal) return null;
  const match = String(timeVal).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return { h, m, totalMins: h * 60 + m, formatted: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

function classifyShift(timeStr) {
  const parsed = parseTimeMinutes(timeStr);
  if (!parsed) return { shift: 'Tidak Scan', batas: '-', onTime: false, displayTime: '-' };
  const mins = parsed.totalMins;
  if (mins >= 210 && mins <= 310) return { shift: 'Pagi', batas: '05:10', onTime: true, displayTime: parsed.formatted };
  if (mins >= 450 && mins <= 610) return { shift: 'Middle', batas: '10:10', onTime: true, displayTime: parsed.formatted };
  if (mins > 610 && mins <= 670) return { shift: 'Siang', batas: '11:10', onTime: true, displayTime: parsed.formatted };
  return { shift: 'Lainnya', batas: '-', onTime: false, displayTime: parsed.formatted };
}

function calculateHours(masukStr, pulangStr) {
  const p1 = parseTimeMinutes(masukStr);
  const p2 = parseTimeMinutes(pulangStr);
  if (!p1 || !p2) return 0;
  let t1 = p1.totalMins;
  let t2 = p2.totalMins;
  if (t2 < t1) t2 += 24 * 60;
  const totalMins = t2 - t1;
  return totalMins > 0 ? (totalMins / 60) : 0;
}

function sum(values) { return values.reduce((t, v) => t + Number(v || 0), 0); }
function totalESB(data) { return Number(data.makanan || 0) + Number(data.minuman || 0) + Number(data.tahu || 0) + Number(data.gorengan || 0) + Number(data.lain_lain || 0) + Number(data.pajak || 0); }
function totalCounter(data) { return Number(data.cash || 0) + Number(data.debit_card || 0) + Number(data.grab || 0) + Number(data.qris || 0); }

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function downloadElementAsImage(elementId, filename) {
  const target = $(elementId);
  if (!target) { showToast('Area laporan tidak ditemukan.'); return; }
  showToast('Sedang membuat gambar...');

  html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    .then(canvas => {
      const link = document.createElement('a');
      link.download = filename + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Gambar berhasil diunduh.');
    }).catch(err => { console.error(err); showToast('Gagal mengubah ke gambar.'); });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadData(targetPage = null) {
  showToast('Memuat data dari Cloud...');
  try {
    const [sRes, cRes, eRes, cashRes, attRes, advRes, mRes, iRes] = await Promise.all([
      db.from('sales').select('*'),
      db.from('counter').select('*'),
      db.from('expenses').select('*'),
      db.from('cash_positions').select('*'),
      db.from('attendance').select('*'),
      db.from('advances').select('*'),
      db.from('master_salary').select('*'),
      db.from('installments').select('*')
    ]);

    if (sRes.error) throw sRes.error;
    if (cRes.error) throw cRes.error;

    DB.sales = sRes.data || [];
    DB.counter = cRes.data || [];
    DB.expenses = eRes.data || [];
    DB.cash = cashRes.data || [];
    DB.attendance = attRes.data || [];
    DB.advances = advRes.data || [];
    DB.masterSalary = mRes.data || [];
    DB.installments = iRes.data || [];

    showPage(targetPage || 'dashboard');
  } catch (error) {
    console.error(error);
    showToast('Gagal mengambil data dari Supabase: ' + error.message);
  }
}

function showPage(page) {
  document.querySelectorAll('.nav button, .b-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  $('appSidebar').classList.remove('open');
  $('sidebarOverlay').classList.remove('active');

  if (page === 'dashboard') renderDashboard();
  if (page === 'sales') renderSales();
  if (page === 'expense') renderExpense();
  if (page === 'attendance') renderAttendancePage();
  if (page === 'payroll') renderPayrollPage();
}

window.calcExpRow = function(el) {
  const tr = el.closest('tr');
  const q = Number(tr.querySelector('.exp-qty').value || 0);
  const h = Number(tr.querySelector('.exp-harga').value || 0);
  tr.querySelector('.exp-nominal').value = q * h;
};

/* ========================================
   DASHBOARD & EXPORT BULANAN
======================================== */
function renderDashboard() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  $('content').innerHTML = `
    <div class="top">
      <div>
        <div class="title">Dashboard Keuangan</div>
        <div class="subtitle">Sari Kedele - Subang</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 13px; font-weight: 700; color: var(--muted);">Pilih Bulan Rekapitulasi:</label>
        <input type="month" id="dashboardMonth" value="${currentMonth}" onchange="updateDashboardMetrics(this.value)" style="padding: 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 16px; width: 100%; background: var(--card); color: var(--text);">
        <button class="btn btn-success" onclick="exportMonthlyExcel()" style="padding: 12px; margin-top: 5px; background: #059669;"><i class="fa-solid fa-file-excel"></i> Download Excel Bulanan</button>
      </div>
    </div>

    <div class="cards">
      <div class="card card-green">
        <div class="card-label">Omset Konter Bulan Ini</div>
        <div class="card-value" id="cardOmset">Rp 0</div>
      </div>
      <div class="card card-danger">
        <div class="card-label">Pengeluaran Bulan Ini</div>
        <div class="card-value" id="cardExpense">Rp 0</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Aksi Cepat</div>
      <div class="icon-grid">
        <div class="icon-btn" onclick="showPage('sales')"><i class="fa-solid fa-wallet"></i><span>Pendapatan</span></div>
        <div class="icon-btn" onclick="showPage('expense')"><i class="fa-solid fa-receipt"></i><span>Pengeluaran</span></div>
        <div class="icon-btn" onclick="showPage('attendance')"><i class="fa-solid fa-user-clock"></i><span>Absensi</span></div>
        <div class="icon-btn" onclick="showPage('payroll')"><i class="fa-solid fa-file-invoice-dollar"></i><span>Gaji</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Grafik Tren Omset Bulan Ini</div>
      <div class="chart-container">
        <canvas id="monthlySalesChart"></canvas>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Akumulasi Penjualan Berdasarkan Kategori</div>
      <div class="chart-container">
        <canvas id="categorySalesChart"></canvas>
      </div>
    </div>
  `;

  updateDashboardMetrics(currentMonth);
}

let monthlyChartInstance = null;
let categoryChartInstance = null;

function updateDashboardMetrics(yearMonth) {
  const [targetYear, targetMonth] = yearMonth.split('-');

  const monthCounters = (DB.counter || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));
  const monthExpenses = (DB.expenses || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));
  const monthSales = (DB.sales || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));

  $('cardOmset').textContent = money(sum(monthCounters.map(r => totalCounter(r))));
  $('cardExpense').textContent = money(sum(monthExpenses.map(r => r.nominal)));

  let sumMakanan = 0, sumMinuman = 0, sumTahu = 0, sumGorengan = 0, sumLain = 0;
  monthSales.forEach(s => {
    sumMakanan += Number(s.makanan || 0);
    sumMinuman += Number(s.minuman || 0);
    sumTahu += Number(s.tahu || 0);
    sumGorengan += Number(s.gorengan || 0);
    sumLain += Number(s.lain_lain || 0);
  });

  const ctxMonthly = document.getElementById('monthlySalesChart');
  if (ctxMonthly) {
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const labels = [];
    const dataOmset = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
      labels.push(String(day));
      const match = monthCounters.find(r => formatDate(r.tanggal) === dayStr);
      dataOmset.push(match ? totalCounter(match) : 0);
    }

    monthlyChartInstance = new Chart(ctxMonthly, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'Omset Harian (Rp)', data: dataOmset, borderColor: '#00a884', backgroundColor: 'rgba(0, 168, 132, 0.1)', fill: true, tension: 0.2 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctxCategory = document.getElementById('categorySalesChart');
  if (ctxCategory) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCategory, {
      type: 'bar',
      data: {
        labels: ['Makanan', 'Minuman', 'Tahu', 'Gorengan', 'Lain-lain'],
        datasets: [{ label: 'Akumulasi (Rp)', data: [sumMakanan, sumMinuman, sumTahu, sumGorengan, sumLain], backgroundColor: ['#e11d48', '#0284c7', '#f59e0b', '#00a884', '#64748b'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

async function exportMonthlyExcel() {
  if (typeof ExcelJS === 'undefined') {
    showToast('Library ExcelJS belum dimuat. Tambahkan script CDN di HTML.');
    return;
  }
  
  showToast('Sedang merakit file Excel Multi-Sheet...');
  try {
    const yearMonth = $('dashboardMonth').value; 
    const [y, mStr] = yearMonth.split('-');
    const mNames = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const monthName = mNames[parseInt(mStr, 10) - 1];

    const wb = new ExcelJS.Workbook();
    const titleFont = { bold: true, size: 12 };
    const headerFont = { bold: true };

    // 1. SUMMARY
    const shSum = wb.addWorksheet('SUMMARY');
    shSum.getCell('B1').value = `LAPORAN KEUANGAN SARI KEDELE CABANG SUBANG ${monthName} ${y}`;
    shSum.getCell('B1').font = titleFont;

    // 2. OMSET
    const shOmset = wb.addWorksheet('OMSET');
    shOmset.getCell('B2').value = 'OMSET HARIAN UNIT SUBANG';
    shOmset.getCell('B2').font = titleFont;
    shOmset.getRow(3).values = [null, 'No.', 'TANGGAL', 'CASH', 'CARD', 'QRIS', 'GRAB', 'PAJAK'];
    shOmset.getRow(3).font = headerFont;
    
    const salesFilter = DB.sales.filter(r => formatDate(r.tanggal).startsWith(yearMonth));
    salesFilter.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
    
    let rowIdx = 4;
    let totalCash = 0, totalCard = 0, totalQris = 0, totalGrab = 0, totalPajak = 0;
    
    salesFilter.forEach((s, idx) => {
      const dateObj = new Date(formatDate(s.tanggal));
      shOmset.getRow(rowIdx).values = [
        null, idx + 1, dateObj, Number(s.cash||0), Number(s.debit_card||0), Number(s.qris||0), Number(s.grab||0), Number(s.pajak||0)
      ];
      totalCash += Number(s.cash||0);
      totalCard += Number(s.debit_card||0);
      totalQris += Number(s.qris||0);
      totalGrab += Number(s.grab||0);
      totalPajak += Number(s.pajak||0);
      rowIdx++;
    });
    shOmset.getRow(rowIdx).values = [null, '', 'TOTAL', totalCash, totalCard, totalQris, totalGrab, totalPajak];
    shOmset.getRow(rowIdx).font = headerFont;

    // Filter expenses untuk 4 sheet terpisah
    const expFilter = DB.expenses.filter(r => formatDate(r.tanggal).startsWith(yearMonth));
    const expPasar = expFilter.filter(r => r.kategori === 'PASAR');
    const expCikuda = expFilter.filter(r => r.kategori === 'CIKUDA');
    const expSkf = expFilter.filter(r => r.kategori === 'SKF');
    const expLain = expFilter.filter(r => r.kategori === 'LAIN-LAIN' || !r.kategori);

    // 3. PEMBELANJAAN PASAR (DIPECAH MENJADI SUB-TABEL OTOMATIS)
    const shPasar = wb.addWorksheet('PEMBELANJAAN PASAR');
    shPasar.getCell('B1').value = 'Lampiran 5';
    shPasar.getCell('B3').value = 'PEMBELANJAAN ALAT DAN BAHAN BAKU';
    
    const sumPasar = sum(expPasar.map(r => r.nominal));
    shPasar.getCell('B5').value = 'TOTAL';
    shPasar.getCell('D5').value = sumPasar;
    shPasar.getCell('B5').font = headerFont;
    shPasar.getCell('D5').font = headerFont;

    rowIdx = 7;
    // Mengelompokkan item pasar berdasarkan sub_kategori yang diketik
    const groupedPasar = {};
    expPasar.forEach(ex => {
      const groupName = (ex.sub_kategori || 'LAINNYA').trim().toUpperCase();
      if (!groupedPasar[groupName]) groupedPasar[groupName] = [];
      groupedPasar[groupName].push(ex);
    });

    for (const [groupName, items] of Object.entries(groupedPasar)) {
      shPasar.getCell(`H${rowIdx}`).value = groupName;
      shPasar.getCell(`H${rowIdx}`).font = headerFont;
      rowIdx++;

      shPasar.getRow(rowIdx).values = [null, 'NO', 'TANGGAL', 'JENIS BARANG', 'QTY', 'SATUAN', 'HARGA SATUAN', 'JUMLAH (Rp)'];
      shPasar.getRow(rowIdx).font = headerFont;
      rowIdx++;

      let subtotalGroup = 0;
      items.forEach((ex, i) => {
        shPasar.getRow(rowIdx++).values = [null, i+1, ex.tanggal, ex.sumber, Number(ex.qty||1), ex.satuan||'PCS', Number(ex.harga_satuan||ex.nominal), Number(ex.nominal)];
        subtotalGroup += Number(ex.nominal);
      });

      shPasar.getCell(`H${rowIdx}`).value = subtotalGroup;
      shPasar.getCell(`H${rowIdx}`).font = headerFont;
      rowIdx += 2; 
    }

    // 4. PEMBELANJAAN CIKUDA
    const shCikuda = wb.addWorksheet('PEMBELANJAAN CIKUDA');
    shCikuda.getCell('B1').value = 'Lampiran 6';
    shCikuda.getRow(5).values = [null, 'No', 'Tanggal', 'Nama Barang', 'QTT', 'Harga', 'Total'];
    shCikuda.getRow(5).font = headerFont;
    rowIdx = 6;
    let sumCikuda = 0;
    expCikuda.forEach((ex, i) => {
      shCikuda.getRow(rowIdx++).values = [null, i+1, ex.tanggal, ex.sumber, Number(ex.qty||1), Number(ex.harga_satuan||ex.nominal), Number(ex.nominal)];
      sumCikuda += Number(ex.nominal);
    });

    // 5. PEMBELANJAN SKF
    const shSkf = wb.addWorksheet('PEMBELANJAN SKF');
    shSkf.getCell('B3').value = 'Pembelanjaan dari SKF';
    shSkf.getRow(5).values = [null, 'NO', 'TANGGAL', 'KETERANGAN', 'QTY', 'JUMLAH SATUAN', 'TOTAL'];
    shSkf.getRow(5).font = headerFont;
    rowIdx = 6;
    let sumSkf = 0;
    expSkf.forEach((ex, i) => {
      shSkf.getRow(rowIdx++).values = [null, i+1, ex.tanggal, ex.sumber, Number(ex.qty||1), Number(ex.harga_satuan||ex.nominal), Number(ex.nominal)];
      sumSkf += Number(ex.nominal);
    });

    // 6. LAIN-LAIN
    const shLain = wb.addWorksheet('LAIN-LAIN');
    shLain.getCell('C1').value = 'Lampiran 8';
    shLain.getCell('C2').value = 'PENGELUARAN ALAT DAN LAIN-LAIN';
    shLain.getCell('C3').value = 'TOTAL';
    const sumLain = sum(expLain.map(r => r.nominal));
    shLain.getCell('H3').value = sumLain;
    
    shLain.getRow(4).values = [null, null, null, 'NO', 'TANGGAL', 'JENIS BARANG', 'QTY', 'SATUAN', 'HARGA SATUAN', 'JUMLAH (Rp)'];
    shLain.getRow(4).font = headerFont;
    rowIdx = 5;
    expLain.forEach((ex, i) => {
      shLain.getRow(rowIdx++).values = [null, null, null, i+1, ex.tanggal, ex.sumber, Number(ex.qty||1), ex.satuan||'PCS', Number(ex.harga_satuan||ex.nominal), Number(ex.nominal)];
    });

    // 7. GAJI KARYAWAN
    const shGaji = wb.addWorksheet('GAJI KARYAWAN');
    shGaji.getCell('B1').value = 'Lampiran 7';
    shGaji.getCell('B2').value = 'GAJI KARYAWAN';
    shGaji.getCell('B3').value = 'TOTAL GAJI KARYAWAN';
    
    const lastD = new Date(y, parseInt(mStr, 10), 0).getDate();
    const sDate = `${yearMonth}-01`;
    const eDate = `${yearMonth}-${String(lastD).padStart(2, '0')}`;
    const payroll = getCalculatedPayrollList(sDate, eDate, 'ALL');
    
    const sumGaji = sum(payroll.map(p => p.gajiBersih));
    shGaji.getCell('E3').value = sumGaji;
    shGaji.getCell('E3').font = headerFont;
    
    shGaji.getCell('B5').value = 'GAJI BULANAN';
    shGaji.getRow(6).values = [null, 'NO', 'Nama Pegawai', 'GAJI POKOK', 'Tunjangan', null, null, null, null, null, null, 'TOTAL GAJI', 'Potongan', null, null, 'Gaji Bersih'];
    shGaji.getRow(6).font = headerFont;
    
    rowIdx = 7;
    payroll.forEach((p, i) => {
      const tunjangan = p.jabatan + p.prestasi + p.kesehatan + p.jamKerja + p.zakat + p.loyalitas + p.lainLain;
      const potongan = p.kasbon + p.bpjs + p.cicilan;
      shGaji.getRow(rowIdx++).values = [null, i+1, p.nama, p.pokok, tunjangan, null, null, null, null, null, null, p.pokok + tunjangan, potongan, null, null, p.gajiBersih];
    });

    // PENGISIAN TOTAL KE SUMMARY
    shSum.getCell('B3').value = 'TOTAL OMSET';
    shSum.getCell('C3').value = totalCash + totalCard + totalQris + totalGrab;
    shSum.getCell('B4').value = 'PENGELUARAN PASAR';
    shSum.getCell('C4').value = sumPasar;
    shSum.getCell('B5').value = 'PENGELUARAN CIKUDA';
    shSum.getCell('C5').value = sumCikuda;
    shSum.getCell('B6').value = 'PENGELUARAN SKF';
    shSum.getCell('C6').value = sumSkf;
    shSum.getCell('B7').value = 'PENGELUARAN LAIN-LAIN';
    shSum.getCell('C7').value = sumLain;
    shSum.getCell('B8').value = 'GAJI KARYAWAN';
    shSum.getCell('C8').value = sumGaji;

    const totalPengeluaranAll = sumPasar + sumCikuda + sumSkf + sumLain + sumGaji;
    shSum.getCell('B10').value = 'SISA/PROFIT';
    shSum.getCell('C10').value = (totalCash + totalCard + totalQris + totalGrab) - totalPengeluaranAll;
    
    // PEMBUATAN FILE UNDUHAN
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LAPORAN_KEUANGAN_SUBANG_${monthName}_${y}.xlsx`;
    link.click();
    
    showToast('Excel berhasil diunduh!');
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat Excel: ' + err.message);
  }
}

/* ========================================
   MODUL PENDAPATAN
======================================== */
function renderSales() {
  $('content').innerHTML = `
    <div class="top">
      <div><div class="title">Modul Pendapatan</div></div>
      <div style="display:flex; gap:8px;">
        <button id="subBtnInput" class="sub-nav-btn active-sub" onclick="showSalesSub('input')">Input Data</button>
        <button id="subBtnReport" class="sub-nav-btn" onclick="showSalesSub('report')">Laporan Harian</button>
      </div>
    </div>
    <div id="salesSubContent"></div>
  `;
  showSalesSub('input');
}

function showSalesSub(type) {
  const container = $('salesSubContent');
  if (!container) return;

  const btnIn = $('subBtnInput');
  const btnRep = $('subBtnReport');
  if (btnIn && btnRep) {
    btnIn.classList.toggle('active-sub', type === 'input');
    btnRep.classList.toggle('active-sub', type === 'report');
  }

  if (type === 'input') {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">PENDAPATAN ESB</div>
        <form id="salesForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', today(), 'date')}
            ${inputField('makanan', 'Makanan', 0)}
            ${inputField('minuman', 'Minuman', 0)}
            ${inputField('tahu', 'Tahu', 0)}
            ${inputField('gorengan', 'Gorengan', 0)}
            ${inputField('lain_lain', 'Lain-lain', 0)}
            ${inputField('pajak', 'Pajak', 0)}
            ${inputField('cash', 'Cash', 0)}
            ${inputField('debit_card', 'Debit Card', 0)}
            ${inputField('grab', 'Grab', 0)}
            ${inputField('qris', 'QRIS', 0)}
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan ESB</button></div>
        </form>
      </div>

      <div class="panel">
        <div class="panel-title">PENDAPATAN KONTER</div>
        <form id="counterForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', today(), 'date')}
            ${inputField('cash', 'Cash', 0)}
            ${inputField('debit_card', 'Debit Card', 0)}
            ${inputField('grab', 'Grab', 0)}
            ${inputField('qris', 'QRIS', 0)}
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan Konter</button></div>
        </form>
      </div>
    `;

    $('salesForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const { error } = await db.from('sales').upsert([formData], { onConflict: 'tanggal' });
      if (error) showToast('Gagal: ' + error.message);
      else { showToast('Laporan ESB disimpan.'); loadData('sales'); }
    };

    $('counterForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const { error } = await db.from('counter').upsert([formData], { onConflict: 'tanggal' });
      if (error) showToast('Gagal: ' + error.message);
      else { showToast('Laporan Konter disimpan.'); loadData('sales'); }
    };
  } else {
    container.innerHTML = `
      <div class="panel">
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
          <label style="font-weight:700;">Pilih Tanggal Laporan:</label>
          <input type="date" id="reportDate" value="${today()}" onchange="loadReport()" style="padding:12px; border:1px solid var(--line); border-radius:8px; font-size:16px; background:var(--card); color:var(--text);">
          <button class="btn btn-success" onclick="downloadDailyReportImage()"><i class="fa-solid fa-camera"></i> Download Gambar Laporan</button>
        </div>
        <div id="reportResult" style="margin-top: 15px; width: 100%;"></div>
      </div>
    `;
    loadReport();
  }
}

function inputField(name, label, value = '', type = 'number') {
  return `
    <div class="field">
      <label>${label}</label>
      <input name="${name}" type="${type}" value="${value}" ${type === 'number' ? 'min="0" step="1"' : ''}>
    </div>
  `;
}

function reportRow(label, value, forceDash = false) {
  const number = Number(value || 0);
  const isNegative = number < 0;
  const displayValue = Math.abs(number).toLocaleString('id-ID');
  const display = forceDash || number === 0 ? '-' : (isNegative ? '-' + displayValue : displayValue);
  
  return `
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13.5px;">
      <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${label}</span>
      <span style="white-space: nowrap;">&nbsp;&nbsp;&nbsp;: Rp</span>
      <span style="text-align: right; min-width: 85px;">${display}</span>
    </div>
  `;
}

function loadReport() {
  const dateEl = $('reportDate');
  const resultEl = $('reportResult');
  
  if (!dateEl) { console.error('Elemen #reportDate tidak ditemukan'); return; }
  if (!resultEl) { console.error('Elemen #reportResult tidak ditemukan'); return; }

  try {
    const selectedDate = normalizeDate(dateEl.value);
    
    const salesFound = (DB.sales || []).find(r => normalizeDate(r.tanggal) === selectedDate);
    const counterFound = (DB.counter || []).find(r => normalizeDate(r.tanggal) === selectedDate);
    
    const sales = salesFound || {};
    const counter = counterFound || {};

    const totalEsb = totalESB(sales);
    const totalKonterVal = totalCounter(counter);

    const diffCash = Number(sales.cash || 0) - Number(counter.cash || 0);
    const diffDebit = Number(sales.debit_card || 0) - Number(counter.debit_card || 0);
    const diffGrab = Number(sales.grab || 0) - Number(counter.grab || 0);
    const diffQris = Number(sales.qris || 0) - Number(counter.qris || 0);

    const dateObject = new Date(selectedDate + 'T00:00:00');
    const formattedDate = isNaN(dateObject) ? selectedDate : dateObject.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const statusInfo = (!salesFound && !counterFound) 
      ? `<div style="text-align:center; padding: 10px; color: #dc2626; font-weight: bold; margin-bottom: 10px;">Belum ada data penjualan pada tanggal ini.</div>` 
      : '';

    resultEl.innerHTML = `
      <div class="report-container">
        ${statusInfo}
        <div id="captureDailyReport" style="padding: 20px; background: white; color: black; border-radius: 8px; border: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
          
          <div style="text-align: center; font-weight: 800; margin-bottom: 5px; font-size: 15px;">
            RUMAH MAKAN TAHU SUMEDANG<br>SARI KEDELE<br><span style="font-size:12px;">UNIT SUBANG</span>
          </div>
          <div style="border-bottom: 2px dashed #94a3b8; margin-bottom: 10px;"></div>
          <div style="text-align: center; margin-bottom: 15px; font-weight: bold; font-size: 14px;">
            ${formattedDate}
          </div>

          <!-- PENDAPATAN PER KATEGORI -->
          <div style="margin-bottom: 18px;">
            <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">PENDAPATAN PER KATEGORI</div>
            ${reportRow('MAKANAN', sales.makanan)}
            ${reportRow('MINUMAN', sales.minuman)}
            ${reportRow('TAHU', sales.tahu)}
            ${reportRow('GORENGAN', sales.gorengan)}
            ${reportRow('LAIN-LAIN', sales.lain_lain)}
            ${reportRow('PAJAK', sales.pajak)}
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
              ${reportRow('TOTAL PENDAPATAN ESB', totalEsb)}
            </div>
          </div>

          <!-- ESB & KONTER BERDAMPINGAN -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 18px;">
            <div>
              <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">PEMBAYARAN ESB</div>
              ${reportRow('CASH', sales.cash)}
              ${reportRow('DEBIT CARD', sales.debit_card)}
              ${reportRow('GRAB', sales.grab)}
              ${reportRow('QRIS', sales.qris)}
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
                ${reportRow('TOTAL ESB', totalEsb)}
              </div>
            </div>
            <div>
              <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">PEMBAYARAN KONTER</div>
              ${reportRow('CASH', counter.cash)}
              ${reportRow('DEBIT CARD', counter.debit_card)}
              ${reportRow('GRAB', counter.grab)}
              ${reportRow('QRIS', counter.qris)}
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
                ${reportRow('TOTAL KONTER', totalKonterVal)}
              </div>
            </div>
          </div>

          <!-- SELISIH -->
          <div>
            <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px; color: #dc2626;">SELISIH (ESB - KONTER)</div>
            ${reportRow('CASH', diffCash)}
            ${reportRow('DEBIT CARD', diffDebit)}
            ${reportRow('GRAB', diffGrab)}
            ${reportRow('QRIS', diffQris)}
          </div>
          
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Gagal memuat laporan:', error);
    resultEl.innerHTML = `
      <div style="color:#dc2626; padding: 15px; border: 1px solid #dc2626; border-radius: 8px;">
        Gagal memuat laporan harian. <br><small>${error.message}</small>
      </div>
    `;
  }
}

function downloadDailyReportImage() {
  const target = $('captureDailyReport');
  if (!target) {
    showToast('Laporan belum dimuat atau kosong.');
    return;
  }
  const date = $('reportDate').value || today();
  downloadElementAsImage('captureDailyReport', 'LAPORAN_PENDAPATAN_' + date);
}

/* ========================================
   MODUL PENGELUARAN
======================================== */
function renderExpense() {
  $('content').innerHTML = `
    <div class="top">
      <div><div class="title">Modul Pengeluaran</div></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button id="expBtnIn" class="sub-nav-btn active-sub" onclick="showExpenseSub('input')">Input</button>
        <button id="expBtnRep" class="sub-nav-btn" onclick="showExpenseSub('report')">Laporan</button>
        <button id="expBtnCash" class="sub-nav-btn" onclick="showExpenseSub('cash')">Posisi Kas</button>
      </div>
    </div>
    <div id="expenseSubContent"></div>
  `;
  showExpenseSub('input');
}

function showExpenseSub(type) {
  const container = $('expenseSubContent');
  if (!container) return;

  const btnIn = $('expBtnIn');
  const btnRep = $('expBtnRep');
  const btnCash = $('expBtnCash');
  if (btnIn && btnRep && btnCash) {
    btnIn.classList.toggle('active-sub', type === 'input');
    btnRep.classList.toggle('active-sub', type === 'report');
    btnCash.classList.toggle('active-sub', type === 'cash');
  }

  if (type === 'input') {
    container.innerHTML = `
      <div class="panel">
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
          <div class="panel-title" style="margin-bottom:0;">Input Pengeluaran Sekaligus</div>
          <input type="date" id="batchExpenseDate" value="${today()}" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px; width: 100%;">
        </div>
        <div class="table-wrap" style="overflow-x: auto;">
          <table class="table" style="min-width: 800px;">
            <thead>
              <tr>
                <th style="width: 12%;">Sheet</th>
                <th style="width: 13%;">Grup (Tabel)</th>
                <th style="width: 18%;">Nama Barang</th>
                <th style="width: 8%;">Qty</th>
                <th style="width: 8%;">Satuan</th>
                <th style="width: 14%;">Harga</th>
                <th style="width: 14%;">Total</th>
                <th style="width: 8%;" class="center">Aksi</th>
              </tr>
            </thead>
            <tbody id="batchExpenseBody"></tbody>
          </table>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
          <button type="button" class="btn btn-secondary" onclick="addExpenseRow()">+ Tambah Baris</button>
          <button type="button" class="btn btn-primary" onclick="submitBatchExpenses()">Simpan Semua</button>
        </div>
      </div>
    `;
    for (let i = 0; i < 3; i++) addExpenseRow();
  } else if (type === 'report') {
    container.innerHTML = `
      <div class="panel">
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
          <label style="font-weight:700;">Pilih Tanggal Laporan:</label>
          <input type="date" id="expenseReportDate" value="${today()}" onchange="loadExpenseReport()" style="padding:12px; border:1px solid var(--line); border-radius:8px; font-size:16px;">
          <button class="btn btn-success" onclick="downloadExpenseReportImage()">📷 Download Gambar</button>
        </div>
        <div id="expenseReportResult" style="margin-top: 15px;"></div>
      </div>
    `;
    loadExpenseReport();
  } else {
    const currentDate = today();
    const cash = (DB.cash || []).find(c => formatDate(c.tanggal) === currentDate) || {};
    
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">Posisi Saldo Kas</div>
        <form id="cashForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', cash.tanggal || currentDate, 'date')}
            ${inputField('saldo_harian', 'Saldo Harian', cash.saldo_harian || 0)}
            ${inputField('belanja_malam', 'Belanja Malam', cash.belanja_malam || 0)}
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan Posisi Kas</button></div>
        </form>
      </div>
    `;
    
    $('cashForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const payload = {
        tanggal: formData.tanggal,
        saldo_harian: Number(formData.saldo_harian || 0),
        belanja_malam: Number(formData.belanja_malam || 0)
      };

      const { error } = await db.from('cash_positions').upsert([payload], { onConflict: 'tanggal' });
      if (error) showToast('Gagal: ' + error.message);
      else { showToast('Posisi kas disimpan.'); loadData('expense'); }
    };
  }
}

function addExpenseRow() {
  const tr = document.createElement('tr');
  tr.className = 'expense-input-row';
  tr.innerHTML = `
    <td>
      <select class="exp-kategori" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;">
        <option value="LAIN-LAIN">Lain-lain</option>
        <option value="PASAR">Pasar</option>
        <option value="CIKUDA">Cikuda</option>
        <option value="SKF">SKF</option>
      </select>
    </td>
    <td><input type="text" class="exp-sub" placeholder="Grup (Cth: AYAM)" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="text" class="exp-sumber" placeholder="Nama Barang..." style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="number" class="exp-qty" placeholder="1" value="1" step="0.01" oninput="calcExpRow(this)" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="text" class="exp-satuan" placeholder="Kg/Pcs" value="PCS" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="number" class="exp-harga" placeholder="0" min="0" oninput="calcExpRow(this)" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="number" class="exp-nominal" placeholder="0" readonly style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background:#f1f5f9;"></td>
    <td class="center"><button type="button" class="btn btn-outline-danger" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  $('batchExpenseBody').appendChild(tr);
}

async function submitBatchExpenses() {
  const tanggal = $('batchExpenseDate').value;
  const items = [];
  document.querySelectorAll('.expense-input-row').forEach(r => {
    const cat = r.querySelector('.exp-kategori').value;
    const sub = r.querySelector('.exp-sub').value.trim();
    const s = r.querySelector('.exp-sumber').value.trim();
    const q = r.querySelector('.exp-qty').value;
    const sat = r.querySelector('.exp-satuan').value.trim();
    const h = r.querySelector('.exp-harga').value;
    const n = r.querySelector('.exp-nominal').value;

    if (s || n) items.push({
        tanggal,
        kategori: cat,
        sub_kategori: sub,
        sumber: s,
        qty: Number(q || 1),
        satuan: sat || 'PCS',
        harga_satuan: Number(h || 0),
        nominal: Number(n || 0),
        keterangan: '-'
    });
  });
  if (!items.length) { showToast('Isi minimal satu baris.'); return; }
  const { error } = await db.from('expenses').insert(items);
  if (error) showToast('Gagal: ' + error.message);
  else { showToast('Pengeluaran berhasil disimpan.'); loadData('expense'); }
}

function loadExpenseReport() {
  const dateEl = $('expenseReportDate');
  const resultEl = $('expenseReportResult');
  
  if (!dateEl) { console.error('Elemen #expenseReportDate tidak ditemukan'); return; }
  if (!resultEl) { console.error('Elemen #expenseReportResult tidak ditemukan'); return; }

  try {
    const date = normalizeDate(dateEl.value);

    const cashRow = DB.cash.find(r => formatDate(r.tanggal) === date) || {};
    const dayExpenses = DB.expenses.filter(r => formatDate(r.tanggal) === date);
    
    const totalPemasukan = Number(cashRow.saldo_harian || 0) + Number(cashRow.belanja_malam || 0);
    const totalPengeluaran = sum(dayExpenses.map(r => r.nominal));
    const sisaSaldo = totalPemasukan - totalPengeluaran;

    const dateObject = new Date(date + 'T00:00:00');
    const formattedDate = isNaN(dateObject) ? date : dateObject.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    let expenseRowsHtml = dayExpenses.length > 0 
      ? dayExpenses.map((expense, i) => reportRow(`${i + 1}. ${escapeHtml(expense.sumber || 'Pengeluaran')}`, expense.nominal)).join('') 
      : `<div style="text-align:center; color:#64748b; font-size:13.5px; padding:10px;">Tidak ada pengeluaran</div>`;

    resultEl.innerHTML = `
      <div class="expense-report-wrapper">
        <div id="captureExpenseReport" style="padding: 20px; background: white; color: black; border-radius: 8px; border: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
          
          <div style="text-align: center; font-weight: 800; margin-bottom: 5px; font-size: 15px;">
            RUMAH MAKAN TAHU SUMEDANG<br>SARI KEDELE<br><span style="font-size:12px;">UNIT SUBANG</span>
          </div>
          <div style="border-bottom: 2px dashed #94a3b8; margin-bottom: 10px;"></div>
          <div style="text-align: center; margin-bottom: 15px; font-weight: bold; font-size: 14px;">
            LAPORAN KAS & PENGELUARAN<br>
            <span style="font-size:13px; font-weight:normal;">${formattedDate}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 18px;">
            <!-- KIRI: SUMBER SALDO -->
            <div>
              <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">SUMBER SALDO</div>
              ${reportRow('1. Saldo Harian', cashRow.saldo_harian)}
              ${reportRow('2. Belanja Malam', cashRow.belanja_malam)}
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
                ${reportRow('TOTAL PEMASUKAN', totalPemasukan)}
              </div>
            </div>
            
            <!-- KANAN: PENGELUARAN -->
            <div>
              <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">RINCIAN PENGELUARAN</div>
              ${expenseRowsHtml}
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
                ${reportRow('TOTAL PENGELUARAN', totalPengeluaran)}
              </div>
            </div>
          </div>

          <!-- BAWAH: SISA SALDO -->
          <div>
            <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px; color: ${sisaSaldo < 0 ? '#dc2626' : '#059669'};">POSISI KAS AKHIR</div>
            ${reportRow('SISA SALDO TUNAI', sisaSaldo)}
          </div>
          
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Gagal memuat laporan pengeluaran:', error);
    resultEl.innerHTML = `
      <div style="color:#dc2626; padding: 15px; border: 1px solid #dc2626; border-radius: 8px;">
        Gagal memuat laporan pengeluaran. <br><small>${error.message}</small>
      </div>
    `;
  }
}

function downloadExpenseReportImage() {
  const target = $('captureExpenseReport');
  if (!target) { showToast('Laporan pengeluaran belum dimuat.'); return; }
  const date = $('expenseReportDate').value || today();
  downloadElementAsImage('captureExpenseReport', 'LAPORAN_PENGELUARAN_' + date);
}

/* ========================================
   MODUL ABSENSI
======================================== */
function renderAttendancePage() {
  $('content').innerHTML = `
    <div class="top">
      <div><div class="title">Modul Absensi & SDM</div></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button id="attBtnLog" class="sub-nav-btn active-sub" onclick="showAttendanceSub('log')">Log</button>
        <button id="attBtnAllow" class="sub-nav-btn" onclick="showAttendanceSub('allowance')">Uang Jajan</button>
        <button id="attBtnHours" class="sub-nav-btn" onclick="showAttendanceSub('hours')">Jam Kerja</button>
      </div>
    </div>
    <div id="attendanceSubContent"></div>
  `;
  showAttendanceSub('log');
}

function showAttendanceSub(type) {
  const container = $('attendanceSubContent');
  if (!container) return;

  const btnLog = $('attBtnLog');
  const btnAllow = $('attBtnAllow');
  const btnHours = $('attBtnHours');
  if (btnLog && btnAllow && btnHours) {
    btnLog.classList.toggle('active-sub', type === 'log');
    btnAllow.classList.toggle('active-sub', type === 'allowance');
    btnHours.classList.toggle('active-sub', type === 'hours');
  }

  if (type === 'log') {
    container.innerHTML = `
      <div class="panel">
        <div class="upload-zone" onclick="$('excelFileInput').click()">
          <div style="font-size: 38px; margin-bottom: 6px;">📂</div>
          <div style="font-weight: 700; font-size: 15px;">Klik untuk Upload File Log Absensi (.xls / .xlsx)</div>
          <input type="file" id="excelFileInput" accept=".xls,.xlsx" onchange="handleExcelUpload(event)">
        </div>
        <div id="uploadProgress" style="display:none; margin-top:12px; font-weight:700; color:var(--wa-primary);">⏳ Memproses file...</div>
      </div>
      <div class="panel">
        <div style="display:flex; flex-direction: column; gap: 8px; margin-bottom:14px;">
          <div class="panel-title" style="margin-bottom:0;">Riwayat Absensi Harian</div>
          <input type="date" id="attendanceFilterDate" value="${today()}" onchange="renderAttendanceTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px; width: 100%;">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:45px;" class="center">No</th><th>Nama Karyawan</th><th>Divisi</th><th class="center">Masuk</th><th class="center">Pulang</th><th class="center">Status</th></tr></thead>
            <tbody id="attendanceTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    renderAttendanceTable();
  } else if (type === 'allowance') {
    container.innerHTML = `
      <div class="panel">
        <div style="display:flex; flex-direction: column; gap: 8px; margin-bottom:14px;">
          <label style="font-weight:700;">Pilih Tanggal:</label>
          <input type="date" id="allowanceFilterDate" value="${today()}" onchange="renderAllowanceTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px;">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:45px;" class="center">No</th><th>Nama Karyawan</th><th>Divisi</th><th class="center">Shift</th><th class="center">Jam Masuk</th><th class="center">Batas</th><th class="center">Status</th><th class="right">Uang Jajan</th></tr></thead>
            <tbody id="allowanceTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    renderAllowanceTable();
  } else {
    container.innerHTML = `
      <div class="panel">
        <div style="display:flex; flex-direction: column; gap: 8px; margin-bottom:14px;">
          <label style="font-weight:700;">Pilih Tanggal:</label>
          <input type="date" id="workHoursFilterDate" value="${today()}" onchange="renderWorkHoursTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px;">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:45px;" class="center">No</th><th>Nama Karyawan</th><th>Divisi</th><th class="center">Masuk</th><th class="center">Pulang</th><th class="center">Durasi</th><th class="center">Selisih</th><th class="right">Penyesuaian</th></tr></thead>
            <tbody id="workHoursTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    renderWorkHoursTable();
  }
}

function renderAttendanceTable() {
  const fDate = formatDate($('attendanceFilterDate')?.value) || today();
  const list = (DB.attendance || []).filter(r => formatDate(r.tanggal) === fDate);
  const tbody = $('attendanceTableBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Belum ada absensi tanggal ${fDate}.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((r, i) => `
    <tr>
      <td class="center">${i+1}</td>
      <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
      <td><span class="badge badge-dept">${escapeHtml(r.departemen || '-')}</span></td>
      <td class="center" style="font-weight:700; color:${r.masuk ? 'var(--wa-primary)' : 'var(--danger)'};">${r.masuk || '-'}</td>
      <td class="center" style="font-weight:700;">${r.pulang || '-'}</td>
      <td class="center"><span class="badge ${r.status === 'Hadir' ? 'badge-success' : 'badge-danger'}">${r.status}</span></td>
    </tr>
  `).join('');
}

function renderAllowanceTable() {
  const fDate = formatDate($('allowanceFilterDate')?.value) || today();
  const allAttToday = (DB.attendance || []).filter(r => formatDate(r.tanggal) === fDate);
  const tbody = $('allowanceTableBody');
  if (!tbody) return;

  if (!allAttToday.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Belum ada absensi tanggal ${fDate}.</td></tr>`;
    return;
  }

  const list = allAttToday.map(r => ({ ...r, c: classifyShift(r.masuk) })).filter(r => r.c.onTime);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Tidak ada yang tepat waktu.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, i) => `
    <tr style="border-bottom: 1px solid var(--line);">
      <td class="center" style="color:var(--muted);">${i+1}</td>
      <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
      <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
      <td class="center"><span class="badge" style="background:#e0f2fe; color:#0369a1; border: 1px solid #bae6fd;">${r.c.shift}</span></td>
      <td class="center" style="font-weight:800;">${r.c.displayTime}</td>
      <td class="center" style="color:var(--muted); font-size:11px;">Maks ${r.c.batas}</td>
      <td class="center"><span class="badge badge-success" style="padding: 4px 8px; border-radius: 20px;">✓ Tepat Waktu</span></td>
      <td class="right" style="font-weight:800; color:#059669; font-size:14px;">+${money(DEFAULT_ALLOWANCE)}</td>
    </tr>
  `).join('');
}

function renderWorkHoursTable() {
  const fDate = formatDate($('workHoursFilterDate')?.value) || today();
  const list = (DB.attendance || []).filter(r => formatDate(r.tanggal) === fDate);
  const tbody = $('workHoursTableBody');
  if (!tbody) return;

  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" class="empty">Belum ada data.</td></tr>`; return; }

  tbody.innerHTML = list.map((r, i) => {
    const durasi = calculateHours(r.masuk, r.pulang);
    let diff = 0;
    let roundedDiff = 0;
    let nominal = 0;
    
    if (durasi > 0) {
      diff = durasi - 11;
      roundedDiff = Math.round(diff);
      nominal = roundedDiff * 5000;
    }
    
    return `
      <tr style="border-bottom: 1px solid var(--line);">
        <td class="center" style="color:var(--muted);">${i+1}</td>
        <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
        <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
        <td class="center" style="font-weight:600;">${r.masuk || '-'}</td>
        <td class="center" style="font-weight:600;">${r.pulang || '-'}</td>
        <td class="center" style="color:var(--muted); font-size:12px;">${durasi ? durasi.toFixed(2) + ' Jam' : '-'}</td>
        <td class="center" style="font-weight:800; color:${roundedDiff > 0 ? '#059669' : (roundedDiff < 0 ? '#dc2626' : 'var(--text)')};">${roundedDiff !== 0 ? (roundedDiff > 0 ? '+' : '') + roundedDiff + ' Jam' : 'Pas'}</td>
        <td class="right" style="font-weight:800; color:${nominal > 0 ? '#059669' : (nominal < 0 ? '#dc2626' : 'var(--text)')}; font-size: 14px;">${nominal !== 0 ? (nominal > 0 ? '+' : '') + money(nominal) : 'Rp 0'}</td>
      </tr>
    `;
  }).join('');
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  $('uploadProgress').style.display = 'block';
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'log') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      let periodText = '';
      for (let r = 0; r < Math.min(5, rows.length); r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (String(rows[r][c]).includes('~')) { periodText = String(rows[r][c]); break; }
        }
        if (periodText) break;
      }

      let startYear = new Date().getFullYear();
      let startMonth = new Date().getMonth() + 1;
      let startDay = 1;

      const periodMatch = periodText.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
      if (periodMatch) {
        startYear = parseInt(periodMatch[1], 10);
        startMonth = parseInt(periodMatch[2], 10);
        startDay = parseInt(periodMatch[3], 10);
      }

      const parsedRecords = [];
      for (let i = 0; i < rows.length; i++) {
        const rowStr = rows[i].join(' ');
        if (rowStr.includes('No :') && rowStr.includes('Nama :')) {
          const daysRow = i > 0 ? rows[i - 1] : [];
          const infoRow = rows[i];
          const punchRow = i + 1 < rows.length ? rows[i + 1] : [];

          let namaVal = '', deptVal = '';
          for (let c = 0; c < infoRow.length; c++) {
            const cellStr = String(infoRow[c]).trim();
            if (cellStr.includes('Nama :')) {
              for (let k = c + 1; k < infoRow.length; k++) {
                if (String(infoRow[k]).trim()) { namaVal = String(infoRow[k]).trim(); break; }
              }
            } else if (cellStr.includes('Dept :')) {
              for (let k = c + 1; k < infoRow.length; k++) {
                if (String(infoRow[k]).trim()) { deptVal = String(infoRow[k]).trim(); break; }
              }
            }
          }

          if (!namaVal) continue;

          for (let col = 0; col < daysRow.length; col++) {
            const dayNum = parseInt(daysRow[col], 10);
            if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

            let currentMonth = startMonth;
            let currentYear = startYear;
            
            if (startDay > 15 && dayNum < 15) {
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
            }

            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const punchStr = String(punchRow[col] || '').trim();
            const times = punchStr.split(/[\n\r]+/).map(t => t.trim()).filter(t => t.includes(':'));

            let masukVal = '';
            let pulangVal = '';
            if (times.length > 0) {
              masukVal = times[0];
            }
            if (times.length > 1) {
              pulangVal = times[times.length - 1];
            }

            parsedRecords.push({
              tanggal: dateStr,
              nama: namaVal,
              departemen: deptVal,
              masuk: masukVal,
              pulang: pulangVal,
              status: times.length > 0 ? 'Hadir' : 'Tidak Hadir'
            });
          }
          i += 1;
        }
      }

      const { error } = await db.from('attendance').upsert(parsedRecords, { onConflict: 'tanggal,nama' });
      $('uploadProgress').style.display = 'none';
      if (error) showToast('Gagal: ' + error.message);
      else { showToast('Absensi berhasil diunggah.'); loadData('attendance'); }
    } catch (err) {
      $('uploadProgress').style.display = 'none';
      showToast('Gagal memproses file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ========================================
   MODUL GAJI & SDM
======================================== */
function renderPayrollPage() {
  $('content').innerHTML = `
    <div class="top">
      <div><div class="title">Modul Gaji & SDM</div></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button id="payBtnRekap" class="sub-nav-btn active-sub" onclick="showPayrollSub('rekap')">Rekapitulasi</button>
        <button id="payBtnSlip" class="sub-nav-btn" onclick="showPayrollSub('slips')">Cetak Slip PDF</button>
        <button id="payBtnKasbon" class="sub-nav-btn" onclick="showPayrollSub('kasbon')">Kasbon</button>
        <button id="payBtnCicilan" class="sub-nav-btn" onclick="showPayrollSub('cicilan')">Cicilan</button>
      </div>
    </div>
    <div id="payrollSubContent"></div>
  `;
  showPayrollSub('rekap');
}

function showPayrollSub(type) {
  const container = $('payrollSubContent');
  if (!container) return;

  const btnRekap = $('payBtnRekap');
  const btnSlip = $('payBtnSlip');
  const btnKasbon = $('payBtnKasbon');
  const btnCicilan = $('payBtnCicilan');
  
  if (btnRekap && btnSlip && btnKasbon && btnCicilan) {
    btnRekap.classList.toggle('active-sub', type === 'rekap');
    btnSlip.classList.toggle('active-sub', type === 'slips');
    btnKasbon.classList.toggle('active-sub', type === 'kasbon');
    btnCicilan.classList.toggle('active-sub', type === 'cicilan');
  }

  const allDepts = Array.from(new Set((DB.masterSalary || []).map(r => String(r.departemen || '').trim()))).sort();
  const deptOptionsHtml = allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const lastD = new Date(y, d.getMonth() + 1, 0).getDate();
  const todayFormatted = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  
  let defaultStart = `${y}-${m}-01`;
  let defaultEnd = `${y}-${m}-${String(lastD).padStart(2, '0')}`;

  if (type === 'rekap') {
    container.innerHTML = `
      <div class="panel">
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Periode Awal:</label>
            <input type="date" id="payrollStartDate" value="${defaultStart}" onchange="renderPayrollCards()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Periode Akhir:</label>
            <input type="date" id="payrollEndDate" value="${defaultEnd}" onchange="renderPayrollCards()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Filter Divisi:</label>
            <select id="payrollFilterDept" onchange="renderPayrollCards()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
              <option value="ALL">Semua Divisi</option>
              ${deptOptionsHtml}
            </select>
          </div>
        </div>
      </div>
      <div id="payrollCardsContainer" style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;"></div>
    `;
    renderPayrollCards();
  } else if (type === 'slips') {
    container.innerHTML = `
      <div class="panel">
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Periode Awal:</label>
            <input type="date" id="slipStartDate" value="${defaultStart}" onchange="renderSlipPages()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Periode Akhir:</label>
            <input type="date" id="slipEndDate" value="${defaultEnd}" onchange="renderSlipPages()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Filter Divisi:</label>
            <select id="slipFilterDept" onchange="renderSlipPages()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
              <option value="ALL">Semua Divisi</option>
              ${deptOptionsHtml}
            </select>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Tanggal Cetak Slip:</label>
            <input type="text" id="slipPrintDate" value="Subang, ${todayFormatted}" onchange="renderSlipPages()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <button class="btn btn-primary" onclick="exportSlipsToPDF()">📥 Download PDF Slip Gaji</button>
        </div>
      </div>
      <div class="slip-container" id="slipPrintContainer"></div>
    `;
    renderSlipPages();
  } else if (type === 'kasbon') {
    const empOptionsHtml = (DB.masterSalary || []).map(d => `<option value="${escapeHtml(d.nama)}">${escapeHtml(d.nama)}</option>`).join('');
    const currentMonth = new Date().toISOString().slice(0, 7);

    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">Input Kasbon Karyawan</div>
        <form id="kasbonForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', today(), 'date')}
            <div class="field">
              <label>Nama Karyawan</label>
              <select name="nama" style="padding: 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; width:100%; background:var(--card); color:var(--text);">
                ${empOptionsHtml}
              </select>
            </div>
            ${inputField('nominal', 'Nominal Kasbon (Rp)', 0)}
            <div class="field">
              <label>Keterangan</label>
              <input name="keterangan" type="text" placeholder="Keperluan..." style="padding: 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; width:100%; background:var(--card); color:var(--text);">
            </div>
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan Kasbon</button></div>
        </form>
      </div>

      <div class="panel">
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
          <label style="font-weight:700;">Lihat Histori Kasbon Bulan:</label>
          <input type="month" id="kasbonFilterMonth" value="${currentMonth}" onchange="renderKasbonTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px; background:var(--card); color:var(--text);">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:45px;" class="center">No</th><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th class="right">Nominal</th></tr></thead>
            <tbody id="kasbonTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    $('kasbonForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const payload = {
        tanggal: formData.tanggal,
        nama: formData.nama,
        nominal: Number(formData.nominal || 0),
        keterangan: formData.keterangan || '-'
      };
      
      if (!payload.nominal) { showToast('Nominal tidak boleh nol.'); return; }

      const { error } = await db.from('advances').insert([payload]);
      if (error) showToast('Gagal: ' + error.message);
      else { 
        showToast('Kasbon berhasil dicatat.'); 
        loadData('payroll'); 
      }
    };

    renderKasbonTable();
  } else if (type === 'cicilan') {
    const empOptionsHtml = (DB.masterSalary || []).map(d => `<option value="${escapeHtml(d.nama)}">${escapeHtml(d.nama)}</option>`).join('');
    const currentMonth = new Date().toISOString().slice(0, 7);

    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">Input Cicilan Karyawan</div>
        <form id="cicilanForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', today(), 'date')}
            <div class="field">
              <label>Nama Karyawan</label>
              <select name="nama" style="padding: 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; width:100%; background:var(--card); color:var(--text);">
                ${empOptionsHtml}
              </select>
            </div>
            ${inputField('nominal', 'Total Pinjaman (Rp)', 0)}
            ${inputField('tenor', 'Tenor (Bulan)', 1)}
            <div class="field">
              <label>Keterangan</label>
              <input name="keterangan" type="text" placeholder="Keperluan/Sisa Cicilan..." style="padding: 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; width:100%; background:var(--card); color:var(--text);">
            </div>
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan Cicilan</button></div>
        </form>
      </div>

      <div class="panel">
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
          <label style="font-weight:700;">Lihat Histori Cicilan (Bulan Masuk):</label>
          <input type="month" id="cicilanFilterMonth" value="${currentMonth}" onchange="renderCicilanTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 16px; background:var(--card); color:var(--text);">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:45px;" class="center">No</th><th>Tanggal</th><th>Nama</th><th>Tenor</th><th>Keterangan</th><th class="right">Pinjaman</th><th class="right">Cicilan/Bln</th></tr></thead>
            <tbody id="cicilanTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    $('cicilanForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const payload = {
        tanggal: formData.tanggal,
        nama: formData.nama,
        nominal: Number(formData.nominal || 0),
        tenor: Number(formData.tenor || 1),
        keterangan: formData.keterangan || '-'
      };
      
      if (!payload.nominal) { showToast('Nominal tidak boleh nol.'); return; }

      const { error } = await db.from('installments').insert([payload]);
      if (error) showToast('Gagal: ' + error.message);
      else { 
        showToast('Cicilan berhasil dicatat.'); 
        loadData('payroll'); 
      }
    };

    renderCicilanTable();
  }
}

function renderKasbonTable() {
  const fMonth = $('kasbonFilterMonth')?.value || new Date().toISOString().slice(0, 7);
  const tbody = $('kasbonTableBody');
  if (!tbody) return;

  const list = (DB.advances || [])
    .filter(r => formatDate(r.tanggal).startsWith(fMonth))
    .sort((a,b) => a.tanggal.localeCompare(b.tanggal));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Tidak ada data kasbon bulan ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, i) => `
    <tr>
      <td class="center">${i+1}</td>
      <td class="center">${formatDate(r.tanggal)}</td>
      <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.keterangan)}</td>
      <td class="right" style="font-weight:700; color:var(--danger);">- ${money(r.nominal)}</td>
    </tr>
  `).join('');
}

function renderCicilanTable() {
  const fMonth = $('cicilanFilterMonth')?.value || new Date().toISOString().slice(0, 7);
  const tbody = $('cicilanTableBody');
  if (!tbody) return;

  const list = (DB.installments || [])
    .filter(r => formatDate(r.tanggal).startsWith(fMonth))
    .sort((a,b) => a.tanggal.localeCompare(b.tanggal));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Tidak ada data cicilan bulan ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, i) => {
    const tenor = Number(r.tenor) || 1;
    const perBulan = Math.round(Number(r.nominal) / tenor);
    
    return `
      <tr>
        <td class="center">${i+1}</td>
        <td class="center">${formatDate(r.tanggal)}</td>
        <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
        <td class="center">${tenor} Bln</td>
        <td>${escapeHtml(r.keterangan)}</td>
        <td class="right" style="font-weight:700; color:var(--danger);">- ${money(r.nominal)}</td>
        <td class="right" style="font-weight:700; color:var(--danger);">- ${money(perBulan)}</td>
      </tr>
    `;
  }).join('');
}

function getCalculatedPayrollList(sDate, eDate, fDept) {
  let masterList = DB.masterSalary || [];
  if (fDept !== 'ALL') {
    masterList = masterList.filter(r => String(r.departemen).trim().toUpperCase() === fDept.toUpperCase());
  }
  masterList.sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  const eDateObj = new Date(eDate || today());
  const eYear = eDateObj.getFullYear();
  const eMonth = eDateObj.getMonth();

  return masterList.map(emp => {
    const nmKey = String(emp.nama || '').trim().toUpperCase();
    const lainLain = (nmKey === "ZAENAL ARIFIN") ? DEFAULT_BONUS_LAIN : 0;
    
    const empAdvances = (DB.advances || []).filter(adv => {
      const advDate = formatDate(adv.tanggal);
      return String(adv.nama || '').trim().toUpperCase() === nmKey && advDate >= sDate && advDate <= eDate;
    });
    const kasbonPeriode = sum(empAdvances.map(a => a.nominal));

    const empInstallments = (DB.installments || []).filter(ins => String(ins.nama || '').trim().toUpperCase() === nmKey);
    let cicilanPeriode = 0;

    empInstallments.forEach(ins => {
      const insDate = new Date(formatDate(ins.tanggal));
      const iYear = insDate.getFullYear();
      const iMonth = insDate.getMonth();
      const tenor = Number(ins.tenor) || 1;
      const nominal = Number(ins.nominal) || 0;
      const perBulan = Math.round(nominal / tenor);

      const monthDiff = (eYear - iYear) * 12 + (eMonth - iMonth);

      if (monthDiff >= 0 && monthDiff < tenor) {
        cicilanPeriode += perBulan;
      }
    });

    const empAttendance = (DB.attendance || []).filter(att => {
      const attDate = formatDate(att.tanggal);
      return String(att.nama || '').trim().toUpperCase() === nmKey && attDate >= sDate && attDate <= eDate;
    });

    let totalPenyesuaianJam = 0;

    empAttendance.forEach(att => {
      if (att.status === 'Hadir') {
        const durasi = calculateHours(att.masuk, att.pulang);
        if (durasi > 0) {
          const diff = durasi - STANDARD_WORK_HOURS; 
          const roundedDiff = Math.round(diff);
          totalPenyesuaianJam += (roundedDiff * RATE_PER_HOUR); 
        }
      }
    });

    const gajiPokok = Number(emp.gaji_pokok || 0);
    const jabatan = Number(emp.jabatan || 0);
    const prestasi = Number(emp.prestasi || 0);
    const kesehatan = Number(emp.kesehatan || 0);
    const zakat = Number(emp.zakat || 0);
    const loyalitas = Number(emp.kebersihan_loyalitas || 0);

    const totalPendapatan = gajiPokok + jabatan + prestasi + kesehatan + zakat + loyalitas + lainLain + totalPenyesuaianJam;
    const totalPotongan = cicilanPeriode + kasbonPeriode; 
    const gajiBersih = Math.max(0, totalPendapatan - totalPotongan);

    return {
      nama: emp.nama,
      departemen: emp.departemen,
      pokok: gajiPokok,
      jabatan: jabatan,
      prestasi: prestasi,
      kesehatan: kesehatan,
      jamKerja: totalPenyesuaianJam,
      zakat: zakat,
      loyalitas: loyalitas,
      lainLain: lainLain,
      kasbon: kasbonPeriode, 
      bpjs: 0,
      cicilan: cicilanPeriode,
      gajiBersih: gajiBersih
    };
  });
}

function renderPayrollCards() {
  const sDate = $('payrollStartDate')?.value;
  const eDate = $('payrollEndDate')?.value;
  const fDept = $('payrollFilterDept')?.value || 'ALL';

  const container = $('payrollCardsContainer');
  if (!container) return;

  const list = getCalculatedPayrollList(sDate, eDate, fDept);

  if (!list.length) {
    container.innerHTML = `<div class="panel" style="text-align: center; color: var(--muted);">Belum ada data gaji.</div>`;
    return;
  }

  container.innerHTML = list.map((emp, idx) => {
    const totalPendapatan = emp.pokok + emp.jabatan + emp.prestasi + emp.kesehatan + emp.jamKerja + emp.zakat + emp.loyalitas + emp.lainLain;
    const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;

    return `
      <div class="panel" style="margin-top:0; border-left: 4px solid var(--wa-primary); cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; outline: none;" onclick="const el = document.getElementById('slip-wrapper-${idx}'); el.style.gridTemplateRows = el.style.gridTemplateRows === '1fr' ? '0fr' : '1fr';">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 16px;">${escapeHtml(emp.nama)}</div>
            <span class="badge badge-dept" style="margin-top: 4px;">${escapeHtml(emp.departemen)}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--muted); font-weight: 700;">GAJI BERSIH <i class="fa-solid fa-chevron-down" style="margin-left: 4px;"></i></div>
            <div style="font-size: 16px; font-weight: 800; color: var(--wa-primary);">${money(emp.gajiBersih)}</div>
          </div>
        </div>
        <div style="font-size: 12.5px; color: var(--muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid var(--line); padding-top: 8px;">
          <div>Pokok: <b>${money(emp.pokok)}</b></div>
          <div>Tunjangan & Absen: <b>${money(totalPendapatan - emp.pokok)}</b></div>
          <div>Potongan: <b style="color:var(--danger);">${money(totalPotongan)}</b></div>
          <div>Total Bruto: <b>${money(totalPendapatan)}</b></div>
        </div>

        <div id="slip-wrapper-${idx}" style="display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease-out;">
          <div style="overflow: hidden;">
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); font-size: 13px;">
              <div style="font-weight: 800; margin-bottom: 8px; color: var(--text);">Rincian Pendapatan</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Gaji Pokok</span> <b>${money(emp.pokok)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Jabatan</span> <b>${money(emp.jabatan)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Prestasi</span> <b>${money(emp.prestasi)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Kesehatan</span> <b>${money(emp.kesehatan)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Jam Kerja (+/-)</span> <b style="color:${emp.jamKerja < 0 ? 'var(--danger)' : 'var(--text)'};">${money(emp.jamKerja)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Zakat</span> <b>${money(emp.zakat)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Kebersihan/Loyalitas</span> <b>${money(emp.loyalitas)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Lain-lain</span> <b>${money(emp.lainLain)}</b></div>
              
              <div style="font-weight: 800; margin-top: 12px; margin-bottom: 8px; color: var(--danger);">Rincian Potongan</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Kasbon</span> <b style="color:var(--danger);">${money(emp.kasbon)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>BPJS</span> <b style="color:var(--danger);">${money(emp.bpjs)}</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Cicilan</span> <b style="color:var(--danger);">${money(emp.cicilan)}</b></div>
              
              <div style="text-align: center; margin-top: 14px; font-size: 11px; font-style: italic; color: var(--muted);">
                (Klik kembali kartu untuk menyembunyikan rincian)
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSlipPages() {
  const sDate = $('slipStartDate')?.value;
  const eDate = $('slipEndDate')?.value;
  const fDept = $('slipFilterDept')?.value || 'ALL';
  const printDate = $('slipPrintDate')?.value || `Subang, ${today()}`;

  const container = $('slipPrintContainer');
  if (!container) return;

  const list = getCalculatedPayrollList(sDate, eDate, fDept);

  if (!list.length) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--muted); background: white;">Tidak ada data.</div>`;
    return;
  }

  let periodMonth = '';
  if (sDate) {
      const pDate = new Date(sDate);
      periodMonth = pDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  let html = '';

  list.forEach(emp => {
    const totalPendapatan = emp.pokok + emp.jabatan + emp.prestasi + emp.kesehatan + emp.jamKerja + emp.zakat + emp.loyalitas + emp.lainLain;
    const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;

    html += `
      <div class="slip-card">
        <div>
          <div class="slip-header">
            <div class="slip-header-title">RUMAH MAKAN TAHU SUMEDANG</div>
            <div class="slip-header-sub">SARI KEDELE</div>
            <div style="font-size: 9px; color: #475569;">UNIT SUBANG</div>
            <div class="slip-header-period">SLIP GAJI PERIODE ${periodMonth}</div>
          </div>
          <div class="slip-bio">
            <span>NAMA</span><span>:</span><span>${escapeHtml(emp.nama)}</span>
            <span>POSISI</span><span>:</span><span>${escapeHtml(emp.departemen)}</span>
          </div>
          <div class="slip-section-bar">RINCIAN GAJI</div>
          <div class="slip-row"><span>GAJI POKOK</span><span>Rp</span><span class="right">${formatNum(emp.pokok)}</span></div>
          <div class="slip-row"><span>JABATAN</span><span>Rp</span><span class="right">${formatNum(emp.jabatan)}</span></div>
          <div class="slip-row"><span>PRESTASI</span><span>Rp</span><span class="right">${formatNum(emp.prestasi)}</span></div>
          <div class="slip-row"><span>KESEHATAN</span><span>Rp</span><span class="right">${formatNum(emp.kesehatan)}</span></div>
          <div class="slip-row"><span>JAM KERJA (+/-)</span><span>Rp</span><span class="right">${formatNum(emp.jamKerja)}</span></div>
          <div class="slip-row"><span>ZAKAT</span><span>Rp</span><span class="right">${formatNum(emp.zakat)}</span></div>
          <div class="slip-row"><span>KEBERSIHAN/LOYALITAS</span><span>Rp</span><span class="right">${formatNum(emp.loyalitas)}</span></div>
          <div class="slip-row"><span>LAIN-LAIN</span><span>Rp</span><span class="right">${formatNum(emp.lainLain)}</span></div>
          <div class="slip-subtotal"><span>Jumlah Pendapatan</span><span>Rp</span><span class="right">${formatNum(totalPendapatan)}</span></div>
          <div class="slip-section-bar">POTONGAN</div>
          <div class="slip-row"><span>KASBON</span><span>Rp</span><span class="right">${formatNum(emp.kasbon)}</span></div>
          <div class="slip-row"><span>BPJS</span><span>Rp</span><span class="right">${formatNum(emp.bpjs)}</span></div>
          <div class="slip-row"><span>CICILAN</span><span>Rp</span><span class="right">${formatNum(emp.cicilan)}</span></div>
          <div class="slip-subtotal"><span>Jumlah Potongan</span><span>Rp</span><span class="right">${formatNum(totalPotongan)}</span></div>
        </div>
        <div>
          <div class="slip-net-bar"><span>Gaji Diterima</span><span>Rp</span><span class="right">${formatNum(emp.gajiBersih)}</span></div>
          <div class="slip-footer-date">${escapeHtml(printDate)}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function exportSlipsToPDF() {
  const container = $('slipPrintContainer');
  if (!container || container.innerHTML.trim() === '') {
    showToast('Tidak ada slip gaji untuk diekspor.');
    return;
  }

  showToast('Sedang merakit dokumen PDF...');
  
  try {
    const { jsPDF } = window.jspdf;
    const cards = container.querySelectorAll('.slip-card');
    if (!cards.length) {
      showToast('Slip gaji kosong.');
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 90; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const col = i % 2; 
      const row = Math.floor((i / 2) % 3); 
      
      const marginX = 12;
      const marginY = 12;
      const gapX = 6;
      const gapY = 6;
      
      const posX = marginX + col * (imgWidth + gapX);
      const posY = marginY + row * (imgHeight + gapY);
      
      if (i > 0 && i % 6 === 0) {
        pdf.addPage();
      }
      
      pdf.addImage(imgData, 'PNG', posX, posY, imgWidth, imgHeight);
    }
    
    const sDate = $('slipStartDate')?.value || 'periode';
    pdf.save(`SLIP_GAJI_${sDate}.pdf`);
    showToast('PDF berhasil diunduh!');
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat PDF: ' + err.message);
  }
}

loadData();
