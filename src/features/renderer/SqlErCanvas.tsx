import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Messages } from '../i18n/messages';
import { readStoredErNodePositions, writeStoredErNodePositions } from '../storage/storage';
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
import { modelToSql, parseSqlErModel, type SqlColumn, type SqlErModel, type SqlRelationship, type SqlTable } from './sqlErModel';

export type { ErDisplaySettings, ErViewMode };

interface Props {
  displaySettings: ErDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  transparentExport: boolean;
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

export const defaultErDisplaySettings: ErDisplaySettings = {
  accentColor: '#507c69',
  attributeVisibility: 'keys',
  fillColor: '#ffffff',
  layoutDirection: 'LR',
  nodeScale: 1,
  showCardinality: true,
  showComments: true,
  showTypes: true,
  strokeColor: '#171817',
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
  if (target.kind === 'table-name') return updateTable(model, target.tableName, (table) => ({ ...table, name: String(value) || table.name }));
  if (target.kind === 'column-comment') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, comment: String(value) }));
  if (target.kind === 'column-name') return updateColumn(model, target.tableName, target.columnName, (column) => ({ ...column, name: String(value) || column.name }));
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
    layoutDirection: display.layoutDirection,
    nodeScale: display.nodeScale,
    showCardinality: display.showCardinality,
    showComments: display.showComments,
    showTypes: display.showTypes,
    strokeColor: display.strokeColor,
    tables: model.tables.map((table) => ({
      columns: table.columns.map((column) => [column.name, column.comment, column.dataType, column.isPrimaryKey, column.isForeignKey]),
      name: table.name,
    })),
    viewMode: display.viewMode,
  });
}

function InnerSqlErCanvas({
  displaySettings,
  fitRequest,
  resetRequest,
  source,
  text,
  transparentExport,
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
  const [localLabels, setLocalLabels] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredErNodePositions());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const model = useMemo(() => parseSqlErModel(source), [source]);
  const modelSignature = useMemo(() => getModelSignature(model, displaySettings), [model, displaySettings]);
  const collapsedSignature = useMemo(() => JSON.stringify(collapsedTables), [collapsedTables]);

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

  const graph = useMemo(
    () =>
      buildErGraph(model, {
        collapsedTables,
        display: displaySettings,
        localLabels,
        onEdit: commitModel,
        onLocalLabelEdit: (nodeId, value) => setLocalLabels((labels) => ({ ...labels, [nodeId]: value })),
        positions,
        selectedId,
        setCollapsed: (tableName, collapsed) => setCollapsedTables((value) => ({ ...value, [tableName]: collapsed })),
      }),
    [collapsedTables, commitModel, displaySettings, localLabels, model, positions, selectedId],
  );

  useEffect(() => {
    onErrorChange(model.tables.length === 0 ? text.noTable : null);
  }, [model.tables.length, onErrorChange, text.noTable]);

  useEffect(() => {
    let cancelled = false;
    void layoutErGraph(graph.nodes, graph.edges, displaySettings.layoutDirection).then((layout) => {
      if (cancelled) return;
      const merged = Object.fromEntries(Object.entries(layout).map(([id, position]) => [id, positions[id] ?? position]));
      setNodes(applyPositions(graph.nodes, merged));
      setEdges(graph.edges);
      setPositions((previous) => ({ ...merged, ...previous }));
    });
    return () => {
      cancelled = true;
    };
  }, [collapsedSignature, displaySettings.layoutDirection, layoutRevision, modelSignature]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => {
        const next = graph.nodes.find((item) => item.id === node.id);
        return next ? { ...node, data: next.data, style: next.style } : node;
      }),
    );
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes]);

  useEffect(() => {
    writeStoredErNodePositions(positions);
  }, [positions]);

  useEffect(() => {
    onExportSvgReady(exportErGraphToSvg(nodes, edges, { transparent: transparentExport }));
  }, [edges, nodes, onExportSvgReady, transparentExport]);

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

  return (
    <div className="er-flow-shell" ref={wrapperRef}>
      <div className="er-flow-toolbar" data-no-canvas-pan="true">
        <div className="er-tool-group">
          <button className={displaySettings.viewMode === 'database' ? 'is-active' : ''} onClick={() => commitDisplay({ viewMode: 'database' })} type="button">
            {text.databaseEr}
          </button>
          <button className={displaySettings.viewMode === 'chen' ? 'is-active' : ''} onClick={() => commitDisplay({ viewMode: 'chen' })} type="button">
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
      </div>

      <ReactFlow
        colorMode="light"
        edges={edges}
        fitView
        maxZoom={2.6}
        minZoom={0.15}
        nodeTypes={nodeTypes}
        nodes={nodes}
        onConnect={(connection) => setEdges((current) => addEdge(connection, current))}
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
