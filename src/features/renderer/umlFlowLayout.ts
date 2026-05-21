import type { Node, XYPosition } from '@xyflow/react';
import type { UmlGraphEdge, UmlGraphNode, UmlLayoutDirection } from './umlFlowModel';

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

export interface UmlLayoutOptions {
  direction: UmlLayoutDirection;
  edgeNodeBetweenLayers?: number;
  edgeRouting?: 'ORTHOGONAL' | 'POLYLINE';
  nodeNodeBetweenLayers?: number;
  spacingComponentComponent?: number;
  spacingEdgeEdge?: number;
  spacingNodeNode?: number;
}

let elkPromise: Promise<ElkInstance> | null = null;

function loadElk(): Promise<ElkInstance> {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then((module) => new module.default() as ElkInstance);
  return elkPromise;
}

export async function layoutUmlGraph(
  nodes: Array<UmlGraphNode & { width?: number; height?: number }>,
  edges: UmlGraphEdge[],
  options: UmlLayoutOptions,
): Promise<Record<string, XYPosition>> {
  const elk = await loadElk();
  const graph = {
    children: nodes.map((node) => ({
      height: node.height ?? (Number(node.style?.height) || 72),
      id: node.id,
      width: node.width ?? (Number(node.style?.width) || 180),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
    id: 'pixelgraph-uml',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction === 'LR' ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': options.edgeRouting ?? 'ORTHOGONAL',
      'elk.layered.spacing.edgeNodeBetweenLayers': String(options.edgeNodeBetweenLayers ?? 48),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.nodeNodeBetweenLayers ?? 72),
      'elk.spacing.componentComponent': String(options.spacingComponentComponent ?? 48),
      'elk.spacing.edgeEdge': String(options.spacingEdgeEdge ?? 24),
      'elk.spacing.nodeNode': String(options.spacingNodeNode ?? 42),
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

export function applyUmlPositions<TNode extends Node>(nodes: TNode[], positions: Record<string, XYPosition>): TNode[] {
  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));
}
