import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_META, DETECTION_SUBTYPE_LABELS } from "../catalog";
import { usePipelineStore } from "../pipelineStore";
import type { PipelineNodeData } from "../types";
import {
  categoryForNode,
  useAlgorithmDetail,
  useAlgorithmsForCategory,
  type AlgorithmDetail,
  type AlgorithmParam,
  type AlgorithmSummary,
} from "../algorithmApi";

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
        <p className="text-sm text-canvas-500 font-medium">No node selected</p>
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

  useEffect(() => {
    setLabel(data.label);
    setDescription(data.description);
    setNotes(data.notes);
  }, [data.label, data.description, data.notes]);

  const commitLabel = () => {
    if (label.trim() && label !== data.label) onChange({ label: label.trim() });
    else setLabel(data.label);
  };

  const isDetection = data.category === "detection";
  const isFeature = data.category === "feature";
  const isAlgoBacked = isDetection || isFeature;

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

      {/* Algorithm choice for algorithm-backed nodes (feature + detection) */}
      {isAlgoBacked && (
        <Section title="Algorithm">
          <AlgorithmSelect
            category={categoryForNode(data.category, data.detectionSubType)}
            currentId={data.algorithmId}
            onChange={(newAlgoId, newAlgoName) => {
              // Switching algorithms must fully replace the form — old
              // parameter values are wiped here; the ParameterForm below
              // re-seeds defaults from the freshly fetched schema.
              onChange({
                algorithmId: newAlgoId,
                label: newAlgoName ?? data.label,
                params: {},
              });
            }}
          />
        </Section>
      )}

      {/* Algorithm parameters — rendered from the live-fetched schema */}
      {isAlgoBacked && data.algorithmId && (
        <AlgorithmParameters
          algorithmId={data.algorithmId}
          values={data.params ?? {}}
          onChange={(name, value) =>
            onChange({
              params: { ...(data.params ?? {}), [name]: value },
            })
          }
        />
      )}

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

function AlgorithmSelect({
  category,
  currentId,
  onChange,
}: {
  category: string | undefined;
  currentId?: string;
  onChange: (algoId: string, algoName?: string) => void;
}) {
  const { data, isLoading, isError } = useAlgorithmsForCategory(category);

  if (!category) {
    return (
      <p className="text-xs text-canvas-400 italic">
        Unknown algorithm category.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-xs text-canvas-400 italic">Loading algorithms…</p>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-red-500 italic">
        Failed to load algorithms. Check the backend connection.
      </p>
    );
  }

  const choices: AlgorithmSummary[] = data?.algorithms ?? [];

  if (choices.length === 0) {
    return (
      <p className="text-xs text-canvas-400 italic">
        No algorithms registered for this category.
      </p>
    );
  }

  return (
    <select
      value={currentId ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        const choice = choices.find((c) => c.id === id);
        onChange(id, choice?.name);
      }}
      className="input text-sm"
    >
      {!currentId && <option value="">Choose an algorithm…</option>}
      {choices.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Renders the parameter form for a selected algorithm. The schema is fetched
 * live from GET /algorithms/{id}; defaults are seeded into the node's params
 * the first time the schema arrives so the form shows real values immediately.
 */
function AlgorithmParameters({
  algorithmId,
  values,
  onChange,
}: {
  algorithmId: string;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  const { data, isLoading, isError } = useAlgorithmDetail(algorithmId);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);

  // Seed defaults once the schema arrives, but only for params that are not
  // already set (so we don't clobber user edits on refetch).
  useEffect(() => {
    if (!data?.algorithm || !selectedNodeId) return;
    const detail = data.algorithm;
    const merged: Record<string, unknown> = { ...values };
    let changed = false;
    for (const p of detail.parameters) {
      if (!(p.name in merged)) {
        merged[p.name] = p.default;
        changed = true;
      }
    }
    if (changed) {
      updateNodeData(selectedNodeId, { params: merged });
    }
    // Intentionally depend on algorithmId + the schema identity, not on
    // `values`, to avoid re-seeding on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, algorithmId, selectedNodeId, updateNodeData]);

  if (isLoading) {
    return (
      <Section title="Parameters">
        <p className="text-xs text-canvas-400 italic">Loading schema…</p>
      </Section>
    );
  }

  if (isError) {
    return (
      <Section title="Parameters">
        <p className="text-xs text-red-500 italic">
          Failed to load algorithm schema.
        </p>
      </Section>
    );
  }

  const detail: AlgorithmDetail | undefined = data?.algorithm;
  if (!detail) return null;

  return (
    <Section title="Parameters">
      <ParameterForm
        params={detail.parameters}
        values={values}
        onChange={onChange}
      />
    </Section>
  );
}

function ParameterForm({
  params,
  values,
  onChange,
}: {
  params: AlgorithmParam[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  if (params.length === 0) {
    return (
      <p className="text-xs text-canvas-400 italic">
        This algorithm has no configurable parameters.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {params.map((p) => (
        <ParamField
          key={p.name}
          def={p}
          value={values[p.name] ?? p.default}
          onChange={(v) => onChange(p.name, v)}
        />
      ))}
    </div>
  );
}

function ParamField({
  def,
  value,
  onChange,
}: {
  def: AlgorithmParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-canvas-700">
          {def.name}
        </label>
        <span className="text-[10px] text-canvas-400 bg-canvas-100 px-1 py-0.5 rounded">
          {def.type}
        </span>
      </div>

      {def.type === "enum" && def.options && (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="input text-xs"
        >
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {def.type === "boolean" && (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            value ? "bg-accent-500" : "bg-canvas-300"
          }`}
          aria-pressed={Boolean(value)}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              value ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      )}

      {(def.type === "number" || def.type === "integer") && (
        <NumberField def={def} value={value} onChange={onChange} />
      )}

      {def.type === "string" && (
        <input
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="input text-xs"
        />
      )}

      <p className="text-[11px] text-canvas-400 mt-1 leading-relaxed">
        {def.hint}
      </p>
    </div>
  );
}

function NumberField({
  def,
  value,
  onChange,
}: {
  def: AlgorithmParam;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const num = Number(value);
  const hasRange =
    typeof def.min === "number" && typeof def.max === "number";
  const step = def.step ?? (def.type === "integer" ? 1 : 0.01);

  return (
    <div>
      {hasRange ? (
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={step}
            value={num}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange(def.type === "integer" ? Math.round(v) : v);
            }}
            className="flex-1 accent-accent-500"
          />
          <span className="text-xs font-mono text-canvas-700 w-12 text-right tabular-nums">
            {def.type === "integer" ? Math.round(num) : num}
          </span>
        </div>
      ) : (
        <input
          type="number"
          value={num}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(def.type === "integer" ? Math.round(v) : v);
          }}
          className="input text-xs"
        />
      )}
      {hasRange && (
        <div className="flex justify-between text-[10px] text-canvas-400 mt-0.5">
          <span>{def.min}</span>
          <span>{def.max}</span>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-canvas-100">
      <h3 className="text-xs font-semibold text-canvas-600 uppercase tracking-wide mb-2">
        {title}
      </h3>
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
