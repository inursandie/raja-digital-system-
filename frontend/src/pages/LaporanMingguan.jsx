import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Download, FileSpreadsheet,
  FileText, AlertTriangle, Search, Calendar
} from 'lucide-react';

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateShort(str) {
  const d = new Date(str + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function LaporanMingguan() {
  const { getAuthHeader, API } = useAuth();
  const [weekStart, setWeekStart] = useState(() => {
    const mon = getMonday(new Date());
    return formatDateISO(mon);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return formatDateISO(d);
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const s = new Date(weekStart + 'T00:00:00');
    const e = new Date(weekEnd + 'T00:00:00');
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${s.toLocaleDateString('id-ID', opts)} - ${e.toLocaleDateString('id-ID', opts)}`;
  }, [weekStart, weekEnd]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/weekly-report?start_date=${weekStart}&end_date=${weekEnd}`, { headers: getAuthHeader() });
      setData(res.data);
    } catch (err) {
      toast.error('Gagal memuat laporan mingguan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [weekStart]);

  const prevWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekStart(formatDateISO(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setWeekStart(formatDateISO(d));
  };

  const thisWeek = () => {
    setWeekStart(formatDateISO(getMonday(new Date())));
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const url = `${API}/weekly-report/export/${type}?start_date=${weekStart}&end_date=${weekEnd}`;
      const res = await axios.get(url, { headers: getAuthHeader(), responseType: 'blob' });
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `laporan_mingguan_${weekStart}_${weekEnd}.${type}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Export ${type.toUpperCase()} berhasil`);
    } catch {
      toast.error(`Gagal export ${type.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data?.drivers) return [];
    if (!search.trim()) return data.drivers;
    const q = search.toLowerCase();
    return data.drivers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.plate.toLowerCase().includes(q) ||
      d.driver_id.toLowerCase().includes(q)
    );
  }, [data, search]);

  const fraudCount = useMemo(() => {
    if (!data?.drivers) return 0;
    let count = 0;
    data.drivers.forEach(drv => {
      drv.daily.forEach(d => {
        if (d.khd === 0 && d.rts > 0) count++;
      });
    });
    return count;
  }, [data]);

  const lowAttendanceCount = useMemo(() => {
    if (!data?.drivers) return 0;
    return data.drivers.filter(d => d.total_khd < 5).length;
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Laporan Mingguan</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Audit kehadiran & ritase driver per minggu</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('csv')} disabled={exporting || !data} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition disabled:opacity-50">
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting || !data} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30 transition disabled:opacity-50">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">{weekLabel}</span>
            </div>
            <button onClick={nextWeek} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={thisWeek} className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition">
              Minggu Ini
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 w-full md:w-64 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </motion.div>

      {fraudCount > 0 || lowAttendanceCount > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3">
          {fraudCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-900/30 border border-red-700/40">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">
                <span className="font-bold text-red-400">{fraudCount}</span> kejadian potensi kebocoran (KHD=0, RTS&gt;0)
              </span>
            </div>
          )}
          {lowAttendanceCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-900/30 border border-amber-700/40">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                <span className="font-bold text-amber-400">{lowAttendanceCount}</span> driver kehadiran rendah (KHD &lt; 5)
              </span>
            </div>
          )}
        </motion.div>
      ) : null}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-amber-500 font-mono text-sm animate-pulse">Memuat data laporan...</div>
              </div>
            ) : !data ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-zinc-500 text-sm">Tidak ada data</div>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800/80 border-b border-zinc-700/50">
                    <th className="px-3 py-3 text-left text-zinc-400 font-semibold sticky left-0 bg-zinc-800/80 z-10" style={{ minWidth: 40 }}>No</th>
                    <th className="px-3 py-3 text-left text-zinc-400 font-semibold sticky left-[40px] bg-zinc-800/80 z-10" style={{ minWidth: 140 }}>Nama Driver</th>
                    <th className="px-3 py-3 text-left text-zinc-400 font-semibold" style={{ minWidth: 80 }}>Nopol</th>
                    {data.days.map((day, i) => (
                      <th key={day} className="text-center text-zinc-400 font-semibold" style={{ minWidth: 80 }}>
                        <div className="px-2 py-1">
                          <div className="text-zinc-300">{DAY_LABELS[i]}</div>
                          <div className="text-zinc-500 text-[10px] font-normal">{formatDateShort(day)}</div>
                          <div className="flex justify-center gap-1 mt-0.5">
                            <span className="text-[9px] text-sky-400">KHD</span>
                            <span className="text-zinc-600">|</span>
                            <span className="text-[9px] text-emerald-400">RTS</span>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-center text-sky-400 font-bold" style={{ minWidth: 55 }}>Total<br/>KHD</th>
                    <th className="px-2 py-3 text-center text-emerald-400 font-bold" style={{ minWidth: 55 }}>Total<br/>RTS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3 + 7 + 2} className="text-center py-10 text-zinc-500">
                        {search ? 'Driver tidak ditemukan' : 'Tidak ada data driver'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((drv, idx) => (
                      <tr key={drv.driver_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                        <td className="px-3 py-2.5 text-zinc-500 sticky left-0 bg-zinc-900/90 z-10">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-white font-medium sticky left-[40px] bg-zinc-900/90 z-10">{drv.name}</td>
                        <td className="px-3 py-2.5 text-zinc-400 font-mono">{drv.plate}</td>
                        {drv.daily.map((d) => {
                          const isFraud = d.khd === 0 && d.rts > 0;
                          return (
                            <td key={d.date} className={`px-2 py-2.5 text-center ${isFraud ? 'bg-red-900/50' : ''}`}>
                              <div className={`flex items-center justify-center gap-1 ${isFraud ? 'font-bold' : ''}`}>
                                <span className={isFraud ? 'text-red-400' : d.khd > 0 ? 'text-sky-400' : 'text-zinc-600'}>{d.khd}</span>
                                <span className="text-zinc-700">|</span>
                                <span className={isFraud ? 'text-red-400' : d.rts > 0 ? 'text-emerald-400' : 'text-zinc-600'}>{d.rts}</span>
                              </div>
                              {isFraud && (
                                <div className="text-[8px] text-red-400 mt-0.5 flex items-center justify-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> BOCOR
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className={`px-2 py-2.5 text-center font-bold ${drv.total_khd < 5 ? 'text-red-400 bg-red-900/40' : 'text-sky-400'}`}>
                          {drv.total_khd}
                          {drv.total_khd < 5 && <div className="text-[8px] text-red-400 mt-0.5">RENDAH</div>}
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-emerald-400">{drv.total_rts}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-900/50 border border-red-700/50" />
            <span>KHD=0, RTS&gt;0 = Potensi Kebocoran</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 font-bold">RENDAH</span>
            <span>Total KHD &lt; 5 = Kehadiran Rendah</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sky-400">KHD</span> = Kehadiran (ada SIJ)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">RTS</span> = Ritase (jumlah trip)
          </div>
        </div>
      </motion.div>
    </div>
  );
}
