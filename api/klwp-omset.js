export default async function handler(req, res) {
    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';

        // Mengambil data langsung menggunakan fetch standar Vercel
        const response = await fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            return res.status(200).send('0');
        }

        const data = await response.json();

        let totalOmset = 0;
        if (Array.isArray(data)) {
            data.forEach(item => {
                totalOmset += Number(item.cash || 0) + 
                              Number(item.debit_card || 0) + 
                              Number(item.grab || 0) + 
                              Number(item.qris || 0);
            });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(totalOmset.toString());
    } catch (err) {
        res.status(200).send('0');
    }
}
