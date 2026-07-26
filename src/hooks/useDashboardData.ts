/**
 * Fetches real execution history from the backend and reshapes it into
 * the structures the Dashboard cards + tables already consume.
 */
import { useEffect, useState } from "react";
import { listExecutions } from "../features/executionConsole/api";
import type { ExecutionRecord } from "../features/executionConsole/types";
import type { DashboardStat, RecentExecution } from "../mocks/dashboard";

export interface DashboardData {
  stats: DashboardStat[];
  recentExecutions: RecentExecution[];
  totalExecutions: number;
  activePipelines: number;
  runningJobs: number;
  loading: boolean;
  error: string | null;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return "—";
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (ms < 0 || isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, "0")}s`;
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    stats: [],
    recentExecutions: [],
    totalExecutions: 0,
    activePipelines: 0,
    runningJobs: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { executions, total, distinct_pipelines } = await listExecutions(50);
        if (cancelled) return;
        const running = executions.filter((e) => e.status === "running").length;
        const recent: RecentExecution[] = executions.map((e: ExecutionRecord) => ({
          id: e.id,
          pipeline: e.pipeline_name,
          status: e.status,
          timestamp: formatTimestamp(e.started_at),
          flagged: e.summary?.flagged ?? 0,
          duration: formatDuration(e.started_at, e.completed_at),
        }));
        const stats: DashboardStat[] = [
          {
            id: "active-pipelines",
            label: "Active Pipelines",
            value: String(distinct_pipelines),
            sub: `${distinct_pipelines} unique run`,
          },
          {
            id: "total-executions",
            label: "Total Executions",
            value: total.toLocaleString(),
            sub: "all time",
          },
          {
            id: "running-jobs",
            label: "Running Jobs",
            value: String(running),
            sub: running > 0 ? "live" : "idle",
            accent: true,
          },
        ];
        setData({
          stats,
          recentExecutions: recent,
          totalExecutions: total,
          activePipelines: distinct_pipelines,
          runningJobs: running,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setData((d) => ({
          ...d,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return data;
}
