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
import { applyUmlPositions, layoutUmlGraph } from './umlFlowLayout';
import { buildHashScope } from './umlFlowModel';
import { CanvasEmptyState } from './CanvasEmptyState';
import { UseCaseAssociationEdge, UseCaseGeneralizationEdge, UseCaseRelationEdge } from './useCaseFlowEdges';
import { UseCaseActorNode, UseCaseBoundaryNode, UseCaseEllipseNode, UseCaseNoteNode } from './useCaseFlowNodes';
import {
  actorId,
  buildUseCaseGraph,
  defaultUseCaseDisplaySettings,
  formatUseCaseSource,
  getUseCaseModelSignature,
  modelToUseCaseDsl,
  parseUseCaseModel,
  renameUseCaseModelLabel,
  systemBoundaryId,
  validateUseCaseSource,
  type UseCaseDisplaySettings,
  type UseCaseGraphEdge,
  type UseCaseGraphNode,
  type UseCaseModel,
} from './useCaseModel';
import { exportUseCaseGraphToSvg } from './useCaseSvgExport';

export type { UseCaseDisplaySettings };
export { defaultUseCaseDisplaySettings, formatUseCaseSource } from './useCaseModel';

interface Props {
  displaySettings: UseCaseDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  themeMode?: 'light' | 'dark';
  onDiagnosticsChange?: (diagnostics: DiagramDiagnostic[]) => void;
  onDisplaySettingsChange: (settings: UseCaseDisplaySettings) => void;
  onErrorChange: (error: string | null) => void;
  onExportSvgReady: (svg: string) => void;
  onSourceChange: (source: string) => void;
}

const nodeTypes = {
  useCaseActor: UseCaseActorNode,
  useCaseBoundary: UseCaseBoundaryNode,
  useCaseEllipse: UseCaseEllipseNode,
  useCaseNote: UseCaseNoteNode,
};

const edgeTypes = {
  useCaseAssociation: UseCaseAssociationEdge,
  useCaseGeneralization: UseCaseGeneralizationEdge,
  useCaseRelation: UseCaseRelationEdge,
};

const emptyModel: UseCaseModel = {
  actors: [],
  associations: [],
  dependencies: [],
  extends: [],
  generalizations: [],
  includes: [],
  notes: [],
  systemName: '',
  useCases: [],
};

function safeValidateUseCaseSource(source: string) {
  try {
    return validateUseCaseSource(source);
  } catch (error) {
    return {
      diagnostics: [{ level: 'error' as const, message: error instanceof Error ? error.message : 'Use Case 校验失败。' }],
      hasFatalError: true,
    };
  }
}

function safeParseUseCaseModel(source: string): UseCaseModel {
  try {
    return parseUseCaseModel(source);
  } catch {
    return emptyModel;
  }
}

