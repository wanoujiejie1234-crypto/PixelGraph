import { edgeLabelData, umlNodeStyle, type UmlDisplaySettingsBase, type UmlGraphEdge, type UmlGraphNode } from './umlFlowModel';
import type { StoredUmlEdgeLabel } from '../storage/storage';

export const SEQUENCE_MESSAGE_START_Y = 174;
export const SEQUENCE_MESSAGE_STEP = 52;

export type SimpleDiagramKind = 'class' | 'sequence' | 'state';
export type SimpleNodeKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'lifeline'
  | 'fragment'
  | 'state'
  | 'initial'
  | 'final'
  | 'choice'
  | 'history';
export type SimpleEdgeKind =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'message'
  | 'asyncMessage'
  | 'reply'
  | 'create'
  | 'destroy'
  | 'transition';

export interface SimpleDisplaySettings extends UmlDisplaySettingsBase {
  lineColor: string;
  lineStyle: 'orthogonal' | 'smooth' | 'straight';
  lineWidth: number;
  rankGap: number;
  showDetails: boolean;
}

export interface ActivationRange {
  participantId: string;
  startSequenceIndex: number;
  endSequenceIndex: number;
  depth: number;
}

export interface ClassMember {
  visibility: '+' | '-' | '#' | '~' | '';
  name: string;
  type: string;
  parameters?: string;
  isMethod: boolean;
  isAbstract: boolean;
  isStatic: boolean;
  raw: string;
}

export interface SimpleNodeDefinition {
  children?: string[];
  details?: string[];
  members?: ClassMember[];
  fragmentMessageRange?: { startIndex: number; endIndex: number };
  id: string;
  kind: SimpleNodeKind;
  label: string;
  line: number;
  parentId?: string;
  stereotype?: string;
}

export interface SimpleEdgeDefinition {
  from: string;
  id: string;
  kind: SimpleEdgeKind;
  label?: string;
  line: number;
  sequenceIndex?: number;
  sourceCardinality?: string;
  startMarker?: string;
  endMarker?: string;
  targetCardinality?: string;
  to: string;
}

export interface SimpleModel {
  diagramKind: SimpleDiagramKind;
  edges: SimpleEdgeDefinition[];
  nodes: SimpleNodeDefinition[];
  title: string;
}

export interface SimpleGraphNodeData extends Record<string, unknown> {
  activations?: ActivationRange[];
  childIds?: string[];
  details?: string[];
  members?: ClassMember[];
  display: SimpleDisplaySettings;
  fragmentMessageRange?: { startIndex: number; endIndex: number };
  kind: SimpleNodeKind;
  label: string;
  lifelineTop?: number;
  onLocalLabelEdit?: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: { height: number; width: number }) => void;
  parentId?: string;
  selectedId: string | null;
  stereotype?: string;
}

export interface SimpleGraphEdgeData extends Record<string, unknown> {
  display: SimpleDisplaySettings;
  kind: SimpleEdgeKind;
  label?: string;
  labelOffset?: { x: number; y: number };
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
  sequenceIndex?: number;
  sequenceNumber?: string;
  sourceCardinality?: string;
  startMarker?: string;
  endMarker?: string;
  targetCardinality?: string;
}

export type SimpleGraphNode = UmlGraphNode<SimpleGraphNodeData>;
export type SimpleGraphEdge = UmlGraphEdge<SimpleGraphEdgeData>;

