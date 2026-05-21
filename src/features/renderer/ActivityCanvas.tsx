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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramDiagnostic } from './diagnostics';
import type { Messages } from '../i18n/messages';
import { readStoredUmlNodePositions, readStoredUmlNodeSizes, writeStoredUmlNodePositions, writeStoredUmlNodeSizes } from '../storage/storage';
import { CanvasEmptyState } from './CanvasEmptyState';
import { ActivityControlEdge, ActivityNoteEdge, ActivityObjectEdge } from './activityFlowEdges';
import { ActivityActionNode, ActivityBarNode, ActivityDecisionNode, ActivityEndNode, ActivityFlowFinalNode, ActivityLaneNode, ActivityNoteNode, ActivityObjectNode, ActivityStartNode } from './activityFlowNodes';
import {
  buildActivityGraph,
  buildActivityGraphAsync,
  defaultActivityDisplaySettings,
  formatActivitySource,
  parseActivitySource,
  renameActivityModelLabel,
  validateActivitySource,
  type ActivityDisplaySettings,
  type ActivityGraphEdge,
  type ActivityGraphNode,
  type ActivityModel,
} from './activityModel';
import { exportActivityGraphToSvg } from './activitySvgExport';
import { buildHashScope } from './umlFlowModel';

export { defaultActivityDisplaySettings, formatActivitySource } from './activityModel';
export type { ActivityDisplaySettings } from './activityModel';

interface Props {
  defaultLaneLabel: string;
  displaySettings: ActivityDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  themeMode?: 'light' | 'dark';
  onDiagnosticsChange?: (diagnostics: DiagramDiagnostic[]) => void;
  onDisplaySettingsChange: (settings: ActivityDisplaySettings) => void;
  onErrorChange: (error: string | null) => void;
  onExportSvgReady: (svg: string) => void;
  onSourceChange: (source: string) => void;
}

const nodeTypes = {
  activityAction: ActivityActionNode,
  activityBar: ActivityBarNode,
  activityDecision: ActivityDecisionNode,
  activityEnd: ActivityEndNode,
  activityFlowFinal: ActivityFlowFinalNode,
  activityLane: ActivityLaneNode,
  activityNote: ActivityNoteNode,
  activityObject: ActivityObjectNode,
  activityStart: ActivityStartNode,
};

const edgeTypes = {
  activityControlEdge: ActivityControlEdge,
  activityNoteEdge: ActivityNoteEdge,
  activityObjectEdge: ActivityObjectEdge,
};

function emptyModel(defaultLaneLabel: string): ActivityModel {
  return {
    defaultLaneLabel,
    edges: [],
    lanes: [],
    nodes: [],
    statements: [],
    title: '',
  };
}

function safeParse(source: string, defaultLaneLabel: string): ActivityModel {
  try {
    return parseActivitySource(source, defaultLaneLabel);
  } catch {
    return emptyModel(defaultLaneLabel);
  }
}

