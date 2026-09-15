export default async function handler(req, res) {
    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
        const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

        const resCounter = await fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris`, { headers });
        const dataCounter = resCounter.ok ? await resCounter.json() : [];

        const resExpenses = await fetch(`${SUPABASE_URL}/rest/v1/expenses?select=nominal`, { headers });
        const dataExpenses = resExpenses.ok ? await resExpenses.json() : [];

        let totalCash = 0, totalDebit = 0, totalGrab = 0, totalQris = 0, grandTotal = 0;
        if (Array.isArray(dataCounter)) {
            dataCounter.forEach(item => {
                totalCash += Number(item.cash || 0);
                totalDebit += Number(item.debit_card || 0);
                totalGrab += Number(item.grab || 0);
                totalQris += Number(item.qris || 0);
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

        // Bagian yang diubah: Mengirimkan format JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            omset: grandTotal,
            pengeluaran: totalExpense,
            bersih: netTotal
        });
    } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: "Gagal memuat data" });
    }
}
