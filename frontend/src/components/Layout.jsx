import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  List,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Car,
  Truck,
  UserCog,
  CalendarRange,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    roles: ["admin", "superadmin"],
  },
  {
    icon: FileText,
    label: "Input SIJ",
    path: "/sij",
    roles: ["admin", "superadmin"],
  },
  {
    icon: List,
    label: "List SIJ",
    path: "/sij-list",
    roles: ["admin", "superadmin"],
  },
  {
    icon: Truck,
    label: "List Ritase Driver",
    path: "/ritase",
    roles: ["admin", "superadmin"],
  },
  {
    icon: Users,
    label: "Data Driver",
    path: "/drivers",
    roles: ["superadmin"],
  },
  {
    icon: CalendarRange,
    label: "Laporan Mingguan",
    path: "/laporan-mingguan",
    roles: ["admin", "superadmin"],
  },
  {
    icon: ClipboardList,
    label: "Audit Log",
    path: "/audit",
    roles: ["superadmin"],
  },
  {
    icon: UserCog,
    label: "User Management",
    path: "/user-management",
    roles: ["superadmin"],
  },
];

const SHIFT_COLORS = { Shift1: "text-amber-400", Shift2: "text-sky-400" };
const ROLE_LABELS = { admin: "Admin", superadmin: "Super Admin" };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter((item) =>
    item.roles.includes(user?.role),
  );

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
            <img
              src="https://i.ibb.co.com/j9n9Yqpk/Logo-RAJA-square.png"
              className="w-8 h-auto object-contain rounded-md"
              alt="RAJA Logo"
            />
          </div>
          <div>
            <div
              className="font-black text-white text-lg leading-tight"
              style={{ fontFamily: "Chivo, sans-serif" }}
            >
              RAJA
            </div>
            <div className="text-zinc-500 text-xs font-mono">
              Digital System v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-testid={`nav-${item.path.replace("/", "")}`}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto text-amber-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="px-3 py-4 border-t border-zinc-800/50">
        <div className="px-3 py-3 rounded-lg bg-zinc-900/50 mb-2">
          <div className="text-sm font-semibold text-zinc-100">
            {user?.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500">
              {ROLE_LABELS[user?.role]}
            </span>
            {user?.shift && (
              <>
                <span className="text-zinc-700">·</span>
                <span
                  className={`text-xs font-mono ${SHIFT_COLORS[user?.shift] || "text-zinc-400"}`}
                >
                  {user?.shift}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-900/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-zinc-900/30 border-r border-zinc-800/50 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-60 bg-zinc-900 border-r border-zinc-800 lg:hidden"
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-zinc-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div
            className="font-black text-amber-500 text-base"
            style={{ fontFamily: "Chivo, sans-serif" }}
          >
            RAJA Cooperation
          </div>
          <div className="text-xs font-mono text-zinc-500">
            {user?.shift || "SuperAdmin"}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
