import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FileText,
  Printer,
  RotateCcw,
  CheckCircle2,
  Search,
  CalendarDays,
  X,
  User,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { id } from "date-fns/locale";

const RAJA_LOGO_URL = "https://i.ibb.co.com/rRHnptZz/logostrukraja.jpg";

// Price based on category
const PRICE_MAP = {
  standar: 40000,
  reg: 40000,
  premium: 60000,
};

const formatRupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v);

// Browser Print Receipt (fallback)
const printReceiptBrowser = (tx, driverName, nopol) => {
  const amount = tx.amount || 40000;
  const amountFormatted = new Intl.NumberFormat("id-ID").format(amount);

  const tickets = Array.from(
    { length: tx.sheets },
    (_, i) => `
    <div class="ticket">
      <div class="header">
        <img src="${RAJA_LOGO_URL}" alt="RAJA Logo" style="width:50mm; height:auto; margin: 0 auto 8px; display:block;" onerror="this.style.display='none'" />
        <div class="subtitle">SURAT IZIN JALAN - KOPERASI RAJA</div>
      </div>
      <div class="tx-id">${tx.transaction_id}</div>
      <table class="details">
        <tr><td>Driver</td><td>: ${driverName}</td></tr>
        <tr><td>Plat No.</td><td>: ${nopol}</td></tr>
        <tr><td>Kategori</td><td>: ${tx.category === "premium" ? "Grab Premium" : "Grab Standar"}</td></tr>
        <tr><td>Tanggal</td><td>: ${tx.date} | ${tx.time.substring(0, 5)}</td></tr>
        <tr><td>Admin</td><td>: ${tx.admin_name}</td></tr>
      </table>
      <div class="subtitle" style="text-align: center !important; margin-top: 8px;">Harap selalu menjaga performa, pelayanan dan kedisiplinan dalam bekerja.</div>
      <div class="footer">Ref. : ${tx.qris_ref}</div>
    </div>
  `,
  ).join("");

  const win = window.open("", "_blank");
  win.document.write(`
    <html>
    <head>
      <title>SIJ Receipt - ${tx.transaction_id}</title>
      <style>
      * { color: #000 !important; font-weight: bold !important; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
    font-family: 'Arial Narrow', 'Helvetica Condensed', Arial, sans-serif !important; 
    font-stretch: condensed; 
    background: #f5f5f5; 
    padding: 5px 15px !important; 
    font-weight: bold !important; 
    color: #000 !important; 
}
        .ticket { width: 58mm; background: white; border: 2px dashed #333; padding: 8px; margin: 10px auto; page-break-after: always; }
        .header { text-align: center; margin-bottom: 8px; }
        .title { font-size: 12px; font-weight: bold; letter-spacing: 1px; }
        .subtitle { font-size: 12px; color: black; }
        .tx-id { font-size: 11px; font-weight: bold; text-align: center; letter-spacing: 1px; border: 1px solid #000; padding: 4px; margin: 6px 0; background: #f0f0f0; }
        .details { 
    width: 100%; 
    font-size: 14px !important; 
    margin-bottom: 10px; 
}
.details td { 
    padding: 4px 0 !important; 
}
        .details td:first-child { color: #666; width: 35%; }
        .details td:last-child { font-weight: bold; }
        .footer { font-size: 10px; color: #888; text-align: center; margin-top: 6px; border-top: 1px dashed #ccc; padding-top: 4px; }
        @media print { body { background: white; padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      ${tickets}
      <div class="no-print" style="text-align:center; margin-top:20px">
        <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; background:#f59e0b; border:none; border-radius:6px; font-weight:bold;">
          Cetak / Print
        </button>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
};

// Generate ESC/POS commands for thermal printer (58mm)
const generateESCPOSCommands = (tx, driverName) => {
  const ESC = "\x1B";
  const GS = "\x1D";
  const LF = "\x0A";

  const INIT = ESC + "@";
  const CENTER = ESC + "a" + "\x01";
  const LEFT = ESC + "a" + "\x00";
  const BOLD_ON = ESC + "E" + "\x01";
  const BOLD_OFF = ESC + "E" + "\x00";
  const DOUBLE_HEIGHT = GS + "!" + "\x11";
  const NORMAL_SIZE = GS + "!" + "\x00";
  const CUT = GS + "V" + "\x41" + "\x00";
  const DASHES = "--------------------------------";

  const amount = tx.amount || 40000;
  const amountFormatted = new Intl.NumberFormat("id-ID").format(amount);
  const categoryLabel = tx.category === "premium" ? "PREMIUM" : "STANDAR";

  let commands = [];

  for (let i = 0; i < tx.sheets; i++) {
    let receipt = "";
    receipt += INIT;
    receipt += CENTER;

    receipt += BOLD_ON + DOUBLE_HEIGHT;
    receipt += "RAJA DIGITAL SYSTEM" + LF;
    receipt += NORMAL_SIZE + BOLD_OFF;
    receipt += "SIJ - Soetta Airport" + LF;
    receipt += DASHES + LF;

    receipt += BOLD_ON + DOUBLE_HEIGHT;
    receipt += tx.transaction_id + LF;
    receipt += NORMAL_SIZE + BOLD_OFF;
    receipt += DASHES + LF;

    receipt += LEFT;
    receipt += "Driver   : " + driverName.substring(0, 20) + LF;
    receipt += "Kategori : " + categoryLabel + LF;
    receipt += "Tanggal  : " + tx.date + LF;
    receipt += "Jam      : " + tx.time + LF;
    receipt += "Admin    : " + tx.admin_name + LF;
    receipt += "Lembar   : " + (i + 1) + " / " + tx.sheets + LF;

    receipt += CENTER;
    receipt += DASHES + LF;
    receipt += BOLD_ON + DOUBLE_HEIGHT;
    receipt += "Rp " + amountFormatted + LF;
    receipt += NORMAL_SIZE + BOLD_OFF;
    receipt += DASHES + LF;

    receipt += "QRIS: " + tx.qris_ref + LF;
    receipt += LF + LF;
    receipt += CUT;

    commands.push(receipt);
  }

  return commands.join("");
};

// Download ESC/POS as binary file
const downloadESCPOS = (tx, driverName) => {
  const escposData = generateESCPOSCommands(tx, driverName);
  const blob = new Blob([escposData], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SIJ_${tx.transaction_id}.bin`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("File ESC/POS berhasil diunduh");
};

export default function SIJInput() {
  const { getAuthHeader, API, user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    driver_id: "",
    sheets: "5",
    qris_ref: "",
    date: null,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Date constraints: today to 7 days ahead
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 7);

  // Calculate price based on selected driver
  const currentPrice = useMemo(() => {
    if (!selectedDriver) return PRICE_MAP.standar;
    return PRICE_MAP[selectedDriver.category] || PRICE_MAP.standar;
  }, [selectedDriver]);

  useEffect(() => {
    axios
      .get(`${API}/drivers/active`, { headers: getAuthHeader() })
      .then((res) => setDrivers(res.data))
      .catch(() => toast.error("Gagal memuat data driver"));
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchRef.current &&
        !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered drivers based on search
  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return drivers
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.driver_id.toLowerCase().includes(q) ||
          d.plate.toLowerCase().includes(q) ||
          d.phone.includes(q),
      )
      .slice(0, 50);
  }, [drivers, searchQuery]);

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
    setForm((f) => ({ ...f, driver_id: driver.driver_id }));
    setSearchQuery(driver.name);
    setShowDropdown(false);
  };

  const clearDriver = () => {
    setSelectedDriver(null);
    setForm((f) => ({ ...f, driver_id: "" }));
    setSearchQuery("");
  };

  const handleDateSelect = (date) => {
    setForm((f) => ({ ...f, date }));
    setDatePickerOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.driver_id) {
      toast.error("Pilih driver terlebih dahulu");
      return;
    }
    if (!form.qris_ref.trim()) {
      toast.error("QRIS Reference wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        driver_id: form.driver_id,
        sheets: parseInt(form.sheets),
        qris_ref: form.qris_ref.trim(),
      };
      if (form.date) {
        payload.date = format(form.date, "yyyy-MM-dd");
      }
      const res = await axios.post(`${API}/sij`, payload, {
        headers: getAuthHeader(),
      });
      setResult(res.data);
      toast.success("SIJ berhasil dibuat!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat SIJ");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ driver_id: "", sheets: "5", qris_ref: "", date: null });
    setResult(null);
    setSelectedDriver(null);
    setSearchQuery("");
  };

  const todayFormatted = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1
              className="text-xl font-black text-white"
              style={{ fontFamily: "Chivo, sans-serif" }}
            >
              Input SIJ
            </h1>
            <p className="text-zinc-500 text-xs">{todayFormatted}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <form
                onSubmit={handleSubmit}
                className="glass-card rounded-xl p-6 space-y-5"
                data-testid="sij-form"
              >
                {/* Searchable Driver Input */}
                <div>
                  <label className="text-label block mb-2">
                    Driver <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        ref={searchRef}
                        data-testid="driver-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                          if (!e.target.value) clearDriver();
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Cari nama, ID, plat, atau telepon driver..."
                        className="w-full pl-10 pr-10 py-3 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all"
                      />
                      {selectedDriver && (
                        <button
                          type="button"
                          onClick={clearDriver}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors"
                        >
                          <X className="w-3 h-3 text-zinc-300" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown */}
                    <AnimatePresence>
                      {showDropdown && !selectedDriver && (
                        <motion.div
                          ref={dropdownRef}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto scrollbar-thin"
                          data-testid="driver-dropdown"
                        >
                          {filteredDrivers.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-zinc-500">
                              Tidak ada driver ditemukan
                            </div>
                          ) : (
                            filteredDrivers.map((d) => (
                              <button
                                key={d.driver_id}
                                type="button"
                                onClick={() => handleDriverSelect(d)}
                                className="w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"
                                data-testid={`driver-option-${d.driver_id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-zinc-100 text-sm font-medium">
                                      {d.name}
                                    </span>
                                    <span
                                      className={`ml-2 text-xs font-mono ${d.category === "premium" ? "text-amber-400" : "text-zinc-500"}`}
                                    >
                                      {d.category === "premium"
                                        ? "PREMIUM"
                                        : "STANDAR"}
                                    </span>
                                  </div>
                                  <span className="text-xs font-mono text-zinc-500">
                                    {d.plate}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                  {d.driver_id} • {d.phone} •{" "}
                                  <span
                                    className={
                                      d.category === "premium"
                                        ? "text-amber-400"
                                        : "text-emerald-400"
                                    }
                                  >
                                    {formatRupiah(
                                      PRICE_MAP[d.category] ||
                                        PRICE_MAP.standar,
                                    )}
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Driver Info */}
                  {selectedDriver && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-500/20 flex items-center gap-3 text-xs"
                    >
                      <User className="w-4 h-4 text-emerald-400" />
                      <div className="flex-1">
                        <span className="text-emerald-400 font-medium">
                          {selectedDriver.name}
                        </span>
                        <span
                          className={`ml-2 font-mono ${selectedDriver.category === "premium" ? "text-amber-400" : "text-zinc-400"}`}
                        >
                          {selectedDriver.category === "premium"
                            ? "PREMIUM"
                            : "STANDAR"}
                        </span>
                      </div>
                      <span className="text-zinc-500">
                        {selectedDriver.phone}
                      </span>
                      <span className="text-zinc-500 font-mono">
                        {selectedDriver.plate}
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Date Picker */}
                <div>
                  <label className="text-label block mb-2">Tanggal SIJ</label>
                  <Popover
                    open={datePickerOpen}
                    onOpenChange={setDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-testid="date-picker-trigger"
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-sm transition-all hover:border-zinc-600"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-zinc-500" />
                          <span
                            className={
                              form.date ? "text-zinc-100" : "text-zinc-500"
                            }
                          >
                            {form.date
                              ? format(form.date, "EEEE, d MMMM yyyy", {
                                  locale: id,
                                })
                              : "Hari ini (default)"}
                          </span>
                        </div>
                        {form.date && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm((f) => ({ ...f, date: null }));
                            }}
                            className="w-5 h-5 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-zinc-300" />
                          </button>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-zinc-900 border-zinc-700"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={form.date}
                        onSelect={handleDateSelect}
                        disabled={(date) =>
                          isBefore(date, today) || isAfter(date, maxDate)
                        }
                        initialFocus
                        className="bg-zinc-900 text-zinc-100"
                        classNames={{
                          day_selected:
                            "bg-amber-500 text-black hover:bg-amber-400",
                          day_today: "bg-zinc-800 text-amber-400",
                          day_disabled: "text-zinc-600 opacity-50",
                        }}
                      />
                      <div className="px-3 py-2 border-t border-zinc-700 text-xs text-zinc-500">
                        Dapat memilih tanggal hingga 7 hari ke depan
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Sheets */}
                <div>
                  <label className="text-label block mb-2">Jumlah Sheet</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, sheets: String(n) }))
                        }
                        className={`flex-1 py-2.5 rounded-lg text-sm font-mono font-bold transition-all ${
                          form.sheets === String(n)
                            ? "bg-amber-500 text-black"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                        data-testid={`sheets-btn-${n}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount (dynamic based on category) */}
                <div>
                  <label className="text-label block mb-2">
                    Jumlah Pembayaran
                  </label>
                  <div
                    className={`px-4 py-3 rounded-lg border font-mono font-bold text-sm flex items-center justify-between ${
                      selectedDriver?.category === "premium"
                        ? "bg-amber-900/20 border-amber-500/30 text-amber-400"
                        : "bg-emerald-900/20 border-emerald-500/30 text-emerald-400"
                    }`}
                  >
                    <span>{formatRupiah(currentPrice)}</span>
                    <span
                      className={`text-xs font-normal ${
                        selectedDriver?.category === "premium"
                          ? "text-amber-400/70"
                          : "text-emerald-400/70"
                      }`}
                    >
                      {selectedDriver?.category === "premium"
                        ? "Premium"
                        : "Standar"}
                    </span>
                  </div>
                </div>

                {/* QRIS Ref */}
                <div>
                  <label className="text-label block mb-2">
                    QRIS Reference <span className="text-red-400">*</span>
                  </label>
                  <input
                    data-testid="qris-ref-input"
                    type="text"
                    value={form.qris_ref}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, qris_ref: e.target.value }))
                    }
                    placeholder="Masukkan nomor referensi QRIS"
                    className="w-full px-4 py-3 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all font-mono"
                  />
                </div>

                {/* Auto-filled fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-label block mb-2">Admin</label>
                    <div className="px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm">
                      {user?.name}
                    </div>
                  </div>
                  <div>
                    <label className="text-label block mb-2">Shift</label>
                    <div className="px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm font-mono">
                      {user?.shift}
                    </div>
                  </div>
                </div>

                <button
                  data-testid="sij-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Buat SIJ
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-xl p-6 space-y-5"
              data-testid="sij-success-card"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold text-emerald-400">
                    SIJ Berhasil Dibuat!
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Transaksi tercatat dalam sistem
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-800">
                <div className="text-label mb-2">Transaction ID</div>
                <div
                  className="font-mono text-xl font-bold text-amber-400 tracking-widest"
                  data-testid="transaction-id"
                >
                  {result.transaction_id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-label">Driver</span>
                  <p className="text-zinc-100 mt-0.5">{result.driver_name}</p>
                </div>
                <div>
                  <span className="text-label">Kategori</span>
                  <p
                    className={`mt-0.5 font-mono ${result.category === "premium" ? "text-amber-400" : "text-zinc-300"}`}
                  >
                    {result.category === "premium" ? "PREMIUM" : "STANDAR"}
                  </p>
                </div>
                <div>
                  <span className="text-label">Tanggal</span>
                  <p className="text-zinc-100 mt-0.5 font-mono">
                    {result.date}
                  </p>
                </div>
                <div>
                  <span className="text-label">Jam</span>
                  <p className="text-zinc-100 mt-0.5 font-mono">
                    {result.time}
                  </p>
                </div>
                <div>
                  <span className="text-label">Sheet</span>
                  <p className="text-zinc-100 mt-0.5">{result.sheets} lembar</p>
                </div>
                <div>
                  <span className="text-label">Admin</span>
                  <p className="text-zinc-100 mt-0.5">{result.admin_name}</p>
                </div>
              </div>

              {/* Amount highlight */}
              <div
                className={`rounded-lg p-3 text-center border ${
                  result.category === "premium"
                    ? "bg-amber-900/20 border-amber-500/30"
                    : "bg-emerald-900/20 border-emerald-500/30"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${result.category === "premium" ? "text-amber-400/70" : "text-emerald-400/70"}`}
                >
                  Total Pembayaran (
                  {result.category === "premium" ? "Premium" : "Standar"})
                </div>
                <div
                  className={`text-xl font-bold font-mono ${result.category === "premium" ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {formatRupiah(result.amount)}
                </div>
              </div>

              {/* Print Options */}
              <div className="space-y-3">
                <div className="text-label">Cetak Struk</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    data-testid="print-browser-button"
                    onClick={() =>
                      printReceiptBrowser(
                        result,
                        result.driver_name,
                        drivers.find((d) => d.name === result.driver_name)
                          ?.plate || "-",
                      )
                    }
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak Browser
                  </button>
                  <button
                    data-testid="download-escpos-button"
                    onClick={() => downloadESCPOS(result, result.driver_name)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    Download ESC/POS
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  * File ESC/POS (.bin) dapat dikirim ke thermal printer 58mm
                  melalui aplikasi printer atau command line
                </p>
              </div>

              <button
                data-testid="new-sij-button"
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 font-bold text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Input SIJ Baru
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
