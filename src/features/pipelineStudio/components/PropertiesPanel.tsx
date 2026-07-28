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

      {/* Dynamic Dataset Features & Parameters Section */}
      {(data.category === "feature" || data.category === "preprocessing" || data.category === "detection") && (
        <DynamicDatasetFeaturesSection nodeData={data} onChange={onChange} />
      )}

      {/* Rule-to-Cluster Interactive Manager for Clustering nodes */}
      {(data.detectionSubType === "clustering" || (data.algorithmId && data.algorithmId.includes("cluster"))) && (
        <RuleClusterManagerSection nodeData={data} onChange={onChange} />
      )}


      {/* Markdown Rules (.md) Input Section */}
      {(data.defType === "input.markdown-rules" || data.category === "input") && (
        <MarkdownRuleSection nodeData={data} onChange={onChange} />
      )}

      {/* Transaction Data Feed / train_data.xlsx Log Feed Input Section */}
      {(data.defType === "input.transaction-feed" || data.category === "input") && (
        <TransactionFeedSection nodeData={data} onChange={onChange} />
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

const DEFAULT_MARKDOWN_RULES_TEXT = `## Rule -> Parameters

### ALERT_LOGIN_3075_FRAUDULENT_ISP_B
- Rule Description: ISP from login is found on customer profile indicating fraud occurred in past 30 days and cust device age < 180 days.
- Parameter Count: 6
- Parameters:
  - IP Carrier
  - Online Device First Seen
  - Reject Type Code
  - Rejected Transaction Indication
  - Transaction Type
  - Trx Date

### ALERT_LOGIN_3076_MULTI_ECN_PER_DEVICE_A
- Rule Description: If an Online Device Id has been used to login by at least 4 users (>= 4 ECNs) within the past 6 hours, then create this alert rule at Login.
- Parameter Count: 1
- Parameters:
  - Transaction Type

### ALERT_LOGIN_3077_FAILED_LOGINS
- Rule Description: Customer has failed at least 3 logins within the past 24 hours.
- Parameter Count: 6
- Parameters:
  - ActSet Reject Type Code
  - ActSet Transaction Type
  - ActSet Trx Date
  - Main Entity Activity Set
  - Transaction Type
  - Trx Date

### ALERT_LOGIN_3079_UNTRUST_ISP_A
- Rule Description: If ISP is not on the Trusted ISP list from the given user then fire advisory
- Parameter Count: 4
- Parameters:
  - IP Carrier
  - Reject Type Code
  - Rejected Transaction Indication
  - Transaction Type

### RISK_LOGIN_3000_NEW_DVC_A
- Rule Description: If login from an untrusted device with customer device age <=365 days, then challenge. Bypass delegate users and bypass when a NULL WF DVC_ID is upgraded flag returns TRUE. And bypass low BioCatch scores on browser logins.
- Parameter Count: 12
- Parameters:
  - BIOCATCH_MODEL_SCORE
  - Customer Type
  - Is New WFDID Upgraded Device`;

function MarkdownRuleSection({
  nodeData,
  onChange,
}: {
  nodeData: PipelineNodeData;
  onChange: (patch: Partial<PipelineNodeData>) => void;
}) {
  const initialFile = typeof nodeData.params?.fileName === "string" ? nodeData.params.fileName : "RULE_PARAMETER_MAPPING.md";
  const initialMd = typeof nodeData.params?.rawMarkdown === "string" ? nodeData.params.rawMarkdown : DEFAULT_MARKDOWN_RULES_TEXT;

  const [fileName, setFileName] = useState<string>(initialFile);
  const [rawMarkdown, setRawMarkdown] = useState<string>(initialMd);
  const [parsedCount, setParsedCount] = useState(5);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = (evt.target?.result as string) || "";
      setRawMarkdown(text);
      const matches = text.match(/###\s+[^\n]+/g) || [];
      setParsedCount(matches.length || 1);

      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/datasets/upload", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        onChange({
          params: {
            ...(nodeData.params || {}),
            datasetRef: json.id,
            fileName: file.name,
            rawMarkdown: text,
          },
        });
      } catch (err) {
        console.error("Failed to upload markdown rules", err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const loadSampleRules = () => {
    setFileName("RULE_PARAMETER_MAPPING.md");
    setRawMarkdown(DEFAULT_MARKDOWN_RULES_TEXT);
    setParsedCount(5);
    onChange({
      params: {
        ...(nodeData.params || {}),
        datasetRef: "sample-md-rules-001",
        fileName: "RULE_PARAMETER_MAPPING.md",
        rawMarkdown: DEFAULT_MARKDOWN_RULES_TEXT,
      },
    });
  };

  return (
    <Section title="Markdown Rules Source (.md)">
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-canvas-50 border border-canvas-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-canvas-800 flex items-center gap-1.5 truncate max-w-[170px]">
              📄 {fileName}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {parsedCount} Rules
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <label className="btn-primary text-xs !py-1.5 flex-1 cursor-pointer justify-center text-center">
              {uploading ? "Uploading..." : "Upload .md File"}
              <input
                type="file"
                accept=".md,.markdown,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <button
              onClick={loadSampleRules}
              className="btn-ghost text-xs !py-1.5 text-canvas-700 border border-canvas-200 hover:bg-canvas-100"
              title="Load default rule mapping"
            >
              Preset Rules
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-canvas-700 mb-1.5">
            Rule Definitions & Parameters (.md):
          </label>
          <textarea
            value={rawMarkdown}
            onChange={(e) => {
              const text = e.target.value;
              setRawMarkdown(text);
              const matches = text.match(/###\s+[^\n]+/g) || [];
              setParsedCount(matches.length || 1);
            }}
            onBlur={() => {
              onChange({
                params: {
                  ...(nodeData.params || {}),
                  rawMarkdown,
                  fileName,
                },
              });
            }}
            rows={8}
            className="input font-mono text-[11px] leading-relaxed resize-none bg-slate-900 text-emerald-400 p-2.5 rounded-md border-slate-800"
            placeholder="### ALERT_LOGIN_3075_FRAUDULENT_ISP_B&#10;- Rule Description: ...&#10;- Parameter Count: 6..."
          />
        </div>
      </div>
    </Section>
  );
}

function RuleClusterManagerSection({
  nodeData,
  onChange,
}: {
  nodeData: PipelineNodeData;
  onChange: (patch: Partial<PipelineNodeData>) => void;
}) {
  const customClusters: Record<string, string> =
    (nodeData.params?.customRuleClusters as Record<string, string>) || {
      ALERT_LOGIN_3075_FRAUDULENT_ISP_B: "Cluster 1 (ISP Risk)",
      ALERT_LOGIN_3076_MULTI_ECN_PER_DEVICE_A: "Cluster 2 (Login Velocity)",
      ALERT_LOGIN_3077_FAILED_LOGINS: "Cluster 2 (Login Velocity)",
      ALERT_LOGIN_3079_UNTRUST_ISP_A: "Cluster 1 (ISP Risk)",
      RISK_LOGIN_3000_NEW_DVC_A: "Cluster 3 (BioCatch Risk)",
    };

  const handleClusterChange = (ruleId: string, newCluster: string) => {
    const updated = { ...customClusters, [ruleId]: newCluster };
    onChange({
      params: {
        ...(nodeData.params || {}),
        customRuleClusters: updated,
      },
    });
  };

  return (
    <Section title="Interactive Rule-to-Cluster Override">
      <div className="space-y-2.5">
        <p className="text-[11px] text-canvas-500">
          Re-assign individual rules to custom clusters. Overrides are saved with this pipeline node.
        </p>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {Object.entries(customClusters).map(([ruleId, clusterName]) => (
            <div
              key={ruleId}
              className="p-2 rounded-md bg-canvas-50 border border-canvas-200 flex flex-col gap-1 text-xs"
            >
              <span className="font-mono font-semibold text-canvas-800 truncate" title={ruleId}>
                {ruleId}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-canvas-500 uppercase font-semibold">
                  Cluster:
                </span>
                <select
                  value={clusterName}
                  onChange={(e) => handleClusterChange(ruleId, e.target.value)}
                  className="input text-xs !py-1 !px-1.5 flex-1 bg-white font-semibold text-accent-700 border-canvas-200"
                >
                  <option value="Cluster 1 (ISP Risk)">Cluster 1 (ISP Risk)</option>
                  <option value="Cluster 2 (Login Velocity)">Cluster 2 (Login Velocity)</option>
                  <option value="Cluster 3 (BioCatch Risk)">Cluster 3 (BioCatch Risk)</option>
                  <option value="Cluster 4 (Custom)">Cluster 4 (Custom)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function TransactionFeedSection({
  nodeData,
  onChange,
}: {
  nodeData: PipelineNodeData;
  onChange: (patch: Partial<PipelineNodeData>) => void;
}) {
  const currentDs = (nodeData.params?.datasetRef as string) || "train-data-log-001";
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      onChange({
        params: {
          ...(nodeData.params || {}),
          datasetRef: json.id,
          fileName: file.name,
        },
      });
    } catch (err) {
      console.error("Failed to upload dataset file", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Section title="Transaction Dataset Feed Source">
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-canvas-50 border border-canvas-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-canvas-800 flex items-center gap-1.5 truncate max-w-[170px]">
              📊 {currentDs === "train-data-log-001" ? "train_data.xlsx (Log Feed)" : currentDs}
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() =>
                onChange({
                  params: {
                    ...(nodeData.params || {}),
                    datasetRef: "train-data-log-001",
                    fileName: "train_data.xlsx",
                  },
                })
              }
              className={`btn-ghost text-xs !py-1.5 font-bold border ${
                currentDs === "train-data-log-001"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                  : "border-canvas-200 text-canvas-700 hover:bg-canvas-100"
              }`}
            >
              📑 Use train_data.xlsx Log Feed
            </button>
            <label className="btn-primary text-xs !py-1.5 cursor-pointer justify-center text-center">
              {uploading ? "Uploading Excel/CSV…" : "📥 Upload custom .xlsx / .csv"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      </div>
    </Section>
  );
}

interface DatasetSchema {
  id: string;
  name: string;
  row_count: number;
  total_columns_count: number;
  columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  target_columns: string[];
}

function useDatasetSchema(datasetRef = "train-data-log-001") {
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/datasets/${encodeURIComponent(datasetRef)}/schema`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.columns) {
          setSchema(data);
        }
      })
      .catch((err) => console.error("Failed to load dataset schema", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [datasetRef]);

  return { schema, loading };
}

function DynamicDatasetFeaturesSection({
  nodeData,
  onChange,
}: {
  nodeData: PipelineNodeData;
  onChange: (patch: Partial<PipelineNodeData>) => void;
}) {
  const activeDatasetRef = usePipelineStore((s) => s.activeDatasetRef);
  const activeDatasetName = usePipelineStore((s) => s.activeDatasetName);
  const datasetRef = (nodeData.params?.datasetRef as string) || activeDatasetRef || "train-data-log-001";
  const { schema, loading } = useDatasetSchema(datasetRef);
  const selectedFeatures = (nodeData.params?.selectedFeatures as string[]) || [];
  const targetVar = (nodeData.params?.targetVariable as string) || "is_fraud";


  const handleToggleFeature = (col: string) => {
    const next = selectedFeatures.includes(col)
      ? selectedFeatures.filter((c) => c !== col)
      : [...selectedFeatures, col];
    onChange({
      params: {
        ...(nodeData.params || {}),
        selectedFeatures: next,
      },
    });
  };

  const handleSelectAll = () => {
    if (!schema) return;
    const all = schema.columns.filter((c) => c !== targetVar);
    onChange({
      params: {
        ...(nodeData.params || {}),
        selectedFeatures: all,
      },
    });
  };

  const handleClearAll = () => {
    onChange({
      params: {
        ...(nodeData.params || {}),
        selectedFeatures: [],
      },
    });
  };

  return (
    <Section title="📊 Dynamic Dataset Features & Parameters">
      <div className="space-y-2.5">
        <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/80 text-xs">
          <div className="flex items-center justify-between font-semibold text-indigo-900 mb-1">
            <span className="truncate max-w-[170px]" title={schema?.name || activeDatasetName}>
              📁 {schema?.name || activeDatasetName}
            </span>
            <span className="bg-indigo-200/80 text-indigo-800 px-1.5 py-0.5 rounded text-[10px]">
              {schema?.row_count || 500} records
            </span>
          </div>

          <p className="text-[11px] text-indigo-700 leading-relaxed">
            Detected {schema?.total_columns_count || 44} extracted features ({schema?.numeric_columns.length || 21} numeric, {schema?.categorical_columns.length || 23} categorical).
          </p>
        </div>

        {/* Target Variable Selector */}
        {nodeData.category === "detection" && (
          <div>
            <label className="block text-[11px] font-semibold text-canvas-700 uppercase mb-1">
              Target Variable (Label)
            </label>
            <select
              value={targetVar}
              onChange={(e) =>
                onChange({
                  params: {
                    ...(nodeData.params || {}),
                    targetVariable: e.target.value,
                  },
                })
              }
              className="input text-xs font-semibold text-canvas-800 bg-white"
            >
              {(schema?.target_columns.length ? schema.target_columns : ["is_fraud"]).map((col) => (
                <option key={col} value={col}>
                  🎯 {col}
                </option>
              ))}
              {(schema?.columns || [])
                .filter((c) => !schema?.target_columns.includes(c))
                .slice(0, 10)
                .map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Dynamic Column Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-canvas-700 uppercase">
              Model Feature Input Selection
            </span>
            <div className="flex gap-1.5 text-[10px]">
              <button
                onClick={handleSelectAll}
                className="text-accent-600 font-semibold hover:underline"
              >
                Select All
              </button>
              <span className="text-canvas-300">|</span>
              <button
                onClick={handleClearAll}
                className="text-canvas-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border border-canvas-200 rounded-md p-1.5 space-y-1 bg-canvas-50/50">
            {loading ? (
              <div className="p-2 text-center text-xs text-canvas-500">Loading dataset schema…</div>
            ) : (schema?.columns || []).length === 0 ? (
              <div className="p-2 text-center text-xs text-canvas-500">No columns found</div>
            ) : (
              (schema?.columns || []).map((col) => {
                const checked = selectedFeatures.length === 0 || selectedFeatures.includes(col);
                const isNumeric = schema?.numeric_columns.includes(col);
                return (
                  <label
                    key={col}
                    className="flex items-center justify-between p-1 rounded hover:bg-canvas-100 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleFeature(col)}
                        className="rounded border-canvas-300 text-accent-600 focus:ring-accent-500"
                      />
                      <span className="font-mono text-[11px] text-canvas-800 truncate" title={col}>
                        {col}
                      </span>
                    </div>
                    <span className="text-[9px] px-1 rounded bg-canvas-200/70 text-canvas-600 font-semibold">
                      {isNumeric ? "num" : "cat"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}




