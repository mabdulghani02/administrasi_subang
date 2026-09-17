export default async function handler(req, res) {
    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
        const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

        // 1. Ambil data transaksi counter menggunakan kolom tanggal
        const resCounter = await fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris,tanggal&order=tanggal.asc`, { headers });
        const dataCounter = resCounter.ok ? await resCounter.json() : [];

        // 2. Ambil data pengeluaran
        const resExpenses = await fetch(`${SUPABASE_URL}/rest/v1/expenses?select=nominal`, { headers });
        const dataExpenses = resExpenses.ok ? await resExpenses.json() : [];

        // 3. Tentukan bulan, tahun, dan jumlah hari pada bulan berjalan
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0 = Januari, 8 = September, 11 = Desember
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Inisialisasi array sebulan penuh dengan angka 0
        const omsetBulanIni = new Array(daysInMonth).fill(0);

        let totalCash = 0, totalDebit = 0, totalGrab = 0, totalQris = 0, grandTotal = 0;

        if (Array.isArray(dataCounter)) {
            dataCounter.forEach(item => {
                const itemOmset = Number(item.cash || 0) + Number(item.debit_card || 0) + Number(item.grab || 0) + Number(item.qris || 0);
                
                totalCash += Number(item.cash || 0);
                totalDebit += Number(item.debit_card || 0);
                totalGrab += Number(item.grab || 0);
                totalQris += Number(item.qris || 0);

                // Ekstrak tanggal langsung dari string YYYY-MM-DD
                if (item.tanggal) {
                    const [year, month, day] = item.tanggal.split('-').map(Number);
                    if (year === currentYear && (month - 1) === currentMonth) {
                        omsetBulanIni[day - 1] += itemOmset;
                    }
                }
            });
            grandTotal = totalCash + totalDebit + totalGrab + totalQris;
        }

        let totalExpense = 0;
        if (Array.isArray(dataExpenses)) {
            dataExpenses.forEach(item => {
                totalExpense += Number(item.nominal || 0);
            });
        }

        let netTotal = grandTotal - totalExpense;

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            omset: grandTotal,
            pengeluaran: totalExpense,
            bersih: netTotal,
            harian: omsetBulanIni
        });
    } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: "Gagal memuat data" });
    }
}