function InnerActivityCanvas({
  defaultLaneLabel,
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
  const flowRef = useRef<ReactFlowInstance<ActivityGraphNode, ActivityGraphEdge> | null>(null);
  const contentScope = useMemo(() => buildHashScope('activity', source, defaultLaneLabel), [defaultLaneLabel, source]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredUmlNodePositions(contentScope));
  const [nodeSizes, setNodeSizes] = useState<Record<string, { height: number; width: number }>>(() => readStoredUmlNodeSizes(contentScope));
  const [nodes, setNodes] = useState<ActivityGraphNode[]>([]);
  const [edges, setEdges] = useState<ActivityGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);

  // Async ELK-based graph state (replaces synchronous buildActivityGraph)
  const [graph, setGraph] = useState<{ nodes: ActivityGraphNode[]; edges: ActivityGraphEdge[] }>({ nodes: [], edges: [] });
  const [layoutTrigger, setLayoutTrigger] = useState(0);

  const isBlankSource = source.trim().length === 0;
  const validation = useMemo(() => (isBlankSource ? { diagnostics: [], hasFatalError: false } : validateActivitySource(source, defaultLaneLabel)), [defaultLaneLabel, isBlankSource, source]);
  const validationMessage = useMemo(
    () => validation.diagnostics.map((item) => `${item.level === 'warning' ? 'Warning' : 'Error'}: ${item.message}`).join('\n'),
    [validation.diagnostics],
  );
  const model = useMemo(() => (validation.hasFatalError || isBlankSource ? emptyModel(defaultLaneLabel) : safeParse(source, defaultLaneLabel)), [defaultLaneLabel, isBlankSource, source, validation.hasFatalError]);

  // Stable ref to avoid re-triggering layout when onSourceChange reference changes
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;

  // Async layout with ELKJS (replaces the synchronous useMemo)
  useEffect(() => {
    if (validation.hasFatalError || isBlankSource) return;
    let cancelled = false;

    buildActivityGraphAsync(model, {
      display: displaySettings,
      nodeSizes,
      onLabelEdit: (nodeId, value) => onSourceChangeRef.current(renameActivityModelLabel(model, nodeId, value)),
      onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
      selectedId,
    })
      .then((result) => {
        if (!cancelled) setGraph(result);
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback to synchronous layout on error (e.g. ELK module load failure)
          setGraph(
            buildActivityGraph(model, {
              display: displaySettings,
              nodeSizes,
              onLabelEdit: (nodeId, value) => onSourceChangeRef.current(renameActivityModelLabel(model, nodeId, value)),
              onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
              selectedId,
            }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displaySettings, isBlankSource, layoutTrigger, model, nodeSizes, selectedId, validation.hasFatalError]);

  useEffect(() => {
    onDiagnosticsChange?.(
      validation.diagnostics.map((item, index) => ({
        code: `activity-${index}`,
        level: item.level,
        message: item.message,
      })),
    );
  }, [onDiagnosticsChange, validation.diagnostics]);

  useEffect(() => {
    if (validation.hasFatalError) {
      onErrorChange(validationMessage || 'Activity source is invalid.');
      setNodes([]);
      setEdges([]);
      onExportSvgReady('');
      return;
    }
    onErrorChange(validationMessage || null);
  }, [onErrorChange, onExportSvgReady, validation.hasFatalError, validationMessage]);

  useEffect(() => {
    setPositions(readStoredUmlNodePositions(contentScope));
    setNodeSizes(readStoredUmlNodeSizes(contentScope));
  }, [contentScope]);

  useEffect(() => {
    writeStoredUmlNodePositions(contentScope, positions);
  }, [contentScope, positions]);

  useEffect(() => {
    writeStoredUmlNodeSizes(contentScope, nodeSizes);
  }, [contentScope, nodeSizes]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    setNodes(
      graph.nodes.map((node) => ({
        ...node,
        position: positions[node.id] ?? node.position,
      })),
    );
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, layoutRevision, positions, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError || nodes.length === 0) {
      onExportSvgReady('');
      return;
    }
    onExportSvgReady(exportActivityGraphToSvg(nodes, edges, { transparent: false }));
  }, [edges, nodes, onExportSvgReady, validation.hasFatalError]);

  useEffect(() => {
    if (fitRequest === 0) return;
    window.setTimeout(() => flowRef.current?.fitView({ duration: 260, padding: 0.12 }), 0);
  }, [fitRequest]);

  useEffect(() => {
    if (resetRequest === 0) return;
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
  }, [resetRequest]);

  const onNodesChange = useCallback((changes: NodeChange<ActivityGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<ActivityGraphEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onNodeDragStop = useCallback((_: React.MouseEvent | React.TouchEvent, node: ActivityGraphNode) => {
    setPositions((current) => {
      const nextPosition = node.position;
      const prevPosition = current[node.id];
      if (prevPosition && prevPosition.x === nextPosition.x && prevPosition.y === nextPosition.y) {
        return current;
      }
      return {
        ...current,
        [node.id]: nextPosition,
      };
    });
  }, []);

  function autoLayout(): void {
    setPositions({});
    setLayoutTrigger((value) => value + 1);
    setLayoutRevision((value) => value + 1);
    window.setTimeout(() => flowRef.current?.fitView({ duration: 280, padding: 0.12 }), 80);
  }

  if (validation.hasFatalError) {
    return (
      <div className="er-flow-shell activity-flow-shell">
        <div className="er-error-state">
          <strong>{text.activityInvalidTitle}</strong>
          <p>{text.activityInvalidBody}</p>
          <pre>{validationMessage}</pre>
        </div>
      </div>
    );
  }

  if (isBlankSource) {
    return <CanvasEmptyState diagramType="Activity" />;
  }

  return (
    <div
      className="er-flow-shell activity-flow-shell"
      style={
        {
          '--er-font-size': `${displaySettings.fontSize}px`,
          '--er-text': displaySettings.textColor,
          '--er-stroke': displaySettings.strokeColor,
        } as React.CSSProperties
      }
    >
      <div className="er-flow-toolbar" data-no-canvas-pan="true">
        <div className="er-tool-group">
          <button onClick={autoLayout} type="button">
            {text.autoLayout}
          </button>
          <button onClick={() => flowRef.current?.fitView({ duration: 260, padding: 0.12 })} type="button">
            {text.fitView}
          </button>
        </div>
        <div className="er-tool-group">
          <button className={displaySettings.showNotes ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, showNotes: !displaySettings.showNotes })} type="button">
            {text.showComments}
          </button>
        </div>
      </div>

      <ReactFlow
        colorMode={themeMode === 'dark' ? 'dark' : 'light'}
        edgeTypes={edgeTypes}
        edges={edges}
        fitView
        maxZoom={2.4}
        minZoom={0.15}
        nodeTypes={nodeTypes}
        nodes={nodes}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          flowRef.current = instance;
          window.setTimeout(() => instance.fitView({ duration: 260, padding: 0.12 }), 0);
        }}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onNodeDragStop={onNodeDragStop}
        onNodesChange={onNodesChange}
        panOnDrag
        selectionOnDrag
      >
        <Background color="rgba(80, 124, 105, 0.14)" gap={28} variant={BackgroundVariant.Lines} />
        <Controls showInteractive={false} />
        <MiniMap pannable position="bottom-right" zoomable />
      </ReactFlow>
    </div>
  );
}

export function ActivityCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerActivityCanvas {...props} />
    </ReactFlowProvider>
  );
}
