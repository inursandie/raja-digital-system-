import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Search,
  Calendar,
  Pencil,
  X,
} from "lucide-react";

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const ABSENCE_REASONS = [
  "SAKIT",
  "IZIN",
  "GANTI UNIT",
  "PINDAH PREMIUM",
  "CUTI",
  "GANGGUAN G.A.",
  "TAKEDOWN",
  "RESIGN",
  "TANPA KETERANGAN",
  "AKUN BLOKIR",
  "UNIT MAINTENANCE",
];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDateShort(str) {
  const d = new Date(str + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function DriverTable({ drivers, days, title, search, onAbsenceClick }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.toLowerCase();
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.plate.toLowerCase().includes(q) ||
        d.driver_id.toLowerCase().includes(q),
    );
  }, [drivers, search]);

  if (drivers.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/40">
        <h3 className="text-sm font-bold text-amber-400">
          {title} ({drivers.length} driver)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-800/80 border-b border-zinc-700/50">
              <th
                className="px-3 py-3 text-left text-zinc-400 font-semibold sticky left-0 bg-zinc-800/80 z-10"
                style={{ minWidth: 40 }}
              >
                No
              </th>
              <th
                className="px-3 py-3 text-left text-zinc-400 font-semibold sticky left-[40px] bg-zinc-800/80 z-10"
                style={{ minWidth: 140 }}
              >
                Nama Driver
              </th>
              <th
                className="px-3 py-3 text-left text-zinc-400 font-semibold"
                style={{ minWidth: 80 }}
              >
                Nopol
              </th>
              {days.map((day, i) => (
                <th
                  key={day}
                  className="text-center text-zinc-400 font-semibold"
                  style={{ minWidth: 90 }}
                >
                  <div className="px-2 py-1">
                    <div className="text-zinc-300">{DAY_LABELS[i]}</div>
                    <div className="text-zinc-500 text-[10px] font-normal">
                      {formatDateShort(day)}
                    </div>
                    <div className="flex justify-center gap-1 mt-0.5">
                      <span className="text-[9px] text-sky-400">KHD</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-[9px] text-emerald-400">RTS</span>
                    </div>
                  </div>
                </th>
              ))}
              <th
                className="px-2 py-3 text-center text-sky-400 font-bold"
                style={{ minWidth: 55 }}
              >
                Total
                <br />
                KHD
              </th>
              <th
                className="px-2 py-3 text-center text-emerald-400 font-bold"
                style={{ minWidth: 55 }}
              >
                Total
                <br />
                RTS
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + days.length + 2}
                  className="text-center py-10 text-zinc-500"
                >
                  {search ? "Driver tidak ditemukan" : "Tidak ada data driver"}
                </td>
              </tr>
            ) : (
              filtered.map((drv, idx) => (
                <tr
                  key={drv.driver_id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition"
                >
                  <td className="px-3 py-2.5 text-zinc-500 sticky left-0 bg-zinc-900/90 z-10">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5 text-white font-medium sticky left-[40px] bg-zinc-900/90 z-10">
                    {drv.name}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-400 font-mono">
                    {drv.plate}
                  </td>
                  {drv.daily.map((d) => {
                    const isFraud = d.khd === 0 && d.rts > 0 && !d.reason;
                    const hasReason = d.khd === 0 && d.reason;
                    const isAbsent = d.khd === 0;
                    return (
                      <td
                        key={d.date}
                        className={`px-1 py-2.5 text-center ${isFraud ? "bg-red-900/50" : hasReason ? "bg-amber-900/20" : ""}`}
                      >
                        {hasReason ? (
                          <div
                            className="cursor-pointer group"
                            onClick={() =>
                              onAbsenceClick(
                                drv.driver_id,
                                drv.name,
                                d.date,
                                d.reason,
                              )
                            }
                          >
                            <div className="text-[9px] text-amber-400 font-medium leading-tight">
                              {d.reason}
                            </div>
                            <div className="text-[8px] text-zinc-500 mt-0.5">
                              RTS: {d.rts}
                            </div>
                            <Pencil className="w-2.5 h-2.5 text-zinc-600 mx-auto mt-0.5 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        ) : isAbsent ? (
                          <div
                            className="cursor-pointer group"
                            onClick={() =>
                              onAbsenceClick(
                                drv.driver_id,
                                drv.name,
                                d.date,
                                "",
                              )
                            }
                          >
                            <div
                              className={`flex items-center justify-center gap-1 ${isFraud ? "font-bold" : ""}`}
                            >
                              <span
                                className={
                                  isFraud ? "text-red-400" : "text-zinc-600"
                                }
                              >
                                {d.khd}
                              </span>
                              <span className="text-zinc-700">|</span>
                              <span
                                className={
                                  isFraud
                                    ? "text-red-400"
                                    : d.rts > 0
                                      ? "text-emerald-400"
                                      : "text-zinc-600"
                                }
                              >
                                {d.rts}
                              </span>
                            </div>
                            {isFraud && (
                              <div className="text-[8px] text-red-400 mt-0.5 flex items-center justify-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> BOCOR
                              </div>
                            )}
                            <Pencil className="w-2.5 h-2.5 text-zinc-600 mx-auto mt-0.5 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={
                                d.khd > 0 ? "text-sky-400" : "text-zinc-600"
                              }
                            >
                              {d.khd}
                            </span>
                            <span className="text-zinc-700">|</span>
                            <span
                              className={
                                d.rts > 0 ? "text-emerald-400" : "text-zinc-600"
                              }
                            >
                              {d.rts}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`px-2 py-2.5 text-center font-bold ${drv.total_khd < 5 ? "text-red-400 bg-red-900/40" : "text-sky-400"}`}
                  >
                    {drv.total_khd}
                    {drv.total_khd < 5 && (
                      <div className="text-[8px] text-red-400 mt-0.5">
                        RENDAH
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center font-bold text-emerald-400">
                    {drv.total_rts}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LaporanMingguan() {
  const { getAuthHeader, API } = useAuth();
  const [weekStart, setWeekStart] = useState(() => {
    const mon = getMonday(new Date());
    return formatDateISO(mon);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [absenceModal, setAbsenceModal] = useState(null);
  const [savingAbsence, setSavingAbsence] = useState(false);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return formatDateISO(d);
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const s = new Date(weekStart + "T00:00:00");
    const e = new Date(weekEnd + "T00:00:00");
    const opts = { day: "numeric", month: "short", year: "numeric" };
    return `${s.toLocaleDateString("id-ID", opts)} - ${e.toLocaleDateString("id-ID", opts)}`;
  }, [weekStart, weekEnd]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/weekly-report?start_date=${weekStart}&end_date=${weekEnd}`,
        { headers: getAuthHeader() },
      );
      setData(res.data);
    } catch (err) {
      toast.error("Gagal memuat laporan mingguan");
    } finally {
      setLoading(false);
    }
  }, [API, getAuthHeader, weekStart, weekEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const prevWeek = () => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(formatDateISO(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart + "T00:00:00");
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
      const res = await axios.get(url, {
        headers: getAuthHeader(),
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const link = document.createElement("a");
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

  const handleAbsenceClick = (driverId, driverName, date, currentReason) => {
    setAbsenceModal({
      driverId,
      driverName,
      date,
      reason: currentReason || "",
    });
  };

  const handleSaveAbsence = async () => {
    if (!absenceModal) return;
    setSavingAbsence(true);
    try {
      await axios.post(
        `${API}/absences`,
        {
          driver_id: absenceModal.driverId,
          date: absenceModal.date,
          reason: absenceModal.reason,
        },
        { headers: getAuthHeader() },
      );
      toast.success("Keterangan absen disimpan");
      setAbsenceModal(null);
      fetchReport();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menyimpan keterangan");
    } finally {
      setSavingAbsence(false);
    }
  };

  const { standarDrivers, premiumDrivers } = useMemo(() => {
    if (!data?.drivers) return { standarDrivers: [], premiumDrivers: [] };
    return {
      standarDrivers: data.drivers.filter(
        (d) => (d.category || "standar") === "standar",
      ),
      premiumDrivers: data.drivers.filter(
        (d) => (d.category || "standar") === "premium",
      ),
    };
  }, [data]);

  const fraudCount = useMemo(() => {
    if (!data?.drivers) return 0;
    let count = 0;
    data.drivers.forEach((drv) => {
      drv.daily.forEach((d) => {
        if (d.khd === 0 && d.rts > 0 && !d.reason) count++;
      });
    });
    return count;
  }, [data]);

  const lowStandar = useMemo(
    () => standarDrivers.filter((d) => d.total_khd < 5),
    [standarDrivers],
  );
  const lowPremium = useMemo(
    () => premiumDrivers.filter((d) => d.total_khd < 5),
    [premiumDrivers],
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Laporan Mingguan
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Audit kehadiran & ritase driver per minggu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || !data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting || !data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 text-red-400 text-xs font-medium hover:bg-red-600/30 transition disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">
                {weekLabel}
              </span>
            </div>
            <button
              onClick={nextWeek}
              className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={thisWeek}
              className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition"
            >
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

      {fraudCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-900/30 border border-red-700/40">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">
              <span className="font-bold text-red-400">{fraudCount}</span> Fraud
              (KHD=0, RTS&gt;0, tanpa keterangan)
            </span>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-amber-500 font-mono text-sm animate-pulse">
            Memuat data laporan...
          </div>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-500 text-sm">Tidak ada data</div>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <DriverTable
              drivers={standarDrivers}
              days={data.days}
              title="Driver Standar"
              search={search}
              onAbsenceClick={handleAbsenceClick}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <DriverTable
              drivers={premiumDrivers}
              days={data.days}
              title="Driver Premium"
              search={search}
              onAbsenceClick={handleAbsenceClick}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Kesimpulan
              </h3>
              <div className="space-y-2 text-sm">
                <div
                  className={`px-3 py-2 rounded-lg ${lowStandar.length > 0 ? "bg-red-900/20 border border-red-800/30" : "bg-zinc-800/30 border border-zinc-700/30"}`}
                >
                  <span className="text-zinc-400">
                    Driver Standar (KHD &lt; 5):{" "}
                  </span>
                  <span
                    className={`font-bold ${lowStandar.length > 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {lowStandar.length}
                  </span>
                  <span className="text-zinc-400"> driver</span>
                  {lowStandar.length > 0 && (
                    <span className="text-zinc-300">
                      {" "}
                      → {lowStandar.map((d) => d.name).join(", ")}
                    </span>
                  )}
                </div>
                <div
                  className={`px-3 py-2 rounded-lg ${lowPremium.length > 0 ? "bg-red-900/20 border border-red-800/30" : "bg-zinc-800/30 border border-zinc-700/30"}`}
                >
                  <span className="text-zinc-400">
                    Driver Premium (KHD &lt; 5):{" "}
                  </span>
                  <span
                    className={`font-bold ${lowPremium.length > 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {lowPremium.length}
                  </span>
                  <span className="text-zinc-400"> driver</span>
                  {lowPremium.length > 0 && (
                    <span className="text-zinc-300">
                      {" "}
                      → {lowPremium.map((d) => d.name).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-900/50 border border-red-700/50" />
            <span>KHD=0, RTS&gt;0 = Potensi Kebocoran</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-900/30 border border-amber-700/40" />
            <span>Keterangan Absen tercatat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Pencil className="w-3 h-3 text-zinc-500" />
            <span>Klik cell KHD=0 untuk isi keterangan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 font-bold">RENDAH</span>
            <span>Total KHD &lt; 5</span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {absenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setAbsenceModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Keterangan Absen
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {absenceModal.driverName} — {absenceModal.date}
                  </p>
                </div>
                <button
                  onClick={() => setAbsenceModal(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <label className="text-xs text-zinc-400 font-medium">
                  Pilih Alasan Absen:
                </label>
                <select
                  value={absenceModal.reason}
                  onChange={(e) =>
                    setAbsenceModal({ ...absenceModal, reason: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">-- Hapus Keterangan --</option>
                  {ABSENCE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
                <button
                  onClick={() => setAbsenceModal(null)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveAbsence}
                  disabled={savingAbsence}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {savingAbsence ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
