import { edgeLabelData, umlNodeStyle, type UmlDisplaySettingsBase, type UmlGraphEdge, type UmlGraphNode } from './umlFlowModel';
import type { StoredUmlEdgeLabel } from '../storage/storage';

export type StructureDiagramKind = 'component' | 'deployment' | 'package';
export type StructureLayoutDirection = 'LR' | 'TB';

export type StructureContainerKind =
  | 'package'
  | 'frame'
  | 'folder'
  | 'cloud'
  | 'node'
  | 'device'
  | 'database'
  | 'execution';

export type StructureLeafKind = 'component' | 'interface' | 'artifact' | 'note' | 'port' | 'deployment-spec';
export type StructureNodeKind = StructureContainerKind | StructureLeafKind;
export type StructureEdgeKind = 'dependency' | 'realization' | 'assembly' | 'communication' | 'import' | 'merge' | 'usage' | 'delegation' | 'deployment' | 'hosting' | 'generalization' | 'note';
export type StructureRelationArrow = 'solid' | 'dashed' | 'none';

const allowedNodeKindsByDiagram: Record<StructureDiagramKind, ReadonlySet<StructureNodeKind>> = {
  component: new Set<StructureNodeKind>(['package', 'frame', 'folder', 'component', 'interface', 'note', 'port']),
  deployment: new Set<StructureNodeKind>(['cloud', 'node', 'device', 'database', 'execution', 'artifact', 'note', 'deployment-spec']),
  package: new Set<StructureNodeKind>(['package', 'frame', 'folder', 'note']),
};

const allowedEdgeKindsByDiagram: Record<StructureDiagramKind, ReadonlySet<StructureEdgeKind>> = {
  component: new Set<StructureEdgeKind>(['dependency', 'realization', 'assembly', 'usage', 'delegation', 'generalization']),
  deployment: new Set<StructureEdgeKind>(['communication', 'dependency', 'deployment', 'hosting', 'generalization']),
  package: new Set<StructureEdgeKind>(['dependency', 'import', 'merge', 'generalization']),
};

export interface StructureDisplaySettings extends UmlDisplaySettingsBase {
  containerPadding: number;
  edgeLabelOffset: number;
  lineColor: string;
  lineStyle: 'orthogonal' | 'smooth' | 'straight';
  lineWidth: number;
  rankGap: number;
  showArtifacts: boolean;
  showContainerHeaders: boolean;
  showGroupFrames: boolean;
  showInterfaces: boolean;
  showMetadata: boolean;
  showProtocolLabels: boolean;
  showRelationLabels: boolean;
}

export interface StructureDiagnostic {
  column: number;
  level: 'error';
  line: number;
  message: string;
}

export interface StructureValidation {
  diagnostics: StructureDiagnostic[];
  hasFatalError: boolean;
}

export interface StructureNodeDefinition {
  alias: string;
  containerAlias: string | null;
  description?: string;
  kind: StructureNodeKind;
  label: string;
  line: number;
  metadata?: string;
  providedInterfaces?: string[];
  requiredInterfaces?: string[];
  specProperties?: Array<{ name: string; value: string }>;
}

export interface StructureEdgeDefinition {
  from: string;
  id: string;
  kind: StructureEdgeKind;
  label?: string;
  line: number;
  to: string;
  visibility?: 'private' | 'public';
}

export interface StructureModel {
  diagramKind: StructureDiagramKind;
  edges: StructureEdgeDefinition[];
  nodes: StructureNodeDefinition[];
  title: string;
}

export interface StructureGraphNodeData extends Record<string, unknown> {
  description?: string;
  display: StructureDisplaySettings;
  kind: StructureNodeKind;
  label: string;
  metadata?: string;
  providedInterfaces?: string[];
  requiredInterfaces?: string[];
  specProperties?: Array<{ name: string; value: string }>;
  onLocalLabelEdit?: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: { height: number; width: number }) => void;
  selectedId: string | null;
}

export interface StructureGraphEdgeData extends Record<string, unknown> {
  display: StructureDisplaySettings;
  kind: StructureEdgeKind;
  label?: string;
  labelOffset?: { x: number; y: number };
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
  visibility?: 'private' | 'public';
}

