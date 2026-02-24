import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Car, Eye, EyeOff, LogIn } from "lucide-react";
import { motion } from "framer-motion";

const BG_URL = "https://i.ibb.co.com/hJNPRvCv/RAJA-Wallpaper.jpg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Username dan password harus diisi");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Selamat datang, ${user.name}!`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_URL})` }}
      />
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card rounded-2xl p-8 border border-white/10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white-500 flex items-center justify-center">
              <img
                src="https://i.ibb.co.com/j9n9Yqpk/Logo-RAJA-square.png"
                className="w-10 h-auto object-contain"
                alt="RAJA Logo"
              />
            </div>
            <div>
              <h1
                className="text-2xl font-black text-white leading-tight"
                style={{ fontFamily: "Chivo, sans-serif" }}
              >
                RAJA
              </h1>
              <p className="text-zinc-400 text-xs">
                Digital System v1.0 — Soekarno-Hatta Airport
              </p>
            </div>
          </div>

          <h2 className="text-lg font-bold text-zinc-100 mb-1">
            Masuk ke Dashboard
          </h2>
          <p className="text-zinc-500 text-sm mb-6">
            Masukkan kredensial akun Anda
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="login-form"
          >
            <div>
              <label className="text-label block mb-1.5">Username</label>
              <input
                data-testid="email-input"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan username"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all"
              />
            </div>
            <div>
              <label className="text-label block mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="password-input"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-zinc-950/70 border border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none text-zinc-100 placeholder:text-zinc-600 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
