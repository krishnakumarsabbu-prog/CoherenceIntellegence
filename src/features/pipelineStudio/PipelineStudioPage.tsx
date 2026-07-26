import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { usePipelineStore } from "./pipelineStore";
import PipelineNode from "./components/PipelineNode";
import NodePalette from "./components/NodePalette";
import PropertiesPanel from "./components/PropertiesPanel";
import CanvasToolbar from "./components/CanvasToolbar";
import ToastStack from "./components/ToastStack";
import NodeContextMenu, {
  type ContextMenuState,
} from "./components/NodeContextMenu";
import { CATEGORY_META } from "./catalog";
import type { NodeCategory } from "./types";

const nodeTypes = { pipeline: PipelineNode };

function Studio() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNodeFromCatalog = usePipelineStore((s) => s.addNodeFromCatalog);
  const deleteNode = usePipelineStore((s) => s.deleteNode);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const validate = usePipelineStore((s) => s.validate);
  const showMinimap = usePipelineStore((s) => s.showMinimap);

  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Keyboard delete for the selected node.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const id = usePipelineStore.getState().selectedNodeId;
        if (id) {
          e.preventDefault();
          deleteNode(id);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) usePipelineStore.getState().redo();
        else usePipelineStore.getState().undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteNode]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const defType = e.dataTransfer.getData("application/x-pipeline-node");
      if (!defType || !wrapperRef.current || !rfInstance) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      addNodeFromCatalog(defType, {
        x: position.x - 94,
        y: position.y - 30,
      });
    },
    [rfInstance, addNodeFromCatalog],
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: { id: string }) => {
      e.preventDefault();
      selectNode(node.id);
      setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 lg:-m-8 border-y border-canvas-200 bg-canvas-50">
      <NodePalette
        collapsed={paletteCollapsed}
        onToggle={() => setPaletteCollapsed((v) => !v)}
        onDragStart={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <CanvasToolbar rfInstance={rfInstance} onValidate={validate} />

        {paletteCollapsed && (
          <button
            onClick={() => setPaletteCollapsed(false)}
            className="absolute left-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-canvas-200 shadow-card rounded-md"
            title="Show palette"
            aria-label="Show palette"
          >
            <ChevronIcon className="w-4 h-4" />
          </button>
        )}

        <div className="relative flex-1" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            onNodeClick={(_e, node) => selectNode(node.id)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
              style: { stroke: "#A9B0BD", strokeWidth: 1.6 },
            }}
            className="bg-canvas-50"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.4}
              color="#D3D8E0"
            />
            <Controls
              showInteractive={false}
              className="!shadow-card !rounded-md !border !border-canvas-200"
            />
            {showMinimap && (
              <MiniMap
                pannable
                zoomable
                className="!bg-white !border !border-canvas-200 !rounded-md !shadow-card"
                nodeColor={(n) => {
                  const cat = (n.data as { category?: NodeCategory })
                    ?.category;
                  return cat ? CATEGORY_META[cat]?.accent ?? "#A9B0BD" : "#A9B0BD";
                }}
                maskColor="rgba(247,248,250,0.6)"
              />
            )}
          </ReactFlow>

          {nodes.length === 0 && <EmptyCanvas />}

          <ToastStack />
        </div>
      </div>

      <PropertiesPanel
        collapsed={propsCollapsed}
        onToggle={() => setPropsCollapsed((v) => !v)}
      />

      {propsCollapsed && (
        <button
          onClick={() => setPropsCollapsed(false)}
          className="absolute right-2 top-14 z-10 btn-ghost !p-1.5 bg-white border border-canvas-200 shadow-card rounded-md"
          title="Show properties"
          aria-label="Show properties"
        >
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      )}

      <NodeContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-xl bg-white border border-canvas-200 text-canvas-400 shadow-card">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <path d="M8 7.5L11 16M16 7.5L13 16M8 6h8" />
          </svg>
        </div>
        <p className="text-sm font-medium text-canvas-600">
          Drag a node from the palette
        </p>
        <p className="text-xs text-canvas-400 mt-1 leading-relaxed">
          Compose your fraud-detection pipeline by dragging stages onto the
          canvas and wiring them together.
        </p>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function PipelineStudioPage() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}
