import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { SqlColumn, SqlErModel, SqlRelationship, SqlTable } from './sqlErModel';
import type { StoredErEdgeLabel } from '../storage/storage';

export type ErViewMode = 'database' | 'chen';
export type ErLayoutDirection = 'LR' | 'TB';
export type ErAttributeVisibility = 'all' | 'keys' | 'none';

export interface ErDisplaySettings {
  accentColor: string;
  attributeVisibility: ErAttributeVisibility;
  fillColor: string;
  fontSize: number;
  layoutDirection: ErLayoutDirection;
  nodeScale: number;
  showCardinality: boolean;
  showComments: boolean;
  showTypes: boolean;
  strokeColor: string;
  textColor: string;
  viewMode: ErViewMode;
}

export interface ErGraphNodeMetadata {
  column?: SqlColumn;
  relationship?: SqlRelationship;
  table?: SqlTable;
}

export interface ErGraphNodeData extends Record<string, unknown> {
  columns?: SqlColumn[];
  display: ErDisplaySettings;
  kind: 'table' | 'entity' | 'attribute' | 'relationship';
  label: string;
  metadata: ErGraphNodeMetadata;
  onEdit: (target: ErEditTarget, value: string | boolean) => void;
  onLocalLabelEdit?: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: { height: number; width: number }) => void;
  selectedId: string | null;
  setCollapsed?: (tableName: string, collapsed: boolean) => void;
}

export interface ErGraphEdgeData extends Record<string, unknown> {
  cardinality?: string;
  display: ErDisplaySettings;
  labelOffset?: { x: number; y: number };
  label?: string;
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
}

export type ErGraphNode = Node<ErGraphNodeData>;
export type ErGraphEdge = Edge<ErGraphEdgeData>;

export type ErEditTarget =
  | { kind: 'table-comment'; tableName: string }
  | { kind: 'table-name'; tableName: string }
  | { columnName: string; kind: 'column-comment'; tableName: string }
  | { columnName: string; kind: 'column-name'; tableName: string }
  | { columnName: string; kind: 'column-type'; tableName: string }
  | { columnName: string; kind: 'column-primary'; tableName: string }
  | { columnName: string; kind: 'column-nullable'; tableName: string }
  | { kind: 'relationship-cardinality'; relationshipId: string }
  | { kind: 'relationship-name'; relationshipId: string };

export interface ErGraphBuildOptions {
  collapsedTables: Record<string, boolean>;
  display: ErDisplaySettings;
  localLabels: Record<string, string>;
  edgeLabels: Record<string, StoredErEdgeLabel>;
  nodeSizes: Record<string, { height: number; width: number }>;
  onEdit: (target: ErEditTarget, value: string | boolean) => void;
  onEdgeLabelChange: (edgeId: string, text: string) => void;
  onEdgeLabelOffsetChange: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
  onLocalLabelEdit: (nodeId: string, value: string) => void;
  onNodeResize: (nodeId: string, size: { height: number; width: number }) => void;
  positions: Record<string, XYPosition>;
  selectedId: string | null;
  setCollapsed: (tableName: string, collapsed: boolean) => void;
}

function edgeLabelData(id: string, fallback: string | undefined, options: ErGraphBuildOptions): Pick<ErGraphEdgeData, 'display' | 'label' | 'labelOffset' | 'onLabelChange' | 'onLabelOffsetChange'> {
  const override = options.edgeLabels[id];
  return {
    display: options.display,
    label: override?.text ?? fallback,
    labelOffset: override ? { x: override.dx, y: override.dy } : undefined,
    onLabelChange: options.onEdgeLabelChange,
    onLabelOffsetChange: (edgeId, offset, text) => options.onEdgeLabelOffsetChange(edgeId, offset, text || fallback || ''),
  };
}

function tableId(tableName: string): string {
  return `table:${tableName.toLowerCase()}`;
}

function entityId(tableName: string): string {
  return `entity:${tableName.toLowerCase()}`;
}

function columnId(tableName: string, columnName: string): string {
  return `column:${tableName.toLowerCase()}:${columnName.toLowerCase()}`;
}

function relationshipId(relationship: SqlRelationship): string {
  return `relationship:${relationship.id.toLowerCase()}`;
}

function edgeId(prefix: string, source: string, target: string): string {
  return `${prefix}:${source}->${target}`;
}

function tableLabel(table: SqlTable, showComments: boolean): string {
  return showComments && table.comment ? table.comment : table.name;
}

function columnLabel(column: SqlColumn, showComments: boolean): string {
  return showComments && column.comment ? column.comment : column.name;
}

function visibleColumns(columns: SqlColumn[], visibility: ErAttributeVisibility): SqlColumn[] {
  if (visibility === 'none') return [];
  if (visibility === 'keys') return columns.filter((column) => column.isPrimaryKey || column.isForeignKey);
  return columns;
}

function getPosition(id: string, positions: Record<string, XYPosition>, fallback: XYPosition): XYPosition {
  return positions[id] ?? fallback;
}

function nodeStyle(display: ErDisplaySettings): Record<string, string | number> {
  return {
    '--er-accent': display.accentColor,
    '--er-fill': display.fillColor,
    '--er-font-size': `${display.fontSize}px`,
    '--er-node-scale': display.nodeScale,
    '--er-stroke': display.strokeColor,
    '--er-text': display.textColor,
  };
}

