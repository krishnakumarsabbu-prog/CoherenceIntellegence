import { useMemo } from "react";
import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import LiveNode from "./LiveNode";
import type { NodeProgress } from "../executionStore";
import type { PipelineEdge, PipelineNode } from "../../pipelineStudio/types";

const nodeTypes = { pipeline: LiveNode };

interface Props {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  progress: NodeProgress[];
  onNodeClick?: (nodeId: string) => void;
}

function Graph({ nodes, edges, progress, onNodeClick }: Props) {
  const statusById = useMemo(() => {
    const m = new Map<string, NodeProgress["status"]>();
    for (const p of progress) m.set(p.id, p.status);
    return m;
  }, [progress]);

  const rfNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        type: "pipeline",
        data: { ...n.data, status: statusById.get(n.id) ?? "pending" },
        draggable: false,
        connectable: false,
        selectable: true,
      })),
    [nodes, statusById],
  );

  if (nodes.length === 0) {
    return (
      <div className="grid place-items-center h-full text-center text-slate-400 text-sm">
        Select a pipeline on the left and click Run to view the live execution flow.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      onNodeClick={(_, node) => onNodeClick?.(node.id)}
      panOnDrag
      zoomOnScroll
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        type: "smoothstep",
        style: { stroke: "#94A3B8", strokeWidth: 2.2 },
        animated: true,
      }}
      className="bg-[#F8FAFC] cursor-pointer"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#CBD5E1" />
      <Controls showInteractive={false} className="!bg-white !border-slate-200 !text-slate-700 !rounded-xl !shadow-sm" />
    </ReactFlow>
  );
}

export default function LivePipelineGraph({ nodes, edges, progress, onNodeClick }: Props) {
  return (
    <ReactFlowProvider>
      <Graph nodes={nodes} edges={edges} progress={progress} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  );
}
