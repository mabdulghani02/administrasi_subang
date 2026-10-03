/* =====================================================================
   CETAK LANGSUNG KE PRINTER THERMAL VIA BLUETOOTH (Web Bluetooth)
   File terpisah. Muat SETELAH fitur_slip_thermal.js:
     <script src="fitur_slip_thermal.js"></script>
     <script src="fitur_printer_bluetooth.js"></script>

   Syarat: Chrome di Android, alamat web HTTPS, Bluetooth & Lokasi HP aktif,
   dan printer bertipe BLE (Bluetooth Low Energy). Printer yang hanya
   Bluetooth "klasik" tidak muncul di daftar perangkat -> pakai metode
   "Dialog cetak" (RawBT) yang sudah ada.

   Slip dirender jadi gambar lalu dikirim sebagai raster ESC/POS, jadi
   tampilannya sama dengan slip thermal di layar.
   ===================================================================== */

const BT_MODE_KEY = 'subang_print_mode';
// UUID layanan umum printer thermal BLE (daftar harus dideklarasikan agar boleh diakses)
const BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb'
];
let _btDev = null, _btChar = null, _btChunk = 100;

const btSleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Koneksi ----------
async function btConnect(forcePick) {
  if (!navigator.bluetooth) throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android.');
  if (_btChar && _btDev && _btDev.gatt.connected && !forcePick) return;
  if (!_btDev || forcePick) {
    _btDev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
    _btDev.addEventListener('gattserverdisconnected', () => { _btChar = null; });
  }
  const server = await _btDev.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const s of services) {
    const chars = await s.getCharacteristics();
    const c = chars.find(ch => ch.properties.write || ch.properties.writeWithoutResponse);
    if (c) { _btChar = c; return; }
  }
  _btChar = null;
  throw new Error('Printer terhubung, tetapi jalur kirim datanya tidak dikenali. Beri tahu merek/tipe printer ke pembuat aplikasi.');
}

async function btSend(bytes) {
  const wr = _btChar.properties.writeWithoutResponse ? 'writeValueWithoutResponse' : 'writeValue';
  let i = 0;
  while (i < bytes.length) {
    try {
      await _btChar[wr](bytes.slice(i, i + _btChunk));
      i += _btChunk;
      await btSleep(12);
    } catch (e) {
      if (_btChunk > 20) { _btChunk = 20; continue; } // potongan terlalu besar: ulangi dengan 20 byte
      throw e;
    }
  }
}

// ---------- Gambar -> perintah raster ESC/POS ----------
function btRaster(canvas) {
  const w = canvas.width, h = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const bw = w >> 3, out = [];
  for (let y0 = 0; y0 < h; y0 += 128) {
    const bh = Math.min(128, h - y0);
    out.push(0x1D, 0x76, 0x30, 0x00, bw & 255, bw >> 8, bh & 255, bh >> 8); // GS v 0
    for (let y = y0; y < y0 + bh; y++) {
      for (let x = 0; x < w; x += 8) {
        let b = 0;
        for (let k = 0; k < 8; k++) {
          const i = (y * w + x + k) * 4;
          if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 170) b |= 0x80 >> k;
        }
        out.push(b);
      }
    }
  }
  return Uint8Array.from(out);
}

function btDots() { return thermalWidth() === '80' ? 576 : 384; } // lebar cetak printer 80mm / 58mm

async function btSlipCanvas(emp, periodMonth, printDate) {
  const px = btDots(), fs = px === 576 ? 26 : 22;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${px}px;background:#fff;color:#000;`;
  host.innerHTML = `<style>
    .bt .slip{width:${px}px;padding:6px 0 10px;box-sizing:border-box;font-family:Arial,sans-serif;font-size:${fs}px;line-height:1.3;background:#fff;color:#000}
    .bt .c{text-align:center}.bt .b{font-weight:800}.bt .s{font-size:${fs - 4}px}
    .bt .r{display:flex;justify-content:space-between;gap:8px;margin:2px 0}
    .bt .r span:first-child{flex:1}.bt .r span:last-child{text-align:right;white-space:nowrap}
    .bt .hr{border-top:2px dashed #000;margin:6px 0}.bt .hr.dbl{border-top:3px solid #000}
    .bt .top{border-top:2px dashed #000;margin-top:3px;padding-top:3px}.bt .big{font-size:${fs + 3}px}
  </style><div class="bt">${thermalSlipHtml(emp, periodMonth, printDate)}</div>`;
  document.body.appendChild(host);
  try {
    return await html2canvas(host.querySelector('.slip'), { scale: 1, backgroundColor: '#ffffff', width: px });
  } finally { host.remove(); }
}

