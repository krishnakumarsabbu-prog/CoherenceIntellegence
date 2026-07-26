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
}

function Graph({ nodes, edges, progress }: Props) {
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
        selectable: false,
      })),
    [nodes, statusById],
  );

  if (nodes.length === 0) {
    return (
      <div className="grid place-items-center h-full text-center text-canvas-400 text-sm">
        Select a pipeline on the left and click Run to view the live graph.
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
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "#A9B0BD", strokeWidth: 1.6 } }}
      className="bg-canvas-50"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="#D3D8E0" />
      <Controls showInteractive={false} className="!shadow-card !rounded-md !border !border-canvas-200" />
    </ReactFlow>
  );
}

export default function LivePipelineGraph({ nodes, edges, progress }: Props) {
  return (
    <ReactFlowProvider>
      <Graph nodes={nodes} edges={edges} progress={progress} />
    </ReactFlowProvider>
  );
}
