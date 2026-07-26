import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATEGORY_META } from "../catalog";
import type { NodeCategory, PipelineNodeData } from "../types";

const CATEGORY_ICON: Record<string, string> = {
  input:
    '<path d="M5 8h14M5 8l4-4M5 8l4 4M19 16H5M19 16l-4-4M19 16l-4 4"/>',
  preprocessing: '<path d="M4 7h16M4 12h10M4 17h16"/>',
  feature:
    '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/>',
  detection:
    '<path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/>',
  output: '<path d="M9 6l6 6-6 6M5 12h10"/>',
};

function PipelineNodeView({ data, selected }: NodeProps) {
  const d = data as PipelineNodeData;
  const meta = CATEGORY_META[d.category];
  const iconPath = CATEGORY_ICON[d.category] ?? "";
  const sub =
    d.detectionSubType === "clustering"
      ? "Clustering"
      : d.detectionSubType === "anomaly"
        ? "Anomaly"
        : d.detectionSubType === "classification"
          ? "Classification"
          : null;

  // Algorithm-backed nodes are "pending configuration" until an algorithm is
  // selected in the Properties panel.
  const isPending =
    (d.category === "feature" || d.category === "detection") &&
    !d.algorithmId;

  return (
    <div
      className={`relative rounded-lg bg-white shadow-card transition-shadow ${
        isPending ? "border-2 border-dashed" : "border"
      }`}
      style={{
        borderColor: isPending ? "#C4CAD6" : selected ? meta.accent : "#E5E8ED",
        boxShadow: selected
          ? `0 0 0 2px ${meta.accent}33, 0 4px 12px rgba(16,24,40,0.08)`
          : undefined,
        width: 188,
        opacity: isPending ? 0.92 : 1,
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: meta.accent, opacity: isPending ? 0.5 : 1 }}
      />
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: meta.soft, opacity: isPending ? 0.6 : 1 }}
      >
        <span
          className="grid place-items-center w-6 h-6 rounded shrink-0"
          style={{ backgroundColor: meta.accent, color: "#fff" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: iconPath }}
          />
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wide truncate"
          style={{ color: meta.accent }}
        >
          {meta.label}
        </span>
      </div>
      <div className="px-3 py-2">
        <p
          className={`text-sm font-medium leading-tight truncate ${
            isPending
              ? "text-canvas-400 italic"
              : "text-canvas-800"
          }`}
        >
          {d.label}
        </p>
        {sub && !isPending && (
          <p className="text-[10px] text-canvas-400 mt-0.5">{sub}</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white"
        style={{ background: meta.accent }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white"
        style={{ background: meta.accent }}
      />
    </div>
  );
}

export default memo(PipelineNodeView);

export type { PipelineNodeData, NodeCategory };