function btFeedCut() {
  return thermalWidth() === '80'
    ? Uint8Array.from([0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x00]) // feed + potong
    : Uint8Array.from([0x1B, 0x64, 0x05]);                         // feed saja
}

function btErrorMsg(e) {
  if (e && e.name === 'NotFoundError') return 'Pemilihan printer dibatalkan atau tidak ada printer BLE yang ditemukan.';
  if (e && e.name === 'SecurityError') return 'Web Bluetooth butuh alamat HTTPS.';
  return (e && e.message) || 'Gagal terhubung ke printer.';
}

// ---------- Tes koneksi ----------
window.btTestPrint = async function () {
  try {
    showToast('Pilih printer pada daftar...');
    await btConnect(true);
    const px = btDots();
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = 140;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, px, 140);
    g.fillStyle = '#000'; g.textAlign = 'center';
    g.font = 'bold 30px Arial'; g.fillText('TES PRINTER OK', px / 2, 55);
    g.font = '20px Arial'; g.fillText('Sari Kedele - Subang', px / 2, 95);
    await btSend(Uint8Array.from([0x1B, 0x40]));
    await btSend(btRaster(cv));
    await btSend(btFeedCut());
    showToast('Tes terkirim. Cek apakah kertas keluar.');
  } catch (e) {
    console.error(e);
    _btChar = null;
    showToast(btErrorMsg(e));
  }
};

// ---------- Cetak slip ----------
async function btPrintSlips(idx) {
  const sDate = $('slipStartDate')?.value;
  const eDate = $('slipEndDate')?.value;
  const fDept = $('slipFilterDept')?.value || 'ALL';
  const printDate = $('slipPrintDate')?.value || '';
  let list = getCalculatedPayrollList(sDate, eDate, fDept);
  if (typeof idx === 'number') list = list.slice(idx, idx + 1);
  if (!list.length) { showToast('Tidak ada slip untuk dicetak.'); return; }
  const periodMonth = sDate
    ? new Date(sDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase() : '';

  try {
    showToast('Menghubungkan ke printer...');
    await btConnect(false); // harus dipanggil langsung dari ketukan tombol (izin pengguna)
    for (let n = 0; n < list.length; n++) {
      showToast(`Mencetak ${n + 1}/${list.length}: ${list[n].nama}`);
      const cv = await btSlipCanvas(list[n], periodMonth, printDate);
      await btSend(Uint8Array.from([0x1B, 0x40]));
      await btSend(btRaster(cv));
      await btSend(btFeedCut());
      await btSleep(600);
    }
    showToast(`${list.length} slip terkirim ke printer.`);
  } catch (e) {
    console.error(e);
    _btChar = null;
    showToast(btErrorMsg(e));
  }
}

// ---------- Pilihan metode & tombol di tab Cetak Slip ----------
const _thermalPrintOrig = window.thermalPrintSlips;
window.thermalPrintSlips = function (idx) {
  return localStorage.getItem(BT_MODE_KEY) === 'bt' ? btPrintSlips(idx) : _thermalPrintOrig(idx);
};

const _showPayrollSubOrig2 = window.showPayrollSub;
window.showPayrollSub = function (type) {
  _showPayrollSubOrig2(type);
  if (type !== 'slips') return;
  const wrap = $('thermalWidth')?.parentElement;
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', `
    <label style="font-size:13px;font-weight:700;margin-top:6px;">Metode Cetak Thermal:</label>
    <select id="printMode" onchange="localStorage.setItem('${BT_MODE_KEY}', this.value)" style="padding:12px;border:1px solid var(--line);border-radius:8px;width:100%;background:var(--input-bg);color:var(--text);">
      <option value="dialog">Dialog cetak (RawBT / USB)</option>
      <option value="bt">Langsung Bluetooth (tanpa aplikasi)</option>
    </select>
    <button class="btn btn-secondary" onclick="btTestPrint()">🔌 Hubungkan &amp; Tes Printer</button>`);
  $('printMode').value = localStorage.getItem(BT_MODE_KEY) === 'bt' ? 'bt' : 'dialog';
};
