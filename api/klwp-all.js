export default async function handler(req, res) {
    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';

        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        // 1. Ambil data pemasukan dari tabel 'counter'
        const resCounter = await fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris`, { headers });
        const dataCounter = resCounter.ok ? await resCounter.json() : [];

        // 2. Ambil data pengeluaran dari tabel 'expenses'
        const resExpenses = await fetch(`${SUPABASE_URL}/rest/v1/expenses?select=nominal`, { headers });
        const dataExpenses = resExpenses.ok ? await resExpenses.json() : [];

        let totalCash = 0;
        let totalDebit = 0;
        let totalGrab = 0;
        let totalQris = 0;
        let grandTotal = 0;

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
                // Menjumlahkan kolom 'nominal' dari tabel expenses
                totalExpense += Number(item.nominal || 0);
            });
        }

        let netTotal = grandTotal - totalExpense;

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            cash: totalCash,
            debit: totalDebit,
            grab: totalGrab,
            qris: totalQris,
            expense: totalExpense,
            total: grandTotal,
            net: netTotal
        });
    } catch (err) {
        res.status(200).json({ cash: 0, debit: 0, grab: 0, qris: 0, expense: 0, total: 0, net: 0 });
    }
}
