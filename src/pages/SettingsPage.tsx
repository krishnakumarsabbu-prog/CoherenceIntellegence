import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";

export default function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-canvas-500 mt-1">
          Manage your profile and workspace preferences.
        </p>
      </div>

      {/* Profile */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-semibold text-canvas-800 mb-1">Profile</h2>
        <p className="text-xs text-canvas-400 mb-5">
          Your account details and role assignment.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-accent-500 text-white text-base font-semibold">
            {user?.initials ?? "FA"}
          </span>
          <div>
            <p className="text-sm font-semibold text-canvas-900">
              {user?.name ?? "Fraud Analyst"}
            </p>
            <p className="text-xs text-canvas-500">
              {user?.email ?? "analyst@coherenceiq.io"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-canvas-600 mb-1.5">
              Display name
            </label>
            <input
              className="input"
              defaultValue={user?.name ?? "Fraud Analyst"}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-canvas-600 mb-1.5">
              Email
            </label>
            <input
              className="input"
              defaultValue={user?.email ?? "analyst@coherenceiq.io"}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-canvas-600 mb-1.5">
            Role
          </label>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-canvas-100 border border-canvas-200">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-sm font-medium text-canvas-700">
              Role: Fraud Analyst
            </span>
            <span className="text-[10px] text-canvas-400 uppercase tracking-wide font-medium">
              read-only
            </span>
          </div>
          <p className="text-[11px] text-canvas-400 mt-2">
            Role-based access control is a placeholder. Granular permissions
            will be configurable in a later phase.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn-primary">Save changes</button>
        </div>
      </motion.section>

      {/* Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-semibold text-canvas-800 mb-1">
          Appearance
        </h2>
        <p className="text-xs text-canvas-400 mb-5">
          Choose how the studio looks. Light is the default.
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-md">
          <ThemeOption
            active={theme === "light"}
            onClick={() => setTheme("light")}
            label="Light"
          >
            <div className="h-16 rounded-md border border-canvas-200 bg-canvas-50 p-2">
              <div className="h-2 w-10 rounded bg-accent-500" />
              <div className="mt-1.5 h-2 w-16 rounded bg-canvas-200" />
              <div className="mt-1 h-2 w-12 rounded bg-canvas-200" />
            </div>
          </ThemeOption>
          <ThemeOption
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            label="Dark"
          >
            <div className="h-16 rounded-md border border-[#2a2e3a] bg-[#0f1117] p-2">
              <div className="h-2 w-10 rounded bg-accent-400" />
              <div className="mt-1.5 h-2 w-16 rounded bg-[#2a2e3a]" />
              <div className="mt-1 h-2 w-12 rounded bg-[#2a2e3a]" />
            </div>
          </ThemeOption>
        </div>
      </motion.section>
    </div>
  );
}

function ThemeOption({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border p-3 transition-all ${
        active
          ? "border-accent-500 ring-2 ring-accent-200 bg-accent-50/40"
          : "border-canvas-200 hover:border-canvas-300"
      }`}
    >
      {children}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium text-canvas-700">{label}</span>
        {active && (
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
    </button>
  );
}
