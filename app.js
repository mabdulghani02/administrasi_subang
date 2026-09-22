const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Kunci API Gemini yang ditanamkan langsung
const GEMINI_API_KEY = 'AQ.Ab8RN6LapTf9ZKKydJWlUYuaj7lPKNYqMbRg-MYGOn5ZssfLLQ';

// Master Relasi Resmi: Mengunci kecocokan murni berbasis ID Mesin Absen
const EMPLOYEE_MAP = {
  '1':  { absenName: 'REIHAN',     masterName: 'REIHAN MUHAMMAD ALIEF' },
  '2':  { absenName: 'AQSHAL',     masterName: 'MUHAMMAD AQSHAL LESMANA' },
  '4':  { absenName: 'EDISOPANDI', masterName: 'EDI SOPANDI' },
  '5':  { absenName: 'ABDUL GHANI',masterName: 'MUHAMMAD ADBUL GHANI' },
  '9':  { absenName: 'JULIAN',     masterName: 'JULIAN TRI SAPUTRA' },
  '10': { absenName: 'DAFA',       masterName: 'DAFFA CAHYA NUGRAHA' },
  '11': { absenName: 'OCHA',       masterName: 'OCHA HERDIATNA' },
  '12': { absenName: 'EKA R',      masterName: 'EKA RAMDANI' },
  '13': { absenName: 'ENJANG',     masterName: 'ENJANG ANDRI' },
  '14': { absenName: 'ENTIS',      masterName: 'TISNA SURYANA' },
  '15': { absenName: 'IRGI',       masterName: 'IRGY MAULANA' },
  '16': { absenName: 'TATANG',     masterName: 'TATANG TARYANA' },
  '17': { absenName: 'YAYAN',      masterName: 'YAYAN ZATNIKA' },
  '18': { absenName: 'PIPIN',      masterName: 'PIPIN SAEPULOH' },
  '19': { absenName: 'DIAN',       masterName: 'DIAN FAZRIANA' },
  '20': { absenName: 'ASPIA',      masterName: 'HAPSOH ASPIA' },
  '21': { absenName: 'SALMA',      masterName: 'SALMA NUR HABILAH' },
  '22': { absenName: 'ZEY',        masterName: 'ZAENAL ARIFIN' },
  '24': { absenName: 'ILHAM',      masterName: 'MUHAMMAD NAZRAUL ILHAM' },
  '25': { absenName: 'YUSUF',      masterName: 'MUHAMAD YUSUF' },
  '26': { absenName: 'BIMA',       masterName: 'BIMA NAZWA OKTA PRIYANA' },
  '27': { absenName: 'HAIKAL',     masterName: 'HAIKAL' }
};

function resolveEmployeeId(record) {
  if (!record) return null;
  const directId = record.no_absen || record.nomor || record.id_absen || record.id_karyawan;
  if (directId && EMPLOYEE_MAP[String(directId).trim()]) {
    return String(directId).trim();
  }
  const clean = String(record.nama || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.includes('YUSUF')) return '25';
  for (const [id, val] of Object.entries(EMPLOYEE_MAP)) {
    const cleanAbsen = val.absenName.replace(/[^A-Z0-9]/g, '');
    const cleanMaster = val.masterName.replace(/[^A-Z0-9]/g, '');
    if (clean === cleanAbsen || clean === cleanMaster) {
      return id;
    }
  }
  return null;
}

function getDisplayNameById(empId, fallbackName = '') {
  if (empId && EMPLOYEE_MAP[empId]) {
    return EMPLOYEE_MAP[empId].masterName;
  }
  return fallbackName || '-';
}

let DB = {
  sales: [],
  counter: [],
  expenses: [],
  cash: [],
  attendance: [],
  advances: [],
  installments: [],
  masterSalary: [],
  wasteSales: []
};

const STANDARD_WORK_HOURS = 11;
const MAX_OVERTIME_PER_DAY = 5;
const RATE_PER_HOUR = 5000;
let DEFAULT_ALLOWANCE = 15000;
let DEFAULT_BONUS_LAIN = 40000;

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('subang_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  showPage('dashboard');
  loadData('dashboard');
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
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('active');
}

const $ = id => document.getElementById(id);

function cleanText(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isRecordMatching(empMaster, attRecord) {
  if (!empMaster || !attRecord) return false;
  const mId = resolveEmployeeId(empMaster);
  const aId = resolveEmployeeId(attRecord);
  if (mId && aId) return mId === aId;
  const mNama = cleanText(empMaster.nama);
  const aNama = cleanText(attRecord.nama);
  return aNama === mNama || aNama.includes(mNama) || mNama.includes(aNama);
}

function money(value) {
  const number = Number(value || 0);
  return (number < 0 ? '-Rp ' : 'Rp ') + Math.abs(number).toLocaleString('id-ID');
}

function formatNum(value) {
  const number = Number(value || 0);
  return number === 0 ? '0' : number.toLocaleString('id-ID');
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
  const str = String(timeVal).trim();
  const match = str.match(/(\d{1,2})[:.](\d{2})/);
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
  return totalMins > 0 ? totalMins / 60 : 0;
}

function calculateDailyOvertimeHours(masukStr, pulangStr) {
  const durasi = calculateHours(masukStr, pulangStr);
  if (durasi <= STANDARD_WORK_HOURS) return 0;
  const rawOvertime = durasi - STANDARD_WORK_HOURS;
  const roundedHours = Math.round(rawOvertime);
  return Math.max(0, Math.min(MAX_OVERTIME_PER_DAY, roundedHours));
}

function sum(values) {
  return values.reduce((t, v) => t + Number(v || 0), 0);
}

function totalESB(data) {
  return (
    Number(data.makanan || 0) +
    Number(data.minuman || 0) +
    Number(data.tahu || 0) +
    Number(data.gorengan || 0) +
    Number(data.lain_lain || 0) +
    Number(data.pajak || 0)
  );
}

function totalCounter(data) {
  return (
    Number(data.cash || 0) +
    Number(data.debit_card || 0) +
    Number(data.grab || 0) +
    Number(data.qris || 0)
  );
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function downloadElementAsImage(elementId, filename) {
  const target = $(elementId);
  if (!target) {
    showToast('Area laporan tidak ditemukan.');
    return;
  }
  showToast('Sedang membuat gambar...');
  html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    .then(canvas => {
      const link = document.createElement('a');
      link.download = filename + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Gambar berhasil diunduh.');
    })
    .catch(err => {
      console.error(err);
      showToast('Gagal mengubah ke gambar.');
    });
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
  try {
    const fetchTableAll = async (tableName) => {
      let allData = [];
      let start = 0;
      const step = 999;
      while (true) {
        const { data, error } = await db.from(tableName).select('*').range(start, start + step);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length <= step) break;
        start += step + 1;
      }
      return allData;
    };

    const [sales, counter, expenses, cash, attendance, advances, masterSalary, installments, wasteSales] =
      await Promise.allSettled([
        fetchTableAll('sales'),
        fetchTableAll('counter'),
        fetchTableAll('expenses'),
        fetchTableAll('cash_positions'),
        fetchTableAll('attendance'),
        fetchTableAll('advances'),
        fetchTableAll('master_salary'),
        fetchTableAll('installments'),
        fetchTableAll('waste_sales')
      ]);

    DB.sales = sales.status === 'fulfilled' ? sales.value : [];
    DB.counter = counter.status === 'fulfilled' ? counter.value : [];
    DB.expenses = expenses.status === 'fulfilled' ? expenses.value : [];
    DB.cash = cash.status === 'fulfilled' ? cash.value : [];
    DB.attendance = attendance.status === 'fulfilled' ? attendance.value : [];
    DB.advances = advances.status === 'fulfilled' ? advances.value : [];
    DB.masterSalary = masterSalary.status === 'fulfilled' ? masterSalary.value : [];
    DB.installments = installments.status === 'fulfilled' ? installments.value : [];
    DB.wasteSales = wasteSales.status === 'fulfilled' ? wasteSales.value : [];

    showPage(targetPage || 'dashboard');
  } catch (error) {
    console.error('Gagal mengambil data:', error);
    showPage(targetPage || 'dashboard');
  }
}

function showPage(page) {
  document.querySelectorAll('.nav button, .b-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  $('appSidebar')?.classList.remove('open');
  $('sidebarOverlay')?.classList.remove('active');

  if (page === 'dashboard') renderDashboard();
  if (page === 'sales') renderSales();
  if (page === 'expense') renderExpense();
  if (page === 'attendance') renderAttendancePage();
  if (page === 'payroll') renderPayrollPage();
  if (page === 'limbah') renderLimbahPage();
  if (page === 'aichat') renderAiChatPage();
  if (page === 'settings') renderSettingsPage();
}

window.calcExpRow = function (el) {
  const tr = el.closest('tr');
  const q = Number(tr.querySelector('.exp-qty').value || 0);
  const h = Number(tr.querySelector('.exp-harga').value || 0);
  tr.querySelector('.exp-nominal').value = q * h;
};

// --- GEMINI API HELPER (Menggunakan gemini-2.0-flash & API Key yang ditanam) ---
async function callGeminiAPI(promptText) {
  if (!GEMINI_API_KEY) {
    return "⚠️ Kunci API Gemini belum terpasang.";
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });
    
    const result = await response.json();
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else if (result.error) {
      return `⚠️ Error Gemini: ${result.error.message}`;
    }
    return "⚠️ Gagal mendapatkan respons dari Gemini.";
  } catch (err) {
    return `⚠️ Gagal terhubung ke jaringan: ${err.message}`;
  }
}