export type StructureGraphNode = UmlGraphNode<StructureGraphNodeData>;
export type StructureGraphEdge = UmlGraphEdge<StructureGraphEdgeData>;

export interface StructureGraphBuildOptions {
  display: StructureDisplaySettings;
  edgeLabels: Record<string, StoredUmlEdgeLabel>;
  localLabels: Record<string, string>;
  nodeSizes: Record<string, { height: number; width: number }>;
  onEdgeLabelChange: (edgeId: string, text: string) => void;
  onEdgeLabelOffsetChange: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
  onLocalLabelEdit: (nodeId: string, value: string) => void;
  onNodeResize: (nodeId: string, size: { height: number; width: number }) => void;
  positions: Record<string, { x: number; y: number }>;
  selectedId: string | null;
}

const structureDefaults: Record<StructureDiagramKind, Partial<StructureDisplaySettings>> = {
  component: {
    layoutDirection: 'LR',
    showArtifacts: false,
    showInterfaces: true,
    showProtocolLabels: false,
  },
  deployment: {
    layoutDirection: 'TB',
    showArtifacts: true,
    showInterfaces: false,
    showProtocolLabels: true,
  },
  package: {
    layoutDirection: 'TB',
    showArtifacts: false,
    showInterfaces: false,
    showProtocolLabels: false,
  },
};

export function defaultStructureDisplaySettings(kind: StructureDiagramKind): StructureDisplaySettings {
  return {
    accentColor: '#507c69',
    containerPadding: 24,
    edgeLabelOffset: 14,
    fillColor: '#ffffff',
    fontSize: 15,
    layoutDirection: structureDefaults[kind].layoutDirection ?? 'TB',
    lineColor: '#171817',
    lineStyle: 'orthogonal',
    lineWidth: 1.5,
    nodeScale: 1,
    rankGap: 108,
    showArtifacts: structureDefaults[kind].showArtifacts ?? false,
    showContainerHeaders: true,
    showGroupFrames: true,
    showInterfaces: structureDefaults[kind].showInterfaces ?? false,
    showMetadata: true,
    showProtocolLabels: structureDefaults[kind].showProtocolLabels ?? false,
    showRelationLabels: true,
    strokeColor: '#171817',
    textColor: '#171817',
  };
}

export function darkStructureDisplaySettings(kind: StructureDiagramKind): StructureDisplaySettings {
  return {
    ...defaultStructureDisplaySettings(kind),
    accentColor: '#9EC6AD',
    fillColor: '#30362F',
    lineColor: '#F2F4EE',
    strokeColor: '#F2F4EE',
    textColor: '#F2F4EE',
  };
}

function lineNumberAt(source: string, index: number): { column: number; line: number } {
  const slice = source.slice(0, Math.max(0, index));
  const line = slice.split('\n').length;
  const lastBreak = slice.lastIndexOf('\n');
  const column = index - lastBreak;
  return { column, line };
}

function stripComment(line: string): string {
  const apostropheIndex = line.indexOf("'");
  return apostropheIndex >= 0 ? line.slice(0, apostropheIndex).trimEnd() : line.trimEnd();
}

function trimQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function unescapeQuoted(value: string): string {
  return trimQuotes(value).replace(/\\"/gu, '"');
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/gu, '_').replace(/[^\w:-]/gu, '').toLowerCase();
}

function makeAlias(kind: string, label: string, used: Set<string>): string {
  const base = normalizeIdentifier(label) || `${kind}_${used.size + 1}`;
  let alias = base;
  let index = 2;
  while (used.has(alias)) {
    alias = `${base}_${index}`;
    index += 1;
  }
  used.add(alias);
  return alias;
}

type ParsedStatement =
  | {
      alias?: string;
      description?: string;
      kind: StructureNodeKind;
      label: string;
      line: number;
      metadata?: string;
      type: 'node';
    }
  | {
      alias?: string;
      description?: string;
      kind: StructureContainerKind;
      label: string;
      line: number;
      metadata?: string;
      type: 'container-open';
    }
  | {
      line: number;
      type: 'container-close';
    }
  | {
      from: string;
      kind: StructureEdgeKind;
      label?: string;
      line: number;
      to: string;
      type: 'edge';
      visibility?: 'private' | 'public';
    }
  | {
      line: number;
      title: string;
      type: 'title';
    };

