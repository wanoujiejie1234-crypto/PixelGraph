import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Messages } from '../i18n/messages';
import { CanvasEmptyState } from './CanvasEmptyState';
import {
  readStoredErEdgeLabels,
  readStoredErLocalLabels,
  readStoredErNodePositions,
  readStoredErNodeSizes,
  writeStoredErEdgeLabels,
  writeStoredErLocalLabels,
  writeStoredErNodePositions,
  writeStoredErNodeSizes,
  type StoredErEdgeLabel,
} from '../storage/storage';
import { CrowFootErEdge, EditableErEdge } from './ErFlowEdges';
import { ChenAttributeNode, ChenEntityNode, ChenRelationshipNode, DatabaseTableNode } from './ErFlowNodes';
import { applyPositions, layoutErGraph } from './erLayout';
import { exportErGraphToSvg } from './erSvgExport';
import {
  buildErGraph,
  type ErAttributeVisibility,
  type ErDisplaySettings,
  type ErEditTarget,
  type ErGraphEdge,
  type ErGraphNode,
  type ErViewMode,
} from './erGraphModel';
import type { DiagramDiagnostic } from './diagnostics';
import { chenFromEdgeId, chenToEdgeId, columnNodeId, databaseEdgeId, entityNodeId, relationshipNodeId, relationshipTargetId, tableNodeId } from './erIds';
import { modelToSql, parseSqlErModel, validateSqlErSource, type SqlColumn, type SqlErModel, type SqlRelationship, type SqlTable } from './sqlErModel';

export type { ErDisplaySettings, ErViewMode };

interface Props {
  displaySettings: ErDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  themeMode?: 'light' | 'dark';
  onDiagnosticsChange?: (diagnostics: DiagramDiagnostic[]) => void;
  onDisplaySettingsChange: (settings: ErDisplaySettings) => void;
  onErrorChange: (error: string | null) => void;
  onExportSvgReady: (svg: string) => void;
  onSourceChange: (source: string) => void;
}

const nodeTypes = {
  chenAttribute: ChenAttributeNode,
  chenEntity: ChenEntityNode,
  chenRelationship: ChenRelationshipNode,
  databaseTable: DatabaseTableNode,
};

const edgeTypes = {
  crowFootEr: CrowFootErEdge,
  editableEr: EditableErEdge,
};

const emptyModel: SqlErModel = {
  relationships: [],
  tables: [],
};

export const defaultErDisplaySettings: ErDisplaySettings = {
  accentColor: '#507c69',
  attributeVisibility: 'keys',
  fillColor: '#ffffff',
  fontSize: 15,
  layoutDirection: 'LR',
  nodeScale: 1,
  notationStyle: 'database',
  showConstraints: true,
  showCardinality: true,
  showComments: true,
  showRelationshipRoles: true,
  showTypes: true,
  strokeColor: '#171817',
  textColor: '#171817',
  viewMode: 'database',
};

function getRelationshipId(relationship: SqlRelationship): string {
  return relationship.id.toLowerCase();
}

function updateTable(model: SqlErModel, tableName: string, updater: (table: SqlTable) => SqlTable): SqlErModel {
  return {
    ...model,
    tables: model.tables.map((table) => (table.name === tableName ? updater(table) : table)),
  };
}

function renameTable(model: SqlErModel, tableName: string, nextName: string): SqlErModel {
  const trimmed = nextName.trim();
  if (!trimmed || trimmed === tableName) return model;

  return {
    tables: model.tables.map((table) => {
      const renamedTable = table.name === tableName ? { ...table, name: trimmed } : table;
      return {
        ...renamedTable,
        columns: renamedTable.columns.map((column) =>
          column.references?.table === tableName
            ? {
                ...column,
                references: { ...column.references, table: trimmed },
              }
            : column,
        ),
      };
    }),
    relationships: model.relationships.map((relationship) => ({
      ...relationship,
      fromTable: relationship.fromTable === tableName ? trimmed : relationship.fromTable,
      toTable: relationship.toTable === tableName ? trimmed : relationship.toTable,
    })),
  };
}

function renameColumn(model: SqlErModel, tableName: string, columnName: string, nextName: string): SqlErModel {
  const trimmed = nextName.trim();
  if (!trimmed || trimmed === columnName) return model;

  return {
    tables: model.tables.map((table) => ({
      ...table,
      columns: table.columns.map((column) => {
        if (table.name === tableName && column.name === columnName) return { ...column, name: trimmed };
        if (column.references?.table === tableName && column.references.column === columnName) {
          return {
            ...column,
            references: { ...column.references, column: trimmed },
          };
        }
        return column;
      }),
    })),
    relationships: model.relationships.map((relationship) => ({
      ...relationship,
      fromColumn: relationship.fromTable === tableName && relationship.fromColumn === columnName ? trimmed : relationship.fromColumn,
      toColumn: relationship.toTable === tableName && relationship.toColumn === columnName ? trimmed : relationship.toColumn,
    })),
  };
}