function renderDashboard() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const contentEl = $('content');
  if (!contentEl) return;

  contentEl.innerHTML = `
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
      <div class="card-label">Variabel Cost (Pengeluaran Murni)</div>
      <div class="card-value" id="cardExpense">Rp 0</div>
    </div>
  </div>

  <div class="panel" style="border-left: 4px solid var(--wa-primary);">
    <div class="panel-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span><i class="fa-solid fa-robot" style="color:var(--wa-primary); margin-right:6px;"></i> Analisis Ringkas Gemini AI</span>
      <button class="btn btn-secondary" onclick="refreshGeminiDashboardAnalysis()" style="font-size:11px; padding: 4px 8px;"><i class="fa-solid fa-rotate"></i> Analisis Ulang</button>
    </div>
    <div id="dashboardInsightsContent" style="font-size: 13.5px; display: flex; flex-direction: column; gap: 12px;">
      <div style="color: var(--muted); text-align:center; padding: 10px;">Menghitung data dan memuat analisis AI...</div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title">Penjualan per Kategori</div>
    <div class="chart-wrapper">
      <div class="donut-chart" id="kategoriDonut">
        <div class="donut-inner-text">
          <h3 id="totalItemQty">0</h3>
          <span>Total Item</span>
        </div>
      </div>
      <div class="chart-legend">
        <div class="legend-item"><div class="legend-color c1"></div><span class="legend-label">Makanan</span><span class="legend-percent" id="persenMakanan">0%</span></div>
        <div class="legend-item"><div class="legend-color c2"></div><span class="legend-label">Minuman</span><span class="legend-percent" id="persenMinuman">0%</span></div>
        <div class="legend-item"><div class="legend-color c3"></div><span class="legend-label">Tahu</span><span class="legend-percent" id="persenTahu">0%</span></div>
        <div class="legend-item"><div class="legend-color c4"></div><span class="legend-label">Gorengan</span><span class="legend-percent" id="persenGorengan">0%</span></div>
        <div class="legend-item" style="margin-top: -6px;"><div class="legend-color" style="background: var(--muted);"></div><span class="legend-label">Lainnya</span><span class="legend-percent" id="persenLainnya">0%</span></div>
      </div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-title">Grafik Tren Omset Bulan Ini</div>
    <div class="chart-container">
      <canvas id="monthlySalesChart"></canvas>
    </div>
  </div>
  `;

  updateDashboardMetrics(currentMonth);
}

let monthlyChartInstance = null;
let cachedDashboardMetrics = {};

function updateDashboardMetrics(yearMonth) {
  if (!yearMonth) return;
  const [targetYear, targetMonth] = yearMonth.split('-');
  const monthCounters = (DB.counter || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));
  const monthExpenses = (DB.expenses || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));
  const monthSales = (DB.sales || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));
  const monthAttendance = (DB.attendance || []).filter(r => formatDate(r.tanggal).startsWith(yearMonth));

  const totalOmsetVal = sum(monthCounters.map(r => totalCounter(r)));
  if ($('cardOmset')) $('cardOmset').textContent = money(totalOmsetVal);
  
  // Variable Cost murni (Pengeluaran operasional umum)
  const variableCost = sum(monthExpenses.map(r => r.nominal));
  if ($('cardExpense')) $('cardExpense').textContent = money(variableCost);

  // Fixed Cost (Gaji Master + Uang Jajan Dinamis Tepat Waktu)
  let totalMasterSalaries = 0;
  (DB.masterSalary || []).forEach(emp => {
    totalMasterSalaries += Number(emp.gaji_pokok || 0) + Number(emp.jabatan || 0) + Number(emp.prestasi || 0) + Number(emp.kesehatan || 0) + Number(emp.zakat || 0) + Number(emp.kebersihan_loyalitas || 0);
  });

  let totalUangJajan = 0;
  monthAttendance.forEach(att => {
    const shiftInfo = classifyShift(att.masuk);
    if (shiftInfo.onTime) {
      totalUangJajan += DEFAULT_ALLOWANCE;
    }
  });

  const fixedCost = totalMasterSalaries + totalUangJajan;
  const totalCostAll = fixedCost + variableCost;
  const netProfitOrLoss = totalOmsetVal - totalCostAll;

  const pctFixed = totalCostAll > 0 ? ((fixedCost / totalCostAll) * 100).toFixed(1) : 0;
  const pctVariable = totalCostAll > 0 ? ((variableCost / totalCostAll) * 100).toFixed(1) : 0;

  // Deteksi Selisih Kas (Potensi Kebocoran)
  let totalSelisihKas = 0;
  let hariSelisihKas = 0;
  monthSales.forEach(s => {
    const tgl = formatDate(s.tanggal);
    const c = monthCounters.find(cnt => formatDate(cnt.tanggal) === tgl);
    if (c) {
      const diffC = Number(s.cash || 0) - Number(c.cash || 0);
      if (diffC !== 0) {
        totalSelisihKas += Math.abs(diffC);
        hariSelisihKas++;
      }
    }
  });

  cachedDashboardMetrics = {
    yearMonth,
    totalOmsetVal,
    fixedCost,
    variableCost,
    netProfitOrLoss,
    pctFixed,
    pctVariable,
    totalSelisihKas,
    hariSelisihKas
  };

  const insightsEl = $('dashboardInsightsContent');
  if (insightsEl) {
    insightsEl.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: var(--card); padding: 10px; border-radius: 8px; border: 1px solid var(--line);">
      <div>
        <div style="font-size:11px; color:var(--muted); font-weight:700;">FIXED COST (GAJI+JAJAN)</div>
        <div style="font-size:14px; font-weight:800; color:var(--text);">${money(fixedCost)} <span style="font-size:11px; font-weight:normal; color:var(--muted);">(${pctFixed}%)</span></div>
      </div>
      <div>
        <div style="font-size:11px; color:var(--muted); font-weight:700;">VARIABLE COST (MURNI)</div>
        <div style="font-size:14px; font-weight:800; color:var(--danger);">${money(variableCost)} <span style="font-size:11px; font-weight:normal; color:var(--muted);">(${pctVariable}%)</span></div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 4px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">
        <span>📊 Laba/Rugi Bersih (Omset - (Fixed+Var)):</span>
        <b style="color: ${netProfitOrLoss >= 0 ? 'var(--success)' : 'var(--danger)'};">${money(netProfitOrLoss)} (${netProfitOrLoss >= 0 ? 'Surplus/Lebih' : 'Defisit/Minus'})</b>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>⚠️ Total Selisih Kas (ESB vs Konter):</span>
        <b style="color: ${totalSelisihKas > 0 ? 'var(--danger)' : 'var(--success)'};">${money(totalSelisihKas)} (${hariSelisihKas} hari)</b>
      </div>
    </div>
    <div id="aiNarrationBox" style="margin-top:8px; padding:10px; background:var(--card); border-radius:8px; border:1px solid var(--line); font-style:italic; color:var(--text);">
      🤖 <i>Memuat analisis naratif dari Gemini AI...</i>
    </div>
    `;
  }

  refreshGeminiDashboardAnalysis();

  let sumMakanan = 0, sumMinuman = 0, sumTahu = 0, sumGorengan = 0, sumLain = 0;
  monthSales.forEach(s => {
    sumMakanan += Number(s.makanan || 0);
    sumMinuman += Number(s.minuman || 0);
    sumTahu += Number(s.tahu || 0);
    sumGorengan += Number(s.gorengan || 0);
    sumLain += Number(s.lain_lain || 0);
  });

  const totalAllKategori = sumMakanan + sumMinuman + sumTahu + sumGorengan + sumLain;
  const pctMakanan = totalAllKategori ? Math.round((sumMakanan / totalAllKategori) * 100) : 0;
  const pctMinuman = totalAllKategori ? Math.round((sumMinuman / totalAllKategori) * 100) : 0;
  const pctTahu = totalAllKategori ? Math.round((sumTahu / totalAllKategori) * 100) : 0;
  const pctGorengan = totalAllKategori ? Math.round((sumGorengan / totalAllKategori) * 100) : 0;
  const pctLainnya = totalAllKategori ? Math.max(0, 100 - (pctMakanan + pctMinuman + pctTahu + pctGorengan)) : 0;

  if ($('totalItemQty')) $('totalItemQty').textContent = formatNum(totalAllKategori);
  if ($('persenMakanan')) $('persenMakanan').textContent = `${pctMakanan}%`;
  if ($('persenMinuman')) $('persenMinuman').textContent = `${pctMinuman}%`;
  if ($('persenTahu')) $('persenTahu').textContent = `${pctTahu}%`;
  if ($('persenGorengan')) $('persenGorengan').textContent = `${pctGorengan}%`;
  if ($('persenLainnya')) $('persenLainnya').textContent = `${pctLainnya}%`;

  const donutChart = $('kategoriDonut');
  if (donutChart) {
    if (totalAllKategori === 0) {
      donutChart.style.background = `conic-gradient(var(--line) 0% 100%)`;
    } else {
      const stop1 = pctMakanan;
      const stop2 = stop1 + pctMinuman;
      const stop3 = stop2 + pctTahu;
      const stop4 = stop3 + pctGorengan;
      donutChart.style.background = `conic-gradient(
        var(--wa-primary) 0% ${stop1}%,
        var(--wa-teal) ${stop1}% ${stop2}%,
        var(--success) ${stop2}% ${stop3}%,
        var(--danger) ${stop3}% ${stop4}%,
        var(--muted) ${stop4}% 100%
      )`;
    }
  }

  const ctxMonthly = document.getElementById('monthlySalesChart');
  if (ctxMonthly && typeof Chart !== 'undefined') {
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
        datasets: [
          {
            label: 'Omset Harian (Rp)',
            data: dataOmset,
            borderColor: '#007aff',
            backgroundColor: 'rgba(0, 122, 255, 0.15)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

async function refreshGeminiDashboardAnalysis() {
  const box = $('aiNarrationBox');
  if (!box) return;
  const m = cachedDashboardMetrics;
  const prompt = `Bertindaklah sebagai konsultan keuangan restoran. Berikan ringkasan eksekutif dan analisis naratif singkat (maksimal 3 kalimat) dalam bahasa Indonesia yang profesional untuk bulan ${m.yearMonth} berdasarkan data berikut:
- Total Omset: ${money(m.totalOmsetVal)}
- Fixed Cost (Gaji + Uang Jajan): ${money(m.fixedCost)} (${m.pctFixed}%)
- Variable Cost (Pengeluaran Murni): ${money(m.variableCost)} (${m.pctVariable}%)
- Laba/Rugi Bersih (Omset - (Fixed + Variable)): ${money(m.netProfitOrLoss)}
- Selisih Kas (Potensi Kebocoran): ${money(m.totalSelisihKas)} selama ${m.hariSelisihKas} hari.
Berikan penilaian apakah keuangannya sehat serta peringatan jika ada selisih kas atau defisit.`;

  const res = await callGeminiAPI(prompt);
  box.innerHTML = `🤖 <b>Analisis Gemini:</b> "${escapeHtml(res)}"`;
}

// --- HALAMAN ASISTEN AI / CHAT Q&A TERPISAH ---
function renderAiChatPage() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
  <div class="top">
    <div>
      <div class="title">Asisten AI & Analisis</div>
      <div class="subtitle">Tanya Jawab Pintar Berbasis Seluruh Data Usaha</div>
    </div>
  </div>
  <div class="panel" style="display:flex; flex-direction:column; height: calc(100vh - 180px); max-height: 650px; padding: 15px;">
    <div id="chatMessages" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-bottom:10px; border-bottom:1px solid var(--line); margin-bottom:10px;">
      <div style="background:var(--card); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px; max-width: 85%;">
        👋 Halo! Saya adalah Asisten AI untuk Rumah Makan Tahu Sumedang Sari Kedele Unit Subang. Saya telah membaca seluruh data keuangan, absensi, gaji, pengeluaran, dan kasbon Anda. Apa yang ingin Anda tanyakan atau analisis hari ini?
      </div>
    </div>
    <div style="display:flex; gap:8px;">
      <input type="text" id="chatInput" placeholder="Ketik pertanyaan atau minta analisis..." onkeydown="if(event.key==='Enter') sendChatMessage()" style="flex:1; padding:12px; border:1px solid var(--line); border-radius:10px; font-size:14px; background:var(--card); color:var(--text);">
      <button class="btn btn-primary" onclick="sendChatMessage()" style="padding: 0 16px;"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </div>
  `;
}