function parseNodeLine(
  line: string,
  lineNumber: number,
  diagnostics: StructureDiagnostic[],
): ParsedStatement | null {
  const nodePattern =
    /^(?<kind>component|interface|artifact|package|frame|folder|cloud|node|device|database|port|deployment-spec)\s+(?<label>"(?:[^"\\]|\\.)+"|[^\[{]+?)(?:\s+as\s+(?<alias>[A-Za-z_][\w:-]*))?(?:\s*\[(?<metadata>[^\]]+)\])?\s*(?<open>\{)?$/iu;
  const executionPattern =
    /^(?<kind>execution)\s+"(?<label>(?:[^"\\]|\\.)+)"\s+(?:as\s+(?<alias>[A-Za-z_][\w:-]*))?(?:\s+in\s+(?<container>[A-Za-z_][\w:-]*))?(?:\s*\[(?<metadata>[^\]]+)\])?\s*(?<open>\{)?$/iu;
  const notePattern =
    /^note\s+"(?<label>(?:[^"\\]|\\.)+)"(?:\s+as\s+(?<alias>[A-Za-z_][\w:-]*))?(?:\s+of\s+(?<target>[A-Za-z_][\w:-]*))?$/iu;

  const execution = line.match(executionPattern);
  if (execution?.groups) {
    return {
      alias: execution.groups.alias?.trim() || undefined,
      description: execution.groups.container?.trim() || undefined,
      kind: 'execution',
      label: unescapeQuoted(execution.groups.label),
      line: lineNumber,
      metadata: execution.groups.metadata?.trim(),
      type: execution.groups.open ? 'container-open' : 'node',
    };
  }

  const note = line.match(notePattern);
  if (note?.groups) {
    return {
      alias: note.groups.alias?.trim() || undefined,
      description: note.groups.target?.trim() || undefined,
      kind: 'note',
      label: unescapeQuoted(note.groups.label),
      line: lineNumber,
      type: 'node',
    };
  }

  const match = line.match(nodePattern);
  if (!match?.groups) return null;

  const kind = match.groups.kind.toLowerCase() as StructureNodeKind;
  const label = unescapeQuoted(match.groups.label);
  if (!label) {
    diagnostics.push({ column: 1, level: 'error', line: lineNumber, message: `${kind} label cannot be empty.` });
    return null;
  }

  if (match.groups.open) {
    return {
      alias: match.groups.alias?.trim() || undefined,
      kind: kind as StructureContainerKind,
      label,
      line: lineNumber,
      metadata: match.groups.metadata?.trim(),
      type: 'container-open',
    };
  }

  return {
    alias: match.groups.alias?.trim() || undefined,
    kind,
    label,
    line: lineNumber,
    metadata: match.groups.metadata?.trim(),
    type: 'node',
  };
}

