import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Users, AlertTriangle, RefreshCw, Ban, Truck, Trophy } from 'lucide-react';
import { toast } from 'sonner';

function useCountUp(target) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    prev.current = target;
    if (!target) { setCount(0); return; }
    const diff = target - start;
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / 1200, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(start + diff * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return count;
}

const COLORS = {
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', glow: 'kpi-glow-amber' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'kpi-glow-emerald' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', glow: 'kpi-glow-sky' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', glow: '' },
};

function KPICard({ title, value, icon, color, prefix, suffix, subtitle, delay }) {
  const count = useCountUp(value || 0);
  const c = COLORS[color] || COLORS.amber;
  const Icon = icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay || 0, duration: 0.4 }}
      className={'glass-card-hover rounded-xl p-5 ' + c.glow}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-label">{title}</span>
        <div className={'w-8 h-8 rounded-lg flex items-center justify-center border ' + c.bg}>
          <Icon className={'w-4 h-4 ' + c.text} />
        </div>
      </div>
      <div className={'text-3xl font-black tracking-tight ' + c.text} style={{ fontFamily: 'Chivo, sans-serif' }}>
        {prefix || ''}{count.toLocaleString('id-ID')}{suffix || ''}
      </div>
      {subtitle ? <p className="text-xs text-zinc-500 mt-1">{subtitle}</p> : null}
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    suspend: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const labels = { active: 'Aktif', warning: 'Warning', suspend: 'Suspend' };
  return (
    <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ' + (styles[status] || 'text-zinc-400 border-zinc-700')}>
      {labels[status] || status}
    </span>
  );
}

