import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Search, CalendarDays, FileText, Printer, X, ChevronLeft, ChevronRight,
  Download, Eye, Clock, User, CreditCard, Hash, FileDown, Plus, Pencil, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const RAJA_LOGO_URL = 'https://customer-assets.emergentagent.com/job_sij-manager/artifacts/hfoe4oj3_Logo-RAJA-Cooperation';

const formatRupiah = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const printReceiptBrowser = (tx) => {
  const amount = tx.amount || 40000;
  const amountFormatted = new Intl.NumberFormat('id-ID').format(amount);
  const categoryLabel = tx.category === 'premium' ? 'PREMIUM' : 'STANDAR';
  const tickets = Array.from({ length: tx.sheets }, (_, i) => `
    <div class="ticket">
      <div class="header">
        <img src="${RAJA_LOGO_URL}" alt="RAJA Logo" style="width:40mm; height:auto; margin: 0 auto 8px; display:block;" onerror="this.style.display='none'" />
        <div class="title">RAJA DIGITAL SYSTEM</div>
        <div class="subtitle">SIJ - Soekarno-Hatta Airport</div>
      </div>
      <div class="tx-id">${tx.transaction_id}</div>
      <table class="details">
        <tr><td>Driver</td><td>${tx.driver_name}</td></tr>
        <tr><td>Kategori</td><td>${categoryLabel}</td></tr>
        <tr><td>Tanggal</td><td>${tx.date}</td></tr>
        <tr><td>Jam</td><td>${tx.time}</td></tr>
        <tr><td>Admin</td><td>${tx.admin_name}</td></tr>
        <tr><td>Shift</td><td>${tx.shift}</td></tr>
        <tr><td>Lembar</td><td>${i + 1} / ${tx.sheets}</td></tr>
        <tr><td>Jumlah</td><td>Rp ${amountFormatted}</td></tr>
      </table>
      <div class="footer">QRIS: ${tx.qris_ref}</div>
    </div>
  `).join('');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>SIJ Receipt - ${tx.transaction_id}</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #f5f5f5; padding: 10px; }
    .ticket { width: 58mm; background: white; border: 2px dashed #333; padding: 8px; margin: 10px auto; page-break-after: always; }
    .header { text-align: center; margin-bottom: 8px; }
    .title { font-size: 12px; font-weight: bold; letter-spacing: 1px; }
    .subtitle { font-size: 8px; color: #666; }
    .tx-id { font-size: 11px; font-weight: bold; text-align: center; letter-spacing: 1px; border: 1px solid #000; padding: 4px; margin: 6px 0; background: #f0f0f0; }
    .details { width: 100%; font-size: 9px; border-collapse: collapse; }
    .details td { padding: 2px 3px; }
    .details td:first-child { color: #666; width: 35%; }
    .details td:last-child { font-weight: bold; }
    .footer { font-size: 8px; color: #888; text-align: center; margin-top: 6px; border-top: 1px dashed #ccc; padding-top: 4px; }
    @media print { body { background: white; padding: 0; } .no-print { display: none; } }
  </style></head><body>${tickets}
    <div class="no-print" style="text-align:center; margin-top:20px">
      <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; background:#f59e0b; border:none; border-radius:6px; font-weight:bold;">Cetak / Print</button>
    </div></body></html>`);
  win.document.close();
  win.focus();
};

const generateESCPOSCommands = (tx) => {
  const ESC = '\x1B'; const GS = '\x1D'; const LF = '\x0A';
  const INIT = ESC + '@'; const CENTER = ESC + 'a\x01'; const LEFT = ESC + 'a\x00';
  const BOLD_ON = ESC + 'E\x01'; const BOLD_OFF = ESC + 'E\x00';
  const DOUBLE_HEIGHT = GS + '!\x11'; const NORMAL_SIZE = GS + '!\x00';
  const CUT = GS + 'V\x41\x00'; const DASHES = '--------------------------------';
  const amount = tx.amount || 40000;
  const amountFormatted = new Intl.NumberFormat('id-ID').format(amount);
  const categoryLabel = tx.category === 'premium' ? 'PREMIUM' : 'STANDAR';
  let commands = [];
  for (let i = 0; i < tx.sheets; i++) {
    let r = INIT + CENTER + BOLD_ON + DOUBLE_HEIGHT + 'RAJA DIGITAL SYSTEM' + LF + NORMAL_SIZE + BOLD_OFF + 'SIJ - Soetta Airport' + LF + DASHES + LF;
    r += BOLD_ON + DOUBLE_HEIGHT + tx.transaction_id + LF + NORMAL_SIZE + BOLD_OFF + DASHES + LF + LEFT;
    r += 'Driver   : ' + (tx.driver_name || '').substring(0, 20) + LF;
    r += 'Kategori : ' + categoryLabel + LF + 'Tanggal  : ' + tx.date + LF + 'Jam      : ' + tx.time + LF;
    r += 'Admin    : ' + tx.admin_name + LF + 'Shift    : ' + tx.shift + LF + 'Lembar   : ' + (i + 1) + ' / ' + tx.sheets + LF;
    r += CENTER + DASHES + LF + BOLD_ON + DOUBLE_HEIGHT + 'Rp ' + amountFormatted + LF + NORMAL_SIZE + BOLD_OFF + DASHES + LF;
    r += 'QRIS: ' + tx.qris_ref + LF + LF + LF + CUT;
    commands.push(r);
  }
  return commands.join('');
};

const downloadESCPOS = (tx) => {
  const escposData = generateESCPOSCommands(tx);
  const blob = new Blob([escposData], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SIJ_${tx.transaction_id}.bin`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('File ESC/POS berhasil diunduh');
};

const StatusBadge = ({ status }) => {
  const map = { active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', void: 'bg-red-500/10 text-red-400 border-red-500/20' };
  const labels = { active: 'Aktif', void: 'Void' };
  return (<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${map[status] || 'text-zinc-400 border-zinc-700'}`}>{labels[status] || status}</span>);
};

const emptyForm = { driver_id: '', sheets: 5, qris_ref: '', date: '' };

export default function SIJList() {
  const { getAuthHeader, API, user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const perPage = 15;

  const isSuperAdmin = user?.role === 'superadmin';

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (searchQuery) params.append('search', searchQuery);
      const res = await axios.get(`${API}/sij?${params.toString()}`, { headers: getAuthHeader() });
      setTransactions(res.data);
    } catch (err) {
      toast.error('Gagal memuat data SIJ');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API}/drivers`, { headers: getAuthHeader() });
      setDrivers(res.data);
    } catch {}
  };

  useEffect(() => { fetchTransactions(); }, [dateFrom, dateTo]);
  useEffect(() => { fetchDrivers(); }, []);

  const handleSearch = () => { setPage(1); fetchTransactions(); };
  const totalPages = Math.ceil(transactions.length / perPage);
  const paginatedData = transactions.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setSearchQuery(''); setPage(1); };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await axios.get(`${API}/sij/export/${type}?${params.toString()}`, { headers: getAuthHeader(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sij_report.${type === 'csv' ? 'csv' : 'pdf'}`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} berhasil diunduh`);
    } catch { toast.error(`Gagal mengekspor ${type.toUpperCase()}`); }
    finally { setExporting(false); }
  };

  const openAdd = () => {
    setFormData({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setShowAddModal(true);
  };

  const openEdit = (tx) => {
    setEditTx(tx);
    setFormData({ driver_id: tx.driver_id, sheets: tx.sheets, qris_ref: tx.qris_ref, date: tx.date, amount: tx.amount });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editTx) {
        await axios.put(`${API}/sij/${editTx.transaction_id}`, formData, { headers: getAuthHeader() });
        toast.success('SIJ berhasil diperbarui');
        setEditTx(null);
      } else {
        await axios.post(`${API}/sij`, formData, { headers: getAuthHeader() });
        toast.success('SIJ berhasil ditambahkan');
        setShowAddModal(false);
      }
      setFormData(emptyForm);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan SIJ');
    } finally { setSaving(false); }
  };

  const handleDelete = async (txId) => {
    if (!window.confirm('Hapus transaksi SIJ ini?')) return;
    try {
      await axios.delete(`${API}/sij/${txId}`, { headers: getAuthHeader() });
      toast.success('SIJ berhasil dihapus');
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus SIJ');
    }
  };

  const FormModal = ({ title, onClose }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-md glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <h2 className="text-base font-bold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-label text-xs mb-1 block">Driver</label>
            <select value={formData.driver_id} onChange={e => setFormData(p => ({ ...p, driver_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm">
              <option value="">-- Pilih Driver --</option>
              {drivers.filter(d => d.status === 'active').map(d => (<option key={d.driver_id} value={d.driver_id}>{d.name} ({d.driver_id})</option>))}
            </select>
          </div>
          <div>
            <label className="text-label text-xs mb-1 block">Tanggal</label>
            <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm [color-scheme:dark]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-xs mb-1 block">Jumlah Sheet</label>
              <input type="number" min="1" value={formData.sheets} onChange={e => setFormData(p => ({ ...p, sheets: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
            </div>
            <div>
              <label className="text-label text-xs mb-1 block">QRIS Ref</label>
              <input type="text" value={formData.qris_ref} onChange={e => setFormData(p => ({ ...p, qris_ref: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !formData.driver_id}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : editTx ? 'Perbarui' : 'Tambah SIJ'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>List SIJ</h1>
              <p className="text-zinc-500 text-xs">Riwayat transaksi SIJ</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all">
            <Plus className="w-3.5 h-3.5" /> Tambah SIJ
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cari nama driver / ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all [color-scheme:dark]" />
            <span className="text-zinc-500 text-xs">s/d</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all [color-scheme:dark]" />
            {(dateFrom || dateTo || searchQuery) && (
              <button type="button" onClick={clearFilters} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-zinc-500">Total: <span className="text-zinc-300 font-mono">{transactions.length}</span> transaksi</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('csv')} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 text-xs font-bold transition-all disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black border border-amber-400 hover:bg-amber-400 text-xs font-bold transition-all disabled:opacity-50">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data...</div></div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500"><FileText className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">Tidak ada data SIJ</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                    <th className="text-left px-4 py-3 text-label">Transaction ID</th>
                    <th className="text-left px-4 py-3 text-label">Driver</th>
                    <th className="text-left px-4 py-3 text-label">Tanggal</th>
                    <th className="text-left px-4 py-3 text-label">Jam</th>
                    <th className="text-left px-4 py-3 text-label">Admin</th>
                    <th className="text-left px-4 py-3 text-label">Sheet</th>
                    <th className="text-left px-4 py-3 text-label">Status</th>
                    <th className="text-right px-4 py-3 text-label">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((tx, i) => (
                    <tr key={tx.transaction_id} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono text-xs text-amber-400">{tx.transaction_id}</span></td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-100">{tx.driver_name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{tx.driver_id}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{tx.date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{tx.time}</td>
                      <td className="px-4 py-3 text-zinc-300 text-xs">{tx.admin_name}</td>
                      <td className="px-4 py-3 text-zinc-300">{tx.sheets}</td>
                      <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setSelectedTx(tx)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all" title="Detail">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isSuperAdmin && (
                            <>
                              <button onClick={() => openEdit(tx)}
                                className="p-1.5 rounded-lg bg-zinc-800 text-blue-400 hover:bg-blue-900/30 transition-all" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(tx.transaction_id)}
                                className="p-1.5 rounded-lg bg-zinc-800 text-red-400 hover:bg-red-900/30 transition-all" title="Hapus">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/50">
                <span className="text-xs text-zinc-500">Halaman {page} dari {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTx(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()} className="w-full max-w-md glass-card rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
                <h3 className="text-base font-bold text-white">Detail SIJ</h3>
                <button onClick={() => setSelectedTx(null)} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"><X className="w-4 h-4 text-zinc-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-800">
                  <div className="flex items-center gap-2 text-label mb-2"><Hash className="w-3.5 h-3.5" /> Transaction ID</div>
                  <div className="font-mono text-lg font-bold text-amber-400 tracking-wider">{selectedTx.transaction_id}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1"><div className="flex items-center gap-1.5 text-label"><User className="w-3 h-3" /> Driver</div><p className="text-zinc-100">{selectedTx.driver_name}</p><p className="text-xs text-zinc-500 font-mono">{selectedTx.driver_id}</p></div>
                  <div className="space-y-1"><div className="text-label">Kategori</div><p className={`font-mono ${selectedTx.category === 'premium' ? 'text-amber-400' : 'text-zinc-300'}`}>{selectedTx.category === 'premium' ? 'PREMIUM' : 'STANDAR'}</p></div>
                  <div className="space-y-1"><div className="flex items-center gap-1.5 text-label"><CalendarDays className="w-3 h-3" /> Tanggal</div><p className="text-zinc-100 font-mono">{selectedTx.date}</p></div>
                  <div className="space-y-1"><div className="flex items-center gap-1.5 text-label"><Clock className="w-3 h-3" /> Waktu</div><p className="text-zinc-100 font-mono">{selectedTx.time}</p></div>
                  <div className="space-y-1"><div className="text-label">Admin</div><p className="text-zinc-100">{selectedTx.admin_name}</p><p className="text-xs text-zinc-500">{selectedTx.shift}</p></div>
                  <div className="space-y-1"><div className="text-label">Jumlah Sheet</div><p className="text-zinc-100">{selectedTx.sheets} lembar</p></div>
                  <div className="space-y-1"><div className="text-label">Status</div><StatusBadge status={selectedTx.status} /></div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-label"><CreditCard className="w-3 h-3" /> QRIS Reference</div>
                  <p className="font-mono text-sm text-zinc-300 bg-zinc-900/50 px-3 py-2 rounded-lg">{selectedTx.qris_ref}</p>
                </div>
                <div className={`rounded-lg p-3 text-center border ${selectedTx.category === 'premium' ? 'bg-amber-900/20 border-amber-500/20' : 'bg-emerald-900/20 border-emerald-500/20'}`}>
                  <div className={`text-xs mb-1 ${selectedTx.category === 'premium' ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>Total Pembayaran ({selectedTx.category === 'premium' ? 'Premium' : 'Standar'})</div>
                  <div className={`text-xl font-bold font-mono ${selectedTx.category === 'premium' ? 'text-amber-400' : 'text-emerald-400'}`}>{formatRupiah(selectedTx.amount || 40000)}</div>
                </div>
              </div>
              <div className="px-5 pb-5 space-y-3">
                <div className="text-label text-xs">Cetak Ulang</div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => printReceiptBrowser(selectedTx)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all">
                    <Printer className="w-4 h-4" /> Cetak Browser
                  </button>
                  <button onClick={() => downloadESCPOS(selectedTx)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all">
                    <Download className="w-4 h-4" /> ESC/POS
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && <FormModal title="Tambah SIJ Baru" onClose={() => setShowAddModal(false)} />}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editTx && <FormModal title="Edit SIJ" onClose={() => setEditTx(null)} />}
      </AnimatePresence>
    </div>
  );
}
