import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle2, Edit2, X, Download, FileDown, Plus, Trash2 } from 'lucide-react';
import { StatusBadge } from './AdminDashboard';

const CATEGORY_LABELS = { standar: 'Standar', reg: 'Standar', premium: 'Premium' };

const EditModal = ({ driver, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: driver.name,
    phone: driver.phone,
    plate: driver.plate,
    category: driver.category,
    status: driver.status,
  });

  const handleSave = (e) => {
    e.preventDefault();
    onSave(driver.driver_id, form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md mx-4 glass-card rounded-xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-zinc-100">Edit Driver</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4" data-testid="edit-driver-form">
          <div>
            <label className="text-label block mb-1.5">Nama</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all" />
          </div>
          <div>
            <label className="text-label block mb-1.5">No. HP</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all font-mono" />
          </div>
          <div>
            <label className="text-label block mb-1.5">Plat Nomor</label>
            <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label block mb-1.5">Kategori</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all">
                <option value="standar">Standar</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-label block mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all">
                <option value="active">Aktif</option>
                <option value="warning">Warning</option>
                <option value="suspend">Suspend</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 text-sm font-bold transition-all">
              Batal
            </button>
            <button type="submit" data-testid="save-driver-button"
              className="flex-1 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all">
              Simpan
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const CreateModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({
    driver_id: '',
    name: '',
    phone: '',
    plate: '',
    category: 'standar',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.driver_id || !form.name) {
      toast.error('Driver ID dan Nama wajib diisi');
      return;
    }
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md mx-4 glass-card rounded-xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-zinc-100">Tambah Driver Baru</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-label block mb-1.5">Driver ID *</label>
            <input value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all font-mono" required />
          </div>
          <div>
            <label className="text-label block mb-1.5">Nama *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all" required />
          </div>
          <div>
            <label className="text-label block mb-1.5">No. HP</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all font-mono" />
          </div>
          <div>
            <label className="text-label block mb-1.5">Plat Nomor</label>
            <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label block mb-1.5">Kategori</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all">
                <option value="standar">Standar</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-label block mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all">
                <option value="active">Aktif</option>
                <option value="warning">Warning</option>
                <option value="suspend">Suspend</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 text-sm font-bold transition-all">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Tambah'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default function Drivers() {
  const { getAuthHeader, API, user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editDriver, setEditDriver] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [exporting, setExporting] = useState(false);
  const isSuperAdmin = user?.role === 'superadmin';

  const fetchDrivers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status_filter', statusFilter);
      const res = await axios.get(`${API}/drivers?${params}`, { headers: getAuthHeader() });
      setDrivers(res.data);
    } catch {
      toast.error('Gagal memuat data driver');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, [search, statusFilter]);

  const handleSuspend = async (driverId, name) => {
    if (!window.confirm(`Suspend driver ${name}?`)) return;
    setActionLoading(driverId);
    try {
      await axios.patch(`${API}/drivers/${driverId}/suspend`, {}, { headers: getAuthHeader() });
      toast.success(`Driver ${name} disuspend`);
      fetchDrivers();
    } catch { toast.error('Gagal mensuspend driver'); }
    finally { setActionLoading(null); }
  };

  const handleActivate = async (driverId, name) => {
    setActionLoading(driverId);
    try {
      await axios.patch(`${API}/drivers/${driverId}/activate`, {}, { headers: getAuthHeader() });
      toast.success(`Driver ${name} diaktifkan`);
      fetchDrivers();
    } catch { toast.error('Gagal mengaktifkan driver'); }
    finally { setActionLoading(null); }
  };

  const handleSave = async (driverId, data) => {
    try {
      await axios.put(`${API}/drivers/${driverId}`, data, { headers: getAuthHeader() });
      toast.success('Driver diperbarui');
      setEditDriver(null);
      fetchDrivers();
    } catch { toast.error('Gagal memperbarui driver'); }
  };

  const handleCreate = async (data) => {
    try {
      await axios.post(`${API}/drivers`, data, { headers: getAuthHeader() });
      toast.success('Driver berhasil ditambahkan');
      setShowCreate(false);
      fetchDrivers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menambah driver');
    }
  };

  const handleDelete = async (driverId, name) => {
    if (!window.confirm(`Hapus driver ${name}? Data akan hilang permanen.`)) return;
    setActionLoading(driverId);
    try {
      await axios.delete(`${API}/drivers/${driverId}`, { headers: getAuthHeader() });
      toast.success(`Driver ${name} berhasil dihapus`);
      fetchDrivers();
    } catch { toast.error('Gagal menghapus driver'); }
    finally { setActionLoading(null); }
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/drivers/export/${type}`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `drivers.${type === 'csv' ? 'csv' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} berhasil diunduh`);
    } catch {
      toast.error(`Gagal mengekspor ${type.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    warning: drivers.filter(d => d.status === 'warning').length,
    suspend: drivers.filter(d => d.status === 'suspend').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {editDriver && (
        <EditModal driver={editDriver} onClose={() => setEditDriver(null)} onSave={handleSave} />
      )}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>Data Driver</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{stats.total} total · {stats.active} aktif · {stats.warning} warning · {stats.suspend} suspend</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 text-xs font-bold transition-all disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black border border-amber-400 hover:bg-amber-400 text-xs font-bold transition-all disabled:opacity-50">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 text-xs font-bold transition-all">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          )}
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Semua', value: '', count: stats.total, color: 'text-zinc-300 bg-zinc-800 border-zinc-700' },
          { label: 'Aktif', value: 'active', count: stats.active, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Warning', value: 'warning', count: stats.warning, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Suspend', value: 'suspend', count: stats.suspend, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
        ].map(pill => (
          <button key={pill.value} onClick={() => setStatusFilter(pill.value)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${pill.color} ${statusFilter === pill.value ? 'ring-1 ring-white/20' : 'opacity-70 hover:opacity-100'}`}>
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          data-testid="driver-search-input"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, ID, atau plat nomor..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Memuat data...</div>
          ) : drivers.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Tidak ada driver ditemukan</div>
          ) : (
            <table className="w-full text-sm" data-testid="drivers-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-4 py-3 text-label">Driver ID</th>
                  <th className="text-left px-4 py-3 text-label">Nama</th>
                  <th className="text-left px-4 py-3 text-label">Plat</th>
                  <th className="text-left px-4 py-3 text-label">Kategori</th>
                  <th className="text-left px-4 py-3 text-label">Status</th>
                  <th className="text-right px-4 py-3 text-label">SIJ Bulan</th>
                  <th className="text-right px-4 py-3 text-label">Mismatch</th>
                  <th className="text-right px-4 py-3 text-label">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <tr key={d.driver_id}
                    className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{d.driver_id}</td>
                    <td className="px-4 py-3 text-zinc-100 font-medium">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{d.plate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${d.category === 'premium' ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {CATEGORY_LABELS[d.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{d.total_sij_month}</td>
                    <td className="px-4 py-3 text-right">
                      {d.mismatch_count > 0 ? (
                        <span className={`font-mono font-bold text-xs ${d.mismatch_count >= 3 ? 'text-red-400' : 'text-orange-400'}`}>
                          {d.mismatch_count}x
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs font-mono">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          data-testid={`edit-driver-${d.driver_id}`}
                          onClick={() => setEditDriver(d)}
                          className="p-1.5 rounded text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {d.status !== 'suspend' ? (
                          <button
                            data-testid={`suspend-driver-${d.driver_id}`}
                            onClick={() => handleSuspend(d.driver_id, d.name)}
                            disabled={actionLoading === d.driver_id}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            data-testid={`activate-driver-${d.driver_id}`}
                            onClick={() => handleActivate(d.driver_id, d.name)}
                            disabled={actionLoading === d.driver_id}
                            className="p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(d.driver_id, d.name)}
                            disabled={actionLoading === d.driver_id}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}
