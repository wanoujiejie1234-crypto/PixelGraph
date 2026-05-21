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
import {
  readStoredUmlEdgeLabels,
  readStoredUmlLocalLabels,
  readStoredUmlNodePositions,
  readStoredUmlNodeSizes,
  writeStoredUmlEdgeLabels,
  writeStoredUmlLocalLabels,
  writeStoredUmlNodePositions,
  writeStoredUmlNodeSizes,
} from '../storage/storage';
import { CanvasEmptyState } from './CanvasEmptyState';
import { SimpleEdge } from './simpleFlowEdges';
import { SimpleClassNode, SimpleFragmentNode, SimpleLifelineNode, SimpleStateContainerNode, SimpleStateNode } from './simpleFlowNodes';
import { applyUmlPositions, layoutUmlGraph } from './umlFlowLayout';
import { buildHashScope } from './umlFlowModel';
import {
  buildSimpleGraph,
  buildSequenceMessageNumbers,
  defaultSimpleDisplaySettings,
  darkSimpleDisplaySettings,
  getSimpleModelSignature,
  parseSimpleModel,
  SEQUENCE_MESSAGE_START_Y,
  SEQUENCE_MESSAGE_STEP,
  validateSimpleSource,
  type SimpleDiagramKind,
  type SimpleDisplaySettings,
  type SimpleGraphEdge,
  type SimpleGraphNode,
  type SimpleModel,
} from './simpleCanvasModel';
import { exportSimpleGraphToSvg } from './simpleSvgExport';

export { darkSimpleDisplaySettings, defaultSimpleDisplaySettings };
export type { SimpleDisplaySettings };

interface Props {
  diagramKind: SimpleDiagramKind;
  displaySettings: SimpleDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  themeMode?: 'light' | 'dark';
  onDiagnosticsChange?: (diagnostics: DiagramDiagnostic[]) => void;
  onDisplaySettingsChange: (settings: SimpleDisplaySettings) => void;
  onErrorChange: (error: string | null) => void;
  onExportSvgReady: (svg: string) => void;
  onSourceChange: (source: string) => void;
}

const nodeTypes = {
  'simple-choice': SimpleStateNode,
  'simple-class': SimpleClassNode,
  'simple-enum': SimpleClassNode,
  'simple-final': SimpleStateNode,
  'simple-fragment': SimpleFragmentNode,
  'simple-history': SimpleStateNode,
  'simple-initial': SimpleStateNode,
  'simple-interface': SimpleClassNode,
  'simple-lifeline': SimpleLifelineNode,
  'simple-state': SimpleStateNode,
  'simple-state-container': SimpleStateContainerNode,
};

const edgeTypes = {
  'simple-edge': SimpleEdge,
};

/** After ELKJS layout, expand container parent nodes to visually wrap their children. */
function adjustContainerBounds(nodes: SimpleGraphNode[]): SimpleGraphNode[] {
  const containerPadding = 44;
  const headerHeight = 48;

  const containers = nodes.filter((n) => n.data.childIds?.length);
  if (containers.length === 0) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const container of containers) {
    const childIds = container.data.childIds!;
    const childNodes = childIds.map((id) => nodeMap.get(id)).filter(Boolean) as SimpleGraphNode[];
    if (childNodes.length === 0) continue;

    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const child of childNodes) {
      const childW = Number(child.width ?? child.style?.width ?? 80);
      const childH = Number(child.height ?? child.style?.height ?? 40);
      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      maxX = Math.max(maxX, child.position.x + childW);
      maxY = Math.max(maxY, child.position.y + childH);
    }

    if (!Number.isFinite(minX)) continue;

    container.position = {
      x: minX - containerPadding,
      y: minY - containerPadding - headerHeight,
    };
    const newWidth = maxX - minX + containerPadding * 2;
    const newHeight = maxY - minY + containerPadding * 2 + headerHeight;
    container.style = {
      ...container.style,
      width: newWidth,
      height: newHeight,
    };
    container.width = newWidth;
    container.height = newHeight;
  }

  return nodes;
}

function emptyModel(diagramKind: SimpleDiagramKind): SimpleModel {
  return { diagramKind, edges: [], nodes: [], title: '' };
}

function replaceLabelInSource(source: string, oldValue: string, nextValue: string, line?: number): string {
  if (!oldValue.trim() || !nextValue.trim()) return source;
  const escaped = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'gu');

  if (line !== undefined) {
    // Only replace on state declaration lines and transition lines
    const sourceLines = source.split('\n');
    let changed = false;
    for (let i = 0; i < sourceLines.length; i++) {
      const trimmed = sourceLines[i].trim();
      if (trimmed.startsWith('state ') || trimmed.includes('-->')) {
        const updated = sourceLines[i].replace(pattern, nextValue.trim());
        if (updated !== sourceLines[i]) {
          sourceLines[i] = updated;
          changed = true;
        }
      }
    }
    return changed ? sourceLines.join('\n') : source;
  }

  return source.replace(pattern, nextValue.trim());
}

