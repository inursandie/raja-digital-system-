import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Users, TrendingUp, DollarSign, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';

const useCountUp = (target) => {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    if (target === 0) { setCount(0); return; }
    const diff = target - start;
    const duration = 1200;
    let startTime = null;
    const animate = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);
  return count;
};

const KPICard = ({ title, value, icon: Icon, color, prefix = '', suffix = '', delay = 0 }) => {
  const count = useCountUp(value);
  const colorMap = {
    amber: 'text-amber-400 kpi-glow-amber',
    emerald: 'text-emerald-400 kpi-glow-emerald',
    sky: 'text-sky-400 kpi-glow-sky',
    red: 'text-red-400 kpi-glow-red',
  };
  const bgMap = {
    amber: 'bg-amber-500/10 border-amber-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    sky: 'bg-sky-500/10 border-sky-500/20',
    red: 'bg-red-500/10 border-red-500/20',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`glass-card-hover rounded-xl p-5 ${colorMap[color]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-label">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-3xl font-black tracking-tight ${colorMap[color].split(' ')[0]}`} style={{ fontFamily: 'Chivo, sans-serif' }}>
        {prefix}{count.toLocaleString('id-ID')}{suffix}
      </div>
    </motion.div>
  );
};

const SHIFT_LABEL = { Shift1: 'Shift 1 (07:00 - 17:00)', Shift2: 'Shift 2 (17:00 - 07:00)' };
const SHIFT_COLOR = { Shift1: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Shift2: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };

export default function AdminDashboard() {
  const { getAuthHeader, API } = useAuth();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/admin`, { headers: getAuthHeader() });
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setCountdown(30);
    }, 30000);
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, []);

  const getMismatchColor = (count) => {
    if (count >= 3) return 'text-red-400';
    if (count >= 2) return 'text-orange-400';
    return 'text-yellow-400';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data...</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Dashboard Admin
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">{data?.today || '-'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono ${SHIFT_COLOR[data?.shift] || 'text-zinc-400'}`}>
            <Clock className="w-3.5 h-3.5" />
            {SHIFT_LABEL[data?.shift] || data?.shift}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
            <RefreshCw className="w-3 h-3" />
            {countdown}s
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="SIJ Shift Hari Ini" value={data?.sij_today_shift || 0} icon={TrendingUp} color="amber" delay={0} />
        <KPICard title="Revenue Shift" value={data?.revenue_shift || 0} icon={DollarSign} color="emerald" prefix="Rp " delay={0.1} />
        <KPICard title="Driver Aktif" value={data?.active_drivers || 0} icon={Users} color="sky" delay={0.2} />
      </div>

      {/* Mismatch */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Daftar Mismatch Driver</h2>
          </div>
          <span className="text-xs font-mono text-zinc-500">{data?.mismatch_list?.length || 0} driver</span>
        </div>
        <div className="overflow-x-auto">
          {data?.mismatch_list?.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-sm">Tidak ada mismatch</div>
          ) : (
            <table className="w-full text-sm" data-testid="mismatch-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-5 py-3 text-label">Driver ID</th>
                  <th className="text-left px-5 py-3 text-label">Nama</th>
                  <th className="text-left px-5 py-3 text-label">Plat</th>
                  <th className="text-left px-5 py-3 text-label">Mismatch</th>
                  <th className="text-left px-5 py-3 text-label">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.mismatch_list?.map((driver, i) => (
                  <tr
                    key={driver.driver_id}
                    style={{ opacity: 1, animationDelay: `${i * 50}ms` }}
                    className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{driver.driver_id}</td>
                    <td className="px-5 py-3 text-zinc-100 font-medium">{driver.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{driver.plate}</td>
                    <td className="px-5 py-3">
                      <span className={`font-bold font-mono ${getMismatchColor(driver.mismatch_count)}`}>
                        {driver.mismatch_count}x
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={driver.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Recent SIJ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-100">SIJ Terbaru (Shift Ini)</h2>
          <span className="text-xs font-mono text-zinc-500">{data?.recent_sij?.length || 0} transaksi</span>
        </div>
        <div className="overflow-x-auto">
          {data?.recent_sij?.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-sm">Belum ada SIJ hari ini</div>
          ) : (
            <table className="w-full text-sm" data-testid="recent-sij-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-5 py-3 text-label">Waktu</th>
                  <th className="text-left px-5 py-3 text-label">Driver</th>
                  <th className="text-left px-5 py-3 text-label">Sheet</th>
                  <th className="text-left px-5 py-3 text-label">QRIS Ref</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_sij?.map((tx) => (
                  <tr key={tx.transaction_id} className="border-b border-zinc-800/30 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{tx.time}</td>
                    <td className="px-5 py-3 text-zinc-100">{tx.driver_name}</td>
                    <td className="px-5 py-3 text-zinc-300">{tx.sheets}</td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{tx.qris_ref}</td>
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

export const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    suspend: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const labels = { active: 'Aktif', warning: 'Warning', suspend: 'Suspend' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${map[status] || 'text-zinc-400'}`}>
      {labels[status] || status}
    </span>
  );
};
