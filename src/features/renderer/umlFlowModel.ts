import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { StoredUmlEdgeLabel } from '../storage/storage';

export type UmlLayoutDirection = 'LR' | 'TB';

export interface UmlDisplaySettingsBase {
  accentColor: string;
  fillColor: string;
  fontSize: number;
  layoutDirection: UmlLayoutDirection;
  nodeScale: number;
  strokeColor: string;
  textColor: string;
}

export interface UmlNodeResize {
  height: number;
  width: number;
}

export interface UmlGraphNodeData extends Record<string, unknown> {
  display: UmlDisplaySettingsBase;
  kind: string;
  label: string;
  onLocalLabelEdit?: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: UmlNodeResize) => void;
  selectedId: string | null;
}

export interface UmlGraphEdgeData extends Record<string, unknown> {
  display: UmlDisplaySettingsBase;
  label?: string;
  labelOffset?: { x: number; y: number };
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
}

export type UmlGraphNode<TData extends UmlGraphNodeData = UmlGraphNodeData> = Node<TData>;
export type UmlGraphEdge<TData extends UmlGraphEdgeData = UmlGraphEdgeData> = Edge<TData>;

export function buildHashScope(diagramType: string, source: string, subview = 'default'): string {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `${diagramType}:${subview}:${hash.toString(36)}`;
}

export function getScopedPosition<TPosition extends XYPosition>(
  id: string,
  positions: Record<string, TPosition>,
  fallback: TPosition,
): TPosition {
  return positions[id] ?? fallback;
}

export function umlNodeStyle(display: UmlDisplaySettingsBase): Record<string, string | number> {
  return {
    '--er-accent': display.accentColor,
    '--er-fill': display.fillColor,
    '--er-font-size': `${display.fontSize}px`,
    '--er-node-scale': display.nodeScale,
    '--er-stroke': display.strokeColor,
    '--er-text': display.textColor,
  };
}

export function edgeLabelData<TDisplay extends UmlDisplaySettingsBase>(
  id: string,
  fallback: string | undefined,
  display: TDisplay,
  edgeLabels: Record<string, StoredUmlEdgeLabel>,
  onEdgeLabelChange: (edgeId: string, text: string) => void,
  onEdgeLabelOffsetChange: (edgeId: string, offset: { x: number; y: number }, text: string) => void,
): {
  display: TDisplay;
  label?: string;
  labelOffset?: { x: number; y: number };
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
} {
  const override = edgeLabels[id];
  return {
    display,
    label: override?.text ?? fallback,
    labelOffset: override ? { x: override.dx, y: override.dy } : undefined,
    onLabelChange: onEdgeLabelChange,
    onLabelOffsetChange: (edgeId, offset, text) => onEdgeLabelOffsetChange(edgeId, offset, text || fallback || ''),
  };
}