function computeBoundaryLayout(
  nodes: UseCaseGraphNode[],
  layout: Record<string, XYPosition>,
  displaySettings: UseCaseDisplaySettings,
  model: UseCaseModel,
): { layout: Record<string, XYPosition>; size?: { height: number; width: number } } {
  const boundaryNode = nodes.find((node) => node.id === systemBoundaryId());
  const actorNodes = nodes.filter((node) => node.data.kind === 'actor');
  const useCaseNodes = nodes.filter((node) => node.data.kind === 'useCase');
  if (!boundaryNode || useCaseNodes.length === 0) return { layout };

  const placedUseCases = useCaseNodes.map((node) => ({
    height: Number(node.height ?? node.style?.height ?? 54),
    width: Number(node.width ?? node.style?.width ?? 176),
    x: layout[node.id]?.x ?? node.position.x,
    y: layout[node.id]?.y ?? node.position.y,
  }));

  const left = Math.min(...placedUseCases.map((item) => item.x));
  const top = Math.min(...placedUseCases.map((item) => item.y));
  const right = Math.max(...placedUseCases.map((item) => item.x + item.width));
  const bottom = Math.max(...placedUseCases.map((item) => item.y + item.height));

  const paddingX = 104;
  const paddingY = 72;
  const boundaryX = left - paddingX;
  const boundaryY = top - paddingY;
  const boundaryWidth = right - left + paddingX * 2;
  const boundaryHeight = bottom - top + paddingY * 2;

  const nextLayout = { ...layout, [systemBoundaryId()]: { x: boundaryX, y: boundaryY } };
  const actorNodeMap = new Map(actorNodes.map((node) => [node.id, node]));
  const actorBands = new Map<string, 'bottom' | 'left' | 'right' | 'top'>();
  const actorChildren = new Map<string, string[]>();
  const actorParents = new Map<string, string>();
  const actorNames = new Set(model.actors.map((actor) => actor.name));

  model.generalizations.forEach((relation) => {
    if (!actorNames.has(relation.from) || !actorNames.has(relation.to)) return;
    actorParents.set(relation.from, relation.to);
    const siblings = actorChildren.get(relation.to) ?? [];
    siblings.push(relation.from);
    actorChildren.set(relation.to, siblings);
  });

  const rootActors = model.actors.filter((actor) => actorNodes.some((node) => node.id === actorId(actor.name)) && !actorParents.has(actor.name));
  const leftRoots = rootActors.filter((_, index) => index % 2 === 0);
  const rightRoots = rootActors.filter((_, index) => index % 2 === 1);

  function assignBand(name: string, band: 'bottom' | 'left' | 'right' | 'top'): void {
    actorBands.set(name, band);
    for (const child of actorChildren.get(name) ?? []) assignBand(child, band);
  }

  for (const actor of leftRoots) assignBand(actor.name, displaySettings.layoutDirection === 'LR' ? 'left' : 'top');
  for (const actor of rightRoots) assignBand(actor.name, displaySettings.layoutDirection === 'LR' ? 'right' : 'bottom');

  const leftActors = model.actors.filter((actor) => actorBands.get(actor.name) === (displaySettings.layoutDirection === 'LR' ? 'left' : 'top'));
  const rightActors = model.actors.filter((actor) => actorBands.get(actor.name) === (displaySettings.layoutDirection === 'LR' ? 'right' : 'bottom'));

  function actorDepth(name: string): number {
    let depth = 0;
    let current = actorParents.get(name);
    while (current) {
      depth += 1;
      current = actorParents.get(current);
    }
    return depth;
  }

  function placeActorColumn(names: string[], side: 'bottom' | 'left' | 'right' | 'top'): void {
    const rootOffset = 42;
    const chainGap = 128;
    const siblingGap = Math.max(26, Math.round(displaySettings.actorSpacing * 0.28));
    names.forEach((name, index) => {
      const nodeId = actorId(name);
      const node = actorNodeMap.get(nodeId);
      if (!node) return;
      const width = Number(node.width ?? node.style?.width ?? 92);
      const height = Number(node.height ?? node.style?.height ?? 104);
      const parentName = actorParents.get(name);
      const depth = actorDepth(name);
      const siblingIndex = parentName ? (actorChildren.get(parentName)?.indexOf(name) ?? 0) : 0;

      if (displaySettings.layoutDirection === 'LR') {
        const baseX = side === 'left' ? boundaryX - width - 96 : boundaryX + boundaryWidth + 96;
        const x = side === 'left' ? baseX - depth * chainGap : baseX + depth * chainGap;
        const y = boundaryY + rootOffset + index * displaySettings.actorSpacing + siblingIndex * siblingGap;
        nextLayout[nodeId] = { x, y };
        return;
      }

      const baseY = side === 'top' ? boundaryY - height - 84 : boundaryY + boundaryHeight + 84;
      const y = side === 'top' ? baseY - depth * chainGap : baseY + depth * chainGap;
      const x = boundaryX + rootOffset + index * displaySettings.actorSpacing + siblingIndex * siblingGap;
      nextLayout[nodeId] = { x, y };
    });
  }

  placeActorColumn(leftActors.map((actor) => actor.name), displaySettings.layoutDirection === 'LR' ? 'left' : 'top');
  placeActorColumn(rightActors.map((actor) => actor.name), displaySettings.layoutDirection === 'LR' ? 'right' : 'bottom');
  model.generalizations.forEach((relation) => {
    if (!actorNames.has(relation.from) || !actorNames.has(relation.to)) return;
    const childId = actorId(relation.from);
    const parentId = actorId(relation.to);
    if (!nextLayout[parentId] || !nextLayout[childId]) return;
  });

  useCaseNodes.forEach((node) => {
    const position = nextLayout[node.id];
    if (!position) return;
    const nearHorizontalActorLink = actorNodes.some((actorNode) => {
      const actorPosition = nextLayout[actorNode.id];
      if (!actorPosition) return false;
      const actorMidY = actorPosition.y + Number(actorNode.height ?? actorNode.style?.height ?? 104) / 2;
      const useCaseMidY = position.y + Number(node.height ?? node.style?.height ?? 54) / 2;
      return Math.abs(actorMidY - useCaseMidY) < 18;
    });
    if (nearHorizontalActorLink) {
      nextLayout[node.id] = {
        x: position.x,
        y: position.y + 26,
      };
    }
  });

  return {
    layout: nextLayout,
    size: {
      height: boundaryHeight,
      width: boundaryWidth,
    },
  };
}

