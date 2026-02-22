import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ClipboardList, Download, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function AuditLog() {
  const { getAuthHeader, API } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = selectedDate ? `?date=${selectedDate}` : '';
      const res = await axios.get(`${API}/audit${params}`, { headers: getAuthHeader() });
      setLogs(res.data);
    } catch {
      toast.error('Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [selectedDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = selectedDate ? `?date=${selectedDate}` : '';
      const res = await axios.get(`${API}/audit/export${params}`, {
        headers: getAuthHeader(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_${selectedDate || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV berhasil diunduh');
    } catch {
      toast.error('Gagal mengekspor CSV');
    } finally {
      setExporting(false);
    }
  };

  const mismatchCount = logs.filter(l => l.mismatch).length;
  const matchCount = logs.filter(l => !l.mismatch).length;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo, sans-serif' }}>Audit Log</h1>
                <p className="text-zinc-500 text-xs">Monitoring mismatch harian driver</p>
              </div>
            </div>
          </div>
          <button
            data-testid="export-csv-button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 text-sm font-bold transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Mengunduh...' : 'Export CSV'}
          </button>
        </div>
      </motion.div>

      {/* Filters + Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-label block mb-1.5">Filter Tanggal</label>
          <input
            data-testid="audit-date-filter"
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 focus:border-amber-500/50 outline-none text-zinc-100 text-sm transition-all [color-scheme:dark]"
          />
        </div>
        {selectedDate && (
          <button onClick={() => setSelectedDate('')}
            className="mt-5 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all">
            Reset
          </button>
        )}
        <div className="flex gap-3 mt-auto ml-auto flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-mono text-red-400 font-bold">{mismatchCount} Mismatch</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400 font-bold">{matchCount} OK</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
            <span className="text-xs font-mono text-zinc-400">{logs.length} total</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Memuat data...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Tidak ada data audit</div>
          ) : (
            <table className="w-full text-sm" data-testid="audit-log-table">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-5 py-3 text-label">Tanggal</th>
                  <th className="text-left px-5 py-3 text-label">Driver ID</th>
                  <th className="text-center px-5 py-3 text-label">Ada SIJ</th>
                  <th className="text-center px-5 py-3 text-label">Ada Trip</th>
                  <th className="text-center px-5 py-3 text-label">Mismatch</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={`${log.date}-${log.driver_id}`}
                    className={`border-b border-zinc-800/30 hover:bg-white/5 transition-colors ${log.mismatch ? 'bg-red-950/10' : ''}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{log.date}</td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-300">{log.driver_id}</td>
                    <td className="px-5 py-3 text-center">
                      {log.has_sij ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {log.has_trip ? (
                        <CheckCircle2 className="w-4 h-4 text-sky-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {log.mismatch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Mismatch
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-zinc-600">—</span>
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
  );
}
