export default async function handler(req, res) {
    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';

        const response = await fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris,expense`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            return res.status(200).json({ cash: 0, debit: 0, grab: 0, qris: 0, expense: 0, total: 0, net: 0 });
        }

        const data = await response.json();

        let totalCash = 0;
        let totalDebit = 0;
        let totalGrab = 0;
        let totalQris = 0;
        let totalExpense = 0;
        let grandTotal = 0;
        let netTotal = 0;

        if (Array.isArray(data)) {
            data.forEach(item => {
                totalCash += Number(item.cash || 0);
                totalDebit += Number(item.debit_card || 0);
                totalGrab += Number(item.grab || 0);
                totalQris += Number(item.qris || 0);
                totalExpense += Number(item.expense || 0);
            });
            grandTotal = totalCash + totalDebit + totalGrab + totalQris;
            netTotal = grandTotal - totalExpense;
        }

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
