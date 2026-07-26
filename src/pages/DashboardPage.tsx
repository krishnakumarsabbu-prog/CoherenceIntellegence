import { motion } from "framer-motion";
import { useDashboardData } from "../hooks/useDashboardData";
import { notifications, type RecentExecution, type DashboardStat } from "../mocks/dashboard";

const statusStyles: Record<RecentExecution["status"], string> = {
  completed: "bg-emerald-50 text-emerald-700",
  running: "bg-accent-50 text-accent-700",
  failed: "bg-red-50 text-red-700",
  queued: "bg-canvas-100 text-canvas-600",
};

export default function DashboardPage() {
  const { stats, recentExecutions, loading } = useDashboardData();
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-canvas-500 mt-1">
          Overview of pipeline activity and detection performance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.id} stat={stat} index={i} />
        ))}
      </div>

      {/* Recent executions + notifications */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RecentExecutionsTable executions={recentExecutions} loading={loading} />
        </div>
        <NotificationsFeed />
      </div>
    </div>
  );
}

function StatCard({
  stat,
  index,
}: {
  stat: DashboardStat;
  index: number;
}) {
  const isLive = stat.id === "running-jobs";

  const displayValue = stat.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`glass-card glass-card-hover p-5 ${
        stat.accent ? "border-accent-200" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-canvas-500 uppercase tracking-wide">
          {stat.label}
        </p>
        {stat.trend && (
          <span
            className={`badge ${
              stat.trend.direction === "up"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-3 h-3 ${
                stat.trend.direction === "down" ? "rotate-90" : ""
              }`}
            >
              <path d="M7 17L17 7M17 7H9M17 7v8" />
            </svg>
            {stat.trend.value}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p
          className={`text-2xl font-semibold tracking-tight ${
            stat.accent ? "text-accent-700" : "text-canvas-900"
          }`}
        >
          {displayValue}
        </p>
        {isLive && (
          <span className="flex items-center gap-1 mb-1.5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">
              live
            </span>
          </span>
        )}
      </div>
      {stat.sub && <p className="text-xs text-canvas-400 mt-1">{stat.sub}</p>}
    </motion.div>
  );
}

function RecentExecutionsTable({
  executions,
  loading,
}: {
  executions: RecentExecution[];
  loading: boolean;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-canvas-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-canvas-800">
            Recent Executions
          </h2>
          <p className="text-xs text-canvas-400 mt-0.5">
            Latest pipeline runs across the workspace
          </p>
        </div>
        <button className="btn-ghost text-xs">View all</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium text-canvas-400 uppercase tracking-wide bg-canvas-50/60">
              <th className="px-5 py-2.5 font-medium">Pipeline</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Timestamp</th>
              <th className="px-5 py-2.5 font-medium text-right">Flagged</th>
              <th className="px-5 py-2.5 font-medium text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading && executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-canvas-400 text-sm">
                  Loading executions…
                </td>
              </tr>
            ) : executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-canvas-400 text-sm">
                  No executions yet. Run a pipeline from the Execution Console.
                </td>
              </tr>
            ) : (
              executions.map((ex, i) => (
              <motion.tr
                key={ex.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="border-t border-canvas-100 hover:bg-canvas-50/70 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-canvas-800">
                  {ex.pipeline}
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${statusStyles[ex.status]}`}>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ex.status === "completed"
                          ? "bg-emerald-500"
                          : ex.status === "running"
                          ? "bg-accent-500"
                          : ex.status === "failed"
                          ? "bg-red-500"
                          : "bg-canvas-400"
                      }`}
                    />
                    {ex.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-canvas-500 font-mono text-xs">
                  {ex.timestamp}
                </td>
                <td className="px-5 py-3 text-right font-medium text-canvas-700">
                  {ex.flagged}
                </td>
                <td className="px-5 py-3 text-right text-canvas-500 font-mono text-xs">
                  {ex.duration}
                </td>
              </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsFeed() {
  return (
    <div className="glass-card overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-canvas-100">
        <h2 className="text-sm font-semibold text-canvas-800">Notifications</h2>
        <p className="text-xs text-canvas-400 mt-0.5">Real-time pipeline alerts</p>
      </div>
      <div className="divide-y divide-canvas-100">
        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className="px-5 py-4 hover:bg-canvas-50/70 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid place-items-center w-7 h-7 rounded-md shrink-0 ${
                  n.severity === "critical"
                    ? "bg-red-50 text-red-600"
                    : n.severity === "warning"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-accent-50 text-accent-600"
                }`}
              >
                {n.severity === "critical" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                  </svg>
                ) : n.severity === "warning" ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-canvas-800">{n.title}</p>
                <p className="text-xs text-canvas-500 mt-0.5 leading-relaxed">
                  {n.message}
                </p>
                <p className="text-[11px] text-canvas-400 mt-1.5">{n.time}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