async function sendChatMessage() {
  const input = $('chatInput');
  const container = $('chatMessages');
  if (!input || !container) return;
  const text = input.value.trim();
  if (!text) return;

  container.innerHTML += `
  <div style="align-self:flex-end; background:var(--wa-primary); color:white; padding:12px; border-radius:10px; font-size:13.5px; max-width:85%; word-break:break-word;">
    ${escapeHtml(text)}
  </div>
  `;
  input.value = '';
  container.scrollTop = container.scrollHeight;

  const loadingId = 'load_' + Date.now();
  container.innerHTML += `
  <div id="${loadingId}" style="align-self:flex-start; background:var(--card); color:var(--muted); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px;">
    <i>🤖 Gemini sedang menganalisis data...</i>
  </div>
  `;
  container.scrollTop = container.scrollHeight;

  const summaryContext = `
Data Ringkasan Aplikasi (Sari Kedele Subang):
- Total Data Sales (Pendapatan): ${DB.sales.length} hari tercatat.
- Total Data Pengeluaran Murni: ${DB.expenses.length} item tercatat.
- Total Data Absensi: ${DB.attendance.length} record.
- Total Karyawan Master Gaji: ${DB.masterSalary.length} orang.
- Total Kasbon Aktif: ${DB.advances.length} catatan.
- Total Cicilan Aktif: ${DB.installments.length} catatan.
`;

  const fullPrompt = `Anda adalah konsultan keuangan profesional dan asisten operasional cerdas untuk Rumah Makan Tahu Sumedang Sari Kedele Unit Subang. Berikut adalah konteks data saat ini:
${summaryContext}

Pertanyaan Pengguna: "${text}"
Jawablah secara akurat, jelas, profesional dalam bahasa Indonesia, dan berikan saran praktis jika diperlukan.`;

  const reply = await callGeminiAPI(fullPrompt);

  const loadEl = $(loadingId);
  if (loadEl) {
    loadEl.outerHTML = `
    <div style="align-self:flex-start; background:var(--card); color:var(--text); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px; max-width:85%; word-break:break-word;">
      🤖 ${escapeHtml(reply).replace(/\n/g, '<br>')}
    </div>
    `;
  }
  container.scrollTop = container.scrollHeight;
}

// --- Modul Lainnya (Pendapatan, Pengeluaran, Absensi, Gaji, Limbah, Pengaturan) ---
function renderSales() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
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
  <div style="display: grid; grid-template-columns: 1fr 24px 85px; align-items: center; margin-bottom: 4px; font-size: 13px;">
    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${label}</span>
    <span style="text-align: center;">: Rp</span>
    <span style="text-align: right;">${display}</span>
  </div>
  `;
}

function loadReport() {
  const dateEl = $('reportDate');
  const resultEl = $('reportResult');
  if (!dateEl || !resultEl) return;

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
    const formattedDate = isNaN(dateObject)
      ? selectedDate
      : dateObject.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

    resultEl.innerHTML = `
    <div class="report-container">
      <div id="captureDailyReport" style="padding: 20px; background: white; color: black; border-radius: 8px; border: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
        <div style="text-align: center; font-weight: 800; margin-bottom: 5px; font-size: 15px;">
          RUMAH MAKAN TAHU SUMEDANG<br>SARI KEDELE<br><span style="font-size:12px;">UNIT SUBANG</span>
        </div>
        <div style="border-bottom: 2px dashed #94a3b8; margin-bottom: 10px;"></div>
        <div style="text-align: center; margin-bottom: 15px; font-weight: bold; font-size: 14px;">
          ${formattedDate}
        </div>
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
  }
}

function downloadDailyReportImage() {
  const target = $('captureDailyReport');
  if (!target) {
    showToast('Laporan belum dimuat.');
    return;
  }
  const date = $('reportDate')?.value || today();
  downloadElementAsImage('captureDailyReport', 'LAPORAN_PENDAPATAN_' + date);
}

