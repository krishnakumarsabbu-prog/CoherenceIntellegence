import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../../store/appStore";
import { notifications as mockNotifications } from "../../mocks/dashboard";

export default function Header() {
  const user = useAppStore((s) => s.user);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const theme = useAppStore((s) => s.theme);
  const setUser = useAppStore((s) => s.setUser);
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.initials ?? "FA";
  const displayName = user?.name ?? "Fraud Analyst";
  const displayEmail = user?.email ?? "analyst@coherenceiq.io";

  return (
    <header className="h-16 sticky top-0 z-20 bg-white border-b border-canvas-200 flex items-center gap-4 px-5">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-canvas-400 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search pipelines, algorithms, reports…"
          className="input pl-9 py-2 bg-canvas-50 border-transparent hover:bg-white hover:border-canvas-200 focus:bg-white"
        />
      </div>

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-ghost !p-2"
        title={theme === "light" ? "Switch to dark" : "Switch to light"}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[18px] h-[18px]"
          >
            <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[18px] h-[18px]"
          >
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
        )}
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="btn-ghost !p-2 relative"
          aria-label="Notifications"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[18px] h-[18px]"
          >
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
        </button>
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 glass-card shadow-card-hover overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-canvas-100 flex items-center justify-between">
                <span className="font-semibold text-sm text-canvas-800">
                  Notifications
                </span>
                <span className="text-xs text-canvas-400">
                  {mockNotifications.length} new
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {mockNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b border-canvas-100 last:border-b-0 hover:bg-canvas-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          n.severity === "critical"
                            ? "bg-red-500"
                            : n.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-accent-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-canvas-800 truncate">
                          {n.title}
                        </p>
                        <p className="text-xs text-canvas-500 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[11px] text-canvas-400 mt-1">
                          {n.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 text-center text-xs font-medium text-accent-600 hover:bg-accent-50 transition-colors">
                View all notifications
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-md hover:bg-canvas-100 transition-colors"
        >
          <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-500 text-white text-xs font-semibold shrink-0">
            {initials}
          </span>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-canvas-800 leading-tight">
              {displayName}
            </p>
            <p className="text-[11px] text-canvas-400 leading-tight">
              {displayEmail}
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-canvas-400 hidden sm:block"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 glass-card shadow-card-hover overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-canvas-100">
                <p className="text-sm font-medium text-canvas-800">
                  {displayName}
                </p>
                <p className="text-xs text-canvas-400">{displayEmail}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-canvas-600 hover:bg-canvas-50 hover:text-canvas-800 transition-colors"
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    setUser(null);
                    navigate("/login");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-canvas-600 hover:bg-canvas-50 hover:text-canvas-800 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
