import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, XYPosition } from '@xyflow/react';
import { getNodeSize, type ErGraphEdge, type ErGraphNode, type ErLayoutDirection } from './erGraphModel';

const elk = new ELK();

export async function layoutErGraph(nodes: ErGraphNode[], edges: ErGraphEdge[], direction: ErLayoutDirection): Promise<Record<string, XYPosition>> {
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
