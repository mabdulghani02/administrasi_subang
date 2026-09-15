import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';

export default async function handler(req, res) {
    try {
        const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data, error } = await db.from('counter').select('cash, debit_card, grab, qris');
        
        if (error) {
            return res.status(200).send('0');
        }

        let totalOmset = 0;
        if (data && Array.isArray(data)) {
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
