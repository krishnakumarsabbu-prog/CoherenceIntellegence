export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { direction: "up" | "down"; value: string };
  accent?: boolean;
}

export interface RecentExecution {
  id: string;
  pipeline: string;
  status: "completed" | "running" | "failed" | "queued";
  timestamp: string;
  flagged: number;
  duration: string;
}

export interface NotificationItem {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  time: string;
}

export const dashboardStats: DashboardStat[] = [
  {
    id: "active-pipelines",
    label: "Active Pipelines",
    value: "14",
    sub: "3 drafts",
    trend: { direction: "up", value: "+2 wk" },
  },
  {
    id: "total-executions",
    label: "Total Executions",
    value: "8,492",
    sub: "last 30 days",
    trend: { direction: "up", value: "+12%" },
  },
  {
    id: "algorithms",
    label: "Algorithms Available",
    value: "27",
    sub: "across 6 families",
  },
  {
    id: "running-jobs",
    label: "Running Jobs",
    value: "3",
    sub: "live",
    accent: true,
  },
  {
    id: "avg-accuracy",
    label: "Average Detection Accuracy",
    value: "94.7%",
    sub: "across all pipelines",
    trend: { direction: "up", value: "+0.4 pts" },
  },
  {
    id: "best-pipeline",
    label: "Best Performing Pipeline",
    value: "Graph Anomaly v4",
    sub: "97.9% accuracy",
    accent: true,
  },
];

export const recentExecutions: RecentExecution[] = [
  {
    id: "ex-001",
    pipeline: "Graph Anomaly v4",
    status: "completed",
    timestamp: "2026-07-26 09:42:11",
    flagged: 12,
    duration: "4m 18s",
  },
  {
    id: "ex-002",
    pipeline: "Velocity Check v2",
    status: "running",
    timestamp: "2026-07-26 09:38:02",
    flagged: 7,
    duration: "—",
  },
  {
    id: "ex-003",
    pipeline: "Behavioral Scoring v3",
    status: "completed",
    timestamp: "2026-07-26 09:15:47",
    flagged: 3,
    duration: "2m 51s",
  },
  {
    id: "ex-004",
    pipeline: "Card Bin Heuristics",
    status: "failed",
    timestamp: "2026-07-26 08:59:30",
    flagged: 0,
    duration: "1m 02s",
  },
  {
    id: "ex-005",
    pipeline: "Graph Anomaly v4",
    status: "completed",
    timestamp: "2026-07-26 08:30:12",
    flagged: 18,
    duration: "4m 09s",
  },
  {
    id: "ex-006",
    pipeline: "Device Fingerprint Match",
    status: "queued",
    timestamp: "2026-07-26 08:12:55",
    flagged: 0,
    duration: "—",
  },
  {
    id: "ex-007",
    pipeline: "Velocity Check v2",
    status: "completed",
    timestamp: "2026-07-26 07:48:20",
    flagged: 9,
    duration: "3m 47s",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "n-1",
    severity: "critical",
    title: "High-severity anomalies detected",
    message: "Graph Anomaly v4 flagged 12 new anomalies in the last run.",
    time: "2 min ago",
  },
  {
    id: "n-2",
    severity: "warning",
    title: "Pipeline failure",
    message: "Card Bin Heuristics failed during execution — upstream timeout.",
    time: "44 min ago",
  },
  {
    id: "n-3",
    severity: "info",
    title: "Execution queued",
    message: "Device Fingerprint Match is waiting for a free worker slot.",
    time: "1 hr ago",
  },
  {
    id: "n-4",
    severity: "info",
    title: "Model retrained",
    message: "Behavioral Scoring v3 baseline refreshed with 14k new samples.",
    time: "3 hr ago",
  },
];