export interface SimpleGraphBuildOptions {
  display: SimpleDisplaySettings;
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

export interface SimpleValidation {
  diagnostics: Array<{ level: 'error'; message: string }>;
  hasFatalError: boolean;
}

export const defaultSimpleDisplaySettings: SimpleDisplaySettings = {
  accentColor: '#507c69',
  fillColor: '#ffffff',
  fontSize: 15,
  layoutDirection: 'TB',
  lineColor: '#171817',
  lineStyle: 'orthogonal',
  lineWidth: 1.5,
  nodeScale: 1,
  rankGap: 104,
  showDetails: true,
  strokeColor: '#171817',
  textColor: '#171817',
};

export function darkSimpleDisplaySettings(): SimpleDisplaySettings {
  return {
    ...defaultSimpleDisplaySettings,
    accentColor: '#9EC6AD',
    fillColor: '#30362F',
    lineColor: '#F2F4EE',
    strokeColor: '#F2F4EE',
    textColor: '#F2F4EE',
  };
}

function cleanId(value: string): string {
  return value.replace(/^"|"$/gu, '').trim();
}

function nodeId(kind: SimpleDiagramKind, label: string): string {
  return `${kind}:${cleanId(label).toLowerCase().replace(/\s+/gu, '-')}`;
}

function addNode(nodes: Map<string, SimpleNodeDefinition>, kind: SimpleDiagramKind, label: string, nodeKind: SimpleNodeKind, line: number, details?: string[], stereotype?: string, members?: ClassMember[]): string {
  const id = nodeId(kind, label);
  const existing = nodes.get(id);
  if (existing) {
    if (details?.length) existing.details = [...(existing.details ?? []), ...details];
    if (members?.length) existing.members = [...(existing.members ?? []), ...members];
    return id;
  }
  nodes.set(id, { details, id, kind: nodeKind, label: cleanId(label), line, stereotype, members });
  return id;
}

export function parseClassMember(line: string): ClassMember {
  // Method: [visibility] name(params) [: type]
  const methodMatch = line.match(/^([+\-#~])?\s*([A-Za-z_][\w-]*)\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*$/);
  if (methodMatch) {
    const rawType = (methodMatch[4] ?? '').trim();
    const cleanType = rawType.replace(/[*$]/g, '').trim();
    return {
      visibility: (methodMatch[1] ?? '') as '+' | '-' | '#' | '~' | '',
      name: methodMatch[2],
      type: cleanType,
      parameters: (methodMatch[3] ?? '').trim() || undefined,
      isMethod: true,
      isAbstract: rawType.endsWith('*'),
      isStatic: rawType.endsWith('$'),
      raw: line,
    };
  }

  // Field with colon: [visibility] name: type
  const fieldColonMatch = line.match(/^([+\-#~])?\s*([A-Za-z_][\w-]*)\s*:\s*(.+)$/);
  if (fieldColonMatch) {
    const rawType = fieldColonMatch[3].trim();
    const cleanType = rawType.replace(/[*$]/g, '').trim();
    return {
      visibility: (fieldColonMatch[1] ?? '') as '+' | '-' | '#' | '~' | '',
      name: fieldColonMatch[2],
      type: cleanType,
      isMethod: false,
      isAbstract: rawType.endsWith('*'),
      isStatic: rawType.endsWith('$'),
      raw: line,
    };
  }

  // Field with space: [visibility] type name (e.g. "+string source")
  const fieldSpaceMatch = line.match(/^([+\-#~])?\s*([A-Za-z_][\w-]*)\s+([A-Za-z_][\w-]*)$/);
  if (fieldSpaceMatch) {
    const rawType = fieldSpaceMatch[2].trim();
    const cleanType = rawType.replace(/[*$]/g, '').trim();
    return {
      visibility: (fieldSpaceMatch[1] ?? '') as '+' | '-' | '#' | '~' | '',
      name: fieldSpaceMatch[3],
      type: cleanType,
      isMethod: false,
      isAbstract: rawType.endsWith('*'),
      isStatic: rawType.endsWith('$'),
      raw: line,
    };
  }

  // Fallback: just the raw string as name
  return {
    visibility: '',
    name: line,
    type: '',
    isMethod: false,
    isAbstract: false,
    isStatic: false,
    raw: line,
  };
}

/** Parse Mermaid class diagram arrow and return kind + marker IDs for source/target ends. */
function parseClassArrow(arrow: string): { kind: SimpleEdgeKind; startMarker?: string; endMarker?: string } {
  // Determine edge kind from arrow characters
  const hasTriangle = arrow.includes('<|') || arrow.includes('|>');
  const isDotted = arrow.includes('..');
  const hasStar = arrow.includes('*');
  const hasO = arrow.includes('o');
  const hasGt = arrow.includes('>');
  const isAssoc = !hasTriangle && !hasStar && !hasO && !arrow.includes('..');

  // Kind detection
  let kind: SimpleEdgeKind;
  if (hasTriangle) kind = isDotted ? 'realization' : 'generalization';
  else if (hasStar) kind = 'composition';
  else if (hasO) kind = 'aggregation';
  else if (isDotted && hasGt) kind = 'dependency';
  else if (isAssoc && hasGt) kind = 'association';
  else if (isDotted) kind = 'dependency';
  else kind = 'association';

  // Marker positions — determined by which SIDE the symbol appears on
  const startsWithSym = /^[<|*o]/.test(arrow);
  const endsWithSym = /[|*>o]$/.test(arrow) || arrow.includes('|>') || arrow.includes('->');
  const hasEndArrow = arrow.endsWith('>') || arrow.endsWith('>') || arrow.includes('|>');

  // Generalization / Realization: triangle at the end that has <| or |>
  if (kind === 'generalization' || kind === 'realization') {
    if (arrow.startsWith('<|')) return { kind, startMarker: 'pg-hollow-triangle' };
    return { kind, endMarker: 'pg-hollow-triangle' };
  }

  // Composition: diamond at the end with *
  if (kind === 'composition') {
    if (arrow.startsWith('*')) return { kind, startMarker: 'pg-solid-diamond' };
    return { kind, endMarker: 'pg-solid-diamond' };
  }

  // Aggregation: diamond at the end with o
  if (kind === 'aggregation') {
    if (arrow.startsWith('o')) return { kind, startMarker: 'pg-hollow-diamond' };
    return { kind, endMarker: 'pg-hollow-diamond' };
  }

  // Dependency: open arrow at target (always right side)
  if (kind === 'dependency') return { kind, endMarker: 'pg-open-arrow' };

  // Directed association (-->): open arrow at target
  if (kind === 'association' && arrow.endsWith('>')) return { kind, endMarker: 'pg-open-arrow' };

  // Plain association: no markers
  return { kind };
}

/** Matches Mermaid classDiagram edge arrows: <|-- *-- o-- --* --o --|> --> ..|> ..> -- .. */
const CLASS_EDGE_RE = /^(.+?)\s+(<\|--|\*--|o--|--\*|--o|--\|>|-->|\.\.\|>|\.\.>|--|\.\.)\s+(.+?)(?:\s*:\s*(.+))?$/u;
/** Same as above but with cardinality quotes before/after the arrow. */
const CLASS_CARD_EDGE_RE = /^(.+?)\s+"([^"]*)"\s+(<\|--|\*--|o--|--\*|--o|--\|>|-->|\.\.\|>|\.\.>|--|\.\.)\s+"([^"]*)"\s+(.+?)(?:\s*:\s*(.+))?$/u;

export function parseClassModel(source: string): SimpleModel {
  const nodeMap = new Map<string, SimpleNodeDefinition>();
  const edges: SimpleEdgeDefinition[] = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  let openClass: { id: string; name: string } | null = null;

  function addEdge(fromId: string, arrow: string, toId: string, label: string | undefined, sourceCard?: string, targetCard?: string, lineNum?: number): void {
    const { kind, startMarker, endMarker } = parseClassArrow(arrow);
    edges.push({
      from: fromId,
      id: `class-edge:${edges.length + 1}`,
      kind,
      label: label?.trim(),
      line: lineNum ?? 0,
      sourceCardinality: sourceCard,
      startMarker,
      endMarker,
      targetCardinality: targetCard,
      to: toId,
    });
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || /^classDiagram$/iu.test(line)) return;
    if (openClass && line === '}') {
      openClass = null;
      return;
    }
    if (openClass) {
      const node = nodeMap.get(openClass.id);
      if (node) {
        node.details = [...(node.details ?? []), line];
        node.members = [...(node.members ?? []), parseClassMember(line)];
      }
      return;
    }

    const classOpen = line.match(/^(class|interface|enum)\s+([A-Za-z_][\w-]*|"[^"]+")(?:<([^>]*)>)?\s*\{$/iu);
    if (classOpen) {
      const kind = classOpen[1].toLowerCase() as 'class' | 'interface' | 'enum';
      const label = classOpen[2] + (classOpen[3] ? `<${classOpen[3]}>` : '');
      const id = addNode(nodeMap, 'class', label, kind, index + 1, [], kind === 'class' ? undefined : kind);
      openClass = { id, name: label };
      return;
    }

    const classLine = line.match(/^(class|interface|enum)\s+([A-Za-z_][\w-]*|"[^"]+")(?:<([^>]*)>)?$/iu);
    if (classLine) {
      const kind = classLine[1].toLowerCase() as 'class' | 'interface' | 'enum';
      const label = classLine[2] + (classLine[3] ? `<${classLine[3]}>` : '');
      addNode(nodeMap, 'class', label, kind, index + 1, [], kind === 'class' ? undefined : kind);
      return;
    }

    const member = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/u);
    if (member) {
      const memberRaw = member[2].trim();
      const id = addNode(nodeMap, 'class', member[1], 'class', index + 1, []);
      const existing = nodeMap.get(id);
      if (existing) {
        existing.details = [...(existing.details ?? []), memberRaw];
        existing.members = [...(existing.members ?? []), parseClassMember(memberRaw)];
      }
      return;
    }

    // Edge with cardinality: Source "card1" --> "card2" Target
    const cardEdge = line.match(CLASS_CARD_EDGE_RE);
    if (cardEdge) {
      const from = cleanId(cardEdge[1].trim());
      const to = cleanId(cardEdge[5].trim());
      const sourceId = addNode(nodeMap, 'class', from, 'class', index + 1);
      const targetId = addNode(nodeMap, 'class', to, 'class', index + 1);
      addEdge(sourceId, cardEdge[3], targetId, cardEdge[6], cardEdge[2], cardEdge[4], index + 1);
      return;
    }

    const edge = line.match(CLASS_EDGE_RE);
    if (edge) {
      const from = cleanId(edge[1].replace(/"[^"]*"/gu, '').trim());
      const to = cleanId(edge[3].replace(/"[^"]*"/gu, '').trim());
      const sourceId = addNode(nodeMap, 'class', from, 'class', index + 1);
      const targetId = addNode(nodeMap, 'class', to, 'class', index + 1);
      addEdge(sourceId, edge[2], targetId, edge[4], undefined, undefined, index + 1);
    }
  });

  return { diagramKind: 'class', edges, nodes: [...nodeMap.values()], title: 'Class diagram' };
}

export function parseSequenceModel(source: string): SimpleModel {
  const nodeMap = new Map<string, SimpleNodeDefinition>();
  const edges: SimpleEdgeDefinition[] = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  const sequenceRef = String.raw`[A-Za-z_]\w*(?:-[A-Za-z_]\w*)*`;
  const activeFragmentStack: { nodeId: string }[] = [];

  function closeOpenFragments(upToIndex: number): void {
    for (const open of activeFragmentStack) {
      const node = nodeMap.get(open.nodeId);
      if (node && !node.fragmentMessageRange) {
        node.fragmentMessageRange = { startIndex: 0, endIndex: Math.max(0, edges.length - 1) };
      }
    }
    activeFragmentStack.length = 0;
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || /^sequenceDiagram$/iu.test(line)) return;

    if (/^end$/iu.test(line)) {
      const closed = activeFragmentStack.pop();
      if (closed) {
        const node = nodeMap.get(closed.nodeId);
        if (node) node.fragmentMessageRange = { startIndex: 0, endIndex: Math.max(0, edges.length - 1) };
      }
      return;
    }

    const participant = line.match(/^(actor|participant|boundary|control|entity)\s+([A-Za-z_][\w-]*)(?:\s+as\s+(.+))?$/iu);
    if (participant) {
      addNode(nodeMap, 'sequence', participant[2], 'lifeline', index + 1, undefined, participant[1].toLowerCase());
      const node = nodeMap.get(nodeId('sequence', participant[2]));
      if (node && participant[3]) node.label = cleanId(participant[3]);
      return;
    }

    const fragment = line.match(/^(alt|opt|loop|par|critical|rect)\b\s*(.*)$/iu);
    if (fragment) {
      const fragId = addNode(nodeMap, 'sequence', `${fragment[1]} ${index + 1}`, 'fragment', index + 1, [fragment[2].trim()].filter(Boolean), fragment[1].toLowerCase());
      activeFragmentStack.push({ nodeId: fragId });
      return;
    }

    const msg = line.match(new RegExp(`^(${sequenceRef})\\s*(--\\)|-\\)|-->>|->>|-->|->)\\s*(${sequenceRef})(?:\\s*:\\s*(.+))?$`, 'u'));
    if (msg) {
      const from = addNode(nodeMap, 'sequence', msg[1], 'lifeline', index + 1);
      const to = addNode(nodeMap, 'sequence', msg[3], 'lifeline', index + 1);
      const arrow = msg[2];
      const kind: SimpleEdgeKind = arrow.includes('--') ? 'reply' : arrow.includes(')') || arrow === '->' ? 'asyncMessage' : 'message';
      edges.push({ from, id: `sequence-edge:${edges.length + 1}`, kind, label: msg[4]?.trim(), line: index + 1, sequenceIndex: edges.length, to });
    }
  });

  closeOpenFragments(edges.length - 1);

  return { diagramKind: 'sequence', edges, nodes: [...nodeMap.values()], title: 'Sequence diagram' };
}

const STATE_INITIAL_ID = 'state:__initial__';
const STATE_FINAL_ID = 'state:__final__';

export function parseStateModel(source: string): SimpleModel {
  const nodeMap = new Map<string, SimpleNodeDefinition>();
  const edges: SimpleEdgeDefinition[] = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');

  const compositeStack: Array<{ prefix: string; parentId: string }> = [];
  let openCompositeCount = 0;

  function currentPrefix(): string {
    return compositeStack.length > 0 ? compositeStack.map((s) => s.prefix).join('.') + '.' : '';
  }

  function prefixedNodeId(label: string): string {
    const prefix = currentPrefix();
    const clean = cleanId(label).toLowerCase().replace(/\s+/gu, '-');
    return prefix ? `state:${prefix}${clean}` : `state:${clean}`;
  }

  function ensureInitialNode(line: number): string {
    if (!nodeMap.has(STATE_INITIAL_ID)) {
      nodeMap.set(STATE_INITIAL_ID, { id: STATE_INITIAL_ID, kind: 'initial', label: '', line, details: undefined, stereotype: undefined });
    }
    return STATE_INITIAL_ID;
  }

  function ensureFinalNode(line: number): string {
    if (!nodeMap.has(STATE_FINAL_ID)) {
      nodeMap.set(STATE_FINAL_ID, { id: STATE_FINAL_ID, kind: 'final', label: '', line, details: undefined, stereotype: undefined });
    }
    return STATE_FINAL_ID;
  }

  function addStateNode(label: string, kind: SimpleNodeKind, line: number, details?: string[], stereotype?: string): string {
    if (kind === 'initial') return ensureInitialNode(line);
    if (kind === 'final') return ensureFinalNode(line);

    const id = prefixedNodeId(label);
    const existing = nodeMap.get(id);
    if (existing) {
      if (details?.length) existing.details = [...(existing.details ?? []), ...details];
      return id;
    }
    nodeMap.set(id, { id, kind, label: cleanId(label), line, details, stereotype });

    // Track parent-child relationship for composite states
    if (compositeStack.length > 0) {
      const parent = compositeStack[compositeStack.length - 1];
      const entry = nodeMap.get(id);
      if (entry) entry.parentId = parent.parentId;
      const parentEntry = nodeMap.get(parent.parentId);
      if (parentEntry) {
        parentEntry.children = [...(parentEntry.children ?? []), id];
      }
    }

    return id;
  }

  function resolveTransitionLabel(rawLabel: string, isSource: boolean): { kind: SimpleNodeKind; label: string; stereo?: string } {
    const cleaned = cleanId(rawLabel);
    if (cleaned === '[*]') return { kind: isSource ? 'initial' : 'final', label: '' };
    const stereoMatch = cleaned.match(/^<<(\w+)>>$/u);
    if (stereoMatch) {
      const inner = stereoMatch[1].toLowerCase();
      return {
        kind: inner === 'choice' ? 'choice' : inner === 'history' ? 'history' : 'state',
        label: cleaned,
        stereo: inner,
      };
    }
    return { kind: 'state', label: cleaned };
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNum = index + 1;

    if (!line || /^stateDiagram(?:-v2)?$/iu.test(line)) return;

    // Close composite state block
    if (line === '}' && openCompositeCount > 0) {
      compositeStack.pop();
      openCompositeCount--;
      return;
    }

    // Skip notes
    if (/^note\s+/iu.test(line) || /^end\s+note$/iu.test(line)) return;

    // Composite: state "Label" as Alias {
    const compQuoted = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_]\w*)\s*\{\s*$/u);
    if (compQuoted) {
      const alias = compQuoted[2];
      const displayLabel = compQuoted[1];
      const parentId = prefixedNodeId(alias);
      if (!nodeMap.has(parentId)) {
        nodeMap.set(parentId, { id: parentId, kind: 'state', label: displayLabel, line: lineNum });
      }
      compositeStack.push({ prefix: alias.toLowerCase().replace(/\s+/gu, '-'), parentId });
      openCompositeCount++;
      return;
    }

    // Composite: state Name {
    const compState = line.match(/^state\s+([A-Za-z_]\w*)\s*\{\s*$/u);
    if (compState) {
      const alias = compState[1];
      const parentId = prefixedNodeId(alias);
      addStateNode(alias, 'state', lineNum);
      compositeStack.push({ prefix: alias.toLowerCase().replace(/\s+/gu, '-'), parentId });
      openCompositeCount++;
      return;
    }

    // State with quoted alias: state "Label" as Alias
    const stateAlias = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_]\w*)$/u);
    if (stateAlias) {
      const alias = stateAlias[2];
      const displayLabel = stateAlias[1];
      const id = prefixedNodeId(alias);
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, kind: 'state', label: displayLabel, line: lineNum });
      }
      return;
    }

    // State with stereotype: state <<stereotype>>
    const stateStereo = line.match(/^state\s+(<<(\w+)>>)$/iu);
    if (stateStereo) {
      const inner = stateStereo[2].toLowerCase();
      const nodeKind: SimpleNodeKind = inner === 'choice' ? 'choice' : inner === 'history' ? 'history' : 'state';
      addStateNode(stateStereo[1], nodeKind, lineNum, [], inner);
      return;
    }

    // State declared with name: state Name
    const simpleState = line.match(/^state\s+([A-Za-z_]\w*)$/u);
    if (simpleState) {
      addStateNode(simpleState[1], 'state', lineNum);
      return;
    }

    // Entry/exit/do action: Alias: entry / action
    const actionMatch = line.match(/^([A-Za-z_]\w*)\s*:\s*(entry|exit|do)\s*\/\s*(.+)$/iu);
    if (actionMatch) {
      const alias = actionMatch[1];
      const actionType = actionMatch[2].toLowerCase();
      const actionText = actionMatch[3].trim();
      const id = prefixedNodeId(alias);
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, kind: 'state', label: cleanId(alias), line: lineNum, details: [] });
      }
      const existing = nodeMap.get(id);
      if (existing) {
        existing.details = [...(existing.details ?? []), `${actionType}: ${actionText}`];
      }
      return;
    }

