export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const SUPABASE_URL = 'https://grlaiyobzuhoxpofqhrb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_JfhWW06jtowD1Af22vfUxA__d_MBbDE';
        const headers = { 
            'apikey': SUPABASE_ANON_KEY, 
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
        };

        // 1. Fetch data dari 3 tabel secara paralel
        const [resCounter, resExpenses, resCash] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/counter?select=cash,debit_card,grab,qris,tanggal&order=tanggal.asc`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/expenses?select=sumber,nominal,tanggal&order=tanggal.asc`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/cash_positions?select=tanggal,saldo_harian,belanja_malam&order=tanggal.asc`, { headers })
        ]);

        const rawCounter = await resCounter.json();
        const rawExpenses = await resExpenses.json();
        const rawCash = await resCash.json();

        // Validasi respon Supabase (jika error, Supabase mengembalikan object error, bukan array)
        if (!Array.isArray(rawCounter)) throw new Error(`Supabase Counter Error: ${JSON.stringify(rawCounter)}`);
        if (!Array.isArray(rawExpenses)) throw new Error(`Supabase Expenses Error: ${JSON.stringify(rawExpenses)}`);
        if (!Array.isArray(rawCash)) throw new Error(`Supabase Cash Error: ${JSON.stringify(rawCash)}`);

        // 2. Hitung tanggal lokal hari ini (WIB / Asia/Jakarta)
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Jakarta', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).formatToParts(now);

        const currentYear = Number(parts.find(p => p.type === 'year')?.value || now.getFullYear());
        const currentMonth = Number(parts.find(p => p.type === 'month')?.value || (now.getMonth() + 1)) - 1;
        const currentDay = Number(parts.find(p => p.type === 'day')?.value || now.getDate());
        const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const omsetBulanIni = new Array(daysInMonth).fill(0);

        // 3. Olah data Counter
        let totalCash = 0, totalDebit = 0, totalGrab = 0, totalQris = 0, grandTotal = 0;

        rawCounter.forEach(item => {
            const itemOmset = Number(item.cash || 0) + Number(item.debit_card || 0) + Number(item.grab || 0) + Number(item.qris || 0);
            totalCash += Number(item.cash || 0);
            totalDebit += Number(item.debit_card || 0);
            totalGrab += Number(item.grab || 0);
            totalQris += Number(item.qris || 0);

            if (item.tanggal && typeof item.tanggal === 'string') {
                const [year, month, day] = item.tanggal.split('-').map(Number);
                if (year === currentYear && (month - 1) === currentMonth && day >= 1 && day <= daysInMonth) {
                    omsetBulanIni[day - 1] += itemOmset;
                }
            }
        });
        grandTotal = totalCash + totalDebit + totalGrab + totalQris;

        // 4. Olah data Expenses
        let totalExpense = 0;
        let totalBelanjaHariIni = 0;
        const pengeluaranHariIni = [];

        rawExpenses.forEach(item => {
            const nominal = Number(item.nominal || 0);
            totalExpense += nominal;

            if (item.tanggal === todayStr) {
                totalBelanjaHariIni += nominal;
                pengeluaranHariIni.push({
                    sumber: item.sumber || '-',
                    nominal: nominal
                });
            }
        });

        let teksDaftarPengeluaran = "Tidak ada pengeluaran hari ini";
        if (pengeluaranHariIni.length > 0) {
            teksDaftarPengeluaran = pengeluaranHariIni.map(item => {
                const nominalFormat = item.nominal.toLocaleString('id-ID');
                return `• ${item.sumber}: Rp ${nominalFormat}`;
            }).join('\n');
        }

        // 5. Olah data Cash Positions
        let saldoHarianHariIni = 0;
        let belanjaMalamHariIni = 0;

        const posisiHariIni = rawCash.find(item => item.tanggal === todayStr);
        if (posisiHariIni) {
            saldoHarianHariIni = Number(posisiHariIni.saldo_harian || 0);
            belanjaMalamHariIni = Number(posisiHariIni.belanja_malam || 0);
        }

        const sisaKasHariIni = (saldoHarianHariIni + belanjaMalamHariIni) - totalBelanjaHariIni;
        const netTotal = grandTotal - totalExpense;

        return res.status(200).json({
            omset: grandTotal,
            pengeluaran: totalExpense,
            bersih: netTotal,
            harian: omsetBulanIni,
            pengeluaran_hari_ini: pengeluaranHariIni,
            teks_pengeluaran_hari_ini: teksDaftarPengeluaran,
            total_belanja_hari_ini: totalBelanjaHariIni,
            posisi_kas: {
                saldo_harian: saldoHarianHariIni,
                belanja_malam: belanjaMalamHariIni,
                sisa_kas: sisaKasHariIni,
                teks_saldo: `Rp ${saldoHarianHariIni.toLocaleString('id-ID')}`,
                teks_belanja_malam: `Rp ${belanjaMalamHariIni.toLocaleString('id-ID')}`,
                teks_sisa_kas: `Rp ${sisaKasHariIni.toLocaleString('id-ID')}`
            }
        });

    } catch (err) {
        return res.status(500).json({ 
            error: err.message || "Internal Server Error" 
        });
    }
}

        if (Array.isArray(dataCounter)) {
            dataCounter.forEach(item => {
                const itemOmset = Number(item.cash || 0) + Number(item.debit_card || 0) + Number(item.grab || 0) + Number(item.qris || 0);
                
                totalCash += Number(item.cash || 0);
                totalDebit += Number(item.debit_card || 0);
                totalGrab += Number(item.grab || 0);
                totalQris += Number(item.qris || 0);

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
        let totalBelanjaHariIni = 0;
        const pengeluaranHariIni = [];

        if (Array.isArray(dataExpenses)) {
            dataExpenses.forEach(item => {
                const nominal = Number(item.nominal || 0);
                totalExpense += nominal;

                if (item.tanggal === todayStr) {
                    totalBelanjaHariIni += nominal;
                    pengeluaranHariIni.push({
                        sumber: item.sumber || '-',
                        nominal: nominal
                    });
                }
            });
        }

        let teksDaftarPengeluaran = "Tidak ada pengeluaran hari ini";
        if (pengeluaranHariIni.length > 0) {
            teksDaftarPengeluaran = pengeluaranHariIni.map(item => {
                const nominalFormat = item.nominal.toLocaleString('id-ID');
                return `• ${item.sumber}: Rp ${nominalFormat}`;
            }).join('\n');
        }

        // 5. Posisi kas & kalkulasi sisa kas hari ini
        let saldoHarianHariIni = 0;
        let belanjaMalamHariIni = 0;

        if (Array.isArray(dataCash)) {
            const posisiHariIni = dataCash.find(item => item.tanggal === todayStr);
            if (posisiHariIni) {
                saldoHarianHariIni = Number(posisiHariIni.saldo_harian || 0);
                belanjaMalamHariIni = Number(posisiHariIni.belanja_malam || 0);
            }
        }

        // Rumus: (Saldo Harian + Belanja Malam) - Total Belanja Hari Ini
        const sisaKasHariIni = (saldoHarianHariIni + belanjaMalamHariIni) - totalBelanjaHariIni;
        const netTotal = grandTotal - totalExpense;

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            omset: grandTotal,
            pengeluaran: totalExpense,
            bersih: netTotal,
            harian: omsetBulanIni,
            pengeluaran_hari_ini: pengeluaranHariIni,
            teks_pengeluaran_hari_ini: teksDaftarPengeluaran,
            total_belanja_hari_ini: totalBelanjaHariIni,
            posisi_kas: {
                saldo_harian: saldoHarianHariIni,
                belanja_malam: belanjaMalamHariIni,
                sisa_kas: sisaKasHariIni,
                teks_saldo: `Rp ${saldoHarianHariIni.toLocaleString('id-ID')}`,
                teks_belanja_malam: `Rp ${belanjaMalamHariIni.toLocaleString('id-ID')}`,
                teks_sisa_kas: `Rp ${sisaKasHariIni.toLocaleString('id-ID')}`
            }
        });
    } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: "Gagal memuat data" });
    }
}
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
