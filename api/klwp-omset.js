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

        // Langsung kirim sebagai teks biasa
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(String(totalOmset));
    } catch (err) {
        res.status(500).send('0');
    }
}