function ShiftChart({ data }) {
  const items = data || [];
  const total = items.reduce(function(s, d) { return s + (d.value || 0); }, 0);
  return (
    <div className="py-2 space-y-5">
      <div className="text-center mb-4">
        <div className="text-5xl font-black text-white leading-none" style={{ fontFamily: 'Chivo, sans-serif' }}>{total}</div>
        <div className="text-xs font-mono text-zinc-500 mt-1.5 uppercase tracking-widest">Total SIJ Hari Ini</div>
      </div>
      {items.map(function(d) {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const w = total > 0 ? ((d.value / total) * 100) + '%' : '0%';
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                <span style={{ color: d.fill }}>{d.name}</span>
              </div>
              <span className="font-bold text-zinc-200">
                {d.value}
                <span className="text-zinc-600 ml-1 font-normal">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: w, backgroundColor: d.fill, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineSVGChart({ data }) {
  const items = data || [];
  if (!items.length) {
    return <div className="h-44 flex items-center justify-center text-xs text-zinc-600 font-mono">Belum ada data</div>;
  }
  const maxVal = Math.max.apply(null, items.map(function(d) { return d.sij || 0; })) || 1;
  const svgH = 160;
  const padL = 30;
  const padB = 24;
  const padR = 12;
  const chartH = svgH - padB - 8;
  const svgW = 300;
  const chartW = svgW - padL - padR;
  const stepX = chartW / (items.length - 1 || 1);

  const pts = items.map(function(d, i) {
    const x = padL + i * stepX;
    const y = 8 + (chartH - ((d.sij / maxVal) * chartH));
    return { x: x, y: y, sij: d.sij, date: d.date };
  });

  const polyline = pts.map(function(p) { return p.x + ',' + p.y; }).join(' ');

  return (
    <svg width="100%" height="160" viewBox={'0 0 ' + svgW + ' ' + svgH} preserveAspectRatio="none">
      <polyline
        points={polyline}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {pts.map(function(p, i) {
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#f59e0b" />
            <text x={p.x} y={svgH - 6} textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">{p.date}</text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="monospace">{p.sij}</text>
          </g>
        );
      })}
      <line x1={padL - 4} y1={8} x2={padL - 4} y2={chartH + 8} stroke="#27272a" strokeWidth="1" />
      <line x1={padL - 4} y1={chartH + 8} x2={svgW - padR} y2={chartH + 8} stroke="#27272a" strokeWidth="1" />
    </svg>
  );
}

export default function SuperAdminDashboard() {
  const { getAuthHeader, API } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [suspending, setSuspending] = useState(null);

  const fetchData = async () => {
    try {
      const res = await axios.get(API + '/dashboard/superadmin', { headers: getAuthHeader() });
      setData(res.data);
    } catch (err) {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(function() { fetchData(); setCountdown(30); }, 30000);
    const tk = setInterval(function() { setCountdown(function(c) { return c > 0 ? c - 1 : 30; }); }, 1000);
    return function() { clearInterval(iv); clearInterval(tk); };
  }, []);

  const handleSuspend = async (driverId, name) => {
    if (!window.confirm('Suspend driver ' + name + '?')) return;
    setSuspending(driverId);
    try {
      await axios.patch(API + '/drivers/' + driverId + '/suspend', {}, { headers: getAuthHeader() });
      toast.success('Driver ' + name + ' disuspend');
      fetchData();
    } catch (err) {
      toast.error('Gagal mensuspend driver');
    } finally {
      setSuspending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data...</div>
      </div>
    );
  }

  const totalDrivers = data && data.total_drivers ? data.total_drivers : 0;
  const suspendedDrivers = data && data.suspended_drivers ? data.suspended_drivers : 0;
  const driverSubtitle = totalDrivers + ' total · ' + suspendedDrivers + ' suspend';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="SIJ Hari Ini" value={data && data.total_sij_today} icon={TrendingUp} color="amber" delay={0} />
        <KPICard title="Revenue Hari Ini" value={data && data.total_revenue_today} icon={DollarSign} color="emerald" prefix="Rp " delay={0.07} />
        <KPICard title="Driver Aktif" value={data && data.active_drivers} icon={Users} color="sky" subtitle={driverSubtitle} delay={0.14} />
        <KPICard title="Ritase Hari Ini" value={data && data.total_ritase_today} icon={Truck} color="purple" delay={0.21} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">SIJ per Shift (Hari Ini)</h3>
          <ShiftChart data={data && data.sij_per_shift} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">Tren SIJ 7 Hari</h3>
          <LineSVGChart data={data && data.daily_trend} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Ranking Driver Berdasarkan Ritase</h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">Bulan Ini</span>
          </div>
          <div className="overflow-x-auto max-h-64 scrollbar-thin">
            {!(data && data.ritase_ranking && data.ritase_ranking.length) ? (
              <div className="py-10 text-center text-zinc-500 text-sm">Belum ada data ritase bulan ini</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="text-left px-4 py-3 text-label">Rank</th>
                    <th className="text-left px-4 py-3 text-label">Nama Driver</th>
                    <th className="text-right px-4 py-3 text-label">Total Trip</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.ritase_ranking || []).map(function(d, idx) {
                    var rankColor = idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-orange-400' : 'text-zinc-500';
                    return (
                      <tr key={d.driver_id} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3"><span className={'font-bold font-mono text-sm ' + rankColor}>#{idx + 1}</span></td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-100 text-sm">{d.driver_name}</div>
                          <div className="text-xs font-mono text-zinc-500">{d.driver_id}</div>
                        </td>
                        <td className="px-4 py-3 text-right"><span className="font-bold font-mono text-sm text-amber-400">{d.trip_count}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Mismatch Driver</h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">{data && data.mismatch_list ? data.mismatch_list.length : 0}</span>
          </div>
          <div className="overflow-x-auto max-h-64 scrollbar-thin">
            {!(data && data.mismatch_list && data.mismatch_list.length) ? (
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
                  {(data.mismatch_list || []).map(function(d) {
                    const mc = d.mismatch_count >= 3 ? 'text-red-400' : d.mismatch_count >= 2 ? 'text-orange-400' : 'text-yellow-400';
                    return (
                      <tr key={d.driver_id} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-zinc-100 text-sm">{d.name}</div>
                          <div className="text-xs font-mono text-zinc-500">{d.driver_id}</div>
                        </td>
                        <td className="px-4 py-3"><span className={'font-bold font-mono text-sm ' + mc}>{d.mismatch_count}x</span></td>
                        <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                        <td className="px-4 py-3 text-right">
                          {d.status !== 'suspend' ? (
                            <button
                              data-testid={'suspend-btn-' + d.driver_id}
                              onClick={function() { handleSuspend(d.driver_id, d.name); }}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
