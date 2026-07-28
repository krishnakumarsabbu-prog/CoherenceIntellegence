import { useState } from "react";
import {
  useReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { usePipelineStore } from "../pipelineStore";
import type { ValidationIssue } from "../types";

interface Props {
  rfInstance: ReactFlowInstance | null;
  onValidate: () => ValidationIssue[];
  onBackToDashboard?: () => void;
  onTrainClick: (pipelineId: string, datasetRef: string) => void;
}

export default function CanvasToolbar({ rfInstance, onValidate, onBackToDashboard, onTrainClick }: Props) {
  const undo = usePipelineStore((s) => s.undo);
  const redo = usePipelineStore((s) => s.redo);
  const canUndo = usePipelineStore((s) => s.past.length > 0);
  const canRedo = usePipelineStore((s) => s.future.length > 0);
  const showMinimap = usePipelineStore((s) => s.showMinimap);
  const toggleMinimap = usePipelineStore((s) => s.toggleMinimap);
  const clearCanvas = usePipelineStore((s) => s.clearCanvas);
  const saveCurrent = usePipelineStore((s) => s.saveCurrent);
  const activePipelineName = usePipelineStore((s) => s.activePipelineName);
  const pushToast = usePipelineStore((s) => s.pushToast);
  const nodeCount = usePipelineStore((s) => s.nodes.length);

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(activePipelineName);

  const activeDatasetRef = usePipelineStore((s) => s.activeDatasetRef);
  const activeDatasetName = usePipelineStore((s) => s.activeDatasetName);
  const setActiveDataset = usePipelineStore((s) => s.setActiveDataset);

  const [uploadingDs, setUploadingDs] = useState(false);

  const handleDatasetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDs(true);
    pushToast("info", `Uploading dataset "${file.name}"…`);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      setActiveDataset(json.id, file.name);
      pushToast("success", `Dataset "${file.name}" uploaded! Schema and features are now populated for all models.`);
    } catch (err) {
      console.error("Failed to upload dataset", err);
      pushToast("error", "Failed to upload dataset file.");
    } finally {
      setUploadingDs(false);
    }
  };

  const doSave = () => {
    saveCurrent(name);
    setSaveOpen(false);
    pushToast("success", `Pipeline "${name.trim() || "Untitled pipeline"}" saved to Database.`);
  };

  const doTrainAndSave = () => {
    const issues = onValidate();
    const errors = issues.filter((i) => i.level === "error");
    if (errors.length > 0) {
      pushToast("error", `Cannot train: ${errors.map((e) => e.message).join(" | ")}`);
      return;
    }
    const activePipe = saveCurrent(name.trim() || activePipelineName);
    setSaveOpen(false);
    onTrainClick(activePipe.id, activeDatasetRef);
  };



  const doValidate = () => {
    const issues = onValidate();
    const errors = issues.filter((i) => i.level === "error");
    const infos = issues.filter((i) => i.level === "info");

    if (errors.length === 0) {
      const msg = infos[0]?.message || "Pipeline validation passed! Structure is valid and ready for execution.";
      pushToast("success", msg);
    } else {
      pushToast(
        "error",
        `Validation failed (${errors.length} error): ${errors.map((e) => e.message).join(" | ")}`,
      );
    }
  };

  return (
    <div className="h-12 px-3 flex items-center gap-1.5 border-b border-canvas-100 bg-white/80 backdrop-blur-sm">
      {onBackToDashboard && (
        <>
          <button
            onClick={onBackToDashboard}
            className="btn-ghost text-xs flex items-center gap-1 text-canvas-700 font-semibold hover:bg-canvas-100 px-2 py-1 rounded-md"
            title="Return to Pipelines Dashboard"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Dashboard</span>
          </button>
          <Divider />
        </>
      )}
      <ToolGroup>
        <ToolButton
          title="Zoom in"
          onClick={() => rfInstance?.zoomIn()}
          disabled={!rfInstance}
        >
          <PlusIcon className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          title="Zoom out"
          onClick={() => rfInstance?.zoomOut()}
          disabled={!rfInstance}
        >
          <MinusIcon className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          title="Fit view"
          onClick={() => rfInstance?.fitView({ padding: 0.2, duration: 300 })}
          disabled={!rfInstance || nodeCount === 0}
        >
          <FitIcon className="w-4 h-4" />
        </ToolButton>
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          title={showMinimap ? "Hide minimap" : "Show minimap"}
          onClick={toggleMinimap}
          active={showMinimap}
        >
          <MapIcon className="w-4 h-4" />
        </ToolButton>
      </ToolGroup>

      <Divider />

      {/* Active Pipeline Dataset Selector & Uploader */}
      <div className="flex items-center gap-1.5 bg-canvas-50/80 border border-canvas-200 px-2 py-1 rounded-md text-xs">
        <span className="text-canvas-500 font-semibold uppercase text-[10px]">Dataset:</span>
        <span className="font-bold text-indigo-900 truncate max-w-[130px]" title={activeDatasetName}>
          📁 {activeDatasetName}
        </span>
        <button
          onClick={() => setActiveDataset("train-data-log-001", "train_data.xlsx (Log Feed)")}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
            activeDatasetRef === "train-data-log-001"
              ? "bg-indigo-100 text-indigo-700 border-indigo-300"
              : "border-canvas-200 text-canvas-600 hover:bg-canvas-100"
          }`}
          title="Use train_data.xlsx Log Feed"
        >
          Log Feed
        </button>
        <label className="cursor-pointer bg-white hover:bg-canvas-100 text-canvas-700 border border-canvas-200 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-2xs">
          {uploadingDs ? "Uploading…" : "📥 Upload .xlsx"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleDatasetUpload}
          />
        </label>
      </div>

      <Divider />


      <ToolGroup>
        <ToolButton title="Undo" onClick={undo} disabled={!canUndo}>
          <UndoIcon className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Redo" onClick={redo} disabled={!canRedo}>
          <RedoIcon className="w-4 h-4" />
        </ToolButton>
      </ToolGroup>

      <div className="flex-1" />

      <ToolButton
        title="Clear canvas"
        onClick={() => {
          if (nodeCount === 0) return;
          clearCanvas();
          pushToast("info", "Canvas cleared.");
        }}
        disabled={nodeCount === 0}
      >
        <TrashIcon className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Clear</span>
      </ToolButton>

      <button
        onClick={doValidate}
        disabled={nodeCount === 0}
        className="btn-ghost text-xs disabled:opacity-50"
        title="Validate pipeline structure"
      >
        <CheckIcon className="w-4 h-4" />
        Validate
      </button>

      {saveOpen ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSave();
              if (e.key === "Escape") setSaveOpen(false);
            }}
            className="input text-xs py-1.5 w-40"
            placeholder="Pipeline name"
          />
          <button onClick={doSave} className="btn-ghost text-xs py-1.5 border border-canvas-200">
            Save Only
          </button>
          <button
            onClick={doTrainAndSave}
            className="btn-primary text-xs py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 font-bold"
          >
            ⚡ Train & Save Models
          </button>
          <button
            onClick={() => setSaveOpen(false)}
            className="btn-ghost text-xs py-1.5"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setName(activePipelineName);
              setSaveOpen(true);
            }}
            className="btn-ghost text-xs border border-canvas-200 font-medium"
            title="Save pipeline definition"
          >
            <SaveIcon className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={doTrainAndSave}
            className="btn-primary text-xs bg-gradient-to-r from-blue-600 to-indigo-600 font-bold shadow-sm"
            title="Save pipeline and fit model artifacts (.joblib)"
          >
            <SaveIcon className="w-4 h-4" />
            ⚡ Train & Save (.joblib)
          </button>
        </div>
      )}

    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <span className="w-px h-5 bg-canvas-200 mx-1" />;
}

function ToolButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-canvas-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-accent-50 text-accent-700"
          : "hover:bg-canvas-100 hover:text-canvas-800"
      }`}
    >
      {children}
    </button>
  );
}

/* Icons */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}
function FitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
    </svg>
  );
}
function MapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function UndoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-1" />
    </svg>
  );
}
function RedoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h1" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function SaveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 3h11l3 3v15a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M8 3v5h7M8 21v-7h8v7" />
    </svg>
  );
}

export { useReactFlow };