function defaultNodeSize(node: ErGraphNode): { height: number; width: number } {
  const scale = Math.min(1.45, Math.max(0.72, node.data.display.nodeScale || 1));
  if (node.type === 'databaseTable') {
    const columns = node.data.columns?.length ?? 0;
    return {
      height: Math.max(96, 58 + columns * 30) * scale,
      width: 300 * scale,
    };
  }

  if (node.type === 'chenAttribute') return { height: 54 * scale, width: 178 * scale };
  if (node.type === 'chenRelationship') return { height: 82 * scale, width: 158 * scale };
  return { height: 74 * scale, width: 188 * scale };
}

function applyNodeSize(node: ErGraphNode, options: ErGraphBuildOptions): ErGraphNode {
  const size = options.nodeSizes[node.id] ?? defaultNodeSize(node);

  return {
    ...node,
    height: size.height,
    width: size.width,
    style: {
      ...node.style,
      height: size.height,
      width: size.width,
    },
  };
}

export function buildErGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  if (options.display.viewMode === 'chen') return buildChenGraph(model, options);
  return buildDatabaseGraph(model, options);
}

function buildDatabaseGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  const nodes: ErGraphNode[] = model.tables.map((table, index) => {
    const id = tableId(table.name);
    const collapsed = options.collapsedTables[table.name] ?? false;
    const columns = collapsed ? [] : visibleColumns(table.columns, options.display.attributeVisibility);

    const node: ErGraphNode = {
      data: {
        columns,
        display: options.display,
        kind: 'table',
        label: tableLabel(table, options.display.showComments),
        metadata: { table },
        onEdit: options.onEdit,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
        setCollapsed: options.setCollapsed,
      },
      id,
      position: getPosition(id, options.positions, { x: index * 320, y: 0 }),
      style: nodeStyle(options.display),
      type: 'databaseTable',
    };

    return applyNodeSize(node, options);
  });

  const edges: ErGraphEdge[] = model.relationships.map((relationship) => {
    const id = edgeId('database', tableId(relationship.fromTable), tableId(relationship.toTable));
    const label = options.display.showCardinality ? `${relationship.name} ${relationship.fromCardinality}:${relationship.toCardinality}` : relationship.name;
    return {
      data: {
        cardinality: `${relationship.fromCardinality}:${relationship.toCardinality}`,
        ...edgeLabelData(id, label, options),
      },
      id,
      label,
      source: tableId(relationship.fromTable),
      target: tableId(relationship.toTable),
      type: 'editableEr',
    };
  });

  return { edges, nodes };
}

function buildChenGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  const nodes: ErGraphNode[] = [];
  const edges: ErGraphEdge[] = [];

  model.tables.forEach((table, index) => {
    const id = entityId(table.name);
    const node: ErGraphNode = {
      data: {
        display: options.display,
        kind: 'entity',
        label: tableLabel(table, options.display.showComments),
        metadata: { table },
        onEdit: options.onEdit,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
      },
      id,
      position: getPosition(id, options.positions, { x: index * 360, y: 0 }),
      style: nodeStyle(options.display),
      type: 'chenEntity',
    };
    nodes.push(applyNodeSize(node, options));

    visibleColumns(table.columns, options.display.attributeVisibility).forEach((column, columnIndex) => {
      const attributeId = columnId(table.name, column.name);
      const node: ErGraphNode = {
        data: {
          display: options.display,
          kind: 'attribute',
          label: columnLabel(column, options.display.showComments),
          metadata: { column, table },
          onEdit: options.onEdit,
          onNodeResize: options.onNodeResize,
          selectedId: options.selectedId,
        },
        id: attributeId,
        position: getPosition(attributeId, options.positions, { x: index * 360, y: 110 + columnIndex * 70 }),
        style: nodeStyle(options.display),
        type: 'chenAttribute',
      };
      nodes.push(applyNodeSize(node, options));
      edges.push({
        id: edgeId('attribute', id, attributeId),
        source: id,
        target: attributeId,
        type: 'straight',
      });
    });
  });

  model.relationships.forEach((relationship, index) => {
    const id = relationshipId(relationship);
    const node: ErGraphNode = {
      data: {
        display: options.display,
        kind: 'relationship',
        label: options.localLabels[id] ?? relationship.name,
        metadata: { relationship },
        onEdit: options.onEdit,
        onLocalLabelEdit: options.onLocalLabelEdit,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
      },
      id,
      position: getPosition(id, options.positions, { x: index * 360 + 180, y: 220 }),
      style: nodeStyle(options.display),
      type: 'chenRelationship',
    };
    nodes.push(applyNodeSize(node, options));

    const fromEdgeId = edgeId('relationship-from', entityId(relationship.fromTable), id);
    const toEdgeId = edgeId('relationship-to', id, entityId(relationship.toTable));
    edges.push({
      data: {
        cardinality: relationship.fromCardinality,
        ...edgeLabelData(fromEdgeId, options.display.showCardinality ? relationship.fromCardinality : undefined, options),
      },
      id: fromEdgeId,
      label: options.display.showCardinality ? relationship.fromCardinality : undefined,
      source: entityId(relationship.fromTable),
      target: id,
      type: 'editableEr',
    });
    edges.push({
      data: {
        cardinality: relationship.toCardinality,
        ...edgeLabelData(toEdgeId, options.display.showCardinality ? relationship.toCardinality : undefined, options),
      },
      id: toEdgeId,
      label: options.display.showCardinality ? relationship.toCardinality : undefined,
      source: id,
      target: entityId(relationship.toTable),
      type: 'editableEr',
    });
  });

  return { edges, nodes };
}

export function getNodeSize(node: ErGraphNode): { height: number; width: number } {
  if (typeof node.width === 'number' && typeof node.height === 'number') return { height: node.height, width: node.width };
  if (typeof node.style?.width === 'number' && typeof node.style?.height === 'number') return { height: node.style.height, width: node.style.width };
  return defaultNodeSize(node);
}