interface ActivationRange {
  participantId: string;
  startSequenceIndex: number;
  endSequenceIndex: number;
  depth: number;
}

function computeActivations(edges: SimpleGraphEdge[]): ActivationRange[] {
  const stack: { participantId: string; startSequenceIndex: number; depth: number }[] = [];
  const result: ActivationRange[] = [];
  const involvement = new Map<string, { endSequenceIndex: number; startSequenceIndex: number }>();
  const sorted = [...edges].sort((a, b) => (a.data?.sequenceIndex ?? 0) - (b.data?.sequenceIndex ?? 0));

  for (const edge of sorted) {
    const seqIdx = edge.data?.sequenceIndex;
    if (seqIdx === undefined) continue;
    const kind = edge.data?.kind;
    for (const participantId of [edge.source, edge.target]) {
      const current = involvement.get(participantId);
      involvement.set(participantId, {
        endSequenceIndex: Math.max(current?.endSequenceIndex ?? seqIdx, seqIdx),
        startSequenceIndex: Math.min(current?.startSequenceIndex ?? seqIdx, seqIdx),
      });
    }

    if (kind === 'message') {
      const depth = stack.length;
      stack.push({ participantId: edge.target, startSequenceIndex: seqIdx, depth });
    } else if (kind === 'reply') {
      const matchIdx = stack.map((s) => s.participantId).lastIndexOf(edge.source);
      if (matchIdx >= 0) {
        for (let i = stack.length - 1; i >= matchIdx; i--) {
          result.push({ ...stack[i], endSequenceIndex: seqIdx });
        }
        stack.splice(matchIdx);
      }
    }
  }

  const lastIdx = sorted.length > 0 ? (sorted[sorted.length - 1].data?.sequenceIndex ?? 0) : 0;
  for (const remaining of stack) {
    result.push({ ...remaining, endSequenceIndex: lastIdx });
  }

  const participantsWithActivations = new Set(result.map((activation) => activation.participantId));
  for (const [participantId, range] of involvement) {
    if (!participantsWithActivations.has(participantId)) {
      result.push({ ...range, depth: 0, participantId });
    }
  }

  return result;
}

