import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_META, DETECTION_SUBTYPE_LABELS } from "../catalog";
import { usePipelineStore } from "../pipelineStore";
import type { PipelineNodeData } from "../types";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function PropertiesPanel({ collapsed, onToggle }: Props) {
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const node = usePipelineStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  );
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const deleteNode = usePipelineStore((s) => s.deleteNode);
  const duplicateNode = usePipelineStore((s) => s.duplicateNode);

  return (
    <motion.aside
      animate={{ width: collapsed ? 0 : 300 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="shrink-0 h-full bg-white border-l border-canvas-200 overflow-hidden flex flex-col"
    >
      <div className="w-[300px] h-full flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-canvas-100 shrink-0">
          <span className="text-sm font-semibold text-canvas-800">
            Properties
          </span>
          <button
            onClick={onToggle}
            className="btn-ghost !p-1.5"
            title="Collapse panel"
            aria-label="Collapse panel"
          >
            <ChevronIcon className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {!node || !selectedNodeId ? (
          <EmptyState />
        ) : (
          <NodeForm
            key={selectedNodeId}
            data={node.data}
            onChange={(patch) => updateNodeData(selectedNodeId, patch)}
            onDelete={() => deleteNode(selectedNodeId)}
            onDuplicate={() => duplicateNode(selectedNodeId)}
          />
        )}
      </div>
    </motion.aside>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 grid place-items-center p-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-lg bg-canvas-50 border border-canvas-200 text-canvas-400">
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a4 4 0 014 4v3h2v12H6V9h2V6a4 4 0 014-4z" />
          </svg>
        </div>
        <p className="text-sm text-canvas-500 font-medium">
          No node selected
        </p>
        <p className="text-xs text-canvas-400 mt-1 leading-relaxed">
          Select a node on the canvas to view and edit its properties.
        </p>
      </div>
    </div>
  );
}

function NodeForm({
  data,
  onChange,
  onDelete,
  onDuplicate,
}: {
  data: PipelineNodeData;
  onChange: (patch: Partial<PipelineNodeData>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const meta = CATEGORY_META[data.category];
  const [label, setLabel] = useState(data.label);
  const [description, setDescription] = useState(data.description);
  const [notes, setNotes] = useState(data.notes);

  // Re-seed local state when a different node is mounted (key prop handles remount).
  useEffect(() => {
    setLabel(data.label);
    setDescription(data.description);
    setNotes(data.notes);
  }, [data.label, data.description, data.notes]);

  const commitLabel = () => {
    if (label.trim() && label !== data.label) onChange({ label: label.trim() });
    else setLabel(data.label);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header chip */}
      <div className="px-4 py-3 border-b border-canvas-100">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: meta.accent }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: meta.accent }}
          >
            {meta.label}
          </span>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="input text-sm font-semibold"
        />
        {data.detectionSubType && (
          <p className="text-[11px] text-canvas-400 mt-1.5">
            Sub-type:{" "}
            {DETECTION_SUBTYPE_LABELS[data.detectionSubType] ??
              data.detectionSubType}
          </p>
        )}
      </div>

      {/* Configuration placeholder */}
      <Section title="Configuration" hint="Phase 3">
        <div className="rounded-md border border-dashed border-canvas-200 bg-canvas-50/50 px-3 py-4 text-center">
          <p className="text-xs text-canvas-400 leading-relaxed">
            Algorithm parameters will be configurable here in Phase 3
            (Algorithm Library).
          </p>
        </div>
      </Section>

      {/* Description */}
      <Section title="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== data.description) onChange({ description });
          }}
          rows={3}
          placeholder="Describe what this node does in your pipeline…"
          className="input resize-none text-sm leading-relaxed"
        />
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== data.notes) onChange({ notes });
          }}
          rows={4}
          placeholder="Annotate why this node is here, decisions, caveats…"
          className="input resize-none text-sm leading-relaxed"
        />
      </Section>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-canvas-100 flex gap-2">
        <button onClick={onDuplicate} className="btn-ghost flex-1 text-xs">
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="btn-ghost flex-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-canvas-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-canvas-600 uppercase tracking-wide">
          {title}
        </h3>
        {hint && (
          <span className="text-[10px] text-canvas-400 bg-canvas-100 px-1.5 py-0.5 rounded">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
