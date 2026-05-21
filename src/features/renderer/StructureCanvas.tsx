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
import { StructureRelationEdge } from './structureFlowEdges';
import {
  StructureArtifactNode,
  StructureCloudNode,
  StructureComponentNode,
  StructureContainerNode,
  StructureDatabaseNode,
  StructureDeploymentSpecNode,
  StructureDeviceNode,
  StructureInterfaceNode,
  StructureNodeBox,
  StructureNoteNode,
  StructurePortNode,
} from './structureFlowNodes';
import {
  buildStructureGraph,
  defaultStructureDisplaySettings,
  formatStructureSource,
  getStructureModelSignature,
  parseStructureSource,
  renameStructureModelLabel,
  validateStructureSource,
  type StructureDiagramKind,
  type StructureDisplaySettings,
  type StructureGraphEdge,
  type StructureGraphNode,
  type StructureModel,
} from './structureModel';
import { exportStructureGraphToSvg } from './structureSvgExport';

export type { StructureDisplaySettings };
export { defaultStructureDisplaySettings, darkStructureDisplaySettings, formatStructureSource, isStructureSourceCompatible } from './structureModel';

interface Props {
  diagramKind: StructureDiagramKind;
  displaySettings: StructureDisplaySettings;
  fitRequest: number;
  resetRequest: number;
  source: string;
  text: Messages;
  themeMode?: 'light' | 'dark';
  onDiagnosticsChange?: (diagnostics: DiagramDiagnostic[]) => void;
  onDisplaySettingsChange: (settings: StructureDisplaySettings) => void;
  onErrorChange: (error: string | null) => void;
  onExportSvgReady: (svg: string) => void;
  onSourceChange: (source: string) => void;
}

const nodeTypes = {
  'structure-artifact': StructureArtifactNode,
  'structure-cloud': StructureCloudNode,
  'structure-component': StructureComponentNode,
  'structure-database': StructureDatabaseNode,
  'structure-deployment-spec': StructureDeploymentSpecNode,
  'structure-device': StructureDeviceNode,
  'structure-execution': StructureContainerNode,
  'structure-folder': StructureContainerNode,
  'structure-frame': StructureContainerNode,
  'structure-interface': StructureInterfaceNode,
  'structure-node': StructureNodeBox,
  'structure-note': StructureNoteNode,
  'structure-package': StructureContainerNode,
  'structure-port': StructurePortNode,
};

const edgeTypes = {
  'structure-edge': StructureRelationEdge,
};

const emptyModel: StructureModel = {
  diagramKind: 'component',
  edges: [],
  nodes: [],
  title: '',
};

function safeValidateStructureSource(source: string, diagramKind: StructureDiagramKind) {
  try {
    return validateStructureSource(source, diagramKind);
  } catch (error) {
    return {
      diagnostics: [{ column: 1, level: 'error' as const, line: 1, message: error instanceof Error ? error.message : 'Structure validation failed.' }],
      hasFatalError: true,
    };
  }
}

function safeParseStructureModel(source: string, diagramKind: StructureDiagramKind): StructureModel {
  try {
    return parseStructureSource(source, diagramKind);
  } catch {
    return { ...emptyModel, diagramKind };
  }
}

async function layoutStructureGraph(
  nodes: StructureGraphNode[],
  edges: StructureGraphEdge[],
  displaySettings: StructureDisplaySettings,
): Promise<Record<string, XYPosition>> {
  return layoutUmlGraph(nodes, edges, {
    direction: displaySettings.layoutDirection,
    edgeNodeBetweenLayers: 46,
    edgeRouting: displaySettings.lineStyle === 'orthogonal' ? 'ORTHOGONAL' : 'POLYLINE',
    nodeNodeBetweenLayers: displaySettings.rankGap,
    spacingEdgeEdge: 20,
    spacingNodeNode: Math.max(38, Math.round(displaySettings.rankGap * 0.62)),
  });
}