function parseEdgeLine(line: string, lineNumber: number): ParsedStatement | null {
  const pattern =
    /^(?<from>[A-Za-z_][\w:-]*)\s*(?<arrow>--\|>|\.\.\|>|\.\.>|-->|-up->|-down->|-left->|-right->|\.\.up\.\.>|\.\.down\.\.>|\.\.left\.\.>|\.\.right\.\.>|-\(>-|<\.\.|\.\.>|\*-->)\s*(?<to>[A-Za-z_][\w:-]*)(?:\s*:\s*(?<label>.+))?$/iu;
  const match = line.match(pattern);
  if (!match?.groups) return null;

  const arrow = match.groups.arrow;
  let kind: StructureEdgeKind = 'dependency';
  if (arrow.endsWith('|>')) kind = 'generalization';
  else if (arrow.includes('(')) kind = 'assembly';
  else if (arrow.startsWith('<') || arrow.includes('*')) kind = 'merge';
  else if (arrow.startsWith('..')) kind = 'dependency';
  else kind = 'realization';

  return {
    from: match.groups.from.trim(),
    kind,
    label: match.groups.label?.trim(),
    line: lineNumber,
    to: match.groups.to.trim(),
    type: 'edge',
  };
}

function parseSpecializedEdgeLine(line: string, lineNumber: number): ParsedStatement | null {
  const keywordMatch = line.match(
    /^(?<from>[A-Za-z_][\w:-]*)\s+(?<kind>uses|delegates|deploys|hosts)\s+(?<to>[A-Za-z_][\w:-]*)(?:\s*:\s*(?<label>.+))?$/iu,
  );
  if (keywordMatch?.groups) {
    const kindMap: Record<string, StructureEdgeKind> = {
      delegates: 'delegation',
      deploys: 'deployment',
      hosts: 'hosting',
      uses: 'usage',
    };
    return {
      from: keywordMatch.groups.from.trim(),
      kind: kindMap[keywordMatch.groups.kind.toLowerCase()],
      label: keywordMatch.groups.label?.trim(),
      line: lineNumber,
      to: keywordMatch.groups.to.trim(),
      type: 'edge',
    };
  }

  const specializedPatterns: Array<{ kind: StructureEdgeKind; pattern: RegExp }> = [
    { kind: 'import', pattern: /^(?<from>[A-Za-z_][\w:-]*)\s+\.\.>\s+(?<to>[A-Za-z_][\w:-]*)\s*<<import>>(?:\s*\[(?<visibility>public|private)\])?(?:\s*:\s*(?<label>.+))?$/iu },
    { kind: 'merge', pattern: /^(?<from>[A-Za-z_][\w:-]*)\s+\.\.>\s+(?<to>[A-Za-z_][\w:-]*)\s*<<merge>>(?:\s*:\s*(?<label>.+))?$/iu },
    { kind: 'communication', pattern: /^(?<from>[A-Za-z_][\w:-]*)\s+--\s+(?<to>[A-Za-z_][\w:-]*)(?:\s*:\s*(?<label>.+))?$/iu },
  ];

  for (const candidate of specializedPatterns) {
    const match = line.match(candidate.pattern);
    if (!match?.groups) continue;
    return {
      from: match.groups.from.trim(),
      kind: candidate.kind,
      label: match.groups.label?.trim(),
      line: lineNumber,
      to: match.groups.to.trim(),
      type: 'edge',
      visibility: match.groups.visibility?.toLowerCase() as 'private' | 'public' | undefined,
    };
  }

  return parseEdgeLine(line, lineNumber);
}

function isVisibleNode(kind: StructureNodeKind, display: StructureDisplaySettings): boolean {
  if (kind === 'artifact') return display.showArtifacts;
  if (kind === 'interface') return display.showInterfaces;
  if (kind === 'frame' || kind === 'folder' || kind === 'package') return display.showGroupFrames;
  return true;
}

function isVisibleStructureNode(
  node: StructureNodeDefinition,
  diagramKind: StructureDiagramKind,
  display: StructureDisplaySettings,
): boolean {
  if (diagramKind === 'package' && (node.kind === 'frame' || node.kind === 'folder' || node.kind === 'package')) {
    return true;
  }
  return isVisibleNode(node.kind, display);
}

function inferContainerAlias(targetAlias: string | undefined, nodes: StructureNodeDefinition[]): string | null {
  if (!targetAlias) return null;
  const target = nodes.find((node) => node.alias === targetAlias);
  return target?.containerAlias ?? null;
}

function extractInterfaceList(metadata: string | undefined, key: 'provided' | 'required'): string[] | undefined {
  if (!metadata) return undefined;
  const match = metadata.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, 'iu'));
  if (!match) return undefined;
  return match[1].split(/[,|]/u).map((item) => item.trim()).filter(Boolean);
}

function parseSpecProperties(metadata: string | undefined): Array<{ name: string; value: string }> | undefined {
  if (!metadata) return undefined;
  const properties = metadata
    .split(/[;,]/u)
    .map((part) => part.trim())
    .map((part) => part.match(/^([\w.-]+)\s*=\s*(.+)$/u))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ name: match[1], value: trimQuotes(match[2]) }));
  return properties.length > 0 ? properties : undefined;
}

