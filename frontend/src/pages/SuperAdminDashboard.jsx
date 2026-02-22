import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import {
  TrendingUp, DollarSign, Users, BarChart2, AlertTriangle,
  RefreshCw, Ban, CheckCircle2
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';
import { toast } from 'sonner';
import { StatusBadge } from './AdminDashboard';

const useCountUp = (target) => {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    if (target === 0) { setCount(0); return; }
    const diff = target - start;
    let startTime = null;
    const animate = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / 1200, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);
  return count;
};

const KPICard = ({ title, value, icon: Icon, color, prefix = '', suffix = '', subtitle = '', delay = 0 }) => {
  const count = useCountUp(value);
  const styles = {
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', card: 'kpi-glow-amber' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', card: 'kpi-glow-emerald' },
    sky: { text: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', card: 'kpi-glow-sky' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', card: '' },
  };
  const s = styles[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`glass-card-hover rounded-xl p-5 ${s.card}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-label">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${s.bg}`}>
          <Icon className={`w-4 h-4 ${s.text}`} />
        </div>
      </div>
      <div className={`text-3xl font-black tracking-tight ${s.text}`} style={{ fontFamily: 'Chivo, sans-serif' }}>
        {prefix}{count.toLocaleString('id-ID')}{suffix}
      </div>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </motion.div>
  );
};

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800/95 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl">
      {label && <p className="text-zinc-400 mb-1.5 font-mono">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="font-mono" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value.toLocaleString('id-ID')}
        </p>
      ))}
    </div>
  );
};

const ADMIN_NAMES = { admin1: 'Admin 1', admin2: 'Admin 2', admin3: 'Admin 3', admin4: 'Admin 4' };

export default function SuperAdminDashboard() {
  const { getAuthHeader, API } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [suspending, setSuspending] = useState(null);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/superadmin`, { headers: getAuthHeader() });
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => { fetchData(); setCountdown(30); }, 30000);
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, []);

  const handleSuspend = async (driverId, name) => {
    if (!window.confirm(`Suspend driver ${name}?`)) return;
    setSuspending(driverId);
    try {
      await axios.patch(`${API}/drivers/${driverId}/suspend`, {}, { headers: getAuthHeader() });
      toast.success(`Driver ${name} disuspend`);
      fetchData();
    } catch {
      toast.error('Gagal mensuspend driver');
    } finally {
      setSuspending(null);
    }
  };

  const barData = (data?.revenue_per_admin || []).map(a => ({
    name: ADMIN_NAMES[a._id] || a._id,
    revenue: a.revenue,
    count: a.count,
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data...</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Dashboard SuperAdmin
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Soekarno-Hatta Airport — Overview Lengkap</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
          <RefreshCw className="w-3 h-3" />
          {countdown}s
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="SIJ Hari Ini" value={data?.total_sij_today || 0} icon={TrendingUp} color="amber" delay={0} />
        <KPICard title="Revenue Hari Ini" value={data?.total_revenue_today || 0} icon={DollarSign} color="emerald" prefix="Rp " delay={0.07} />
        <KPICard title="Driver Aktif" value={data?.active_drivers || 0} icon={Users} color="sky"
          subtitle={`${data?.total_drivers || 0} total · ${data?.suspended_drivers || 0} suspend`} delay={0.14} />
        <KPICard title="Proyeksi Bulan" value={data?.projection || 0} icon={BarChart2} color="purple" prefix="Rp " delay={0.21} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">SIJ per Shift (Hari Ini)</h3>
          {(() => {
            const pieData = (data?.sij_per_shift || []).filter(d => d.value > 0);
            const totalPie = pieData.reduce((s, d) => s + d.value, 0);
            if (totalPie === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-[180px] text-zinc-600">
                  <div className="text-sm font-mono">Belum ada SIJ hari ini</div>
                </div>
              );
            }
            return (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1">
                  {pieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                      <span className="text-zinc-400">{entry.name}: </span>
                      <span className="font-bold" style={{ color: entry.fill }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </motion.div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }}
          className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">Revenue per Admin (Hari Ini)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip formatter={(v) => `Rp ${v.toLocaleString('id-ID')}`} />} />
              <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Line Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
          className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">Tren SIJ 7 Hari</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data?.daily_trend || []} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 9, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="sij" stroke="#f59e0b" strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 3 }} activeDot={{ r: 5 }} name="SIJ" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Driver Ranking + Mismatch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Driver Ranking */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800/50">
            <h2 className="text-sm font-semibold text-zinc-100">Ranking Driver (SIJ Bulan Ini)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="driver-ranking-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-4 py-3 text-label">#</th>
                  <th className="text-left px-4 py-3 text-label">Nama</th>
                  <th className="text-left px-4 py-3 text-label">Kategori</th>
                  <th className="text-right px-4 py-3 text-label">SIJ</th>
                </tr>
              </thead>
              <tbody>
                {(data?.driver_ranking || []).map((d, i) => (
                  <tr key={d.driver_id} className="border-b border-zinc-800/30 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-400' : 'text-zinc-500'}`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-100 text-sm">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${d.category === 'premium' ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {d.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{d.total_sij_month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Mismatch + Suspend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.57 }}
          className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Mismatch Driver</h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">{data?.mismatch_list?.length || 0}</span>
          </div>
          <div className="overflow-x-auto max-h-64 scrollbar-thin">
            {data?.mismatch_list?.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-sm">Tidak ada mismatch</div>
            ) : (
              <table className="w-full text-sm" data-testid="superadmin-mismatch-table">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="text-left px-4 py-3 text-label">Nama</th>
                    <th className="text-left px-4 py-3 text-label">Mismatch</th>
                    <th className="text-left px-4 py-3 text-label">Status</th>
                    <th className="text-right px-4 py-3 text-label">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.mismatch_list?.map((d) => (
                    <tr key={d.driver_id} className="border-b border-zinc-800/30 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-zinc-100 text-sm">{d.name}</div>
                        <div className="text-xs font-mono text-zinc-500">{d.driver_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold font-mono text-sm ${d.mismatch_count >= 3 ? 'text-red-400' : d.mismatch_count >= 2 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {d.mismatch_count}x
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {d.status !== 'suspend' ? (
                          <button
                            data-testid={`suspend-btn-${d.driver_id}`}
                            onClick={() => handleSuspend(d.driver_id, d.name)}
                            disabled={suspending === d.driver_id}
                            className="flex items-center gap-1 ml-auto px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 transition-all disabled:opacity-50"
                          >
                            <Ban className="w-3 h-3" />
                            Suspend
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600 font-mono">suspended</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
