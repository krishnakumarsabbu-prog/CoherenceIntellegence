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

  const borderColor =
    status === "running"
      ? "#F59E0B"
      : status === "complete"
        ? "#10B981"
        : selected
          ? meta.accent
          : "#E5E8ED";

  const ring =
    status === "running"
      ? "0 0 0 2px #F59E0B55, 0 0 14px rgba(245,158,11,0.35)"
      : status === "complete"
        ? "0 0 0 2px #10B98133, 0 4px 12px rgba(16,24,40,0.06)"
        : undefined;

  return (
    <div
      className={`relative rounded-lg bg-white border shadow-card transition-all duration-300 ${status === "running" ? "animate-pulse" : ""}`}
      style={{ borderColor, boxShadow: ring, width: 170 }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: meta.accent }} />
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg" style={{ backgroundColor: meta.soft }}>
        <span className="grid place-items-center w-6 h-6 rounded shrink-0" style={{ backgroundColor: meta.accent, color: "#fff" }}>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconPath }} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: meta.accent }}>
          {meta.label}
        </span>
        <StatusDot status={status} />
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-canvas-800 leading-tight truncate">{d.label}</p>
        <p className="text-[10px] text-canvas-400 mt-0.5 capitalize">{status}</p>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !border-2 !border-white" style={{ background: meta.accent }} />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-2 !border-white" style={{ background: meta.accent }} />
    </div>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  if (status === "pending") return <span className="ml-auto w-2 h-2 rounded-full bg-canvas-200" />;
  if (status === "running")
    return (
      <span className="ml-auto relative flex w-2.5 h-2.5">
        <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
        <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
      </span>
    );
  return <span className="ml-auto w-2.5 h-2.5 rounded-full bg-emerald-500" />;
}

export default memo(LiveNodeView);
