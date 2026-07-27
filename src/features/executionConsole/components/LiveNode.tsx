import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATEGORY_META } from "../../pipelineStudio/catalog";
import type { NodeCategory, PipelineNodeData } from "../../pipelineStudio/types";
import type { NodeStatus } from "../executionStore";

export interface LiveNodeData extends PipelineNodeData {
  status?: NodeStatus;
}

const CATEGORY_ICON: Record<string, string> = {
  input: '<path d="M5 8h14M5 8l4-4M5 8l4 4M19 16H5M19 16l-4-4M19 16l-4 4"/>',
  preprocessing: '<path d="M4 7h16M4 12h10M4 17h16"/>',
  feature: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/>',
  detection: '<path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/>',
  output: '<path d="M9 6l6 6-6 6M5 12h10"/>',
};

function LiveNodeView({ data, selected }: NodeProps) {
  const d = data as LiveNodeData;
  const meta = CATEGORY_META[d.category as NodeCategory] ?? CATEGORY_META.input;
  const status: NodeStatus = (d.status as NodeStatus) ?? "pending";
  const iconPath = CATEGORY_ICON[d.category] ?? "";

  const isRunning = status === "running";
  const isComplete = status === "complete";

  const borderColor = isRunning
    ? "#F59E0B"
    : isComplete
    ? "#10B981"
    : selected
    ? meta.accent
    : "#E2E8F0";

  const glowShadow = isRunning
    ? "0 0 16px rgba(245, 158, 11, 0.35), 0 4px 12px rgba(245, 158, 11, 0.15)"
    : isComplete
    ? "0 4px 14px rgba(16, 185, 129, 0.15)"
    : "0 2px 8px rgba(0, 0, 0, 0.04)";

  return (
    <div
      className={`relative rounded-2xl bg-white border-2 transition-all duration-300 ${
        isRunning ? "scale-105" : "hover:shadow-md hover:border-slate-300"
      }`}
      style={{
        borderColor,
        boxShadow: glowShadow,
        width: 190,
      }}
    >
      {/* Category Accent Left Line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: isComplete ? "#10B981" : isRunning ? "#F59E0B" : meta.accent }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-2xl border-b border-slate-100"
        style={{ backgroundColor: meta.soft }}
      >
        <span
          className="grid place-items-center w-5 h-5 rounded-md shrink-0 text-white shadow-xs"
          style={{ backgroundColor: meta.accent }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: iconPath }}
          />
        </span>
        <span
          className="text-[9px] font-mono font-bold uppercase tracking-wider truncate"
          style={{ color: meta.accent }}
        >
          {meta.label}
        </span>
        <StatusDot status={status} />
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-xs font-bold text-slate-800 leading-tight truncate">{d.label}</p>
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="truncate max-w-[100px]">{d.algorithmId ? d.algorithmId.split(".").pop() : "Standard"}</span>
          <span
            className={`font-bold capitalize px-1.5 py-0.2 rounded text-[9px] ${
              isComplete
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : isRunning
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: isComplete ? "#10B981" : meta.accent }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: isComplete ? "#10B981" : meta.accent }}
      />
    </div>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  if (status === "pending")
    return <span className="ml-auto w-2 h-2 rounded-full bg-slate-300" />;
  if (status === "running")
    return (
      <span className="ml-auto relative flex w-2.5 h-2.5">
        <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
        <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
      </span>
    );
  return (
    <span className="ml-auto w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
  );
}

export default memo(LiveNodeView);
