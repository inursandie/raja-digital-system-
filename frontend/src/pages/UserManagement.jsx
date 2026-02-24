import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users, Plus, Pencil, Trash2, X, Eye, EyeOff, Shield, User
} from 'lucide-react';

const emptyForm = { user_id: '', name: '', email: '', password: '', role: 'admin', shift: '' };
const ROLE_LABELS = { admin: 'Admin', superadmin: 'Super Admin' };
const SHIFT_OPTIONS = ['', 'Shift1', 'Shift2'];

export default function UserManagement() {
  const { getAuthHeader, API } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/users`, { headers: getAuthHeader() });
      setUsers(res.data);
    } catch {
      toast.error('Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setFormData(emptyForm);
    setShowPassword(false);
    setShowAddModal(true);
  };

  const openEdit = (item) => {
    setFormData({
      user_id: item.user_id,
      name: item.name,
      email: item.email,
      password: '',
      role: item.role,
      shift: item.shift || ''
    });
    setShowPassword(false);
    setEditItem(item);
  };

  const handleSave = async () => {
    if (!editItem && !formData.password) {
      toast.error('Password wajib diisi untuk user baru');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        const payload = {};
        if (formData.name) payload.name = formData.name;
        if (formData.email) payload.email = formData.email;
        if (formData.password) payload.password = formData.password;
        if (formData.role) payload.role = formData.role;
        payload.shift = formData.shift || null;
        await axios.put(`${API}/users/${editItem.user_id}`, payload, { headers: getAuthHeader() });
        toast.success('User berhasil diperbarui');
        setEditItem(null);
      } else {
        await axios.post(`${API}/users`, {
          user_id: formData.user_id,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          shift: formData.shift || null
        }, { headers: getAuthHeader() });
        toast.success('User berhasil dibuat');
        setShowAddModal(false);
      }
      setFormData(emptyForm);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan user');
    } finally { setSaving(false); }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm(`Hapus user "${userId}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { headers: getAuthHeader() });
      toast.success('User berhasil dihapus');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus user');
    }
  };

  const FormModal = ({ title, onClose, isEdit }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-lg glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <h2 className="text-base font-bold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="text-label text-xs mb-1 block">User ID <span className="text-red-400">*</span></label>
              <input type="text" value={formData.user_id}
                onChange={e => setFormData(p => ({ ...p, user_id: e.target.value }))}
                placeholder="Contoh: admin5"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
            </div>
          )}
          <div>
            <label className="text-label text-xs mb-1 block">Nama Lengkap <span className="text-red-400">*</span></label>
            <input type="text" value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="Nama lengkap user"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
          </div>
          <div>
            <label className="text-label text-xs mb-1 block">Email <span className="text-red-400">*</span></label>
            <input type="email" value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="email@raja.id"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
          </div>
          <div>
            <label className="text-label text-xs mb-1 block">
              Password {isEdit && <span className="text-zinc-500 font-normal">(kosongkan jika tidak diubah)</span>}
              {!isEdit && <span className="text-red-400"> *</span>}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={formData.password}
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                placeholder={isEdit ? 'Password baru (opsional)' : 'Masukkan password'}
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm" />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label text-xs mb-1 block">Role <span className="text-red-400">*</span></label>
              <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm">
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="text-label text-xs mb-1 block">Shift</label>
              <select value={formData.shift} onChange={e => setFormData(p => ({ ...p, shift: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm">
                <option value="">Tidak ada</option>
                <option value="Shift1">Shift 1</option>
                <option value="Shift2">Shift 2</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave}
            disabled={saving || !formData.name || !formData.email || (!isEdit && (!formData.user_id || !formData.password))}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-50">
            {saving ? 'Menyimpan...' : isEdit ? 'Perbarui User' : 'Buat User'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>User Management</h1>
              <p className="text-zinc-500 text-xs">Kelola akun pengguna sistem</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all">
            <Plus className="w-3.5 h-3.5" /> Tambah User
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Tidak ada user ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                  <th className="text-left px-4 py-3 text-label">User ID</th>
                  <th className="text-left px-4 py-3 text-label">Nama</th>
                  <th className="text-left px-4 py-3 text-label">Email</th>
                  <th className="text-left px-4 py-3 text-label">Role</th>
                  <th className="text-left px-4 py-3 text-label">Shift</th>
                  <th className="text-right px-4 py-3 text-label">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-amber-400">{u.user_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === 'superadmin' ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                          {u.role === 'superadmin' ? <Shield className="w-3.5 h-3.5 text-amber-400" /> : <User className="w-3.5 h-3.5 text-zinc-400" />}
                        </div>
                        <span className="text-zinc-100">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        u.role === 'superadmin'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.shift ? (
                        <span className={`text-xs font-mono ${u.shift === 'Shift1' ? 'text-amber-400' : 'text-sky-400'}`}>{u.shift}</span>
                      ) : (
                        <span className="text-zinc-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg bg-zinc-800 text-blue-400 hover:bg-blue-900/30 transition-all" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(u.user_id)}
                          className="p-1.5 rounded-lg bg-zinc-800 text-red-400 hover:bg-red-900/30 transition-all" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showAddModal && <FormModal title="Tambah User Baru" onClose={() => setShowAddModal(false)} isEdit={false} />}
      </AnimatePresence>
      <AnimatePresence>
        {editItem && <FormModal title="Edit User" onClose={() => setEditItem(null)} isEdit={true} />}
      </AnimatePresence>
    </div>
  );
}
