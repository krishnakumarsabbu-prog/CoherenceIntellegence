import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../../store/appStore";
import { navItems } from "../../config/nav";

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const navigate = useNavigate();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="shrink-0 h-screen sticky top-0 bg-white border-r border-canvas-200 flex flex-col z-30"
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-canvas-100 shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 min-w-0"
        >
          <span className="grid place-items-center w-9 h-9 rounded-md bg-accent-500 text-white shrink-0 shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path
                d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-canvas-900 text-[15px] whitespace-nowrap tracking-tight"
              >
                Coherence<span className="text-accent-500">IQ</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-item-active" : ""} ${
                  collapsed ? "justify-center px-0" : ""
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0 relative">
                <Icon className="w-[18px] h-[18px]" />
                {collapsed && (
                  <span className="absolute left-0 top-0 bottom-0 -ml-2 w-1 rounded-r bg-accent-500" />
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-canvas-100 shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-canvas-500 hover:bg-canvas-100 hover:text-canvas-700 transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && (
            <span className="text-xs font-medium">Collapse</span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