    // Transition: Source --> Target: label
    const transition = line.match(/^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.+))?$/u);
    if (transition) {
      const fromResolved = resolveTransitionLabel(transition[1], true);
      const toResolved = resolveTransitionLabel(transition[2], false);
      const fromId = addStateNode(fromResolved.label, fromResolved.kind, lineNum, [], fromResolved.stereo);
      const toId = addStateNode(toResolved.label, toResolved.kind, lineNum, [], toResolved.stereo);
      edges.push({ from: fromId, id: `state-edge:${edges.length + 1}`, kind: 'transition', label: transition[3]?.trim(), line: lineNum, startMarker: undefined, endMarker: 'pg-open-arrow', to: toId });
    }
  });

  return { diagramKind: 'state', edges, nodes: [...nodeMap.values()], title: 'State diagram' };
}

export function parseSimpleModel(kind: SimpleDiagramKind, source: string): SimpleModel {
  if (kind === 'class') return parseClassModel(source);
  if (kind === 'sequence') return parseSequenceModel(source);
  return parseStateModel(source);
}

export function validateSimpleSource(kind: SimpleDiagramKind, source: string): SimpleValidation {
  try {
    if (!source.trim()) return { diagnostics: [], hasFatalError: false };
    const model = parseSimpleModel(kind, source);
    return {
      diagnostics: model.nodes.length === 0 ? [{ level: 'error', message: `${kind} source did not produce any editable nodes.` }] : [],
      hasFatalError: model.nodes.length === 0,
    };
  } catch (error) {
    return { diagnostics: [{ level: 'error', message: error instanceof Error ? error.message : `${kind} parsing failed.` }], hasFatalError: true };
  }
}