export function parseStructureSource(source: string, diagramKind: StructureDiagramKind): StructureModel {
  const diagnostics: StructureDiagnostic[] = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  const statements: ParsedStatement[] = [];
  const title = '';

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripComment(rawLine).trim();
    if (!line) return;
    if (/^@startuml$/iu.test(line) || /^@enduml$/iu.test(line) || /^left\s+to\s+right\s+direction$/iu.test(line) || /^top\s+to\s+bottom\s+direction$/iu.test(line)) {
      return;
    }

    const titleMatch = line.match(/^title\s+(.+)$/iu);
    if (titleMatch) {
      statements.push({ line: lineNumber, title: trimQuotes(titleMatch[1]), type: 'title' });
      return;
    }

    if (line === '{') {
      diagnostics.push({ column: 1, level: 'error', line: lineNumber, message: 'Container opening must be declared on the same line as the element.' });
      return;
    }

    if (line === '}') {
      statements.push({ line: lineNumber, type: 'container-close' });
      return;
    }

    const parsedNode = parseNodeLine(line, lineNumber, diagnostics);
    if (parsedNode) {
      statements.push(parsedNode);
      return;
    }

    const parsedEdge = parseSpecializedEdgeLine(line, lineNumber);
    if (parsedEdge) {
      statements.push(parsedEdge);
      return;
    }

    const { column } = lineNumberAt(source, source.indexOf(rawLine));
    diagnostics.push({ column, level: 'error', line: lineNumber, message: `Unrecognized PlantUML statement: ${line}` });
  });

  if (diagnostics.length > 0) {
    const error = new Error(diagnostics.map((item) => `L${item.line}:${item.column} ${item.message}`).join('\n'));
    (error as Error & { diagnostics?: StructureDiagnostic[] }).diagnostics = diagnostics;
    throw error;
  }

  const usedAliases = new Set<string>();
  const stack: Array<{ alias: string; kind: StructureContainerKind; label: string }> = [];
  const nodes: StructureNodeDefinition[] = [];
  const edges: StructureEdgeDefinition[] = [];
  let currentTitle = '';

  statements.forEach((statement) => {
    if (statement.type === 'title') {
      currentTitle = statement.title;
      return;
    }

    if (statement.type === 'container-close') {
      if (stack.length === 0) {
        throw new Error(`L${statement.line}: unexpected closing brace.`);
      }
      stack.pop();
      return;
    }

    if (statement.type === 'container-open') {
      const alias = statement.alias?.trim() || makeAlias(statement.kind, statement.label, usedAliases);
      usedAliases.add(alias);
      nodes.push({
        alias,
        containerAlias: statement.kind === 'execution' && statement.description ? statement.description : stack.at(-1)?.alias ?? null,
        description: statement.description,
        kind: statement.kind,
        label: statement.label,
        line: statement.line,
        metadata: statement.metadata,
        providedInterfaces: extractInterfaceList(statement.metadata, 'provided'),
        requiredInterfaces: extractInterfaceList(statement.metadata, 'required'),
        specProperties: parseSpecProperties(statement.metadata),
      });
      stack.push({ alias, kind: statement.kind, label: statement.label });
      return;
    }

    if (statement.type === 'node') {
      const alias = statement.alias?.trim() || makeAlias(statement.kind, statement.label, usedAliases);
      usedAliases.add(alias);
      nodes.push({
        alias,
        containerAlias:
          statement.kind === 'note'
            ? inferContainerAlias(statement.description, nodes)
            : statement.kind === 'execution' && statement.description
              ? statement.description
              : stack.at(-1)?.alias ?? null,
        description: statement.description,
        kind: statement.kind,
        label: statement.label,
        line: statement.line,
        metadata: statement.metadata,
        providedInterfaces: extractInterfaceList(statement.metadata, 'provided'),
        requiredInterfaces: extractInterfaceList(statement.metadata, 'required'),
        specProperties: parseSpecProperties(statement.metadata),
      });
      return;
    }

    if (statement.type === 'edge') {
      edges.push({
        from: statement.from,
        id: `${statement.kind}:${edges.length + 1}`,
        kind: statement.kind,
        label: statement.label,
        line: statement.line,
        to: statement.to,
        visibility: statement.visibility,
      });
    }
  });

  if (stack.length > 0) {
    const open = stack.at(-1);
    throw new Error(`L${nodes.find((node) => node.alias === open?.alias)?.line ?? 1}: container "${open?.label}" is not closed.`);
  }

  return {
    diagramKind,
    edges,
    nodes,
    title: currentTitle || `${diagramKind[0].toUpperCase()}${diagramKind.slice(1)} diagram`,
  };
}