function updateColumn(model: SqlErModel, tableName: string, columnName: string, updater: (column: SqlColumn) => SqlColumn): SqlErModel {
  return updateTable(model, tableName, (table) => ({
    ...table,
    columns: table.columns.map((column) => (column.name === columnName ? updater(column) : column)),
  }));
}

function updateRelationship(model: SqlErModel, relationshipId: string, updater: (relationship: SqlRelationship) => SqlRelationship): SqlErModel {
  return {
    ...model,
    relationships: model.relationships.map((relationship) => (getRelationshipId(relationship) === relationshipId ? updater(relationship) : relationship)),
  };
}

function applyEdit(model: SqlErModel, target: ErEditTarget, value: string | boolean): SqlErModel {
  if (target.kind === 'table-comment') return updateTable(model, target.tableName, (table) => ({ ...table, comment: String(value) }));
  if (target.kind === 'table-name') return renameTable(model, target.tableName, String(value));
  if (target.kind === 'column-comment') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, comment: String(value) }));
  if (target.kind === 'column-name') return renameColumn(model, target.tableName, target.columnName, String(value));
  if (target.kind === 'column-type') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, dataType: String(value) || 'TEXT' }));
  if (target.kind === 'column-primary') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, isPrimaryKey: Boolean(value) }));
  if (target.kind === 'column-nullable') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, isNullable: Boolean(value) }));
  if (target.kind === 'relationship-name') return updateRelationship(model, target.relationshipId, (relationship) => ({ ...relationship, name: String(value) }));
  if (target.kind === 'relationship-cardinality') {
    const [fromCardinality = '1', toCardinality = 'N'] = String(value).split(':');
    return updateRelationship(model, target.relationshipId, (relationship) => ({ ...relationship, fromCardinality, toCardinality }));
  }
  return model;
}

function getModelSignature(model: SqlErModel, display: ErDisplaySettings): string {
  return JSON.stringify({
    attributeVisibility: display.attributeVisibility,
    accentColor: display.accentColor,
    fillColor: display.fillColor,
    fontSize: display.fontSize,
    layoutDirection: display.layoutDirection,
    nodeScale: display.nodeScale,
    showCardinality: display.showCardinality,
    showComments: display.showComments,
    showTypes: display.showTypes,
    strokeColor: display.strokeColor,
    textColor: display.textColor,
    tables: model.tables.map((table) => ({
      columns: table.columns.map((column) => [column.name, column.comment, column.dataType, column.isPrimaryKey, column.isForeignKey]),
      name: table.name,
    })),
    viewMode: display.viewMode,
  });
}

function getPositionScope(source: string, display: ErDisplaySettings): string {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `${display.viewMode}:${hash.toString(36)}`;
}

function safeValidateSqlErSource(source: string): ReturnType<typeof validateSqlErSource> {
  try {
    return validateSqlErSource(source);
  } catch (error) {
    return {
      diagnostics: [
        {
          code: 'sql-er-validation-failed',
          level: 'error',
          message: error instanceof Error ? `SQL ER ?????${error.message}` : 'SQL ER ?????????????',
        },
      ],
      hasFatalError: true,
    };
  }
}

function safeParseSqlErModel(source: string): SqlErModel {
  try {
    return parseSqlErModel(source);
  } catch {
    return emptyModel;
  }
}