export interface SequenceNumberEdge {
  id: string;
  kind: SimpleEdgeKind;
  sequenceIndex?: number;
  source: string;
  target: string;
}

export function buildSequenceMessageNumbers(edges: SequenceNumberEdge[]): Record<string, string> {
  const numbers: Record<string, string> = {};
  const stack: Array<{ nextChild: number; number: string; participantId: string }> = [];
  let nextTopLevel = 1;

  for (const edge of [...edges].sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))) {
    if (edge.sequenceIndex === undefined) continue;

    const sourceIndex = stack.map((item) => item.participantId).lastIndexOf(edge.source);
    if (edge.kind === 'reply') {
      const targetIsCaller = sourceIndex > 0 && stack[sourceIndex - 1].participantId === edge.target;
      if (targetIsCaller) {
        numbers[edge.id] = stack[sourceIndex].number;
        stack.splice(sourceIndex);
        continue;
      }
    }

    if (sourceIndex >= 0) {
      stack.splice(sourceIndex + 1);
    } else {
      stack.length = 0;
    }

    let number: string;
    if (stack.length === 0) {
      number = String(nextTopLevel++);
    } else {
      const parent = stack[stack.length - 1];
      number = `${parent.number}.${parent.nextChild++}`;
    }
    numbers[edge.id] = number;

    if (edge.kind === 'message' || edge.kind === 'asyncMessage' || edge.kind === 'reply' || edge.kind === 'create') {
      stack.push({ nextChild: 1, number, participantId: edge.target });
    }
  }

  return numbers;
}

