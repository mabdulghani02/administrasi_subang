import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    try {
        const { data, error } = await db.from('counter').select('cash, debit_card, grab, qris');
        
        if (error) throw error;

        let totalOmset = 0;
        data.forEach(item => {
            totalOmset += Number(item.cash || 0) + 
                          Number(item.debit_card || 0) + 
                          Number(item.grab || 0) + 
                          Number(item.qris || 0);
        });

        // Mengirim dalam format JSON agar sangat stabil dibaca KLWP
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ total: totalOmset });
    } catch (err) {
        res.status(500).json({ total: 0 });
    }
}
