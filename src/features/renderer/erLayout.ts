import type { Node, XYPosition } from '@xyflow/react';
import { getNodeSize, type ErGraphEdge, type ErGraphNode, type ErLayoutDirection } from './erGraphModel';

type ElkLayoutResult = {
  children?: Array<{
    id: string;
    x?: number;
    y?: number;
  }>;
};

type ElkInstance = {
  layout: (graph: unknown) => Promise<ElkLayoutResult>;
};

let elkPromise: Promise<ElkInstance> | null = null;

function loadElk(): Promise<ElkInstance> {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then((module) => new module.default() as ElkInstance);
  return elkPromise;
}

export async function layoutErGraph(nodes: ErGraphNode[], edges: ErGraphEdge[], direction: ErLayoutDirection): Promise<Record<string, XYPosition>> {
  const elk = await loadElk();
  const graph = {
    children: nodes.map((node) => {
      const size = getNodeSize(node);
      return {
        height: size.height,
        id: node.id,
        width: size.width,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
    id: 'pixelgraph-er',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.edgeNodeBetweenLayers': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
      'elk.spacing.edgeEdge': '24',
      'elk.spacing.nodeNode': '42',
    },
  };

  const result = await elk.layout(graph);
  return Object.fromEntries(
    (result.children ?? []).map((child) => [
      child.id,
      {
        x: child.x ?? 0,
        y: child.y ?? 0,
      },
    ]),
  );
}

export function applyPositions<TNode extends Node>(nodes: TNode[], positions: Record<string, XYPosition>): TNode[] {
  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));
}
