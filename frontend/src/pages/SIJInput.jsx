import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { FileText, Printer, RotateCcw, CheckCircle2, ChevronDown } from 'lucide-react';

const formatRupiah = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const printReceipt = (tx, driverName) => {
  const tickets = Array.from({ length: tx.sheets }, (_, i) => `
    <div class="ticket">
      <div class="header">
        <div class="title">RAJA DIGITAL SYSTEM</div>
        <div class="subtitle">SIJ - Soekarno-Hatta Airport</div>
      </div>
      <div class="tx-id">${tx.transaction_id}</div>
      <table class="details">
        <tr><td>Driver</td><td>${driverName}</td></tr>
        <tr><td>Tanggal</td><td>${tx.date}</td></tr>
        <tr><td>Jam</td><td>${tx.time}</td></tr>
        <tr><td>Admin</td><td>${tx.admin_name}</td></tr>
        <tr><td>Shift</td><td>${tx.shift}</td></tr>
        <tr><td>Lembar</td><td>${i + 1} / ${tx.sheets}</td></tr>
        <tr><td>Jumlah</td><td>Rp 40.000</td></tr>
      </table>
      <div class="footer">QRIS: ${tx.qris_ref}</div>
    </div>
  `).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <html>
    <head>
      <title>SIJ Receipt - ${tx.transaction_id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: #f5f5f5; padding: 10px; }
        .ticket { width: 80mm; background: white; border: 2px dashed #333; padding: 12px; margin: 10px auto; page-break-after: always; }
        .header { text-align: center; margin-bottom: 8px; }
        .title { font-size: 14px; font-weight: bold; letter-spacing: 2px; }
        .subtitle { font-size: 9px; color: #666; }
        .tx-id { font-size: 13px; font-weight: bold; text-align: center; letter-spacing: 1px; border: 1px solid #000; padding: 6px 4px; margin: 8px 0; background: #f0f0f0; }
        .details { width: 100%; font-size: 10px; border-collapse: collapse; }
        .details td { padding: 2px 4px; }
        .details td:first-child { color: #666; width: 40%; }
        .details td:last-child { font-weight: bold; }
        .footer { font-size: 9px; color: #888; text-align: center; margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 4px; }
        @media print { body { background: white; padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      ${tickets}
      <div class="no-print" style="text-align:center; margin-top:20px">
        <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; background:#f59e0b; border:none; border-radius:6px; font-weight:bold;">
          Cetak / Print
        </button>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
};

export default function SIJInput() {
  const { getAuthHeader, API, user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ driver_id: '', sheets: '5', qris_ref: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    axios.get(`${API}/drivers/active`, { headers: getAuthHeader() })
      .then(res => setDrivers(res.data))
      .catch(() => toast.error('Gagal memuat data driver'));
  }, []);

  const handleDriverChange = (e) => {
    const did = e.target.value;
    setForm(f => ({ ...f, driver_id: did }));
    setSelectedDriver(drivers.find(d => d.driver_id === did) || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.driver_id) { toast.error('Pilih driver terlebih dahulu'); return; }
    if (!form.qris_ref.trim()) { toast.error('QRIS Reference wajib diisi'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/sij`, {
        driver_id: form.driver_id,
        sheets: parseInt(form.sheets),
        qris_ref: form.qris_ref.trim(),
      }, { headers: getAuthHeader() });
      setResult(res.data);
      toast.success('SIJ berhasil dibuat!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal membuat SIJ');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ driver_id: '', sheets: '5', qris_ref: '' });
    setResult(null);
    setSelectedDriver(null);
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>Input SIJ</h1>
            <p className="text-zinc-500 text-xs">{today}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5" data-testid="sij-form">

                {/* Driver Select */}
                <div>
                  <label className="text-label block mb-2">Driver <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select
                      data-testid="driver-select"
                      value={form.driver_id}
                      onChange={handleDriverChange}
                      className="w-full appearance-none px-4 py-3 pr-10 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 text-sm transition-all"
                    >
                      <option value="">-- Pilih Driver --</option>
                      {drivers.map(d => (
                        <option key={d.driver_id} value={d.driver_id}>
                          {d.name} ({d.plate}) — {d.driver_id}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                  {selectedDriver && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 flex items-center gap-3 text-xs">
                      <span className={`font-mono ${selectedDriver.category === 'premium' ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {selectedDriver.category.toUpperCase()}
                      </span>
                      <span className="text-zinc-500">{selectedDriver.phone}</span>
                    </div>
                  )}
                </div>

                {/* Sheets */}
                <div>
                  <label className="text-label block mb-2">Jumlah Sheet</label>
                  <div className="relative">
                    <select
                      data-testid="sheets-select"
                      value={form.sheets}
                      onChange={e => setForm(f => ({ ...f, sheets: e.target.value }))}
                      className="w-full appearance-none px-4 py-3 pr-10 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 text-sm transition-all"
                    >
                      {[1,2,3,4,5,6,7].map(n => (
                        <option key={n} value={n}>{n} lembar{n === 5 ? ' (default)' : ''}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Amount (fixed) */}
                <div>
                  <label className="text-label block mb-2">Jumlah Pembayaran</label>
                  <div className="px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-emerald-400 font-mono font-bold text-sm">
                    Rp 40.000 (tetap)
                  </div>
                </div>

                {/* QRIS Ref */}
                <div>
                  <label className="text-label block mb-2">QRIS Reference <span className="text-red-400">*</span></label>
                  <input
                    data-testid="qris-ref-input"
                    type="text"
                    value={form.qris_ref}
                    onChange={e => setForm(f => ({ ...f, qris_ref: e.target.value }))}
                    placeholder="Masukkan nomor referensi QRIS"
                    className="w-full px-4 py-3 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all font-mono"
                  />
                </div>

                {/* Auto-filled fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-label block mb-2">Admin</label>
                    <div className="px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm">{user?.name}</div>
                  </div>
                  <div>
                    <label className="text-label block mb-2">Shift</label>
                    <div className="px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm font-mono">{user?.shift}</div>
                  </div>
                </div>

                <button
                  data-testid="sij-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                  ) : (
                    <><FileText className="w-4 h-4" />Buat SIJ</>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-xl p-6 space-y-5"
              data-testid="sij-success-card"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold text-emerald-400">SIJ Berhasil Dibuat!</h2>
                  <p className="text-xs text-zinc-500">Transaksi tercatat dalam sistem</p>
                </div>
              </div>

              <div className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-800">
                <div className="text-label mb-2">Transaction ID</div>
                <div className="font-mono text-xl font-bold text-amber-400 tracking-widest" data-testid="transaction-id">
                  {result.transaction_id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-label">Driver</span><p className="text-zinc-100 mt-0.5">{result.driver_name}</p></div>
                <div><span className="text-label">Tanggal</span><p className="text-zinc-100 mt-0.5 font-mono">{result.date}</p></div>
                <div><span className="text-label">Jam</span><p className="text-zinc-100 mt-0.5 font-mono">{result.time}</p></div>
                <div><span className="text-label">Sheet</span><p className="text-zinc-100 mt-0.5">{result.sheets} lembar</p></div>
                <div><span className="text-label">Admin</span><p className="text-zinc-100 mt-0.5">{result.admin_name}</p></div>
                <div><span className="text-label">Jumlah</span><p className="text-emerald-400 mt-0.5 font-mono font-bold">{formatRupiah(result.amount)}</p></div>
              </div>

              <div className="flex gap-3">
                <button
                  data-testid="print-sij-button"
                  onClick={() => printReceipt(result, result.driver_name)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Cetak SIJ ({result.sheets} lembar)
                </button>
                <button
                  data-testid="new-sij-button"
                  onClick={resetForm}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 font-bold text-sm transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Input Baru
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