function InnerSimpleCanvas({
  diagramKind,
  displaySettings,
  fitRequest,
  resetRequest,
  source,
  themeMode = 'light',
  onDiagnosticsChange,
  onDisplaySettingsChange,
  onErrorChange,
  onExportSvgReady,
  onSourceChange,
}: Props) {
  const flowRef = useRef<ReactFlowInstance<SimpleGraphNode, SimpleGraphEdge> | null>(null);
  const isBlankSource = source.trim().length === 0;
  const positionScope = useMemo(() => buildHashScope(`${diagramKind}-canvas-v1`, source, displaySettings.layoutDirection), [diagramKind, displaySettings.layoutDirection, source]);
  const contentScope = useMemo(() => buildHashScope(`${diagramKind}-canvas-content`, source, displaySettings.layoutDirection), [diagramKind, displaySettings.layoutDirection, source]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredUmlNodePositions(positionScope));
  const [nodeSizes, setNodeSizes] = useState<Record<string, { height: number; width: number }>>(() => readStoredUmlNodeSizes(contentScope));
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(() => readStoredUmlLocalLabels(contentScope));
  const [edgeLabels, setEdgeLabels] = useState<Record<string, { dx: number; dy: number; text: string }>>(() => readStoredUmlEdgeLabels(contentScope));
  const [nodes, setNodes] = useState<SimpleGraphNode[]>([]);
  const [edges, setEdges] = useState<SimpleGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const validation = useMemo(() => validateSimpleSource(diagramKind, source), [diagramKind, source]);
  const model = useMemo(() => (validation.hasFatalError || isBlankSource ? emptyModel(diagramKind) : parseSimpleModel(diagramKind, source)), [diagramKind, isBlankSource, source, validation.hasFatalError]);
  const modelSignature = useMemo(() => getSimpleModelSignature(model, displaySettings), [displaySettings, model]);
  const graph = useMemo(
    () =>
      buildSimpleGraph(model, {
        display: displaySettings,
        edgeLabels,
        localLabels,
        nodeSizes,
        onEdgeLabelChange: (edgeId, value) => setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: labels[edgeId]?.dx ?? 0, dy: labels[edgeId]?.dy ?? 0, text: value } })),
        onEdgeLabelOffsetChange: (edgeId, offset, textValue) => setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: offset.x, dy: offset.y, text: labels[edgeId]?.text ?? textValue } })),
        onLocalLabelEdit: (nodeId, value) => {
          setLocalLabels((labels) => ({ ...labels, [nodeId]: value }));
          const node = model.nodes.find((n) => n.id === nodeId);
          if (node) onSourceChange(replaceLabelInSource(source, node.label, value, node.line));
        },
        onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
        positions,
        selectedId,
      }),
    [displaySettings, edgeLabels, localLabels, model, nodeSizes, onSourceChange, positions, selectedId, source],
  );

  useEffect(() => {
    onDiagnosticsChange?.(validation.diagnostics.map((item, index) => ({ code: `${diagramKind}-${index}`, level: item.level, message: item.message })));
    onErrorChange(validation.hasFatalError ? validation.diagnostics.map((item) => item.message).join('\n') : null);
  }, [diagramKind, onDiagnosticsChange, onErrorChange, validation]);

  useEffect(() => setPositions(readStoredUmlNodePositions(positionScope)), [positionScope]);
  useEffect(() => {
    setNodeSizes(readStoredUmlNodeSizes(contentScope));
    setLocalLabels(readStoredUmlLocalLabels(contentScope));
    setEdgeLabels(readStoredUmlEdgeLabels(contentScope));
  }, [contentScope]);
  useEffect(() => writeStoredUmlNodePositions(positionScope, positions), [positionScope, positions]);
  useEffect(() => writeStoredUmlNodeSizes(contentScope, nodeSizes), [contentScope, nodeSizes]);
  useEffect(() => writeStoredUmlLocalLabels(contentScope, localLabels), [contentScope, localLabels]);
  useEffect(() => writeStoredUmlEdgeLabels(contentScope, edgeLabels), [contentScope, edgeLabels]);

  useEffect(() => {
    if (validation.hasFatalError || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (diagramKind === 'sequence') {
      const merged = Object.fromEntries(graph.nodes.map((n) => [n.id, positions[n.id] ?? n.position]));
      const sequenceNumbers = buildSequenceMessageNumbers(graph.edges.map((edge) => ({ id: edge.id, kind: edge.data?.kind ?? 'association', sequenceIndex: edge.data?.sequenceIndex, source: edge.source, target: edge.target })));
      const numberedEdges: SimpleGraphEdge[] = graph.edges.map((edge) => ({ ...edge, data: { ...edge.data, display: edge.data?.display ?? displaySettings, kind: edge.data?.kind ?? 'association', sequenceNumber: sequenceNumbers[edge.id] } }));
      const edgeCount = graph.edges.length;
      const lastMessageY = edgeCount > 0 ? SEQUENCE_MESSAGE_START_Y + (edgeCount - 1) * SEQUENCE_MESSAGE_STEP : SEQUENCE_MESSAGE_START_Y;

      const activations = computeActivations(numberedEdges);

      const lifelineNodes = graph.nodes.filter((n) => n.data?.kind === 'lifeline');
      const firstX = lifelineNodes.length > 0 ? Math.min(...lifelineNodes.map((n) => merged[n.id]?.x ?? n.position.x)) : 80;
      const lastX = lifelineNodes.length > 0 ? Math.max(...lifelineNodes.map((n) => (merged[n.id]?.x ?? n.position.x) + Number(n.style?.width ?? 132))) : 80 + 132;
      const totalWidth = lastX - firstX;

      const adjusted = graph.nodes.map((n) => {
        const pos = merged[n.id] ?? n.position;
        if (n.data?.kind === 'lifeline') {
          const nodeActivations = activations.filter((a) => a.participantId === n.id);
          const headHeight = 72;
          const requiredHeight = Math.max(280, lastMessageY - pos.y + headHeight);
          const storedHeight = Number(n.style?.height ?? 0);
          const lifelineHeight = Math.max(requiredHeight, Number.isFinite(storedHeight) ? storedHeight : 0);
          return { ...n, position: pos, style: { ...n.style, height: lifelineHeight }, data: { ...n.data, activations: nodeActivations.length > 0 ? nodeActivations : undefined, lifelineTop: pos.y } };
        }
        if (n.data?.kind === 'fragment' && n.data.fragmentMessageRange) {
          const { startIndex, endIndex } = n.data.fragmentMessageRange;
          const fragY = SEQUENCE_MESSAGE_START_Y + startIndex * SEQUENCE_MESSAGE_STEP - 16;
          const fragBottom = SEQUENCE_MESSAGE_START_Y + endIndex * SEQUENCE_MESSAGE_STEP + 36;
          return { ...n, position: { x: Math.max(0, firstX - 14), y: fragY }, style: { ...n.style, width: totalWidth + 28, height: Math.max(60, fragBottom - fragY) } };
        }
        return { ...n, position: pos };
      });
      setNodes(adjusted);
      setEdges(numberedEdges);
      return;
    }

    let cancelled = false;
    // Exclude container nodes from ELKJS — they wrap children post-layout
    const layoutNodes = graph.nodes.filter((n) => !n.data.childIds?.length);
    void layoutUmlGraph(layoutNodes, graph.edges, {
      direction: displaySettings.layoutDirection,
      edgeNodeBetweenLayers: diagramKind === 'state' ? 120 : 48,
      edgeRouting: displaySettings.lineStyle === 'orthogonal' ? 'ORTHOGONAL' : 'POLYLINE',
      nodeNodeBetweenLayers: diagramKind === 'state' ? displaySettings.rankGap * 1.6 : displaySettings.rankGap,
      spacingComponentComponent: diagramKind === 'state' ? 80 : 48,
      spacingEdgeEdge: diagramKind === 'state' ? 50 : 20,
      spacingNodeNode: diagramKind === 'state' ? 90 : 54,
    }).then((layout) => {
      if (cancelled) return;
      const merged = Object.fromEntries(Object.entries(layout).map(([id, position]) => [id, positions[id] ?? position]));
      let positioned = applyUmlPositions(graph.nodes, merged);
      positioned = adjustContainerBounds(positioned);
      setNodes(positioned);
      setEdges(graph.edges);
    });
    return () => {
      cancelled = true;
    };
  }, [diagramKind, displaySettings, graph.edges, graph.nodes, layoutRevision, positions, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    if (diagramKind === 'sequence') {
      return;
    }
    setNodes((current) =>
      current.map((node) => {
        const next = graph.nodes.find((item) => item.id === node.id);
        return next ? { ...next, position: node.position } : node;
      }),
    );
    setEdges(graph.edges);
  }, [diagramKind, graph.edges, graph.nodes, modelSignature, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError || nodes.length === 0) {
      onExportSvgReady('');
      return;
    }
    onExportSvgReady(exportSimpleGraphToSvg(nodes, edges, { transparent: false }));
  }, [edges, nodes, onExportSvgReady, validation.hasFatalError]);

  useEffect(() => {
    if (fitRequest === 0) return;
    window.setTimeout(() => flowRef.current?.fitView({ duration: 260, padding: 0.14 }), 0);
  }, [fitRequest]);

  useEffect(() => {
    if (resetRequest === 0) return;
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
  }, [resetRequest]);

  const onNodesChange = useCallback((changes: NodeChange<SimpleGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    const positionChanges = changes.filter((change): change is NodeChange<SimpleGraphNode> & { id: string; position: XYPosition } => change.type === 'position' && Boolean(change.position));
    if (positionChanges.length > 0) setPositions((current) => ({ ...current, ...Object.fromEntries(positionChanges.map((change) => [change.id, change.position])) }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<SimpleGraphEdge>[]) => setEdges((current) => applyEdgeChanges(changes, current)), []);

  if (validation.hasFatalError) {
    return (
      <div className="er-flow-shell">
        <div className="er-error-state">
          <strong>{diagramKind} source is invalid.</strong>
          <pre>{validation.diagnostics.map((item) => item.message).join('\n')}</pre>
        </div>
      </div>
    );
  }

  if (isBlankSource || graph.nodes.length === 0) return <CanvasEmptyState diagramType={diagramKind} />;

  return (
    <div className="er-flow-shell simple-flow-shell" style={{ '--er-font-size': `${displaySettings.fontSize}px`, '--er-text': displaySettings.textColor, '--simple-line': displaySettings.lineColor } as React.CSSProperties}>
      <div className="er-flow-toolbar" data-no-canvas-pan="true">
        <div className="er-tool-group">
          <button className={displaySettings.layoutDirection === 'LR' ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, layoutDirection: 'LR' })} type="button">
            LR
          </button>
          <button className={displaySettings.layoutDirection === 'TB' ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, layoutDirection: 'TB' })} type="button">
            TB
          </button>
        </div>
        <div className="er-tool-group">
          <button onClick={() => {
            setPositions({});
            writeStoredUmlNodePositions(positionScope, {});
            setLayoutRevision((value) => value + 1);
          }} type="button">
            Auto layout
          </button>
          <button onClick={() => flowRef.current?.fitView({ duration: 260, padding: 0.14 })} type="button">
            Fit
          </button>
        </div>
        <div className="er-tool-group">
          <button className={displaySettings.showDetails ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, showDetails: !displaySettings.showDetails })} type="button">
            Details
          </button>
        </div>
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
        <Background color="rgba(80, 124, 105, 0.16)" gap={28} variant={BackgroundVariant.Lines} />
        <Controls showInteractive={false} />
        <MiniMap pannable position="bottom-right" zoomable />
      </ReactFlow>
    </div>
  );
}

export function SimpleCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerSimpleCanvas {...props} />
    </ReactFlowProvider>
  );
}