async function layoutUseCaseGraph(
  nodes: UseCaseGraphNode[],
  edges: UseCaseGraphEdge[],
  displaySettings: UseCaseDisplaySettings,
  model: UseCaseModel,
): Promise<{ layout: Record<string, XYPosition>; size?: { height: number; width: number } }> {
  const graphNodes = nodes.filter((node) => node.id !== systemBoundaryId());
  const layout = await layoutUmlGraph(graphNodes, edges, {
    direction: displaySettings.layoutDirection,
    edgeNodeBetweenLayers: 46,
    edgeRouting: 'POLYLINE',
    nodeNodeBetweenLayers: displaySettings.useCaseSpacing,
    spacingEdgeEdge: 20,
    spacingNodeNode: Math.max(42, Math.round(displaySettings.useCaseSpacing * 0.72)),
  });

  return computeBoundaryLayout(nodes, layout, displaySettings, model);
}

function InnerUseCaseCanvas({
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
  const flowRef = useRef<ReactFlowInstance<UseCaseGraphNode, UseCaseGraphEdge> | null>(null);
  const [nodes, setNodes] = useState<UseCaseGraphNode[]>([]);
  const [edges, setEdges] = useState<UseCaseGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const positionScope = useMemo(() => buildHashScope('usecase-v3', source, displaySettings.layoutDirection), [displaySettings.layoutDirection, source]);
  const contentScope = useMemo(() => buildHashScope('usecase', source, displaySettings.layoutDirection), [displaySettings.layoutDirection, source]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredUmlNodePositions(positionScope));
  const [nodeSizes, setNodeSizes] = useState<Record<string, { height: number; width: number }>>(() => readStoredUmlNodeSizes(contentScope));
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(() => readStoredUmlLocalLabels(contentScope));
  const [edgeLabels, setEdgeLabels] = useState<Record<string, { dx: number; dy: number; text: string }>>(() => readStoredUmlEdgeLabels(contentScope));

  const isBlankSource = source.trim().length === 0;
  const validation = useMemo(() => (isBlankSource ? { diagnostics: [], hasFatalError: false } : safeValidateUseCaseSource(source)), [isBlankSource, source]);
  const validationMessage = useMemo(() => validation.diagnostics.map((item) => item.message).join('\n'), [validation.diagnostics]);
  const model = useMemo(() => (validation.hasFatalError ? emptyModel : safeParseUseCaseModel(source)), [source, validation.hasFatalError]);
  const modelSignature = useMemo(() => getUseCaseModelSignature(model, displaySettings), [displaySettings, model]);
  const relationMarkerColor = displaySettings.lineColor || displaySettings.strokeColor;

  const commitDisplay = useCallback(
    (next: Partial<UseCaseDisplaySettings>) => {
      onDisplaySettingsChange({ ...displaySettings, ...next });
    },
    [displaySettings, onDisplaySettingsChange],
  );

  const commitNodeLabel = useCallback(
    (nodeId: string, value: string) => {
      const nextModel = renameUseCaseModelLabel(model, nodeId, value);
      onSourceChange(modelToUseCaseDsl(nextModel));
    },
    [model, onSourceChange],
  );

  const graph = useMemo(() => {
    try {
      return buildUseCaseGraph(model, {
        display: displaySettings,
        edgeLabels,
        localLabels,
        nodeSizes,
        onEdgeLabelChange: (edgeId, value) => {
          setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: labels[edgeId]?.dx ?? 0, dy: labels[edgeId]?.dy ?? 0, text: value } }));
        },
        onEdgeLabelOffsetChange: (edgeId, offset, textValue) =>
          setEdgeLabels((labels) => ({ ...labels, [edgeId]: { dx: offset.x, dy: offset.y, text: labels[edgeId]?.text ?? textValue } })),
        onLocalLabelEdit: (nodeId, value) => {
          setLocalLabels((labels) => ({ ...labels, [nodeId]: value }));
          commitNodeLabel(nodeId, value);
        },
        onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
        positions,
        selectedId,
      });
    } catch {
      onErrorChange('Use Case 图模型构建失败，请检查参与者、用例和关系定义。');
      return { edges: [], nodes: [] };
    }
  }, [commitNodeLabel, displaySettings, edgeLabels, localLabels, model, nodeSizes, onErrorChange, positions, selectedId]);

  useEffect(() => {
    onDiagnosticsChange?.(
      validation.diagnostics.map((item, index) => ({
        code: `usecase-${index}`,
        level: item.level,
        message: item.message,
      })),
    );
  }, [onDiagnosticsChange, validation.diagnostics]);

  useEffect(() => {
    if (validation.hasFatalError) {
      onErrorChange(validationMessage || 'Use Case DSL 无效。');
      return;
    }
    onErrorChange(null);
  }, [onErrorChange, validation.hasFatalError, validationMessage]);

  useEffect(() => {
    if (validation.hasFatalError || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let cancelled = false;
    void layoutUseCaseGraph(graph.nodes, graph.edges, displaySettings, model)
      .then(({ layout, size }) => {
        if (cancelled) return;
        const merged = Object.fromEntries(Object.entries(layout).map(([id, position]) => [id, positions[id] ?? position]));
        setNodes(applyUmlPositions(graph.nodes, merged));
        setEdges(graph.edges);
        if (size) {
          setNodeSizes((current) => {
            const previous = current[systemBoundaryId()];
            if (previous) return current;
            return { ...current, [systemBoundaryId()]: size };
          });
        }
      })
      .catch(() => {
        if (!cancelled) onErrorChange('Use Case 自动排版失败，请检查图结构后重试。');
      });

    return () => {
      cancelled = true;
    };
  }, [displaySettings, graph.edges, graph.nodes, layoutRevision, model, onErrorChange, positions, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    setPositions({});
    setLayoutRevision((value) => value + 1);
  }, [displaySettings.actorSpacing, displaySettings.layoutDirection, displaySettings.nodeScale, displaySettings.useCaseSpacing, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    setNodes((current) =>
      current.map((node) => {
        const next = graph.nodes.find((item) => item.id === node.id);
        return next ? { ...node, data: next.data, style: next.style } : node;
      }),
    );
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, modelSignature, validation.hasFatalError]);

  useEffect(() => {
    setPositions(readStoredUmlNodePositions(positionScope));
  }, [positionScope]);

  useEffect(() => {
    setNodeSizes(readStoredUmlNodeSizes(contentScope));
    setLocalLabels(readStoredUmlLocalLabels(contentScope));
    setEdgeLabels(readStoredUmlEdgeLabels(contentScope));
  }, [contentScope]);

  useEffect(() => {
    writeStoredUmlNodePositions(positionScope, positions);
  }, [positionScope, positions]);

  useEffect(() => {
    writeStoredUmlNodeSizes(contentScope, nodeSizes);
  }, [contentScope, nodeSizes]);

  useEffect(() => {
    writeStoredUmlLocalLabels(contentScope, localLabels);
  }, [contentScope, localLabels]);

  useEffect(() => {
    writeStoredUmlEdgeLabels(contentScope, edgeLabels);
  }, [contentScope, edgeLabels]);

  useEffect(() => {
    if (validation.hasFatalError || nodes.length === 0) {
      onExportSvgReady('');
      return;
    }
    onExportSvgReady(exportUseCaseGraphToSvg(nodes, edges, { transparent: false }));
  }, [edges, nodes, onExportSvgReady, validation.hasFatalError]);

  useEffect(() => {
    if (fitRequest === 0) return;
    window.setTimeout(() => flowRef.current?.fitView({ duration: 260, padding: 0.14 }), 0);
  }, [fitRequest]);

  useEffect(() => {
    if (resetRequest === 0) return;
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
  }, [resetRequest]);

  const onNodesChange = useCallback((changes: NodeChange<UseCaseGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    const positionChanges = changes.filter((change): change is NodeChange<UseCaseGraphNode> & { id: string; position: XYPosition } => change.type === 'position' && Boolean(change.position));
    if (positionChanges.length > 0) {
      setPositions((current) => ({
        ...current,
        ...Object.fromEntries(positionChanges.map((change) => [change.id, change.position])),
      }));
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<UseCaseGraphEdge>[]) => {
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
      <div className="er-flow-shell">
        <div className="er-error-state">
          <strong>Use Case 输入不符合 DSL 规范</strong>
          <p>请使用以 usecase 开头的 DSL，并按 actors、usecases、associations、includes、extends、generalizations 分段填写。</p>
          <pre>{validationMessage}</pre>
        </div>
      </div>
    );
  }

  if (isBlankSource || graph.nodes.length === 0) {
    return <CanvasEmptyState diagramType="Use Case" />;
  }

  return (
    <div
      className="er-flow-shell usecase-flow-shell"
      style={
        {
          '--er-font-size': `${displaySettings.fontSize}px`,
          '--er-text': displaySettings.textColor,
          '--usecase-line': relationMarkerColor,
          '--usecase-line-width': displaySettings.lineWidth,
        } as React.CSSProperties
      }
    >
      <div className="er-flow-toolbar" data-no-canvas-pan="true">
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
          <button className={displaySettings.showSystemBoundary ? 'is-active' : ''} onClick={() => commitDisplay({ showSystemBoundary: !displaySettings.showSystemBoundary })} type="button">
            {text.systemBoundary}
          </button>
          <button className={displaySettings.showRelationLabels ? 'is-active' : ''} onClick={() => commitDisplay({ showRelationLabels: !displaySettings.showRelationLabels })} type="button">
            {text.showRelationLabels}
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
        nodes={nodes.filter((node) => displaySettings.showSystemBoundary || node.data.kind !== 'systemBoundary')}
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

export function UseCaseCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerUseCaseCanvas {...props} />
    </ReactFlowProvider>
  );
}