export function validateStructureSource(source: string, diagramKind: StructureDiagramKind): StructureValidation {
  try {
    const model = parseStructureSource(source, diagramKind);
    const diagnostics: StructureDiagnostic[] = [];
    const aliases = new Map(model.nodes.map((node) => [node.alias, node]));
    const allowedNodes = allowedNodeKindsByDiagram[diagramKind];
    const allowedEdges = allowedEdgeKindsByDiagram[diagramKind];

    model.edges.forEach((edge) => {
      if (!aliases.has(edge.from)) diagnostics.push({ column: 1, level: 'error', line: edge.line, message: `Unknown source alias: ${edge.from}` });
      if (!aliases.has(edge.to)) diagnostics.push({ column: 1, level: 'error', line: edge.line, message: `Unknown target alias: ${edge.to}` });
      if (!allowedEdges.has(edge.kind)) {
        diagnostics.push({ column: 1, level: 'error', line: edge.line, message: `${diagramKind} diagram does not support relation kind: ${edge.kind}` });
      }
    });

    model.nodes.forEach((node) => {
      if (!allowedNodes.has(node.kind)) {
        diagnostics.push({ column: 1, level: 'error', line: node.line, message: `${diagramKind} diagram does not support element kind: ${node.kind}` });
      }
      if (node.containerAlias && !aliases.has(node.containerAlias)) {
        diagnostics.push({ column: 1, level: 'error', line: node.line, message: `Unknown container alias: ${node.containerAlias}` });
      }
      if (node.kind === 'execution' && node.description && !aliases.has(node.description)) {
        diagnostics.push({ column: 1, level: 'error', line: node.line, message: `Unknown execution host alias: ${node.description}` });
      }
      if (node.kind === 'note' && node.description && !aliases.has(node.description)) {
        diagnostics.push({ column: 1, level: 'error', line: node.line, message: `Unknown note target alias: ${node.description}` });
      }
    });

    return {
      diagnostics,
      hasFatalError: diagnostics.length > 0,
    };
  } catch (error) {
    const diagnostics = (error as Error & { diagnostics?: StructureDiagnostic[] }).diagnostics;
    if (diagnostics) {
      return { diagnostics, hasFatalError: true };
    }
    return {
      diagnostics: [{ column: 1, level: 'error', line: 1, message: error instanceof Error ? error.message : 'Structure parsing failed.' }],
      hasFatalError: true,
    };
  }
}

export function formatStructureSource(source: string): string {
  return source
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
}

export function getStructureModelSignature(model: StructureModel, display: StructureDisplaySettings): string {
  return JSON.stringify({
    diagramKind: model.diagramKind,
    display,
    edges: model.edges,
    nodes: model.nodes,
    title: model.title,
  });
}

export function renameStructureModelLabel(model: StructureModel, nodeId: string, nextValue: string): StructureModel {
  const value = nextValue.trim();
  if (!value) return model;
  return {
    ...model,
    nodes: model.nodes.map((node) => (node.alias === nodeId ? { ...node, label: value } : node)),
    title: nodeId === '__structure_title__' ? value : model.title,
  };
}

function fallbackNodeSize(kind: StructureNodeKind, display: StructureDisplaySettings): { height: number; width: number } {
  const scale = Math.min(1.45, Math.max(0.72, display.nodeScale || 1));
  if (kind === 'component') return { height: 84 * scale, width: 220 * scale };
  if (kind === 'interface') return { height: 68 * scale, width: 132 * scale };
  if (kind === 'artifact') return { height: 72 * scale, width: 188 * scale };
  if (kind === 'note') return { height: 92 * scale, width: 188 * scale };
  if (kind === 'port') return { height: 30 * scale, width: 48 * scale };
  if (kind === 'deployment-spec') return { height: 112 * scale, width: 192 * scale };
  if (kind === 'execution') return { height: 120 * scale, width: 232 * scale };
  return { height: 220 * scale, width: 320 * scale };
}

