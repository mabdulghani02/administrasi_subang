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
  masterSalary: []
};

const STANDARD_WORK_HOURS = 11;
const RATE_PER_HOUR = 5000;
let DEFAULT_ALLOWANCE = 10000;
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
    const [sRes, cRes, eRes, cashRes, attRes, advRes, mRes] = await Promise.all([
      db.from('sales').select('*'),
      db.from('counter').select('*'),
      db.from('expenses').select('*'),
      db.from('cash_positions').select('*'),
      db.from('attendance').select('*'),
      db.from('advances').select('*'),
      db.from('master_salary').select('*')
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

/* ========================================
   DASHBOARD
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
    <div class="report-row">
      <span>${label}</span><span>:</span><span>Rp</span>
      <span class="amount">${display}</span>
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
    const totalKonterVal = totalCounter(counter); // BUG 1 FIXED: Ubah nama variabel agar tidak bentrok dengan fungsi totalCounter

    const diffCash = Number(sales.cash || 0) - Number(counter.cash || 0);
    const diffDebit = Number(sales.debit_card || 0) - Number(counter.debit_card || 0);
    const diffGrab = Number(sales.grab || 0) - Number(counter.grab || 0);
    const diffQris = Number(sales.qris || 0) - Number(counter.qris || 0);

    const dateObject = new Date(selectedDate + 'T00:00:00');
    const formattedDate = isNaN(dateObject) ? selectedDate : dateObject.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const statusInfo = (!salesFound && !counterFound) 
      ? `<div style="text-align:center; padding: 10px; color: var(--danger); font-weight: bold; margin-bottom: 10px;">Belum ada data penjualan pada tanggal ini.</div>` 
      : '';

    resultEl.innerHTML = `
      <div class="report-container">
        ${statusInfo}
        <div class="report" id="captureDailyReport">
          <div class="report-header">
            RUMAH MAKAN TAHU SUMEDANG<br>SARI KEDELE<br>UNIT SUBANG
          </div>
          <div class="report-red-line"></div>
          <div class="report-date">${formattedDate}</div>
          <div class="report-grid">
            <section>
              <div class="report-section-title">LAPORAN PENDAPATAN ESB</div>
              ${reportRow('MAKANAN', sales.makanan)}
              ${reportRow('MINUMAN', sales.minuman)}
              ${reportRow('TAHU', sales.tahu)}
              ${reportRow('GORENGAN', sales.gorengan)}
              ${reportRow('LAIN-LAIN', sales.lain_lain)}
              <div class="report-total">${reportRow('TOTAL PENDAPATAN', totalEsb)}</div>
              ${reportRow('PAJAK', sales.pajak)}
              <div class="report-payment">
                ${reportRow('CASH', sales.cash)}
                ${reportRow('DEBIT CARD', sales.debit_card)}
                ${reportRow('GRAB', sales.grab)}
                ${reportRow('QRIS', sales.qris)}
              </div>
            </section>
            <section>
              <div class="report-section-title">LAPORAN PENDAPATAN KONTER</div>
              ${reportRow('CASH', counter.cash)}
              ${reportRow('DEBIT CARD', counter.debit_card)}
              ${reportRow('GRAB', counter.grab)}
              ${reportRow('QRIS', counter.qris)}
              <div class="report-total">${reportRow('TOTAL PENDAPATAN', totalKonterVal)}</div>
              <div class="report-selisih">SELISIH</div>
              ${reportRow('CASH', diffCash)}
              ${reportRow('DEBIT CARD', diffDebit)}
              ${reportRow('GRAB', diffGrab)}
              ${reportRow('QRIS', diffQris)}
            </section>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Gagal memuat laporan:', error);
    resultEl.innerHTML = `
      <div class="alert alert-danger" style="color:var(--danger); padding: 15px; border: 1px solid var(--danger); border-radius: 8px;">
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
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width: 35%;">Sumber</th><th style="width: 25%;">Nominal (Rp)</th><th>Keterangan</th><th style="width: 8%;" class="center">Aksi</th></tr></thead>
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
    const cash = DB.cash[DB.cash.length - 1] || {};
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">Posisi Saldo Kas</div>
        <form id="cashForm">
          <div class="form-grid">
            ${inputField('tanggal', 'Tanggal', cash.tanggal || today(), 'date')}
            ${inputField('saldo_harian', 'Saldo Harian', cash.saldo_harian)}
            ${inputField('belanja_malam', 'Belanja Malam', cash.belanja_malam)}
          </div>
          <div class="actions"><button class="btn btn-primary" type="submit">Simpan Posisi Kas</button></div>
        </form>
      </div>
    `;
    $('cashForm').onsubmit = async e => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      const { error } = await db.from('cash_positions').upsert([formData], { onConflict: 'tanggal' });
      if (error) showToast('Gagal: ' + error.message);
      else { showToast('Posisi kas disimpan.'); loadData('expense'); }
    };
  }
}

function addExpenseRow() {
  const tr = document.createElement('tr');
  tr.className = 'expense-input-row';
  tr.innerHTML = `
    <td><input type="text" class="exp-sumber" placeholder="Nama..." style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="number" class="exp-nominal" placeholder="0" min="0" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td><input type="text" class="exp-keterangan" placeholder="-" style="width:100%; padding: 10px; border: 1px solid var(--line); border-radius: 8px;"></td>
    <td class="center"><button type="button" class="btn btn-outline-danger" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  $('batchExpenseBody').appendChild(tr);
}

async function submitBatchExpenses() {
  const tanggal = $('batchExpenseDate').value;
  const items = [];
  document.querySelectorAll('.expense-input-row').forEach(r => {
    const s = r.querySelector('.exp-sumber').value.trim();
    const n = r.querySelector('.exp-nominal').value.trim();
    const k = r.querySelector('.exp-keterangan').value.trim();
    if (s || n) items.push({ tanggal, sumber: s, nominal: Number(n || 0), keterangan: k || '-' });
  });
  if (!items.length) { showToast('Isi minimal satu baris.'); return; }
  const { error } = await db.from('expenses').insert(items);
  if (error) showToast('Gagal: ' + error.message);
  else { showToast('Pengeluaran berhasil disimpan.'); loadData('expense'); }
}

function loadExpenseReport() {
  const dateEl = $('expenseReportDate');
  if (!dateEl) return;
  const date = dateEl.value;

  const cashRow = DB.cash.find(r => formatDate(r.tanggal) === date) || {};
  const dayExpenses = DB.expenses.filter(r => formatDate(r.tanggal) === date);
  const totalPemasukan = Number(cashRow.saldo_harian || 0) + Number(cashRow.belanja_malam || 0);
  const totalPengeluaran = sum(dayExpenses.map(r => r.nominal));
  const sisaSaldo = totalPemasukan - totalPengeluaran;

  const dateObject = new Date(date + 'T00:00:00');
  const formattedDate = dateObject.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  let expenseRows = dayExpenses.length > 0 ? dayExpenses.map((expense, i) => `
    <tr>
      <td class="no">${i + 1}</td>
      <td class="source">${escapeHtml(expense.sumber || '')}</td>
      <td class="nominal">Rp ${Number(expense.nominal || 0).toLocaleString('id-ID')}</td>
    </tr>
  `).join('') : `<tr><td colspan="3" class="center" style="color:var(--muted); height:35px;">Tidak ada pengeluaran</td></tr>`;

  $('expenseReportResult').innerHTML = `
    <div class="expense-report-wrapper">
      <div class="expense-report" id="captureExpenseReport">
        <div class="expense-report-header">
          <div>POSISI KEUANGAN TUNAI</div><div>LAPORAN:</div>
        </div>
        <div class="expense-report-header" style="margin-bottom: 15px;">
          <div>: &nbsp; ${formattedDate}</div><div></div>
        </div>
        <div class="expense-report-grid">
          <section>
            <div class="expense-report-title">SUMBER SALDO</div>
            <table class="expense-table">
              <thead><tr><th class="no">NO</th><th>SUMBER</th><th class="nominal">NOMINAL</th></tr></thead>
              <tbody>
                <tr><td class="no">1</td><td class="source">SALDO HARIAN</td><td class="nominal">Rp ${Number(cashRow.saldo_harian || 0).toLocaleString('id-ID')}</td></tr>
                <tr><td class="no">2</td><td class="source">BELANJA MALAM</td><td class="nominal">Rp ${Number(cashRow.belanja_malam || 0).toLocaleString('id-ID')}</td></tr>
                <tr class="expense-total-row"><td colspan="2" style="text-align: center;">TOTAL PEMASUKAN</td><td class="nominal">Rp ${Number(totalPemasukan).toLocaleString('id-ID')}</td></tr>
              </tbody>
            </table>
          </section>
          <section>
            <div class="expense-report-title">PENGELUARAN</div>
            <table class="expense-table">
              <thead><tr><th class="no">NO</th><th>SUMBER</th><th class="nominal">NOMINAL</th></tr></thead>
              <tbody>
                ${expenseRows}
                <tr class="expense-total-row"><td colspan="2" style="text-align: center;">TOTAL PENGELUARAN</td><td class="nominal">Rp ${Number(totalPengeluaran).toLocaleString('id-ID')}</td></tr>
              </tbody>
            </table>
          </section>
        </div>
        <div class="expense-report-footer" style="margin-top: 15px;">
          <div>SISA SALDO TUNAI</div><div style="text-align: right;">Rp ${Number(sisaSaldo).toLocaleString('id-ID')}</div>
        </div>
      </div>
    </div>
  `;
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
    <tr>
      <td class="center">${i+1}</td>
      <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
      <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
      <td class="center">${r.c.shift}</td>
      <td class="center" style="font-weight:700; color:var(--wa-primary);">${r.c.displayTime}</td>
      <td class="center" style="color:var(--muted); font-size:11px;">Maks ${r.c.batas}</td>
      <td class="center"><span class="badge badge-success">✓ Tepat Waktu</span></td>
      <td class="right" style="font-weight:700; color:var(--wa-primary);">+${money(DEFAULT_ALLOWANCE)}</td>
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
    const diff = durasi > 0 ? (durasi - 11) : 0;
    const nominal = Math.round(diff * 5000);
    return `
      <tr>
        <td class="center">${i+1}</td>
        <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
        <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
        <td class="center">${r.masuk || '-'}</td>
        <td class="center">${r.pulang || '-'}</td>
        <td class="center">${durasi ? durasi.toFixed(2) + ' Jam' : '-'}</td>
        <td class="center" style="font-weight:700; color:${diff >= 0 ? 'var(--wa-primary)' : 'var(--danger)'};">${diff !== 0 ? (diff > 0 ? '+' : '') + diff.toFixed(2) + ' Jam' : 'Pas'}</td>
        <td class="right" style="font-weight:700; color:${nominal >= 0 ? 'var(--wa-primary)' : 'var(--danger)'};">${nominal !== 0 ? (nominal > 0 ? '+' : '') + money(nominal) : 'Rp 0'}</td>
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
      const periodMatch = periodText.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
      if (periodMatch) {
        startYear = parseInt(periodMatch[1], 10);
        startMonth = parseInt(periodMatch[2], 10);
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

            const dateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const punchStr = String(punchRow[col] || '').trim();
            const times = punchStr.split(/[\n\r]+/).map(t => t.trim()).filter(t => t.includes(':'));

            parsedRecords.push({
              tanggal: dateStr,
              nama: namaVal,
              departemen: deptVal,
              masuk: times.length > 0 ? times[0] : '',
              pulang: times.length > 1 ? times[times.length - 1] : '',
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
  if (btnRekap && btnSlip) {
    btnRekap.classList.toggle('active-sub', type === 'rekap');
    btnSlip.classList.toggle('active-sub', type === 'slips');
  }

  const allDepts = Array.from(new Set((DB.masterSalary || []).map(r => String(r.departemen || '').trim()))).sort();
  const deptOptionsHtml = allDepts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  let defaultStart = today();
  let defaultEnd = today();

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
  } else {
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
            <input type="text" id="slipPrintDate" value="Subang, 01 September 2026" onchange="renderSlipPages()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; width: 100%;">
          </div>
          <button class="btn btn-primary" onclick="exportSlipsToPDF()">📥 Download PDF Slip Gaji</button>
        </div>
      </div>
      <div class="slip-container" id="slipPrintContainer"></div>
    `;
    renderSlipPages();
  }
}

function getCalculatedPayrollList(sDate, eDate, fDept) {
  let masterList = DB.masterSalary || [];
  if (fDept !== 'ALL') {
    masterList = masterList.filter(r => String(r.departemen).trim().toUpperCase() === fDept.toUpperCase());
  }
  masterList.sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  return masterList.map(emp => {
    const nmKey = String(emp.nama || '').trim().toUpperCase();
    const lainLain = (nmKey === "ZAENAL ARIFIN") ? DEFAULT_BONUS_LAIN : 0;
    const cicilanTetap = Number(emp.cicilan || 0);

    const gajiPokok = Number(emp.gaji_pokok || 0);
    const jabatan = Number(emp.jabatan || 0);
    const prestasi = Number(emp.prestasi || 0);
    const kesehatan = Number(emp.kesehatan || 0);
    const zakat = Number(emp.zakat || 0);
    const loyalitas = Number(emp.kebersihan_loyalitas || 0);

    const totalPendapatan = gajiPokok + jabatan + prestasi + kesehatan + zakat + loyalitas + lainLain;
    const totalPotongan = cicilanTetap;
    const gajiBersih = Math.max(0, totalPendapatan - totalPotongan);

    return {
      nama: emp.nama,
      departemen: emp.departemen,
      pokok: gajiPokok,
      jabatan: jabatan,
      prestasi: prestasi,
      kesehatan: kesehatan,
      jamKerja: 0,
      zakat: zakat,
      loyalitas: loyalitas,
      lainLain: lainLain,
      kasbon: cicilanTetap,
      bpjs: 0,
      cicilan: 0,
      gajiBersih: gajiBersih
    };
  });
}

function renderPayrollCards() {
  const sDate = $('payrollStartDate')?.value || today();
  const eDate = $('payrollEndDate')?.value || today();
  const fDept = $('payrollFilterDept')?.value || 'ALL';

  const container = $('payrollCardsContainer');
  if (!container) return;

  const list = getCalculatedPayrollList(sDate, eDate, fDept);

  if (!list.length) {
    container.innerHTML = `<div class="panel" style="text-align: center; color: var(--muted);">Belum ada data gaji.</div>`;
    return;
  }

  container.innerHTML = list.map(emp => {
    const totalPendapatan = emp.pokok + emp.jabatan + emp.prestasi + emp.kesehatan + emp.jamKerja + emp.zakat + emp.loyalitas + emp.lainLain;
    const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;

    return `
      <div class="panel" style="margin-top:0; border-left: 4px solid var(--wa-primary);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 16px;">${escapeHtml(emp.nama)}</div>
            <span class="badge badge-dept" style="margin-top: 4px;">${escapeHtml(emp.departemen)}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--muted); font-weight: 700;">GAJI BERSIH</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--wa-primary);">${money(emp.gajiBersih)}</div>
          </div>
        </div>
        <div style="font-size: 12.5px; color: var(--muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid var(--line); padding-top: 8px;">
          <div>Pokok: <b>${money(emp.pokok)}</b></div>
          <div>Tunjangan: <b>${money(totalPendapatan - emp.pokok)}</b></div>
          <div>Potongan: <b style="color:var(--danger);">${money(totalPotongan)}</b></div>
          <div>Total Bruto: <b>${money(totalPendapatan)}</b></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSlipPages() {
  const sDate = $('slipStartDate')?.value || today();
  const eDate = $('slipEndDate')?.value || today();
  const fDept = $('slipFilterDept')?.value || 'ALL';
  const printDate = $('slipPrintDate')?.value || `Subang, ${today()}`;

  const container = $('slipPrintContainer');
  if (!container) return;

  const list = getCalculatedPayrollList(sDate, eDate, fDept);

  if (!list.length) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--muted); background: white;">Tidak ada data.</div>`;
    return;
  }

  const periodMonth = getMonthName(sDate).toUpperCase() || 'AGUSTUS 2026';
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
          <div class="slip-row"><span>JAM KERJA</span><span>Rp</span><span class="right">${formatNum(emp.jamKerja)}</span></div>
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

function getMonthName(dateStr) {
  if (!dateStr) return '';
  const m = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const p = dateStr.split('-');
  if (p.length >= 2) {
    const idx = parseInt(p[1], 10) - 1;
    return (m[idx] || '') + ' ' + p[0];
  }
  return '';
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
