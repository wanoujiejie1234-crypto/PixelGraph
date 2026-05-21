import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { SqlColumn, SqlErModel, SqlRelationship, SqlTable } from './sqlErModel';
import type { StoredErEdgeLabel } from '../storage/storage';
import { chenFromEdgeId, chenToEdgeId, columnNodeId, databaseEdgeId, entityNodeId, relationshipNodeId, tableNodeId } from './erIds';

export type ErViewMode = 'database' | 'chen' | 'crowfoot';
export type ErLayoutDirection = 'LR' | 'TB';
export type ErAttributeVisibility = 'all' | 'keys' | 'none';

export interface ErDisplaySettings {
  accentColor: string;
  attributeVisibility: ErAttributeVisibility;
  fillColor: string;
  fontSize: number;
  layoutDirection: ErLayoutDirection;
  nodeScale: number;
  notationStyle: 'database' | 'chen' | 'crowfoot';
  showConstraints: boolean;
  showCardinality: boolean;
  showComments: boolean;
  showRelationshipRoles: boolean;
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

export interface ErTableColumnView extends SqlColumn {
  diagnosticLevel?: 'warning' | 'error';
}

export interface ErGraphNodeData extends Record<string, unknown> {
  columns?: ErTableColumnView[];
  diagnosticLevel?: 'warning' | 'error';
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
  diagnosticLevel?: 'warning' | 'error';
  relationshipKind?: SqlRelationship['relationshipKind'];
  roleFrom?: string;
  roleTo?: string;
  constraintText?: string;
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
  diagnosticEdgeStates?: Record<string, 'warning' | 'error'>;
  diagnosticNodeStates?: Record<string, 'warning' | 'error'>;
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

function estimatedTextWidth(value: string, fontSize: number): number {
  const units = Array.from(value).reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 1 : 0.56), 0);
  return units * fontSize;
}

function relationshipContentWidth(node: ErGraphNode): number {
  const fontSize = Number(node.data.display.fontSize) || 15;
  const label = String(node.data.label ?? '');
  return Math.max(176, Math.min(300, estimatedTextWidth(label, Math.max(10, fontSize - 2)) + 64));
}

function tableContentWidth(node: ErGraphNode): number {
  const fontSize = Number(node.data.display.fontSize) || 15;
  const titleWidth = estimatedTextWidth(String(node.data.label ?? ''), fontSize) + 84;
  const nameWidth =
    node.data.display.showComments && node.data.metadata.table?.name
      ? estimatedTextWidth(node.data.metadata.table.name, Math.max(11, fontSize - 2)) + 24
      : 0;
  const columnWidth = (node.data.columns ?? []).reduce((maxWidth, column) => {
    const badgeWidth = column.isPrimaryKey || column.isForeignKey ? 40 : 18;
    const label = node.data.display.showComments && column.comment ? column.comment : column.name;
    const labelWidth = estimatedTextWidth(label, Math.max(11, fontSize - 3));
    const typeWidth = node.data.display.showTypes ? Math.max(70, estimatedTextWidth(column.dataType, Math.max(10, fontSize - 4)) + 14) : 0;
    return Math.max(maxWidth, badgeWidth + labelWidth + typeWidth + 36);
  }, 0);
  const emptyWidth = node.data.columns?.length ? 0 : 160;
  return Math.max(titleWidth, nameWidth, columnWidth, emptyWidth);
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
    const headerRows = 2 + (node.data.display.showComments && node.data.metadata.table?.name ? 1 : 0);
    return {
      height: Math.max(128, 18 + headerRows * 20 + columns * 30) * scale,
      width: Math.max(300, tableContentWidth(node)) * scale,
    };
  }

  if (node.type === 'chenAttribute') return { height: 54 * scale, width: 178 * scale };
  if (node.type === 'chenRelationship') return { height: 104 * scale, width: relationshipContentWidth(node) * scale };
  return { height: 74 * scale, width: 188 * scale };
}

function applyNodeSize(node: ErGraphNode, options: ErGraphBuildOptions): ErGraphNode {
  const defaultSize = defaultNodeSize(node);
  const stored = options.nodeSizes[node.id];
  const size =
    stored == null
      ? defaultSize
      : {
          height: Math.max(stored.height, defaultSize.height),
          width: Math.max(stored.width, defaultSize.width),
        };

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
  if (options.display.viewMode === 'crowfoot') return buildCrowFootGraph(model, options);
  return buildDatabaseGraph(model, options);
}

function buildDatabaseGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  const nodes: ErGraphNode[] = model.tables.map((table, index) => {
    const id = tableNodeId(table.name);
    const collapsed = options.collapsedTables[table.name] ?? false;
    const columns = collapsed
      ? []
      : visibleColumns(table.columns, options.display.attributeVisibility).map((column) => ({
          ...column,
          diagnosticLevel: options.diagnosticNodeStates?.[columnNodeId(table.name, column.name)],
        }));

    const node: ErGraphNode = {
      data: {
        columns,
        diagnosticLevel: options.diagnosticNodeStates?.[id],
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
    const id = databaseEdgeId(relationship.fromTable, relationship.toTable);
    const label = options.display.showCardinality ? `${relationship.name} ${relationship.fromCardinality}:${relationship.toCardinality}` : relationship.name;
    return {
      data: {
        cardinality: `${relationship.fromCardinality}:${relationship.toCardinality}`,
        constraintText: relationship.constraintText,
        diagnosticLevel: options.diagnosticEdgeStates?.[id],
        ...edgeLabelData(id, label, options),
        relationshipKind: relationship.relationshipKind,
        roleFrom: relationship.roleFrom,
        roleTo: relationship.roleTo,
      },
      id,
      label,
      source: tableNodeId(relationship.fromTable),
      target: tableNodeId(relationship.toTable),
      type: 'editableEr',
    };
  });

  return { edges, nodes };
}

function buildChenGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  const nodes: ErGraphNode[] = [];
  const edges: ErGraphEdge[] = [];

  model.tables.forEach((table, index) => {
    const id = entityNodeId(table.name);
    const node: ErGraphNode = {
      data: {
        display: options.display,
        diagnosticLevel: options.diagnosticNodeStates?.[id],
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
      const attributeId = columnNodeId(table.name, column.name);
      const node: ErGraphNode = {
        data: {
          display: options.display,
          diagnosticLevel: options.diagnosticNodeStates?.[attributeId],
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
        id: `attribute:${id}->${attributeId}`,
        source: id,
        target: attributeId,
        type: 'straight',
      });
    });
  });

  model.relationships.forEach((relationship, index) => {
    const id = relationshipNodeId(relationship);
    const node: ErGraphNode = {
      data: {
        display: options.display,
        diagnosticLevel: options.diagnosticNodeStates?.[id],
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

    const fromEdgeId = chenFromEdgeId(relationship);
    const toEdgeId = chenToEdgeId(relationship);
    edges.push({
      data: {
        cardinality: relationship.fromCardinality,
        constraintText: relationship.constraintText,
        diagnosticLevel: options.diagnosticEdgeStates?.[fromEdgeId],
        ...edgeLabelData(fromEdgeId, options.display.showCardinality ? relationship.fromCardinality : undefined, options),
        relationshipKind: relationship.relationshipKind,
        roleFrom: relationship.roleFrom,
        roleTo: relationship.roleTo,
      },
      id: fromEdgeId,
      label: options.display.showCardinality ? relationship.fromCardinality : undefined,
      source: entityNodeId(relationship.fromTable),
      target: id,
      type: 'editableEr',
    });
    edges.push({
      data: {
        cardinality: relationship.toCardinality,
        constraintText: relationship.constraintText,
        diagnosticLevel: options.diagnosticEdgeStates?.[toEdgeId],
        ...edgeLabelData(toEdgeId, options.display.showCardinality ? relationship.toCardinality : undefined, options),
        relationshipKind: relationship.relationshipKind,
        roleFrom: relationship.roleFrom,
        roleTo: relationship.roleTo,
      },
      id: toEdgeId,
      label: options.display.showCardinality ? relationship.toCardinality : undefined,
      source: id,
      target: entityNodeId(relationship.toTable),
      type: 'editableEr',
    });
  });

  return { edges, nodes };
}

function buildCrowFootGraph(model: SqlErModel, options: ErGraphBuildOptions): { edges: ErGraphEdge[]; nodes: ErGraphNode[] } {
  const graph = buildDatabaseGraph(model, options);
  return {
    edges: graph.edges.map((edge, index) => {
      const relationship = model.relationships[index];
      return {
        ...edge,
        data: {
          ...(edge.data ?? { display: options.display }),
          display: edge.data?.display ?? options.display,
          label: relationship?.name ?? edge.data?.label,
        },
        label: relationship?.name ?? edge.label,
        type: 'crowFootEr',
      };
    }),
    nodes: graph.nodes,
  };
}

export function getNodeSize(node: ErGraphNode): { height: number; width: number } {
  if (typeof node.width === 'number' && typeof node.height === 'number') return { height: node.height, width: node.width };
  if (typeof node.style?.width === 'number' && typeof node.style?.height === 'number') return { height: node.style.height, width: node.style.width };
  return defaultNodeSize(node);
}