function relationLabel(edge: StructureEdgeDefinition, display: StructureDisplaySettings): string | undefined {
  if (edge.label) return edge.label;
  if (!display.showRelationLabels) return undefined;
  if (edge.kind === 'import') return '<<import>>';
  if (edge.kind === 'merge') return '<<merge>>';
  if (edge.kind === 'realization') return '<<realize>>';
  if (edge.kind === 'usage') return '<<use>>';
  if (edge.kind === 'delegation') return '<<delegate>>';
  if (edge.kind === 'deployment') return '<<deploy>>';
  if (edge.kind === 'hosting') return '<<host>>';
  return undefined;
}

export function buildStructureGraph(
  model: StructureModel,
  options: StructureGraphBuildOptions,
): { edges: StructureGraphEdge[]; nodes: StructureGraphNode[] } {
  const allowedNodes = allowedNodeKindsByDiagram[model.diagramKind];
  const allowedEdges = allowedEdgeKindsByDiagram[model.diagramKind];
  const nodes: StructureGraphNode[] = model.nodes
    .filter((node) => allowedNodes.has(node.kind))
    .filter((node) => isVisibleStructureNode(node, model.diagramKind, options.display))
    .map((node, index) => {
      const size = options.nodeSizes[node.alias] ?? fallbackNodeSize(node.kind, options.display);
      return {
        data: {
          description: node.description,
          display: options.display,
          kind: node.kind,
          label: options.localLabels[node.alias] ?? node.label,
          metadata: options.display.showMetadata ? node.metadata : undefined,
          onLocalLabelEdit: options.onLocalLabelEdit,
          onNodeResize: options.onNodeResize,
          providedInterfaces: node.providedInterfaces,
          requiredInterfaces: node.requiredInterfaces,
          selectedId: options.selectedId,
          specProperties: node.specProperties,
        },
        id: node.alias,
        position: options.positions[node.alias] ?? {
          x: model.diagramKind === 'component' ? 80 + (index % 3) * 280 : 80 + (index % 2) * 340,
          y: 80 + Math.floor(index / (model.diagramKind === 'component' ? 3 : 2)) * options.display.rankGap,
        },
        style: {
          ...umlNodeStyle(options.display),
          height: size.height,
          width: size.width,
        },
        type: `structure-${node.kind}`,
      };
    });

  const visibleAliases = new Set(nodes.map((node) => node.id));
  const edges: StructureGraphEdge[] = model.edges
    .filter((edge) => allowedEdges.has(edge.kind))
    .filter((edge) => visibleAliases.has(edge.from) && visibleAliases.has(edge.to))
    .map((edge) => {
      const fallback = relationLabel(edge, options.display);
      return {
        data: {
          kind: edge.kind,
          visibility: edge.visibility,
          ...edgeLabelData(
            edge.id,
            fallback,
            options.display,
            options.edgeLabels,
            options.onEdgeLabelChange,
            options.onEdgeLabelOffsetChange,
          ),
        },
        id: edge.id,
        label: fallback,
        source: edge.from,
        target: edge.to,
        type: 'structure-edge',
      };
    });

  return { edges, nodes };
}

export function getStructureEdgeArrow(kind: StructureEdgeKind): StructureRelationArrow {
  if (kind === 'communication') return 'none';
  if (kind === 'assembly' || kind === 'generalization') return 'solid';
  return 'dashed';
}

export function isStructureContainerKind(kind: StructureNodeKind): kind is StructureContainerKind {
  return ['package', 'frame', 'folder', 'cloud', 'node', 'device', 'database', 'execution'].includes(kind);
}

export function isStructureSourceCompatible(source: string, diagramKind: StructureDiagramKind): boolean {
  const validation = validateStructureSource(source, diagramKind);
  return !validation.hasFatalError;
}