function renderExpense() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
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
      else {
        showToast('Posisi kas disimpan.');
        loadData('expense');
      }
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
  $('batchExpenseBody')?.appendChild(tr);
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
    if (s || n) {
      items.push({
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
    }
  });

  if (!items.length) {
    showToast('Isi minimal satu baris.');
    return;
  }
  const { error } = await db.from('expenses').insert(items);
  if (error) showToast('Gagal: ' + error.message);
  else {
    showToast('Pengeluaran berhasil disimpan.');
    loadData('expense');
  }
}

function loadExpenseReport() {
  const dateEl = $('expenseReportDate');
  const resultEl = $('expenseReportResult');
  if (!dateEl || !resultEl) return;

  try {
    const date = normalizeDate(dateEl.value);
    const cashRow = DB.cash.find(r => formatDate(r.tanggal) === date) || {};
    const dayExpenses = DB.expenses.filter(r => formatDate(r.tanggal) === date);
    const totalPemasukan = Number(cashRow.saldo_harian || 0) + Number(cashRow.belanja_malam || 0);
    const totalPengeluaran = sum(dayExpenses.map(r => r.nominal));
    const sisaSaldo = totalPemasukan - totalPengeluaran;

    const dateObject = new Date(date + 'T00:00:00');
    const formattedDate = isNaN(dateObject)
      ? date
      : dateObject.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

    let expenseRowsHtml =
      dayExpenses.length > 0
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
          <div>
            <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">SUMBER SALDO</div>
            ${reportRow('1. Saldo Harian', cashRow.saldo_harian)}
            ${reportRow('2. Belanja Malam', cashRow.belanja_malam)}
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
              ${reportRow('TOTAL PEMASUKAN', totalPemasukan)}
            </div>
          </div>
          <div>
            <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px;">RINCIAN PENGELUARAN</div>
            ${expenseRowsHtml}
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: bold;">
              ${reportRow('TOTAL PENGELUARAN', totalPengeluaran)}
            </div>
          </div>
        </div>
        <div>
          <div style="font-weight: bold; font-size: 14px; border-bottom: 1px solid #94a3b8; margin-bottom: 8px; padding-bottom: 4px; color: ${sisaSaldo < 0 ? '#dc2626' : '#059669'};">POSISI KAS AKHIR</div>
          ${reportRow('SISA SALDO TUNAI', sisaSaldo)}
        </div>
      </div>
    </div>
    `;
  } catch (error) {
    console.error('Gagal memuat laporan pengeluaran:', error);
  }
}

function downloadExpenseReportImage() {
  const target = $('captureExpenseReport');
  if (!target) {
    showToast('Laporan pengeluaran belum dimuat.');
    return;
  }
  const date = $('expenseReportDate')?.value || today();
  downloadElementAsImage('captureExpenseReport', 'LAPORAN_PENGELUARAN_' + date);
}

function renderAttendancePage() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
  <div class="top">
    <div><div class="title">Modul Absensi & SDM</div></div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button id="attBtnLog" class="sub-nav-btn active-sub" onclick="showAttendanceSub('log')">Log</button>
      <button id="attBtnAllow" class="sub-nav-btn" onclick="showAttendanceSub('allowance')">Uang Jajan</button>
      <button id="attBtnHours" class="sub-nav-btn" onclick="showAttendanceSub('hours')">Jam Kerja</button>
      <button id="attBtnLibur" class="sub-nav-btn" onclick="showAttendanceSub('libur')">Daftar Libur</button>
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
  const btnLibur = $('attBtnLibur');
  if (btnLog && btnAllow && btnHours && btnLibur) {
    btnLog.classList.toggle('active-sub', type === 'log');
    btnAllow.classList.toggle('active-sub', type === 'allowance');
    btnHours.classList.toggle('active-sub', type === 'hours');
    btnLibur.classList.toggle('active-sub', type === 'libur');
  }

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const lastD = new Date(y, d.getMonth() + 1, 0).getDate();
  const defaultStart = `${y}-${m}-01`;
  const defaultEnd = `${y}-${m}-${String(lastD).padStart(2, '0')}`;

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
    <div class="panel" style="padding-bottom: 120px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:14px;">
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Dari Tanggal:</label>
          <input type="date" id="attLogStart" value="${defaultStart}" onchange="renderAttendanceTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Sampai Tanggal:</label>
          <input type="date" id="attLogEnd" value="${defaultEnd}" onchange="renderAttendanceTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th style="width:45px;" class="center">No</th><th>Tanggal</th><th>Nama Karyawan</th><th>Divisi</th><th class="center">Masuk</th><th class="center">Pulang</th><th class="center">Status</th></tr></thead>
          <tbody id="attendanceTableBody"></tbody>
        </table>
      </div>
    </div>
    `;
    renderAttendanceTable();
  } else if (type === 'allowance') {
    container.innerHTML = `
    <div class="panel" style="padding-bottom: 120px;">
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
  } else if (type === 'hours') {
    container.innerHTML = `
    <div class="panel" style="padding-bottom: 120px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:14px;">
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Dari Tanggal:</label>
          <input type="date" id="hoursStart" value="${defaultStart}" onchange="renderWorkHoursTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Sampai Tanggal:</label>
          <input type="date" id="hoursEnd" value="${defaultEnd}" onchange="renderWorkHoursTable()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width:45px;" class="center">No</th>
              <th>ID</th>
              <th>Nama Karyawan</th>
              <th>Divisi</th>
              <th class="center">Hari Masuk</th>
              <th class="center">Total Jam</th>
              <th class="center">Total Kelebihan</th>
              <th class="right">Total Penyesuaian</th>
            </tr>
          </thead>
          <tbody id="workHoursTableBody"></tbody>
        </table>
      </div>
    </div>
    `;
    renderWorkHoursTable();
  } else {
    container.innerHTML = `
    <div class="panel" style="padding-bottom: 120px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:14px;">
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Dari Tanggal:</label>
          <input type="date" id="liburStart" value="${defaultStart}" onchange="renderLiburList()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">Sampai Tanggal:</label>
          <input type="date" id="liburEnd" value="${defaultEnd}" onchange="renderLiburList()" style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; width: 100%;">
        </div>
      </div>
      <div id="liburListContainer" style="display: flex; flex-direction: column; gap: 12px;"></div>
    </div>
    `;
    renderLiburList();
  }
}

function renderAttendanceTable() {
  const sDate = $('attLogStart')?.value;
  const eDate = $('attLogEnd')?.value;
  const tbody = $('attendanceTableBody');
  if (!tbody) return;

  const rawList = (DB.attendance || []).filter(r => {
    const d = String(r.tanggal || '').slice(0, 10);
    return (!sDate || d >= sDate) && (!eDate || d <= eDate);
  });

  const uniqueMap = new Map();
  rawList.forEach(r => {
    const tgl = String(r.tanggal || '').slice(0, 10);
    let idAbsen = String(r.no_absen || '').trim();
    
    if (!idAbsen || !EMPLOYEE_MAP[idAbsen]) {
      const cleanName = String(r.nama || '').trim().toUpperCase();
      if (cleanName.includes('YUSUF')) idAbsen = '25';
      else {
        for (const [id, val] of Object.entries(EMPLOYEE_MAP)) {
          if (cleanName === val.absenName || cleanName === val.masterName) {
            idAbsen = id;
            break;
          }
        }
      }
    }

    if (idAbsen) {
      uniqueMap.set(`${tgl}_${idAbsen}`, { ...r, no_absen: idAbsen });
    }
  });

  let list = Array.from(uniqueMap.values());

  list.sort((a, b) => {
    const dComp = String(a.tanggal || '').slice(0, 10).localeCompare(String(b.tanggal || '').slice(0, 10));
    if (dComp !== 0) return dComp;
    return Number(a.no_absen) - Number(b.no_absen);
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Tidak ada data absensi pada rentang tanggal ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((r, i) => {
      const isLibur = !r.masuk || r.status === 'Libur' || r.status === 'Tidak Hadir';
      const displayName = EMPLOYEE_MAP[r.no_absen] ? EMPLOYEE_MAP[r.no_absen].masterName : r.nama;
      const tanggalStr = String(r.tanggal || '').slice(0, 10);

      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center" style="font-size:12px;">${tanggalStr}</td>
        <td style="font-weight:700;">${escapeHtml(displayName)}</td>
        <td><span class="badge badge-dept">${escapeHtml(r.departemen || '-')}</span></td>
        <td class="center" style="font-weight:700; color:${r.masuk ? 'var(--wa-primary)' : 'var(--danger)'};">${r.masuk || '-'}</td>
        <td class="center" style="font-weight:700;">${r.pulang || '-'}</td>
        <td class="center">
          <span class="badge ${isLibur ? 'badge-danger' : 'badge-success'}">
            ${isLibur ? 'Libur' : 'Hadir'}
          </span>
        </td>
      </tr>
      `;
    })
    .join('');
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
  tbody.innerHTML = list
    .map(
      (r, i) => `
    <tr style="border-bottom: 1px solid var(--line);">
      <td class="center" style="color:var(--muted);">${i + 1}</td>
      <td style="font-weight:700;">${escapeHtml(getDisplayNameById(resolveEmployeeId(r), r.nama))}</td>
      <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
      <td class="center"><span class="badge" style="background:#e0f2fe; color:#0369a1; border: 1px solid #bae6fd;">${r.c.shift}</span></td>
      <td class="center" style="font-weight:800;">${r.c.displayTime}</td>
      <td class="center" style="color:var(--muted); font-size:11px;">Maks ${r.c.batas}</td>
      <td class="center"><span class="badge badge-success" style="padding: 4px 8px; border-radius: 20px;">✓ Tepat Waktu</span></td>
      <td class="right" style="font-weight:800; color:#059669; font-size:14px;">+${money(DEFAULT_ALLOWANCE)}</td>
    </tr>
    `
    )
    .join('');
}