function InnerStructureCanvas({
  diagramKind,
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
  const flowRef = useRef<ReactFlowInstance<StructureGraphNode, StructureGraphEdge> | null>(null);
  const [nodes, setNodes] = useState<StructureGraphNode[]>([]);
  const [edges, setEdges] = useState<StructureGraphEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const positionScope = useMemo(() => buildHashScope(`${diagramKind}-structure-v1`, source, displaySettings.layoutDirection), [diagramKind, displaySettings.layoutDirection, source]);
  const contentScope = useMemo(() => buildHashScope(`${diagramKind}-structure-content`, source, displaySettings.layoutDirection), [diagramKind, displaySettings.layoutDirection, source]);
  const [positions, setPositions] = useState<Record<string, XYPosition>>(() => readStoredUmlNodePositions(positionScope));
  const [nodeSizes, setNodeSizes] = useState<Record<string, { height: number; width: number }>>(() => readStoredUmlNodeSizes(contentScope));
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(() => readStoredUmlLocalLabels(contentScope));
  const [edgeLabels, setEdgeLabels] = useState<Record<string, { dx: number; dy: number; text: string }>>(() => readStoredUmlEdgeLabels(contentScope));

  const isBlankSource = source.trim().length === 0;
  const validation = useMemo(() => (isBlankSource ? { diagnostics: [], hasFatalError: false } : safeValidateStructureSource(source, diagramKind)), [diagramKind, isBlankSource, source]);
  const validationMessage = useMemo(() => validation.diagnostics.map((item) => `L${item.line}:${item.column} ${item.message}`).join('\n'), [validation.diagnostics]);
  const model = useMemo(() => (validation.hasFatalError ? { ...emptyModel, diagramKind } : safeParseStructureModel(source, diagramKind)), [diagramKind, source, validation.hasFatalError]);
  const modelSignature = useMemo(() => getStructureModelSignature(model, displaySettings), [displaySettings, model]);

  const graph = useMemo(() => {
    try {
      return buildStructureGraph(model, {
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
          onSourceChange(formatStructureSource(structureModelToSource(renameStructureModelLabel(model, nodeId, value))));
        },
        onNodeResize: (nodeId, size) => setNodeSizes((sizes) => ({ ...sizes, [nodeId]: size })),
        positions,
        selectedId,
      });
    } catch {
      onErrorChange('Structure graph model build failed.');
      return { edges: [], nodes: [] };
    }
  }, [displaySettings, edgeLabels, localLabels, model, nodeSizes, onErrorChange, onSourceChange, positions, selectedId]);

  useEffect(() => {
    onDiagnosticsChange?.(
      validation.diagnostics.map((item, index) => ({
        code: `structure-${index}`,
        level: item.level,
        message: item.message,
        sourceRange: { column: item.column, line: item.line },
      })),
    );
  }, [onDiagnosticsChange, validation.diagnostics]);

  useEffect(() => {
    if (validation.hasFatalError) {
      onErrorChange(validationMessage || 'Structure DSL is invalid.');
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
    void layoutStructureGraph(graph.nodes, graph.edges, displaySettings)
      .then((layout) => {
        if (cancelled) return;
        const merged = Object.fromEntries(Object.entries(layout).map(([id, position]) => [id, positions[id] ?? position]));
        setNodes(applyUmlPositions(graph.nodes, merged));
        setEdges(graph.edges);
      })
      .catch(() => {
        if (!cancelled) onErrorChange('Auto layout failed for the current structure diagram.');
      });

    return () => {
      cancelled = true;
    };
  }, [displaySettings, graph.edges, graph.nodes, layoutRevision, onErrorChange, positions, validation.hasFatalError]);

  useEffect(() => {
    if (validation.hasFatalError) return;
    setPositions({});
    setLayoutRevision((value) => value + 1);
  }, [diagramKind, displaySettings.layoutDirection, displaySettings.nodeScale, displaySettings.rankGap, validation.hasFatalError]);

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
    onExportSvgReady(exportStructureGraphToSvg(nodes, edges, { transparent: false }));
  }, [edges, nodes, onExportSvgReady, validation.hasFatalError]);

  useEffect(() => {
    if (fitRequest === 0) return;
    window.setTimeout(() => flowRef.current?.fitView({ duration: 260, padding: 0.14 }), 0);
  }, [fitRequest]);

  useEffect(() => {
    if (resetRequest === 0) return;
    flowRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 });
  }, [resetRequest]);

  const onNodesChange = useCallback((changes: NodeChange<StructureGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    const positionChanges = changes.filter((change): change is NodeChange<StructureGraphNode> & { id: string; position: XYPosition } => change.type === 'position' && Boolean(change.position));
    if (positionChanges.length > 0) {
      setPositions((current) => ({
        ...current,
        ...Object.fromEntries(positionChanges.map((change) => [change.id, change.position])),
      }));
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<StructureGraphEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  function autoLayout(): void {
    setPositions({});
    setLayoutRevision((value) => value + 1);
    window.setTimeout(() => flowRef.current?.fitView({ duration: 280, padding: 0.14 }), 80);
  }

  if (validation.hasFatalError) {
    return (
      <div className="er-flow-shell structure-flow-shell">
        <div className="er-error-state">
          <strong>{text.error}</strong>
          <p>{text.structureInvalidBody}</p>
          <pre>{validationMessage}</pre>
        </div>
      </div>
    );
  }

  if (isBlankSource || graph.nodes.length === 0) {
    return <CanvasEmptyState diagramType={diagramKind} />;
  }

  return (
    <div
      className="er-flow-shell structure-flow-shell"
      style={
        {
          '--er-font-size': `${displaySettings.fontSize}px`,
          '--er-text': displaySettings.textColor,
          '--structure-line': displaySettings.lineColor,
          '--structure-line-width': displaySettings.lineWidth,
        } as React.CSSProperties
      }
    >
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
          <button onClick={autoLayout} type="button">
            {text.autoLayout}
          </button>
          <button onClick={() => flowRef.current?.fitView({ duration: 260, padding: 0.14 })} type="button">
            {text.fitView}
          </button>
        </div>
        <div className="er-tool-group">
          <button className={displaySettings.showRelationLabels ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, showRelationLabels: !displaySettings.showRelationLabels })} type="button">
            {text.showRelationLabels}
          </button>
          <button className={displaySettings.showMetadata ? 'is-active' : ''} onClick={() => onDisplaySettingsChange({ ...displaySettings, showMetadata: !displaySettings.showMetadata })} type="button">
            {text.showMetadata}
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

function structureModelToSource(model: StructureModel): string {
  const lines = ['@startuml', `title ${model.title}`, ''];
  const childrenByContainer = new Map<string | null, StructureModel['nodes']>();

  model.nodes.forEach((node) => {
    const bucket = childrenByContainer.get(node.containerAlias) ?? [];
    bucket.push(node);
    childrenByContainer.set(node.containerAlias, bucket);
  });

  function renderNode(alias: string | null, indent = ''): void {
    const children = childrenByContainer.get(alias) ?? [];
    children.forEach((node) => {
      const aliasSuffix = node.alias && node.alias !== node.label ? ` as ${node.alias}` : '';
      const metadata = node.metadata ? ` [${node.metadata}]` : '';
      if (['package', 'frame', 'folder', 'cloud', 'node', 'device', 'database', 'execution'].includes(node.kind)) {
        if (node.kind === 'execution' && node.description) {
          lines.push(`${indent}execution "${node.label}" as ${node.alias} in ${node.description}${metadata} {`);
        } else {
          lines.push(`${indent}${node.kind} "${node.label}"${aliasSuffix}${metadata} {`);
        }
        renderNode(node.alias, `${indent}  `);
        lines.push(`${indent}}`);
      } else if (node.kind === 'note') {
        lines.push(`${indent}note "${node.label}"${aliasSuffix}${node.description ? ` of ${node.description}` : ''}`);
      } else {
        lines.push(`${indent}${node.kind} "${node.label}"${aliasSuffix}${metadata}`);
      }
    });
  }

  renderNode(null);

  if (model.edges.length > 0) {
    lines.push('');
    model.edges.forEach((edge) => {
      const relation =
        edge.kind === 'communication'
          ? '--'
          : edge.kind === 'usage'
            ? 'uses'
            : edge.kind === 'delegation'
              ? 'delegates'
              : edge.kind === 'deployment'
                ? 'deploys'
                : edge.kind === 'hosting'
                  ? 'hosts'
          : edge.kind === 'assembly'
            ? '-(>-'
            : edge.kind === 'realization'
              ? '-->'
              : edge.kind === 'import'
                ? `..> <<import>>${edge.visibility ? ` [${edge.visibility}]` : ''}`
                : edge.kind === 'merge'
                  ? '..> <<merge>>'
                  : edge.kind === 'generalization'
                    ? '--|>'
                  : '..>';
      lines.push(`${edge.from} ${relation} ${edge.to}${edge.label ? ` : ${edge.label}` : ''}`);
    });
  }

  lines.push('@enduml');
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
}

export function structureModelToPlantUmlSource(model: StructureModel): string {
  return structureModelToSource(model);
}

export function StructureCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerStructureCanvas {...props} />
    </ReactFlowProvider>
  );
}