function defaultNodeSize(node: SimpleNodeDefinition, display: SimpleDisplaySettings): { height: number; width: number } {
  const scale = Math.min(1.45, Math.max(0.72, display.nodeScale || 1));
  if (node.kind === 'lifeline') return { height: 280 * scale, width: 132 * scale };
  if (node.kind === 'initial' || node.kind === 'final') return { height: 40 * scale, width: 40 * scale };
  if (node.kind === 'choice') return { height: 86 * scale, width: 86 * scale };
  // Composite state containers start large; post-layout shrinks them to wrap children
  if (node.children && node.children.length > 0) return { height: 380 * scale, width: 420 * scale };
  const rows = display.showDetails ? (node.members?.length ?? node.details?.length ?? 0) : 0;
  return { height: Math.max(64, 54 + rows * 24) * scale, width: (node.kind === 'fragment' ? 260 : 190) * scale };
}

export function buildSimpleGraph(model: SimpleModel, options: SimpleGraphBuildOptions): { edges: SimpleGraphEdge[]; nodes: SimpleGraphNode[] } {
  const nodes = model.nodes.map((node, index) => {
    const size = options.nodeSizes[node.id] ?? defaultNodeSize(node, options.display);
    const isContainer = node.children !== undefined && node.children.length > 0;
    const hasParent = node.parentId !== undefined;
    return {
      data: {
        childIds: node.children,
        details: options.display.showDetails ? node.details : undefined,
        members: options.display.showDetails ? node.members : undefined,
        display: options.display,
        fragmentMessageRange: node.fragmentMessageRange,
        kind: node.kind,
        label: options.localLabels[node.id] ?? node.label,
        onLocalLabelEdit: options.onLocalLabelEdit,
        onNodeResize: options.onNodeResize,
        parentId: node.parentId,
        selectedId: options.selectedId,
        stereotype: node.stereotype,
      },
      id: node.id,
      position: options.positions[node.id] ?? {
        x: model.diagramKind === 'sequence' ? 80 + index * 210 : 80 + (index % 3) * 260,
        y: model.diagramKind === 'sequence' ? 80 : 80 + Math.floor(index / 3) * options.display.rankGap,
      },
      style: {
        ...umlNodeStyle(options.display),
        height: size.height,
        width: size.width,
      },
      type: isContainer ? 'simple-state-container' : `simple-${node.kind}`,
      zIndex: hasParent ? 2 : (isContainer ? 0 : undefined),
    } satisfies SimpleGraphNode;
  });

  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = model.edges
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .map((edge) => ({
      data: {
        kind: edge.kind,
        sequenceIndex: edge.sequenceIndex,
        sourceCardinality: edge.sourceCardinality,
        startMarker: edge.startMarker,
        endMarker: edge.endMarker,
        targetCardinality: edge.targetCardinality,
        ...edgeLabelData(edge.id, edge.label, options.display, options.edgeLabels, options.onEdgeLabelChange, options.onEdgeLabelOffsetChange),
      },
      id: edge.id,
      label: edge.label,
      source: edge.from,
      target: edge.to,
      type: 'simple-edge',
    }) satisfies SimpleGraphEdge);

  return { edges, nodes };
}

export function getSimpleModelSignature(model: SimpleModel, display: SimpleDisplaySettings): string {
  return JSON.stringify({ display, edges: model.edges, kind: model.diagramKind, nodes: model.nodes });
}