function InnerSqlErCanvas({
  displaySettings,
  fitRequest,
  resetRequest,
  source,
  text,
  themeMode = 'light',
  onDiagnosticsChange,
  onDisplaySettingsChange,
  onErrorChange,
  onExportSvgReady,
  onSourceChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<ErGraphNode, ErGraphEdge> | null>(null);
  const [nodes, setNodes] = useState<ErGraphNode[]>([]);
  const [edges, setEdges] = useState<ErGraphEdge[]>([]);
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});
  const positionScope = useMemo(() => getPositionScope(source, displaySettings), [displaySettings, source]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredErNodePositions(positionScope));
  const [nodeSizes, setNodeSizes] = useState<Record<string, { height: number; width: number }>>(() => readStoredErNodeSizes(positionScope));
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(() => readStoredErLocalLabels(positionScope));
  const [edgeLabels, setEdgeLabels] = useState<Record<string, StoredErEdgeLabel>>(() => readStoredErEdgeLabels(positionScope));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const isBlankSource = source.trim().length === 0;
  const validation = useMemo(() => (isBlankSource ? { diagnostics: [], hasFatalError: false } : safeValidateSqlErSource(source)), [isBlankSource, source]);
  const validationMessage = useMemo(() => validation.diagnostics.map((item) => item.message).join('\n'), [validation.diagnostics]);
  const model = useMemo(
    () => (validation.hasFatalError ? emptyModel : safeParseSqlErModel(source)),
    [source, validation.hasFatalError],
  );
  const modelSignature = useMemo(() => getModelSignature(model, displaySettings), [model, displaySettings]);
  const collapsedSignature = useMemo(() => JSON.stringify(collapsedTables), [collapsedTables]);
  const hasRelationshipRoles = useMemo(() => model.relationships.some((relationship) => relationship.roleFrom || relationship.roleTo), [model.relationships]);
  const hasRelationshipConstraints = useMemo(() => model.relationships.some((relationship) => relationship.constraintText), [model.relationships]);

  const diagnosticMaps = useMemo(() => {
    const nodeStates: Record<string, 'warning' | 'error'> = {};
    const edgeStates: Record<string, 'warning' | 'error'> = {};

    const elevate = (current: 'warning' | 'error' | undefined, next: 'warning' | 'error'): 'warning' | 'error' =>
      current === 'error' || next === 'error' ? 'error' : 'warning';

    validation.diagnostics.forEach((item) => {
      if (!item.targetId || !item.targetKind) return;

      if (item.targetKind === 'table' || item.targetKind === 'column') {
        nodeStates[item.targetId] = elevate(nodeStates[item.targetId], item.level);
        if (item.targetKind === 'table' && item.targetId.startsWith('table:')) {
          const tableName = item.targetId.slice('table:'.length);
          nodeStates[entityNodeId(tableName)] = elevate(nodeStates[entityNodeId(tableName)], item.level);
        }
        if (item.targetKind === 'column' && item.targetId.startsWith('column:')) {
          const [, tableName, columnName] = item.targetId.split(':');
          if (tableName && columnName) {
            const normalizedColumnId = columnNodeId(tableName, columnName);
            nodeStates[normalizedColumnId] = elevate(nodeStates[normalizedColumnId], item.level);
          }
        }
        return;
      }

      if (item.targetKind === 'relationship') {
        const value = item.targetId;
        const relationship = model.relationships.find((entry) => relationshipTargetId(entry.fromTable, entry.toTable) === value);
        if (!relationship) return;
        const nodeId = relationshipNodeId(relationship);
        nodeStates[nodeId] = elevate(nodeStates[nodeId], item.level);
        edgeStates[databaseEdgeId(relationship.fromTable, relationship.toTable)] = elevate(edgeStates[databaseEdgeId(relationship.fromTable, relationship.toTable)], item.level);
        edgeStates[chenFromEdgeId(relationship)] = elevate(edgeStates[chenFromEdgeId(relationship)], item.level);
        edgeStates[chenToEdgeId(relationship)] = elevate(edgeStates[chenToEdgeId(relationship)], item.level);
      }
    });

    model.tables.forEach((table) => {
      const tableId = tableNodeId(table.name);
      const entityId = entityNodeId(table.name);
      if (nodeStates[tableId]) nodeStates[entityId] = elevate(nodeStates[entityId], nodeStates[tableId]);
    });

    return { edgeStates, nodeStates };
  }, [model.relationships, model.tables, validation.diagnostics]);

  const commitDisplay = useCallback(
    (next: Partial<ErDisplaySettings>) => {
      onDisplaySettingsChange({ ...displaySettings, ...next });
    },
    [displaySettings, onDisplaySettingsChange],
  );

  const commitModel = useCallback(
    (target: ErEditTarget, value: string | boolean) => {
      onSourceChange(modelToSql(applyEdit(model, target, value)));
    },
    [model, onSourceChange],
  );

  const graph = useMemo(() => {
    try {
      return buildErGraph(model, {
        collapsedTables,
        diagnosticEdgeStates: diagnosticMaps.edgeStates,
        diagnosticNodeStates: diagnosticMaps.nodeStates,
        display: displaySettings,
        edgeLabels,
        localLabels,
        nodeSizes,
        onEdit: commitModel,
        onEdgeLabelChange: (edgeId, value) => setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: labels[edgeId]?.dx ?? 0, dy: labels[edgeId]?.dy ?? 0, text: value } })),
        onEdgeLabelOffsetChange: (edgeId, offset, textValue) => setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: offset.x, dy: offset.y, text: labels[edgeId]?.text ?? textValue } })),
        onLocalLabelEdit: (nodeId, value) => setLocalLabels((labels) => ({ ...labels, [nodeId]: value })),
        onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
        positions,
        selectedId,
        setCollapsed: (tableName, collapsed) => setCollapsedTables((value) => ({ ...value, [tableName]: collapsed })),
      });
    } catch {
      onErrorChange('ER 图模型构建失败，请检查表名、字段名和外键关系。');
      return { edges: [], nodes: [] };
    }
  }, [collapsedTables, commitModel, diagnosticMaps.edgeStates, diagnosticMaps.nodeStates, displaySettings, edgeLabels, localLabels, model, nodeSizes, onErrorChange, positions, selectedId]);

  useEffect(() => {
    onDiagnosticsChange?.(
      validation.diagnostics.map((item) => ({
        code: item.code,
        level: item.level,
        message: item.message,
        sourceRange: item.sourceRange,
        targetId: item.targetId,
        targetKind: item.targetKind,
      })),
    );
  }, [onDiagnosticsChange, validation.diagnostics]);

  useEffect(() => {
    if (validation.hasFatalError) {
      onErrorChange(validationMessage || text.noTable);
      return;
    }
    onErrorChange(model.tables.length === 0 ? text.noTable : null);
  }, [model.tables.length, onErrorChange, text.noTable, validation.hasFatalError, validationMessage]);

  useEffect(() => {
    if (validation.hasFatalError || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    let cancelled = false;
    void layoutErGraph(graph.nodes, graph.edges, displaySettings.layoutDirection)
      .then((layout) => {
        if (cancelled) return;
        const merged = Object.fromEntries(Object.entries(layout).map(([id, position]) => [id, positions[id] ?? position]));
        setNodes(applyPositions(graph.nodes, merged));
        setEdges(graph.edges);
        setPositions((previous) => ({ ...merged, ...previous }));
      })
      .catch(() => {
        if (!cancelled) onErrorChange('ER 自动排版失败，请检查表关系是否形成了异常结构，或点击自动排版重试。');
      });
    return () => {
      cancelled = true;
    };
  }, [collapsedSignature, displaySettings.layoutDirection, layoutRevision, modelSignature, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    setNodes((current) =>
      current.map((node) => {
        const next = graph.nodes.find((item) => item.id === node.id);
        return next ? { ...node, data: next.data, style: next.style } : node;
      }),
    );
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, validation.hasFatalError]);

  useEffect(() => {
    setPositions(readStoredErNodePositions(positionScope));
    setNodeSizes(readStoredErNodeSizes(positionScope));
    setLocalLabels(readStoredErLocalLabels(positionScope));
    setEdgeLabels(readStoredErEdgeLabels(positionScope));
  }, [positionScope]);

  useEffect(() => {
    writeStoredErNodePositions(positionScope, positions);
  }, [positionScope, positions]);

  useEffect(() => {
    writeStoredErNodeSizes(positionScope, nodeSizes);
  }, [nodeSizes, positionScope]);

  useEffect(() => {
    writeStoredErLocalLabels(positionScope, localLabels);
  }, [localLabels, positionScope]);

  useEffect(() => {
    writeStoredErEdgeLabels(positionScope, edgeLabels);
  }, [edgeLabels, positionScope]);

  useEffect(() => {
    if (validation.hasFatalError || nodes.length === 0) {
      onExportSvgReady('');
      return;
    }
    onExportSvgReady(exportErGraphToSvg(nodes, edges, { transparent: false }));
  }, [edges, nodes, onExportSvgReady, validation.hasFatalError]);

  useEffect(() => {
    if (fitRequest === 0) return;
    window.setTimeout(() => flowRef.current?.fitView({ duration: 260, padding: 0.14 }), 0);
  }, [fitRequest]);

  useEffect(() => {
    if (resetRequest === 0) return;
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
  }, [resetRequest]);

  const onNodesChange = useCallback((changes: NodeChange<ErGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    const positionChanges = changes.filter((change): change is NodeChange<ErGraphNode> & { id: string; position: XYPosition } => change.type === 'position' && Boolean(change.position));
    if (positionChanges.length > 0) {
      setPositions((current) => ({
        ...current,
        ...Object.fromEntries(positionChanges.map((change) => [change.id, change.position])),
      }));
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<ErGraphEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  function autoLayout(): void {
    setPositions({});
    setLayoutRevision((value) => value + 1);
    window.setTimeout(() => flowRef.current?.fitView({ duration: 280, padding: 0.14 }), 80);
  }

  function fitBounds(): void {
    flowRef.current?.fitView({ duration: 260, padding: 0.14 });
  }

  if (validation.hasFatalError) {
    return (
      <div className="er-flow-shell" ref={wrapperRef}>
        <div className="er-error-state">
          <strong>SQL ER 输入不符合标准</strong>
          <p>请使用 CREATE TABLE 语句，并确保每个表都有字段、括号闭合、外键引用的表和字段真实存在。</p>
          <pre>{validationMessage}</pre>
        </div>
      </div>
    );
  }

  if (isBlankSource || graph.nodes.length === 0) {
    return <CanvasEmptyState diagramType="ER" />;
  }

  return (
    <div
      className="er-flow-shell"
      ref={wrapperRef}
      style={
        {
          '--er-font-size': `${displaySettings.fontSize}px`,
          '--er-text': displaySettings.textColor,
        } as React.CSSProperties
      }
    >
      <div className="er-flow-toolbar" data-no-canvas-pan="true">
        <div className="er-tool-group">
          <button className={displaySettings.viewMode === 'database' ? 'is-active' : ''} onClick={() => commitDisplay({ notationStyle: 'database', viewMode: 'database' })} type="button">
            {text.databaseEr}
          </button>
          <button className={displaySettings.viewMode === 'crowfoot' ? 'is-active' : ''} onClick={() => commitDisplay({ notationStyle: 'crowfoot', viewMode: 'crowfoot' })} type="button">
            Crow's Foot
          </button>
          <button className={displaySettings.viewMode === 'chen' ? 'is-active' : ''} onClick={() => commitDisplay({ notationStyle: 'chen', viewMode: 'chen' })} type="button">
            {text.chenEr}
          </button>
        </div>
        <div className="er-tool-group">
          <button className={displaySettings.layoutDirection === 'LR' ? 'is-active' : ''} onClick={() => commitDisplay({ layoutDirection: 'LR' })} type="button">
            LR
          </button>
          <button className={displaySettings.layoutDirection === 'TB' ? 'is-active' : ''} onClick={() => commitDisplay({ layoutDirection: 'TB' })} type="button">
            TB
          </button>
        </div>
        <div className="er-tool-group">
          <button onClick={autoLayout} type="button">
            {text.autoLayout}
          </button>
          <button onClick={fitBounds} type="button">
            {text.fitView}
          </button>
        </div>
        <div className="er-tool-group">
          {(['none', 'keys', 'all'] as ErAttributeVisibility[]).map((mode) => (
            <button className={displaySettings.attributeVisibility === mode ? 'is-active' : ''} key={mode} onClick={() => commitDisplay({ attributeVisibility: mode })} type="button">
              {mode === 'none' ? text.hideFields : mode === 'keys' ? text.keysOnly : text.allFields}
            </button>
          ))}
        </div>
        {hasRelationshipRoles || hasRelationshipConstraints ? (
          <div className="er-tool-group">
            {hasRelationshipRoles ? (
              <button className={displaySettings.showRelationshipRoles ? 'is-active' : ''} onClick={() => commitDisplay({ showRelationshipRoles: !displaySettings.showRelationshipRoles })} type="button">
                Roles
              </button>
            ) : null}
            {hasRelationshipConstraints ? (
              <button className={displaySettings.showConstraints ? 'is-active' : ''} onClick={() => commitDisplay({ showConstraints: !displaySettings.showConstraints })} type="button">
                Constraints
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ReactFlow
        colorMode={themeMode === 'dark' ? 'dark' : 'light'}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        maxZoom={2.6}
        minZoom={0.15}
        nodeTypes={nodeTypes}
        nodes={nodes}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          flowRef.current = instance;
          window.setTimeout(() => instance.fitView({ duration: 260, padding: 0.14 }), 0);
        }}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onNodesChange={onNodesChange}
        panOnDrag
        selectionOnDrag
      >
        <Background color="rgba(80, 124, 105, 0.18)" gap={28} variant={BackgroundVariant.Lines} />
        <Controls showInteractive={false} />
        <MiniMap pannable position="bottom-right" zoomable />
      </ReactFlow>
    </div>
  );
}

export function SqlErCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerSqlErCanvas {...props} />
    </ReactFlowProvider>
  );
}
