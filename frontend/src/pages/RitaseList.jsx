import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search, FileText, X, ChevronLeft, ChevronRight, Download, FileDown,
  Plus, Pencil, Trash2, TruckIcon, Clock
} from 'lucide-react';

const WAKTU_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const from = String(i).padStart(2, '0') + '.00';
  const to = String((i + 1) % 24).padStart(2, '0') + '.00';
  return `${from}-${to}`;
});

const emptyForm = { driver_id: '', date: '', waktu_ritase: '', notes: '' };

export default function RitaseList() {
  const { getAuthHeader, API, user } = useAuth();
  const [ritaseData, setRitaseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const perPage = 15;

  const isSuperAdmin = user?.role === 'superadmin';

  const fetchRitase = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (searchQuery) params.append('search', searchQuery);
      const res = await axios.get(`${API}/ritase?${params.toString()}`, { headers: getAuthHeader() });
      setRitaseData(res.data);
    } catch (err) {
      toast.error('Gagal memuat data ritase');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API}/drivers`, { headers: getAuthHeader() });
      setDrivers(res.data.filter(d => d.status === 'active'));
    } catch {}
  };

  useEffect(() => { fetchRitase(); }, [dateFrom, dateTo]);
  useEffect(() => { fetchDrivers(); }, []);

  const handleSearch = () => { setPage(1); fetchRitase(); };
  const totalPages = Math.ceil(ritaseData.length / perPage);
  const paginatedData = ritaseData.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setSearchQuery(''); setPage(1); };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await axios.get(`${API}/ritase/export/${type}?${params.toString()}`, { headers: getAuthHeader(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ritase_report.${type === 'csv' ? 'csv' : 'pdf'}`);
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

  const openEdit = (item) => {
    setEditItem(item);
    setFormData({
      driver_id: item.driver_id,
      date: item.date,
      waktu_ritase: item.waktu_ritase || '',
      notes: item.notes || ''
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editItem) {
        await axios.put(`${API}/ritase/${editItem.id}`, formData, { headers: getAuthHeader() });
        toast.success('Ritase berhasil diperbarui');
        setEditItem(null);
      } else {
        await axios.post(`${API}/ritase`, formData, { headers: getAuthHeader() });
        toast.success('Ritase berhasil ditambahkan');
        setShowAddModal(false);
      }
      setFormData(emptyForm);
      fetchRitase();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan ritase');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ritase ini?')) return;
    try {
      await axios.delete(`${API}/ritase/${id}`, { headers: getAuthHeader() });
      toast.success('Ritase berhasil dihapus');
      fetchRitase();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus ritase');
    }
  };

  const FormModal = ({ title, onClose }) => {
    const [driverSearch, setDriverSearch] = useState('');
    const [showDriverDropdown, setShowDriverDropdown] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
      if (formData.driver_id) {
        const found = drivers.find(d => d.driver_id === formData.driver_id);
        if (found) {
          setSelectedDriver(found);
          setDriverSearch(found.name);
        }
      }
    }, []);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
            searchRef.current && !searchRef.current.contains(e.target)) {
          setShowDriverDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredDrivers = useMemo(() => {
      if (!driverSearch.trim()) return drivers.slice(0, 50);
      const q = driverSearch.toLowerCase();
      return drivers.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.driver_id.toLowerCase().includes(q) ||
        (d.plate || '').toLowerCase().includes(q) ||
        (d.phone || '').includes(q)
      ).slice(0, 50);
    }, [driverSearch]);

    const handleDriverSelect = (driver) => {
      setSelectedDriver(driver);
      setFormData(p => ({ ...p, driver_id: driver.driver_id }));
      setDriverSearch(driver.name);
      setShowDriverDropdown(false);
    };

    const clearDriver = () => {
      setSelectedDriver(null);
      setFormData(p => ({ ...p, driver_id: '' }));
      setDriverSearch('');
    };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()} className="w-full max-w-lg glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
            <h2 className="text-base font-bold text-zinc-100">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"><X className="w-4 h-4 text-zinc-400" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-label text-xs mb-1 block">Driver</label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={driverSearch}
                    onChange={(e) => {
                      setDriverSearch(e.target.value);
                      setShowDriverDropdown(true);
                      if (!e.target.value) clearDriver();
                    }}
                    onFocus={() => setShowDriverDropdown(true)}
                    placeholder="Cari nama, ID, plat, atau telepon driver..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all"
                  />
                  {selectedDriver && (
                    <button type="button" onClick={clearDriver}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <X className="w-3 h-3 text-zinc-300" />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {showDriverDropdown && !selectedDriver && (
                    <motion.div ref={dropdownRef}
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-52 overflow-y-auto scrollbar-thin">
                      {filteredDrivers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-500">Tidak ada driver ditemukan</div>
                      ) : (
                        filteredDrivers.map(d => (
                          <button key={d.driver_id} type="button" onClick={() => handleDriverSelect(d)}
                            className="w-full px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-zinc-100 text-sm font-medium">{d.name}</span>
                                <span className={`ml-2 text-xs font-mono ${d.category === 'premium' ? 'text-amber-400' : 'text-zinc-500'}`}>
                                  {d.category === 'premium' ? 'PREMIUM' : 'STANDAR'}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-zinc-500">{d.plate}</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">{d.driver_id} • {d.phone}</div>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {selectedDriver && (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                  <div className="text-xs text-emerald-400 font-medium">{selectedDriver.name}</div>
                  <div className="text-xs text-zinc-500">{selectedDriver.driver_id} • {selectedDriver.plate}</div>
                </div>
              )}
            </div>
            <div>
              <label className="text-label text-xs mb-1 block">Tanggal</label>
              <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-label text-xs mb-1 block">Waktu Ritase</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <select value={formData.waktu_ritase} onChange={e => setFormData(p => ({ ...p, waktu_ritase: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm appearance-none">
                  <option value="">-- Pilih Waktu Ritase --</option>
                  {WAKTU_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-label text-xs mb-1 block">Catatan</label>
              <input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Catatan tambahan..."
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
            </div>
            <button onClick={handleSave} disabled={saving || !formData.driver_id || !formData.date}
              className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-50">
              {saving ? 'Menyimpan...' : editItem ? 'Perbarui' : 'Tambah Ritase'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>List Ritase Driver</h1>
              <p className="text-zinc-500 text-xs">Data perjalanan ritase driver</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all">
            <Plus className="w-3.5 h-3.5" /> Tambah Ritase
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
          <span className="text-xs text-zinc-500">Total: <span className="text-zinc-300 font-mono">{ritaseData.length}</span> ritase</span>
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
        ) : ritaseData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500"><TruckIcon className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">Tidak ada data ritase</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                    <th className="text-left px-4 py-3 text-label">ID</th>
                    <th className="text-left px-4 py-3 text-label">Driver</th>
                    <th className="text-left px-4 py-3 text-label">Tanggal</th>
                    <th className="text-left px-4 py-3 text-label">Waktu Ritase</th>
                    <th className="text-left px-4 py-3 text-label">Catatan</th>
                    <th className="text-left px-4 py-3 text-label">Admin</th>
                    <th className="text-right px-4 py-3 text-label">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3"><span className="font-mono text-xs text-amber-400">#{item.id}</span></td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-100">{item.driver_name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{item.driver_id}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{item.date}</td>
                      <td className="px-4 py-3">
                        {item.waktu_ritase ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">
                            <Clock className="w-3 h-3" />{item.waktu_ritase}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 text-xs max-w-[150px] truncate">{item.notes || '-'}</td>
                      <td className="px-4 py-3 text-zinc-300 text-xs">{item.admin_name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSuperAdmin && (
                            <>
                              <button onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg bg-zinc-800 text-blue-400 hover:bg-blue-900/30 transition-all" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(item.id)}
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

      <AnimatePresence>
        {showAddModal && <FormModal title="Tambah Ritase Baru" onClose={() => setShowAddModal(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {editItem && <FormModal title="Edit Ritase" onClose={() => setEditItem(null)} />}
      </AnimatePresence>
    </div>
  );
}