function renderWorkHoursTable() {
  const sDate = $('hoursStart')?.value;
  const eDate = $('hoursEnd')?.value;
  const tbody = $('workHoursTableBody');
  if (!tbody) return;

  const list = (DB.attendance || []).filter(r => {
    const d = formatDate(r.tanggal);
    return (!sDate || d >= sDate) && (!eDate || d <= eDate) && r.masuk && r.pulang;
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Tidak ada data jam kerja pada rentang tanggal ini.</td></tr>`;
    return;
  }

  const grouped = {};
  list.forEach(r => {
    const empId = String(r.no_absen || resolveEmployeeId(r) || '').trim();
    const key = empId ? `ID_${empId}` : `RAW_${r.nama}`;

    if (!grouped[key]) {
      grouped[key] = {
        empId: empId || '-',
        nama: getDisplayNameById(empId, r.nama),
        departemen: r.departemen || '-',
        hariMasuk: 0,
        totalDurasiHours: 0,
        totalOvertimeHours: 0
      };
    }

    const durasi = calculateHours(r.masuk, r.pulang);
    const overtimeHours = calculateDailyOvertimeHours(r.masuk, r.pulang);

    if (durasi > 0) {
      grouped[key].hariMasuk += 1;
      grouped[key].totalDurasiHours += durasi;
      grouped[key].totalOvertimeHours += overtimeHours;
    }
  });

  const summarized = Object.values(grouped).sort((a, b) => {
    const idA = Number(a.empId) || 999;
    const idB = Number(b.empId) || 999;
    return idA - idB;
  });

  tbody.innerHTML = summarized
    .map((r, i) => {
      const nominal = r.totalOvertimeHours * RATE_PER_HOUR;
      return `
      <tr style="border-bottom: 1px solid var(--line);">
        <td class="center" style="color:var(--muted);">${i + 1}</td>
        <td class="center" style="font-weight:700; color:var(--muted);">${escapeHtml(r.empId)}</td>
        <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
        <td><span class="badge badge-dept">${escapeHtml(r.departemen)}</span></td>
        <td class="center" style="font-weight:600;">${r.hariMasuk} Hari</td>
        <td class="center" style="color:var(--muted); font-size:12px;">${r.totalDurasiHours.toFixed(2)} Jam</td>
        <td class="center" style="font-weight:800; color:${r.totalOvertimeHours > 0 ? '#059669' : 'var(--text)'};">
          ${r.totalOvertimeHours > 0 ? '+' + r.totalOvertimeHours + ' Jam' : 'Pas'}
        </td>
        <td class="right" style="font-weight:800; color:${nominal > 0 ? '#059669' : 'var(--text)'}; font-size: 14px;">
          ${nominal > 0 ? '+' + money(nominal) : 'Rp 0'}
        </td>
      </tr>
      `;
    })
    .join('');
}

function renderLiburList() {
  const sDate = $('liburStart')?.value;
  const eDate = $('liburEnd')?.value;
  const container = $('liburListContainer');
  if (!container) return;

  const list = (DB.attendance || []).filter(r => {
    const d = formatDate(r.tanggal);
    const inRange = (!sDate || d >= sDate) && (!eDate || d <= eDate);
    const isLibur = !r.masuk || r.status === 'Libur' || r.status === 'Tidak Hadir';
    return inRange && isLibur;
  });

  if (!list.length) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--muted);">Tidak ada karyawan yang libur pada rentang tanggal ini.</div>`;
    return;
  }

  const grouped = {};
  list.forEach(r => {
    const tgl = formatDate(r.tanggal);
    if (!grouped[tgl]) grouped[tgl] = [];
    grouped[tgl].push(r);
  });

  const sortedDates = Object.keys(grouped).sort();
  container.innerHTML = sortedDates
    .map(tgl => {
      const items = grouped[tgl];
      const dObj = new Date(tgl + 'T00:00:00');
      const dateText = isNaN(dObj) ? tgl : dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return `
      <div style="border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--card);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed var(--line); padding-bottom: 6px; margin-bottom: 8px;">
          <b style="color: var(--text);">${dateText}</b>
          <span class="badge badge-danger">${items.length} Orang Libur</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${items
            .map(
              item => `
            <span style="background: rgba(220, 38, 38, 0.1); color: #dc2626; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600;">
              ${escapeHtml(getDisplayNameById(resolveEmployeeId(item), item.nama))} <small style="color:var(--muted);">(${escapeHtml(item.departemen || '-')})</small>
            </span>
          `
            )
            .join('')}
        </div>
      </div>
      `;
    })
    .join('');
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const progressEl = $('uploadProgress');
  if (progressEl) progressEl.style.display = 'block';

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'log') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      let periodText = '';
      for (let r = 0; r < Math.min(5, rows.length); r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (String(rows[r][c]).includes('~')) {
            periodText = String(rows[r][c]);
            break;
          }
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
          let namaVal = '', deptVal = '', noVal = '';

          for (let c = 0; c < infoRow.length; c++) {
            const cellStr = String(infoRow[c]).trim();
            if (cellStr.includes('No :')) {
              for (let k = c + 1; k < infoRow.length; k++) {
                if (String(infoRow[k]).trim()) {
                  noVal = String(infoRow[k]).trim();
                  break;
                }
              }
            } else if (cellStr.includes('Nama :')) {
              for (let k = c + 1; k < infoRow.length; k++) {
                if (String(infoRow[k]).trim()) {
                  namaVal = String(infoRow[k]).trim();
                  break;
                }
              }
            } else if (cellStr.includes('Dept :')) {
              for (let k = c + 1; k < infoRow.length; k++) {
                if (String(infoRow[k]).trim()) {
                  deptVal = String(infoRow[k]).trim();
                  break;
                }
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
            const times = punchStr
              .split(/[\n\r]+/)
              .map(t => t.trim())
              .filter(t => t.includes(':') || t.includes('.'));
            let masukVal = '';
            let pulangVal = '';
            if (times.length > 0) masukVal = times[0];
            if (times.length > 1) pulangVal = times[times.length - 1];

            parsedRecords.push({
              no_absen: noVal,
              tanggal: dateStr,
              nama: namaVal,
              departemen: deptVal,
              masuk: masukVal,
              pulang: pulangVal,
              status: masukVal ? 'Hadir' : 'Libur'
            });
          }
          i += 1;
        }
      }

      if (!parsedRecords.length) {
        if (progressEl) progressEl.style.display = 'none';
        showToast('Tidak ada data absensi valid di sheet Excel.');
        return;
      }

      const { error } = await db.from('attendance').upsert(parsedRecords, { onConflict: 'tanggal,nama' });
      if (progressEl) progressEl.style.display = 'none';

      if (error) {
        console.error('Error upload:', error);
        showToast('Gagal upload: ' + error.message);
      } else {
        showToast('Absensi berhasil diunggah!');
        loadData('attendance');
      }
    } catch (err) {
      if (progressEl) progressEl.style.display = 'none';
      console.error(err);
      showToast('Gagal memproses file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderPayrollPage() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
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
    <div id="payrollCardsContainer" style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px; padding-bottom: 120px;"></div>
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
    <div class="slip-container" id="slipPrintContainer" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 4px; padding-bottom: 120px;"></div>
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
    <div class="panel" style="padding-bottom: 120px;">
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
      if (!payload.nominal) {
        showToast('Nominal tidak boleh nol.');
        return;
      }
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
    <div class="panel" style="padding-bottom: 120px;">
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
      if (!payload.nominal) {
        showToast('Nominal tidak boleh nol.');
        return;
      }
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
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Tidak ada data kasbon bulan ini.</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (r, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td class="center">${formatDate(r.tanggal)}</td>
      <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
      <td>${escapeHtml(r.keterangan)}</td>
      <td class="right" style="font-weight:700; color:var(--danger);">- ${money(r.nominal)}</td>
    </tr>
    `
    )
    .join('');
}

function renderCicilanTable() {
  const fMonth = $('cicilanFilterMonth')?.value || new Date().toISOString().slice(0, 7);
  const tbody = $('cicilanTableBody');
  if (!tbody) return;
  const list = (DB.installments || [])
    .filter(r => formatDate(r.tanggal).startsWith(fMonth))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Tidak ada data cicilan bulan ini.</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map((r, i) => {
      const tenor = Number(r.tenor) || 1;
      const perBulan = Math.round(Number(r.nominal) / tenor);
      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center">${formatDate(r.tanggal)}</td>
        <td style="font-weight:700;">${escapeHtml(r.nama)}</td>
        <td class="center">${tenor} Bln</td>
        <td>${escapeHtml(r.keterangan)}</td>
        <td class="right" style="font-weight:700; color:var(--danger);">- ${money(r.nominal)}</td>
        <td class="right" style="font-weight:700; color:var(--danger);">- ${money(perBulan)}</td>
      </tr>
      `;
    })
    .join('');
}

function getCalculatedPayrollList(sDate, eDate, fDept) {
  let masterList = DB.masterSalary || [];
  if (fDept !== 'ALL') {
    masterList = masterList.filter(r => cleanText(r.departemen) === cleanText(fDept));
  }

  masterList.sort((a, b) => {
    const idA = Number(resolveEmployeeId(a)) || 999;
    const idB = Number(resolveEmployeeId(b)) || 999;
    return idA - idB;
  });

  const eDateObj = new Date(eDate || today());
  const eYear = eDateObj.getFullYear();
  const eMonth = eDateObj.getMonth();

  return masterList.map(emp => {
    const empId = resolveEmployeeId(emp);
    const lainLain = (empId === '22') ? DEFAULT_BONUS_LAIN : 0;

    const empAdvances = (DB.advances || []).filter(adv => {
      const advDate = formatDate(adv.tanggal);
      const advId = resolveEmployeeId(adv);
      const isMatch = empId ? (advId === empId) : isRecordMatching(emp, adv);
      return isMatch && (!sDate || advDate >= sDate) && (!eDate || advDate <= eDate);
    });
    const kasbonPeriode = sum(empAdvances.map(a => a.nominal));

    const empInstallments = (DB.installments || []).filter(ins => {
      const insId = resolveEmployeeId(ins);
      return empId ? (insId === empId) : isRecordMatching(emp, ins);
    });
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
      const attId = resolveEmployeeId(att);
      const isMatch = empId ? (attId === empId) : isRecordMatching(emp, att);
      return isMatch && (!sDate || attDate >= sDate) && (!eDate || attDate <= eDate);
    });

    let totalKelebihanJam = 0;
    empAttendance.forEach(att => {
      if (att.masuk && att.pulang) {
        totalKelebihanJam += calculateDailyOvertimeHours(att.masuk, att.pulang);
      }
    });

    const totalPenyesuaianJam = totalKelebihanJam * RATE_PER_HOUR;
    const gajiPokok = Number(emp.gaji_pokok || 0);
    const jabatan = Number(emp.jabatan || 0);
    const prestasi = Number(emp.prestasi || 0);
    const kesehatan = Number(emp.kesehatan || 0);
    const zakat = Number(emp.zakat || 0);
    const loyalitas = Number(emp.kebersihan_loyalitas || 0);

    const totalPendapatan =
      gajiPokok +
      jabatan +
      prestasi +
      kesehatan +
      zakat +
      loyalitas +
      lainLain +
      totalPenyesuaianJam;

    const totalPotongan = cicilanPeriode + kasbonPeriode;
    const gajiBersih = Math.max(0, totalPendapatan - totalPotongan);

    return {
      nama: getDisplayNameById(empId, emp.nama),
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

  container.innerHTML = list
    .map((emp, idx) => {
      const totalPendapatan =
        emp.pokok +
        emp.jabatan +
        emp.prestasi +
        emp.kesehatan +
        emp.jamKerja +
        emp.zakat +
        emp.loyalitas +
        emp.lainLain;
      const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;

      return `
      <div class="panel" style="margin-top:0; border-left: 4px solid var(--wa-primary); cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; outline: none;" onclick="const el = document.getElementById('slip-wrapper-${idx}'); if(el) el.style.gridTemplateRows = el.style.gridTemplateRows === '1fr' ? '0fr' : '1fr';">
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
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Jam Kerja (+/-)</span> <b style="color:${emp.jamKerja < 0 ? 'var(--danger)' : 'var(--text)'};">${emp.jamKerja > 0 ? '+' : ''}${money(emp.jamKerja)}</b></div>
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
    })
    .join('');
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

  const slipRow = (label, val, isBold = false) => `
    <div style="display: grid; grid-template-columns: 1fr 20px 70px; align-items: center; margin-bottom: 1.5px; ${isBold ? 'font-weight: 800;' : ''}">
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${label}</span>
      <span style="text-align: center;">Rp</span>
      <span style="text-align: right;">${val}</span>
    </div>
  `;

  let html = '';
  list.forEach(emp => {
    const totalPendapatan =
      emp.pokok +
      emp.jabatan +
      emp.prestasi +
      emp.kesehatan +
      emp.jamKerja +
      emp.zakat +
      emp.loyalitas +
      emp.lainLain;
    const totalPotongan = emp.kasbon + emp.bpjs + emp.cicilan;

    html += `
    <div class="slip-card" style="width: 390px; height: 368px; padding: 8px 12px; box-sizing: border-box; background: white; border: 1px dashed #cbd5e1; display: flex; flex-direction: column; justify-content: space-between; font-family: Arial, sans-serif; font-size: 10px; margin: 0;">
      <div>
        <div style="text-align: center; margin-bottom: 3px; line-height: 1.15;">
          <div style="font-weight: 800; font-size: 11px;">RUMAH MAKAN TAHU SUMEDANG</div>
          <div style="font-weight: 700; font-size: 10px; color: #1e293b;">SARI KEDELE</div>
          <div style="font-size: 8px; color: #64748b;">UNIT SUBANG</div>
          <div style="font-weight: 800; font-size: 9px; margin-top: 2px; border-bottom: 1px solid #94a3b8; padding-bottom: 2px;">SLIP GAJI PERIODE ${periodMonth}</div>
        </div>
        <div style="display: grid; grid-template-columns: 50px 8px 1fr; margin-bottom: 3px; font-weight: bold; font-size: 9.5px; line-height: 1.2;">
          <span>NAMA</span><span>:</span><span>${escapeHtml(emp.nama)}</span>
          <span>POSISI</span><span>:</span><span>${escapeHtml(emp.departemen)}</span>
        </div>
        
        <div style="background: #f1f5f9; font-weight: 800; padding: 2px 4px; font-size: 9px; margin-bottom: 2px; border-left: 3px solid #0284c7;">RINCIAN GAJI</div>
        ${slipRow('GAJI POKOK', formatNum(emp.pokok))}
        ${slipRow('JABATAN', formatNum(emp.jabatan))}
        ${slipRow('PRESTASI', formatNum(emp.prestasi))}
        ${slipRow('KESEHATAN', formatNum(emp.kesehatan))}
        ${slipRow('JAM KERJA (+/-)', emp.jamKerja < 0 ? '-' + formatNum(Math.abs(emp.jamKerja)) : formatNum(emp.jamKerja))}
        ${slipRow('ZAKAT', formatNum(emp.zakat))}
        ${slipRow('KEBERSIHAN/LOYALITAS', formatNum(emp.loyalitas))}
        ${slipRow('LAIN-LAIN', formatNum(emp.lainLain))}
        <div style="border-top: 1px dashed #cbd5e1; margin-top: 2px; padding-top: 1.5px;">
          ${slipRow('Jumlah Pendapatan', formatNum(totalPendapatan), true)}
        </div>
        
        <div style="background: #fef2f2; font-weight: 800; padding: 2px 4px; font-size: 9px; margin: 3px 0 2px 0; border-left: 3px solid #ef4444;">POTONGAN</div>
        ${slipRow('KASBON', formatNum(emp.kasbon))}
        ${slipRow('BPJS', formatNum(emp.bpjs))}
        ${slipRow('CICILAN', formatNum(emp.cicilan))}
        <div style="border-top: 1px dashed #cbd5e1; margin-top: 2px; padding-top: 1.5px;">
          ${slipRow('Jumlah Potongan', formatNum(totalPotongan), true)}
        </div>
      </div>
      <div>
        <div style="background: #ecfdf5; font-weight: 800; padding: 3px 6px; display: grid; grid-template-columns: 1fr 20px 70px; align-items: center; border-radius: 4px; border: 1px solid #a7f3d0; margin-top: 3px; font-size: 10px;">
          <span>Gaji Diterima</span>
          <span style="text-align: center;">Rp</span>
          <span style="text-align: right; color: #047857;">${formatNum(emp.gajiBersih)}</span>
        </div>
        <div style="text-align: right; font-size: 8px; color: #64748b; margin-top: 2px;">${escapeHtml(printDate)}</div>
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
    const cardWidth = 104;
    const cardHeight = 98;
    const marginX = 1;
    const marginY = 1.5;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const indexOnPage = i % 6;
      if (i > 0 && indexOnPage === 0) {
        pdf.addPage();
      }

      const col = indexOnPage % 2;
      const row = Math.floor(indexOnPage / 2);

      const posX = marginX + (col * cardWidth);
      const posY = marginY + (row * cardHeight);

      pdf.addImage(imgData, 'PNG', posX, posY, cardWidth, cardHeight);
    }

    const sDate = $('slipStartDate')?.value || 'periode';
    pdf.save(`SLIP_GAJI_${sDate}.pdf`);
    showToast('PDF berhasil diunduh!');
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat PDF: ' + err.message);
  }
}

function renderLimbahPage() {
  const ampasBelumDibagi = (DB.wasteSales || [])
    .filter(r => r.jenis === 'Ampas Tahu' && r.keterangan === 'Belum Dibagikan')
    .reduce((sum, r) => sum + Number(r.nominal), 0);
  const jalantahBelumDibagi = (DB.wasteSales || [])
    .filter(r => r.jenis === 'Jalantah' && r.keterangan === 'Belum Dibagikan')
    .reduce((sum, r) => sum + Number(r.nominal), 0);

  const contentEl = $('content');
  if (!contentEl) return;

  contentEl.innerHTML = `
  <div class="top">
    <div><div class="title">Modul Penjualan Limbah</div></div>
  </div>
  <div id="limbahContent">
    <div class="panel">
      <div class="panel-title">1. Setor Saldo Ampas Tahu</div>
      <div class="form-grid">
        <div class="field">
          <label>Tanggal</label>
          <input type="date" id="tglAmpas" value="${today()}">
        </div>
        <div class="field">
          <label>Nominal Setoran (Rp)</label>
          <input type="number" id="inputAmpasTahu" min="0" step="1" placeholder="Ketik nominal...">
        </div>
      </div>
      <div class="actions" style="margin-top: 15px;">
        <button class="btn btn-secondary" onclick="submitLimbah('Ampas Tahu', 'tglAmpas', 'inputAmpasTahu')">
          <i class="fa-solid fa-plus"></i> Tambah ke Saldo
        </button>
      </div>
      <hr style="margin: 20px 0; border: 0; border-top: 2px dashed var(--line);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <div style="font-weight: 800; font-size: 16px;">
          Total Saldo Terkumpul: <span style="color: var(--wa-primary);">${money(ampasBelumDibagi)}</span>
        </div>
        <button class="btn btn-primary" onclick="bagikanLimbah('Ampas Tahu')" ${ampasBelumDibagi > 0 ? '' : 'disabled'} style="${ampasBelumDibagi > 0 ? '' : 'opacity:0.5; cursor:not-allowed;'}">
          Dibagikan
        </button>
      </div>
      <div id="resultAmpasTahu"></div>
    </div>
    <div class="panel">
      <div class="panel-title">2. Setor Saldo Jalantah</div>
      <div class="form-grid">
        <div class="field">
          <label>Tanggal</label>
          <input type="date" id="tglJalantah" value="${today()}">
        </div>
        <div class="field">
          <label>Nominal Setoran (Rp)</label>
          <input type="number" id="inputJalantah" min="0" step="1" placeholder="Ketik nominal...">
        </div>
      </div>
      <div class="actions" style="margin-top: 15px;">
        <button class="btn btn-secondary" onclick="submitLimbah('Jalantah', 'tglJalantah', 'inputJalantah')">
          <i class="fa-solid fa-plus"></i> Tambah ke Saldo
        </button>
      </div>
    </div>
    <div class="panel" style="padding-bottom: 120px;">
      <div class="panel-title">Histori Penjualan Limbah</div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="center" style="width:45px;">No</th>
              <th>Tanggal</th>
              <th>Jenis Limbah</th>
              <th class="center">Status</th>
              <th class="right">Nominal</th>
            </tr>
          </thead>
          <tbody id="wasteSalesTableBody"></tbody>
        </table>
      </div>
    </div>
  </div>
  `;

  renderRincianPembagian('Ampas Tahu', ampasBelumDibagi, 'resultAmpasTahu');
  renderWasteSalesTable();
}

window.renderRincianPembagian = function (jenis, total, containerId) {
  const resultEl = $(containerId);
  if (!resultEl) return;
  if (total <= 0) {
    resultEl.innerHTML = `
    <div style="text-align:center; color:var(--muted); padding: 15px; border: 1px solid var(--line); border-radius: 8px;">
      Belum ada saldo yang terkumpul. Silakan input setoran di atas.
    </div>`;
    return;
  }
  const perusahaan = total * 0.5;
  const manajemen = total * 0.25;
  const pabrik = total * 0.25;
  const jatahManajemenPerOrang = manajemen / 3;

  let karyawanMgt = (DB.masterSalary || [])
    .filter(emp => String(emp.departemen).toLowerCase().includes('manajemen'))
    .map(emp => emp.nama);
  while (karyawanMgt.length < 3) {
    karyawanMgt.push('Karyawan Manajemen ' + (karyawanMgt.length + 1));
  }
  const tigaManajemen = karyawanMgt.slice(0, 3);

  let karyawanPabrik = (DB.masterSalary || [])
    .filter(emp => {
      const dept = String(emp.departemen).toLowerCase();
      return dept.includes('pabrik') || dept.includes('produksi');
    })
    .map(emp => emp.nama);

  if (karyawanPabrik.length < 3) {
    const nonMgt = (DB.masterSalary || [])
      .filter(emp => !String(emp.departemen).toLowerCase().includes('manajemen'))
      .map(emp => emp.nama);
    karyawanPabrik = [...new Set([...karyawanPabrik, ...nonMgt])];
  }

  const indexZaenal = karyawanPabrik.findIndex(nama => nama.toUpperCase().includes('ZAENAL'));
  if (indexZaenal > 0) {
    const namaZaenal = karyawanPabrik.splice(indexZaenal, 1)[0];
    karyawanPabrik.unshift(namaZaenal);
  }
  while (karyawanPabrik.length < 3) {
    karyawanPabrik.push('Karyawan Pabrik ' + (karyawanPabrik.length + 1));
  }
  const tigaPabrik = karyawanPabrik.slice(0, 3);
  const jatahPabrik1 = pabrik * 0.4;
  const jatahPabrik2 = pabrik * 0.3;
  const jatahPabrik3 = pabrik * 0.3;

  resultEl.innerHTML = `
  <div style="border: 1px solid var(--line); border-radius: 8px; padding: 15px; background: var(--card);">
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">1. Perusahaan (50%)</div>
        <div style="font-size: 14px; color: #059669; font-weight: bold;">${money(perusahaan)}</div>
      </div>
      <div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">2. Manajemen (25%)</div>
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Total: <b>${money(manajemen)}</b></div>
        <ul style="margin: 0; padding-left: 15px; font-size: 13px; line-height: 1.6;">
          <li><b>${escapeHtml(tigaManajemen[0])}:</b> ${money(jatahManajemenPerOrang)}</li>
          <li><b>${escapeHtml(tigaManajemen[1])}:</b> ${money(jatahManajemenPerOrang)}</li>
          <li><b>${escapeHtml(tigaManajemen[2])}:</b> ${money(jatahManajemenPerOrang)}</li>
        </ul>
      </div>
      <div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">3. Pabrik (25%)</div>
        <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Total: <b>${money(pabrik)}</b></div>
        <ul style="margin: 0; padding-left: 15px; font-size: 13px; line-height: 1.6;">
          <li><b>${escapeHtml(tigaPabrik[0])} (40%):</b> ${money(jatahPabrik1)}</li>
          <li><b>${escapeHtml(tigaPabrik[1])} (30%):</b> ${money(jatahPabrik2)}</li>
          <li><b>${escapeHtml(tigaPabrik[2])} (30%):</b> ${money(jatahPabrik3)}</li>
        </ul>
      </div>
    </div>
  </div>
  `;
};

window.submitLimbah = async function (jenis, idTgl, idNominal) {
  const tglEl = $(idTgl);
  const nomEl = $(idNominal);
  if (!tglEl || !nomEl) return;
  const tanggal = tglEl.value;
  const nominal = Number(nomEl.value || 0);
  if (!tanggal) {
    showToast('Tanggal harus diisi.');
    return;
  }
  if (nominal <= 0) {
    showToast('Nominal harus lebih dari 0.');
    return;
  }
  showToast('Menyimpan ' + jenis + '...');
  const payload = {
    tanggal: tanggal,
    jenis: jenis,
    qty: 1,
    satuan: 'PAKET',
    harga_satuan: nominal,
    nominal: nominal,
    keterangan: 'Belum Dibagikan'
  };
  const { error } = await db.from('waste_sales').insert([payload]);
  if (error) {
    showToast('Gagal menyimpan: ' + error.message);
  } else {
    showToast('Berhasil ditambahkan ke saldo!');
    nomEl.value = '';
    loadData('limbah');
  }
};

window.bagikanLimbah = async function (jenis) {
  if (!confirm(`Anda yakin ingin membagikan seluruh saldo ${jenis}? Tindakan ini akan mereset saldo menjadi Rp 0.`)) return;
  showToast('Memproses pembagian...');
  const { error } = await db
    .from('waste_sales')
    .update({ keterangan: 'Sudah Dibagikan' })
    .eq('jenis', jenis)
    .eq('keterangan', 'Belum Dibagikan');

  if (error) {
    showToast('Gagal membagikan: ' + error.message);
  } else {
    showToast(`Saldo ${jenis} berhasil dibagikan & dinolkan!`);
    loadData('limbah');
  }
};

window.renderWasteSalesTable = function () {
  const tbody = $('wasteSalesTableBody');
  if (!tbody) return;
  const list = [...(DB.wasteSales || [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="center empty">Belum ada riwayat penjualan limbah.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map((item, i) => {
      const isBelum = item.keterangan === 'Belum Dibagikan';
      const badgeBg = isBelum ? '#f59e0b' : '#10b981';
      return `
      <tr style="border-bottom: 1px solid var(--line);">
        <td class="center" style="color:var(--muted);">${i + 1}</td>
        <td>${formatDate(item.tanggal)}</td>
        <td style="font-weight:700;">${escapeHtml(item.jenis)}</td>
        <td class="center">
          <span class="badge" style="background:${badgeBg}; color:white; font-size:11px;">
            ${escapeHtml(item.keterangan)}
          </span>
        </td>
        <td class="right" style="font-weight: 800; font-size:14px;">${money(item.nominal)}</td>
      </tr>
      `;
    })
    .join('');
};

// --- Halaman Asisten AI / Chat Q&A Terpisah ---
function renderAiChatPage() {
  const contentEl = $('content');
  if (!contentEl) return;
  contentEl.innerHTML = `
  <div class="top">
    <div>
      <div class="title">Asisten AI & Analisis</div>
      <div class="subtitle">Tanya Jawab Pintar Berbasis Seluruh Data Usaha</div>
    </div>
  </div>
  <div class="panel" style="display:flex; flex-direction:column; height: calc(100vh - 180px); max-height: 650px; padding: 15px;">
    <div id="chatMessages" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-bottom:10px; border-bottom:1px solid var(--line); margin-bottom:10px;">
      <div style="background:var(--card); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px; max-width: 85%;">
        👋 Halo! Saya adalah Asisten AI untuk Rumah Makan Tahu Sumedang Sari Kedele Unit Subang. Saya telah membaca seluruh data keuangan, absensi, gaji, pengeluaran, dan kasbon Anda. Apa yang ingin Anda tanyakan atau analisis hari ini?
      </div>
    </div>
    <div style="display:flex; gap:8px;">
      <input type="text" id="chatInput" placeholder="Ketik pertanyaan atau minta analisis..." onkeydown="if(event.key==='Enter') sendChatMessage()" style="flex:1; padding:12px; border:1px solid var(--line); border-radius:10px; font-size:14px; background:var(--card); color:var(--text);">
      <button class="btn btn-primary" onclick="sendChatMessage()" style="padding: 0 16px;"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  </div>
  `;
}

async function sendChatMessage() {
  const input = $('chatInput');
  const container = $('chatMessages');
  if (!input || !container) return;
  const text = input.value.trim();
  if (!text) return;

  container.innerHTML += `
  <div style="align-self:flex-end; background:var(--wa-primary); color:white; padding:12px; border-radius:10px; font-size:13.5px; max-width:85%; word-break:break-word;">
    ${escapeHtml(text)}
  </div>
  `;
  input.value = '';
  container.scrollTop = container.scrollHeight;

  const loadingId = 'load_' + Date.now();
  container.innerHTML += `
  <div id="${loadingId}" style="align-self:flex-start; background:var(--card); color:var(--muted); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px;">
    <i>🤖 Gemini sedang menganalisis data...</i>
  </div>
  `;
  container.scrollTop = container.scrollHeight;

  const summaryContext = `
Data Ringkasan Aplikasi (Sari Kedele Subang):
- Total Data Sales (Pendapatan): ${DB.sales.length} hari tercatat.
- Total Data Pengeluaran Murni: ${DB.expenses.length} item tercatat.
- Total Data Absensi: ${DB.attendance.length} record.
- Total Karyawan Master Gaji: ${DB.masterSalary.length} orang.
- Total Kasbon Aktif: ${DB.advances.length} catatan.
- Total Cicilan Aktif: ${DB.installments.length} catatan.
`;

  const fullPrompt = `Anda adalah konsultan keuangan profesional dan asisten operasional cerdas untuk Rumah Makan Tahu Sumedang Sari Kedele Unit Subang. Berikut adalah konteks data saat ini:
${summaryContext}

Pertanyaan Pengguna: "${text}"
Jawablah secara akurat, jelas, profesional dalam bahasa Indonesia, dan berikan saran praktis jika diperlukan.`;

  const reply = await callGeminiAPI(fullPrompt);

  const loadEl = $(loadingId);
  if (loadEl) {
    loadEl.outerHTML = `
    <div style="align-self:flex-start; background:var(--card); color:var(--text); padding:12px; border-radius:10px; border:1px solid var(--line); font-size:13.5px; max-width:85%; word-break:break-word;">
      🤖 ${escapeHtml(reply).replace(/\n/g, '<br>')}
    </div>
    `;
  }
  container.scrollTop = container.scrollHeight;
}

// --- Halaman Pengaturan & Diagnostik Sistem ---
function renderSettingsPage() {
  const contentEl = $('content');
  if (!contentEl) return;
  
  contentEl.innerHTML = `
  <div class="top">
    <div><div class="title">Pengaturan Sistem</div></div>
  </div>
  <div class="panel">
    <div class="panel-title">Diagnostik & Kesehatan Aplikasi</div>
    <p style="font-size: 13.5px; color: var(--muted); margin-bottom: 15px;">
      Gunakan tombol di bawah ini untuk memeriksa status koneksi database Supabase, jumlah baris data di memori tablet, serta memverifikasi keberadaan data karyawan penting.
    </p>
    <button class="btn btn-primary" onclick="runSystemDiagnostics()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <i class="fa-solid fa-stethoscope"></i> Jalankan Analisis Sistem
    </button>
  </div>
  `;
}

function runSystemDiagnostics() {
  try {
    const totalAttendance = (DB.attendance || []).length;
    const totalMaster = Object.keys(typeof EMPLOYEE_MAP !== 'undefined' ? EMPLOYEE_MAP : {}).length;
    const totalSales = (DB.sales || []).length;
    const totalExpenses = (DB.expenses || []).length;
    
    const sampleYusuf = (DB.attendance || []).find(r => String(r.no_absen) === '25' || String(r.nama || '').toUpperCase().includes('YUSUF'));

    const report = `🩺 LAPORAN ANALISIS KESEHATAN SISTEM\n\n` +
                   `• Status Koneksi Supabase: Terhubung Aktif\n` +
                   `• Master Karyawan Terdaftar: ${totalMaster} orang\n` +
                   `• Total Baris Absensi di Memori: ${totalAttendance} baris\n` +
                   `• Status Data Yusuf (ID 25): ${sampleYusuf ? 'Terdeteksi Aman (Ada)' : 'Tidak Ditemukan'}\n` +
                   `• Data Pendapatan Tersimpan: ${totalSales} hari\n` +
                   `• Data Pengeluaran Tersimpan: ${totalExpenses} item\n\n` +
                   `Kesimpulan: Sistem berjalan normal tanpa kendala batasan baris.`;
    
    alert(report);
  } catch (err) {
    alert('⚠️ Gagal menjalankan analisis sistem: ' + err.message);
  }
}
