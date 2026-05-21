import type { XYPosition } from '@xyflow/react';
import { umlNodeStyle, type UmlDisplaySettingsBase, type UmlGraphEdge, type UmlGraphNode, type UmlNodeResize } from './umlFlowModel';

type ElkInstance = {
  layout: (graph: unknown) => Promise<{ children?: Array<{ id: string; x?: number; y?: number }> }>;
};

let elkPromise: Promise<ElkInstance> | null = null;

function loadElk(): Promise<ElkInstance> {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then((module) => new module.default() as ElkInstance);
  return elkPromise;
}

export interface ActivityLane {
  id: string;
  label: string;
  order: number;
}

export type ActivityNodeKind = 'lane' | 'start' | 'end' | 'flowFinal' | 'action' | 'object' | 'decision' | 'merge' | 'fork' | 'join' | 'note' | 'exceptionHandler';
export type ActivityEdgeKind = 'control' | 'object' | 'note' | 'exception';

export interface ActivityNodeDefinition {
  id: string;
  kind: Exclude<ActivityNodeKind, 'lane'>;
  label: string;
  laneId: string;
  noteSide?: 'left' | 'right';
  sourceOrder: number;
  targetRef?: string;
}

export interface ActivityEdgeDefinition {
  id: string;
  kind: ActivityEdgeKind;
  label?: string;
  source: string;
  target: string;
}

type ActivityStatement =
  | { id: string; type: 'partition'; label: string; statements: ActivityStatement[] }
  | { id: string; type: 'start' }
  | { id: string; type: 'stop' }
  | { id: string; type: 'flow-final' }
  | { id: string; type: 'action'; label: string }
  | { id: string; type: 'object'; label: string }
  | { id: string; type: 'if'; condition: string; thenLabel?: string; elseLabel?: string; thenBranch: ActivityStatement[]; elseBranch: ActivityStatement[] }
  | { id: string; type: 'fork'; branches: ActivityStatement[][] }
  | { id: string; type: 'note'; side: 'left' | 'right'; target: string; text: string }
  | { id: string; type: 'arrow'; from: string; to: string; label?: string; kind: ActivityEdgeKind };

export interface ActivityModel {
  defaultLaneLabel: string;
  edges: ActivityEdgeDefinition[];
  lanes: ActivityLane[];
  nodes: ActivityNodeDefinition[];
  statements: ActivityStatement[];
  title: string;
}

export interface ActivityDiagnostic {
  level: 'error' | 'warning';
  message: string;
}

export interface ActivityValidation {
  diagnostics: ActivityDiagnostic[];
  hasFatalError: boolean;
}

export interface ActivityDisplaySettings extends UmlDisplaySettingsBase {
  laneGap: number;
  rankGap: number;
  showNotes: boolean;
}

export interface ActivityGraphNodeData extends Record<string, unknown> {
  display: ActivityDisplaySettings;
  kind: ActivityNodeKind;
  label: string;
  noteSide?: 'left' | 'right';
  onNodeResize?: (nodeId: string, size: UmlNodeResize) => void;
  onLabelEdit?: (nodeId: string, value: string) => void;
  selectedId: string | null;
}

export interface ActivityGraphEdgeData extends Record<string, unknown> {
  display: ActivityDisplaySettings;
  kind: ActivityEdgeKind;
  label?: string;
}

export type ActivityGraphNode = UmlGraphNode<ActivityGraphNodeData>;
export type ActivityGraphEdge = UmlGraphEdge<ActivityGraphEdgeData>;

export interface ActivityGraphBuildOptions {
  display: ActivityDisplaySettings;
  nodeSizes?: Record<string, UmlNodeResize>;
  onLabelEdit: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: UmlNodeResize) => void;
  selectedId: string | null;
}

interface ParseState {
  counters: Record<string, number>;
  diagnostics: ActivityDiagnostic[];
  index: number;
  lines: string[];
}

interface SequenceResult {
  entries: string[];
  exits: string[];
}

interface PendingNote {
  noteId: string;
  sourceOrder: number;
  target: string;
}

interface PendingArrow {
  from: string;
  kind: ActivityEdgeKind;
  label?: string;
  sourceOrder: number;
  to: string;
}

const defaultLaneId = 'activity-default-lane';
const laneHeaderHeight = 54;
const laneInnerPadding = 36;

export const defaultActivityDisplaySettings: ActivityDisplaySettings = {
  accentColor: '#507c69',
  fillColor: '#ffffff',
  fontSize: 15,
  laneGap: 40,
  layoutDirection: 'TB',
  nodeScale: 1,
  rankGap: 96,
  showNotes: true,
  strokeColor: '#171817',
  textColor: '#171817',
};

function nextId(state: ParseState, prefix: string): string {
  state.counters[prefix] = (state.counters[prefix] ?? 0) + 1;
  return `${prefix}:${state.counters[prefix]}`;
}

function normalizeLines(source: string): string[] {
  return source
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''));
}

function parseTitle(lines: string[]): string {
  const titleLine = lines.find((line) => /^title\s+/iu.test(line.trim()));
  return titleLine ? titleLine.trim().replace(/^title\s+/iu, '').trim() : '';
}

function currentLine(state: ParseState): string | null {
  return state.index < state.lines.length ? state.lines[state.index] : null;
}

function advance(state: ParseState): void {
  state.index += 1;
}

function isBlank(line: string): boolean {
  const value = line.trim();
  return value.length === 0 || value.startsWith("'");
}

function parseBlock(state: ParseState, stopTokens: string[] = []): { statements: ActivityStatement[]; stopToken: string | null } {
  const statements: ActivityStatement[] = [];

  while (state.index < state.lines.length) {
    const raw = currentLine(state);
    if (raw == null) break;
    const line = raw.trim();

    if (isBlank(line)) {
      advance(state);
      continue;
    }

    const lower = line.toLowerCase();
    const matchedStopToken = stopTokens.find((token) => lower === token || lower.startsWith(`${token} `) || lower.startsWith(`${token}(`));
    if (matchedStopToken) {
      return { statements, stopToken: matchedStopToken };
    }
    if (line === '}') return { statements, stopToken: '}' };

    if (/^@startuml$/iu.test(line) || /^@enduml$/iu.test(line) || /^title\s+/iu.test(line)) {
      advance(state);
      continue;
    }

    const partition = line.match(/^partition\s+(.+?)\s*\{$/iu);
    if (partition) {
      advance(state);
      const inner = parseBlock(state);
      if (inner.stopToken !== '}') {
        throw new Error(`Partition "${partition[1].trim()}" is not closed.`);
      }
      advance(state);
      statements.push({
        id: nextId(state, 'lane'),
        label: partition[1].trim(),
        statements: inner.statements,
        type: 'partition',
      });
      continue;
    }

    if (/^start$/iu.test(line)) {
      statements.push({ id: nextId(state, 'start'), type: 'start' });
      advance(state);
      continue;
    }

  if (/^stop$/iu.test(line)) {
      statements.push({ id: nextId(state, 'stop'), type: 'stop' });
      advance(state);
      continue;
    }

    if (/^endflow$/iu.test(line) || /^flow\s+final$/iu.test(line)) {
      statements.push({ id: nextId(state, 'flow-final'), type: 'flow-final' });
      advance(state);
      continue;
    }

    const action = line.match(/^:(.+);$/u);
    if (action) {
      const label = action[1].trim();
      if (!label) throw new Error('Activity action cannot be empty.');
      statements.push({ id: nextId(state, 'action'), label, type: 'action' });
      advance(state);
      continue;
    }

    const objectNode = line.match(/^object\s+("?)(.+?)\1$/iu);
    if (objectNode) {
      const label = objectNode[2].trim();
      if (!label) throw new Error('Activity object cannot be empty.');
      statements.push({ id: nextId(state, 'object'), label, type: 'object' });
      advance(state);
      continue;
    }

    const decision = line.match(/^if\s*\((.+)\)\s*then(?:\s*\((.*)\))?$/iu);
    if (decision) {
      advance(state);
      const thenBlock = parseBlock(state, ['else', 'endif']);
      let elseLabel: string | undefined;
      let elseBranch: ActivityStatement[] = [];
      if (thenBlock.stopToken === 'else') {
        const elseLine = currentLine(state)?.trim() ?? 'else';
        const elseMatch = elseLine.match(/^else(?:\s*\((.*)\))?$/iu);
        elseLabel = elseMatch?.[1]?.trim() || undefined;
        advance(state);
        const elseBlock = parseBlock(state, ['endif']);
        if (elseBlock.stopToken !== 'endif') {
          throw new Error(`if (${decision[1].trim()}) is missing endif.`);
        }
        elseBranch = elseBlock.statements;
      } else if (thenBlock.stopToken !== 'endif') {
        throw new Error(`if (${decision[1].trim()}) is missing endif.`);
      }
      advance(state);
      statements.push({
        condition: decision[1].trim(),
        elseBranch,
        elseLabel,
        id: nextId(state, 'decision'),
        thenBranch: thenBlock.statements,
        thenLabel: decision[2]?.trim() || undefined,
        type: 'if',
      });
      continue;
    }

    if (/^fork$/iu.test(line)) {
      advance(state);
      const branches: ActivityStatement[][] = [];
      while (true) {
        const branch = parseBlock(state, ['fork again', 'end fork']);
        branches.push(branch.statements);
        if (branch.stopToken === 'fork again') {
          advance(state);
          continue;
        }
        if (branch.stopToken === 'end fork') {
          advance(state);
          break;
        }
        throw new Error('fork is missing end fork.');
      }
      statements.push({ branches, id: nextId(state, 'fork'), type: 'fork' });
      continue;
    }

    const note = line.match(/^note\s+(left|right)\s+of\s+(.+)$/iu);
    if (note) {
      advance(state);
      const textLines: string[] = [];
      while (state.index < state.lines.length) {
        const candidate = currentLine(state)?.trim() ?? '';
        if (/^end note$/iu.test(candidate)) break;
        textLines.push((currentLine(state) ?? '').trim());
        advance(state);
      }
      if (!/^end note$/iu.test(currentLine(state)?.trim() ?? '')) {
        throw new Error(`Note "${note[2].trim()}" is missing end note.`);
      }
      advance(state);
      statements.push({
        id: nextId(state, 'note'),
        side: note[1].toLowerCase() as 'left' | 'right',
        target: note[2].trim(),
        text: textLines.join('\n').trim(),
        type: 'note',
      });
      continue;
    }

    const arrow = line.match(/^(.+?)\s*(->|=>)\s*(.+?)(?:\s*:\s*(.+))?$/u);
    if (arrow) {
      statements.push({
        from: arrow[1].trim(),
        id: nextId(state, 'arrow'),
        kind: arrow[2] === '=>' ? 'object' : 'control',
        label: arrow[4]?.trim() || undefined,
        to: arrow[3].trim(),
        type: 'arrow',
      });
      advance(state);
      continue;
    }

    state.diagnostics.push({ level: 'warning', message: `Skipped unrecognized statement at line ${state.index + 1}: ${line}` });
    advance(state);
    continue;
  }

  return { statements, stopToken: null };
}

function estimateTextWidth(label: string, fontSize: number): number {
  const units = Array.from(label).reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 1 : 0.58), 0);
  return Math.ceil(units * fontSize);
}

function roundToGrid(value: number): number {
  return Math.round(value / 2) * 2;
}

export function estimateActivityNodeSize(
  kind: ActivityNodeKind,
  label: string,
  display: Pick<ActivityDisplaySettings, 'fontSize' | 'nodeScale'>,
): { height: number; width: number } {
  const scale = Math.min(1.4, Math.max(0.76, display.nodeScale || 1));
  const fontSize = display.fontSize;

  if (kind === 'lane') return { height: 380 * scale, width: 240 * scale };
  if (kind === 'start') return { height: 24 * scale, width: 24 * scale };
  if (kind === 'end') return { height: 30 * scale, width: 30 * scale };
  if (kind === 'flowFinal') return { height: 28 * scale, width: 28 * scale };
  if (kind === 'fork' || kind === 'join') return { height: 12 * scale, width: 126 * scale };
  if (kind === 'merge') return { height: 22 * scale, width: 22 * scale };
  if (kind === 'decision') {
    const side = Math.min(104, Math.max(56, estimateTextWidth(label, fontSize - 2) + 18));
    const scaled = roundToGrid(side * scale);
    return { height: scaled, width: scaled };
  }
  if (kind === 'note') {
    const lines = label.split('\n');
    const width = Math.min(260, Math.max(150, Math.max(...lines.map((line) => estimateTextWidth(line, fontSize - 1))) + 36));
    return { height: Math.max(62, 24 + lines.length * Math.max(16, fontSize)) * scale, width: width * scale };
  }

  if (kind === 'exceptionHandler') return { height: 52 * scale, width: Math.min(260, Math.max(154, estimateTextWidth(label, fontSize - 1) + 44)) * scale };

  if (kind === 'object') {
    const width = Math.min(240, Math.max(132, estimateTextWidth(label, fontSize - 1) + 38));
    return { height: 44 * scale, width: width * scale };
  }

  const width = Math.min(260, Math.max(150, estimateTextWidth(label, fontSize) + 44));
  return { height: 56 * scale, width: width * scale };
}

function normalizeRef(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toLowerCase();
}

function resolveNodeRef(nodes: ActivityNodeDefinition[], value: string, sourceOrder: number): ActivityNodeDefinition | null {
  const ref = normalizeRef(value);
  const candidates = nodes.filter((node) => normalizeRef(node.label) === ref && node.kind !== 'note');
  if (candidates.length === 0) return null;
  const earlier = candidates.filter((node) => node.sourceOrder <= sourceOrder);
  return (earlier.length > 0 ? earlier : candidates).sort((left, right) => right.sourceOrder - left.sourceOrder)[0];
}

function createNode(
  nodes: ActivityNodeDefinition[],
  kind: Exclude<ActivityNodeKind, 'lane'>,
  label: string,
  laneId: string,
  sourceOrder: number,
  id: string,
  noteSide?: 'left' | 'right',
): void {
  nodes.push({ id, kind, label, laneId, noteSide, sourceOrder });
}

function createEdge(edges: ActivityEdgeDefinition[], kind: ActivityEdgeKind, source: string, target: string, label?: string): void {
  edges.push({
    id: `${kind}:${edges.length + 1}`,
    kind,
    label,
    source,
    target,
  });
}

function processSequence(
  statements: ActivityStatement[],
  laneId: string,
  lanes: ActivityLane[],
  nodes: ActivityNodeDefinition[],
  edges: ActivityEdgeDefinition[],
  pendingNotes: PendingNote[],
  pendingArrows: PendingArrow[],
  order: { value: number },
): SequenceResult {
  let firstEntries: string[] = [];
  let previousExits: string[] = [];

  const connectPrevious = (targets: string[], label?: string, kind: ActivityEdgeKind = 'control') => {
    previousExits.forEach((source) => {
      targets.forEach((target, index) => createEdge(edges, kind, source, target, index === 0 ? label : undefined));
    });
  };

  statements.forEach((statement) => {
    if (statement.type === 'partition') {
      lanes.push({ id: statement.id, label: statement.label, order: lanes.length });
      const result = processSequence(statement.statements, statement.id, lanes, nodes, edges, pendingNotes, pendingArrows, order);
      if (result.entries.length > 0) {
        if (firstEntries.length === 0) firstEntries = result.entries;
        connectPrevious(result.entries);
        previousExits = result.exits;
      }
      return;
    }

    if (statement.type === 'arrow') {
      pendingArrows.push({
        from: statement.from,
        kind: statement.kind,
        label: statement.label,
        sourceOrder: order.value,
        to: statement.to,
      });
      return;
    }

    if (statement.type === 'note') {
      order.value += 1;
      createNode(nodes, 'note', statement.text, laneId, order.value, statement.id, statement.side);
      pendingNotes.push({ noteId: statement.id, sourceOrder: order.value, target: statement.target });
      return;
    }

    if (statement.type === 'start') {
      order.value += 1;
      createNode(nodes, 'start', 'start', laneId, order.value, statement.id);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id]);
      previousExits = [statement.id];
      return;
    }

    if (statement.type === 'stop') {
      order.value += 1;
      createNode(nodes, 'end', 'stop', laneId, order.value, statement.id);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id]);
      previousExits = [];
      return;
    }

    if (statement.type === 'flow-final') {
      order.value += 1;
      createNode(nodes, 'flowFinal', 'flow final', laneId, order.value, statement.id);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id]);
      previousExits = [];
      return;
    }

    if (statement.type === 'action') {
      order.value += 1;
      createNode(nodes, 'action', statement.label, laneId, order.value, statement.id);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id]);
      previousExits = [statement.id];
      return;
    }

    if (statement.type === 'object') {
      order.value += 1;
      createNode(nodes, 'object', statement.label, laneId, order.value, statement.id);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id], undefined, 'object');
      previousExits = [statement.id];
      return;
    }

    if (statement.type === 'if') {
      order.value += 1;
      createNode(nodes, 'decision', statement.condition, laneId, order.value, statement.id);
      const mergeId = `${statement.id}:merge`;
      order.value += 1;
      createNode(nodes, 'merge', '', laneId, order.value, mergeId);
      if (firstEntries.length === 0) firstEntries = [statement.id];
      connectPrevious([statement.id]);

      const thenResult = processSequence(statement.thenBranch, laneId, lanes, nodes, edges, pendingNotes, pendingArrows, order);
      const elseResult = processSequence(statement.elseBranch, laneId, lanes, nodes, edges, pendingNotes, pendingArrows, order);

      if (thenResult.entries.length > 0) {
        createEdge(edges, 'control', statement.id, thenResult.entries[0], statement.thenLabel);
        thenResult.exits.forEach((exit) => createEdge(edges, 'control', exit, mergeId));
      } else {
        createEdge(edges, 'control', statement.id, mergeId, statement.thenLabel);
      }

      if (elseResult.entries.length > 0) {
        createEdge(edges, 'control', statement.id, elseResult.entries[0], statement.elseLabel);
        elseResult.exits.forEach((exit) => createEdge(edges, 'control', exit, mergeId));
      } else {
        createEdge(edges, 'control', statement.id, mergeId, statement.elseLabel);
      }

      previousExits = [mergeId];
      return;
    }

    if (statement.type === 'fork') {
      const forkId = statement.id;
      const joinId = `${statement.id}:join`;
      order.value += 1;
      createNode(nodes, 'fork', '', laneId, order.value, forkId);
      order.value += 1;
      createNode(nodes, 'join', '', laneId, order.value, joinId);
      if (firstEntries.length === 0) firstEntries = [forkId];
      connectPrevious([forkId]);

      statement.branches.forEach((branch) => {
        const result = processSequence(branch, laneId, lanes, nodes, edges, pendingNotes, pendingArrows, order);
        if (result.entries.length > 0) {
          createEdge(edges, 'control', forkId, result.entries[0]);
          result.exits.forEach((exit) => createEdge(edges, 'control', exit, joinId));
        } else {
          createEdge(edges, 'control', forkId, joinId);
        }
      });

      previousExits = [joinId];
    }
  });

  return { entries: firstEntries, exits: previousExits };
}

function parseOrThrow(source: string, defaultLaneLabel: string): ActivityModel & { diagnostics?: ActivityDiagnostic[] } {
  const lines = normalizeLines(source);
  const title = parseTitle(lines);
  const state: ParseState = { counters: {}, diagnostics: [], index: 0, lines };
  const root = parseBlock(state);
  const lanes: ActivityLane[] = [];
  const nodes: ActivityNodeDefinition[] = [];
  const edges: ActivityEdgeDefinition[] = [];
  const pendingNotes: PendingNote[] = [];
  const pendingArrows: PendingArrow[] = [];
  const order = { value: 0 };

  lanes.push({ id: defaultLaneId, label: defaultLaneLabel, order: 0 });
  processSequence(root.statements, defaultLaneId, lanes, nodes, edges, pendingNotes, pendingArrows, order);

  pendingNotes.forEach((pending) => {
    const target = resolveNodeRef(nodes, pending.target, pending.sourceOrder);
    const note = nodes.find((node) => node.id === pending.noteId);
    if (!target || !note) {
      throw new Error(`Note target "${pending.target}" does not exist.`);
    }
    note.laneId = target.laneId;
    note.targetRef = target.id;
    createEdge(edges, 'note', target.id, note.id);
  });

  pendingArrows.forEach((pending) => {
    const sourceNode = resolveNodeRef(nodes, pending.from, pending.sourceOrder);
    const targetNode = resolveNodeRef(nodes, pending.to, pending.sourceOrder);
    if (!sourceNode) throw new Error(`Arrow source "${pending.from}" does not exist.`);
    if (!targetNode) throw new Error(`Arrow target "${pending.to}" does not exist.`);
    createEdge(edges, pending.kind, sourceNode.id, targetNode.id, pending.label);
  });

  if (!nodes.some((node) => node.kind === 'start')) {
    throw new Error('Activity diagram requires a start node.');
  }

  return {
    defaultLaneLabel,
    diagnostics: state.diagnostics,
    edges,
    lanes,
    nodes,
    statements: root.statements,
    title,
  };
}

export function parseActivitySource(source: string, defaultLaneLabel = 'Flow'): ActivityModel {
  return parseOrThrow(source, defaultLaneLabel);
}

export function validateActivitySource(source: string, defaultLaneLabel = 'Flow'): ActivityValidation {
  try {
    const model = parseOrThrow(source, defaultLaneLabel);
    const diagnostics: ActivityDiagnostic[] = [...(model.diagnostics ?? [])];
    const terminals = model.nodes.filter((node) => node.kind === 'end' || node.kind === 'flowFinal');
    if (!model.nodes.some((node) => node.kind === 'end')) {
      diagnostics.push({ level: 'warning', message: 'Activity diagram has no stop node. Consider adding stop for the main flow.' });
    }
    if (model.nodes.length > 0 && terminals.length === 0) {
      diagnostics.push({ level: 'error', message: 'Activity diagram requires at least one stop or flow final node.' });
    }
    return { diagnostics, hasFatalError: diagnostics.some((item) => item.level === 'error') };
  } catch (error) {
    return {
      diagnostics: [{ level: 'error', message: error instanceof Error ? error.message : 'Activity parsing failed.' }],
      hasFatalError: true,
    };
  }
}

function serializeStatements(statements: ActivityStatement[], indent = '', rename?: { id: string; value: string }): string[] {
  const lines: string[] = [];

  statements.forEach((statement, index) => {
    if (statement.type === 'partition') {
      const label = rename?.id === statement.id ? rename.value : statement.label;
      lines.push(`${indent}partition ${label} {`);
      lines.push(...serializeStatements(statement.statements, `${indent}  `, rename));
      lines.push(`${indent}}`);
    }

    if (statement.type === 'start') lines.push(`${indent}start`);
    if (statement.type === 'stop') lines.push(`${indent}stop`);
    if (statement.type === 'flow-final') lines.push(`${indent}endflow`);
    if (statement.type === 'action') lines.push(`${indent}:${rename?.id === statement.id ? rename.value : statement.label};`);
    if (statement.type === 'object') lines.push(`${indent}object "${rename?.id === statement.id ? rename.value : statement.label}"`);

    if (statement.type === 'if') {
      const condition = rename?.id === statement.id ? rename.value : statement.condition;
      lines.push(`${indent}if (${condition}) then${statement.thenLabel ? ` (${statement.thenLabel})` : ''}`);
      lines.push(...serializeStatements(statement.thenBranch, `${indent}  `, rename));
      if (statement.elseBranch.length > 0 || statement.elseLabel) {
        lines.push(`${indent}else${statement.elseLabel ? ` (${statement.elseLabel})` : ''}`);
        lines.push(...serializeStatements(statement.elseBranch, `${indent}  `, rename));
      }
      lines.push(`${indent}endif`);
    }

    if (statement.type === 'fork') {
      statement.branches.forEach((branch, branchIndex) => {
        lines.push(`${indent}${branchIndex === 0 ? 'fork' : 'fork again'}`);
        lines.push(...serializeStatements(branch, `${indent}  `, rename));
      });
      lines.push(`${indent}end fork`);
    }

    if (statement.type === 'note') {
      lines.push(`${indent}note ${statement.side} of ${statement.target}`);
      statement.text.split('\n').forEach((line) => lines.push(`${indent}  ${line}`));
      lines.push(`${indent}end note`);
    }

    if (statement.type === 'arrow') {
      const connector = statement.kind === 'object' ? '=>' : '->';
      lines.push(`${indent}${statement.from} ${connector} ${statement.to}${statement.label ? ` : ${statement.label}` : ''}`);
    }

    if (index < statements.length - 1) lines.push('');
  });

  return lines;
}

export function activityModelToSource(model: ActivityModel, rename?: { id: string; value: string }): string {
  const lines = ['@startuml'];
  if (model.title.trim()) {
    lines.push(`title ${model.title.trim()}`, '');
  }
  lines.push(...serializeStatements(model.statements, '', rename));
  lines.push('@enduml');
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}

export function formatActivitySource(source: string, defaultLaneLabel = 'Flow'): string {
  try {
    return activityModelToSource(parseOrThrow(source, defaultLaneLabel));
  } catch {
    return normalizeLines(source).join('\n').trim();
  }
}

export function renameActivityModelLabel(model: ActivityModel, nodeId: string, nextValue: string): string {
  const value = nextValue.trim();
  if (!value) return activityModelToSource(model);
  return activityModelToSource(model, { id: nodeId, value });
}

export function buildActivityGraph(
  model: ActivityModel,
  options: ActivityGraphBuildOptions,
): {
  edges: ActivityGraphEdge[];
  nodes: ActivityGraphNode[];
} {
  const controlEdges = model.edges.filter((edge) => edge.kind === 'control');
  const laneWidths = new Map<string, number>();
  const visibleNodeDefs = model.nodes.filter((node) => options.display.showNotes || node.kind !== 'note');
  const visibleLaneIds = new Set(visibleNodeDefs.map((node) => node.laneId));
  const renderedLanes = model.lanes
    .slice()
    .sort((left, right) => left.order - right.order)
    .filter((lane) => lane.id !== defaultLaneId || model.lanes.length === 1 || visibleLaneIds.has(defaultLaneId));

  visibleNodeDefs.forEach((node) => {
    const estimatedSize = estimateActivityNodeSize(node.kind, node.label, options.display);
    const size = options.nodeSizes?.[node.id] ?? estimatedSize;
    laneWidths.set(node.laneId, Math.max(laneWidths.get(node.laneId) ?? 220, size.width + laneInnerPadding * 2));
  });

  const laneBoxes = new Map<string, { height: number; width: number; x: number; y: number }>();
  let x = 0;
  renderedLanes.forEach((lane) => {
      const width = Math.max(220, laneWidths.get(lane.id) ?? 220);
      laneBoxes.set(lane.id, { height: 480, width, x, y: 0 });
      x += width + options.display.laneGap;
    });

  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  visibleNodeDefs.forEach((node) => {
    incoming.set(node.id, 0);
    adjacency.set(node.id, []);
  });
  controlEdges.forEach((edge) => {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) return;
    adjacency.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  });

  const queue = visibleNodeDefs.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ranks = new Map<string, number>();
  queue.forEach((id) => ranks.set(id, 0));
  while (queue.length > 0) {
    const id = queue.shift()!;
    const currentRank = ranks.get(id) ?? 0;
    (adjacency.get(id) ?? []).forEach((target) => {
      const nextRank = Math.max(ranks.get(target) ?? 0, currentRank + 1);
      ranks.set(target, nextRank);
      const nextIncoming = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, nextIncoming);
      if (nextIncoming === 0) queue.push(target);
    });
  }
  visibleNodeDefs.forEach((node) => {
    if (!ranks.has(node.id)) ranks.set(node.id, Math.max(0, node.sourceOrder - 1));
  });

  const rankLaneOffsets = new Map<string, number>();
  const rankBaseY = new Map<string, number>();

  const graphNodes: ActivityGraphNode[] = [];

  renderedLanes.forEach((lane) => {
      const box = laneBoxes.get(lane.id)!;
      graphNodes.push({
        data: {
          display: options.display,
          kind: 'lane',
          label: lane.label,
          onLabelEdit: lane.id === defaultLaneId ? undefined : options.onLabelEdit,
          selectedId: options.selectedId,
        },
        draggable: false,
        id: lane.id,
        position: { x: box.x, y: box.y },
        selectable: false,
        style: {
          ...umlNodeStyle(options.display),
          height: box.height,
          width: box.width,
          zIndex: 0,
        },
        type: 'activityLane',
      });
    });

  // Pre-compute per-(lane, rank) total consumed height and actual last-node bottom.
  // Exclude note nodes since their positions are overridden later.
  const nonNoteDefs = visibleNodeDefs.filter((n) => n.kind !== 'note');
  const rankContentBottom = new Map<string, number>(); // actual bottom of last node (relative to rank baseY)
  nonNoteDefs.forEach((node) => {
    const size = estimateActivityNodeSize(node.kind, node.label, options.display);
    const rank = ranks.get(node.id) ?? 0;
    const key = `${node.laneId}:${rank}`;
    const prevOffset = rankLaneOffsets.get(key) ?? 0;
    const gap = Math.max(36, Math.round(size.height * 0.6));
    rankLaneOffsets.set(key, prevOffset + size.height + gap);
    rankContentBottom.set(key, prevOffset + size.height);
  });

  // Compute global baseY per rank, synchronized across all lanes.
  // This ensures all lanes' nodes at the same rank share the same Y origin,
  // preventing cross-lane visual misalignment where a rank-N node from one
  // lane sits at the same Y as a rank-(N-1) node from another lane.
  const MIN_RANK_GAP = 48;
  const globalRankContentBottom = new Map<number, number>();
  for (const [key, bottom] of rankContentBottom) {
    const rank = parseInt(key.split(':')[1], 10);
    if (!isNaN(rank)) {
      globalRankContentBottom.set(rank, Math.max(globalRankContentBottom.get(rank) ?? 0, bottom));
    }
  }
  const sortedGlobalRanks = Array.from(globalRankContentBottom.keys()).sort((a, b) => a - b);
  let globalBaseY = 0;
  for (const rank of sortedGlobalRanks) {
    const baseYForRank = Math.max(rank * options.display.rankGap, globalBaseY);
    for (const lane of renderedLanes) {
      const key = `${lane.id}:${rank}`;
      if (rankContentBottom.has(key)) {
        rankBaseY.set(key, baseYForRank);
      }
    }
    const contentBottom = globalRankContentBottom.get(rank) ?? 0;
    globalBaseY = baseYForRank + contentBottom + MIN_RANK_GAP;
  }

  // Reset for per-node within-rank offset tracking
  rankLaneOffsets.clear();

  visibleNodeDefs.forEach((node) => {
    const lane = laneBoxes.get(node.laneId)!;
    const size = estimateActivityNodeSize(node.kind, node.label, options.display);
    const rank = ranks.get(node.id) ?? 0;
    const laneRankKey = `${node.laneId}:${rank}`;
    const laneOffset = rankLaneOffsets.get(laneRankKey) ?? 0;
    const overlapGap = Math.max(36, Math.round(size.height * 0.6));
    // Keep within-rank stacking consistent with pre-computation (notes excluded)
    if (node.kind !== 'note') {
      rankLaneOffsets.set(laneRankKey, laneOffset + size.height + overlapGap);
    }
    const baseY = rankBaseY.get(laneRankKey) ?? rank * options.display.rankGap;
    const defaultPosition = {
      x: lane.x + (lane.width - size.width) / 2,
      y: laneHeaderHeight + laneInnerPadding + baseY + laneOffset,
    };

    graphNodes.push({
      data: {
        display: options.display,
        kind: node.kind,
        label: node.label,
        noteSide: node.noteSide,
        onLabelEdit: node.kind === 'action' || node.kind === 'decision' ? options.onLabelEdit : undefined,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
      },
      id: node.id,
      position: defaultPosition,
      style: {
        ...umlNodeStyle(options.display),
        height: size.height,
        width: size.width,
        zIndex: node.kind === 'note' ? 1 : 2,
      },
        type:
        node.kind === 'start'
          ? 'activityStart'
          : node.kind === 'end'
            ? 'activityEnd'
            : node.kind === 'flowFinal'
              ? 'activityFlowFinal'
              : node.kind === 'object'
                ? 'activityObject'
            : node.kind === 'decision' || node.kind === 'merge'
              ? 'activityDecision'
              : node.kind === 'fork' || node.kind === 'join'
                ? 'activityBar'
                : node.kind === 'note'
                  ? 'activityNote'
                  : 'activityAction',
    });
  });

  const nodesById = new Map(graphNodes.map((node) => [node.id, node]));
  visibleNodeDefs
    .filter((node) => node.kind === 'note' && node.targetRef)
    .forEach((node) => {
      const noteNode = nodesById.get(node.id);
      const targetNode = nodesById.get(node.targetRef!);
      if (!noteNode || !targetNode) return;
      const noteWidth = Number(noteNode.style?.width ?? 0);
      const targetWidth = Number(targetNode.style?.width ?? 0);
      noteNode.position = {
        x: (node.noteSide ?? 'right') === 'right' ? targetNode.position.x + targetWidth + 34 : targetNode.position.x - noteWidth - 34,
        y: targetNode.position.y - 4,
      };
    });

  // Prevent notes from overflowing their lane boundaries.
  // If a note extends past its lane edge, try the opposite side.
  const NOTE_LANE_PADDING = 20;
  visibleNodeDefs
    .filter((node) => node.kind === 'note' && node.targetRef)
    .forEach((node) => {
      const noteNode = nodesById.get(node.id);
      const targetNode = nodesById.get(node.targetRef!);
      if (!noteNode || !targetNode) return;
      const noteW = Number(noteNode.style?.width ?? 0);
      const targetW = Number(targetNode.style?.width ?? 0);
      const lane = laneBoxes.get(node.laneId);
      if (!lane) return;
      const onRight = (node.noteSide ?? 'right') === 'right';
      const noteR = noteNode.position.x + noteW;
      const laneL = lane.x;
      const laneR = lane.x + lane.width;
      const rightOverflow = noteR > laneR - NOTE_LANE_PADDING;
      const leftOverflow = noteNode.position.x < laneL + NOTE_LANE_PADDING;

      if (onRight && rightOverflow) {
        const leftX = targetNode.position.x - noteW - 34;
        if (leftX >= laneL + NOTE_LANE_PADDING) {
          noteNode.position.x = leftX;
          noteNode.position.y = targetNode.position.y - 4;
        }
      } else if (!onRight && leftOverflow) {
        const rightX = targetNode.position.x + targetW + 34;
        if (rightX + noteW <= laneR - NOTE_LANE_PADDING) {
          noteNode.position.x = rightX;
          noteNode.position.y = targetNode.position.y - 4;
        }
      }
    });

  const maxRank = Math.max(0, ...Array.from(ranks.values()));

  const nodeBounds = graphNodes.filter((node) => node.data.kind !== 'lane');
  const minY = nodeBounds.length > 0 ? Math.min(...nodeBounds.map((node) => node.position.y)) : 0;
  const maxY =
    nodeBounds.length > 0
      ? Math.max(...nodeBounds.map((node) => node.position.y + Number(node.style?.height ?? 0)))
      : laneHeaderHeight + laneInnerPadding + (maxRank + 1) * options.display.rankGap;

  graphNodes.forEach((node) => {
    if (node.data.kind !== 'lane') return;
    node.position.y = minY - laneHeaderHeight - laneInnerPadding;
    node.style = {
      ...node.style,
      height: maxY - minY + laneHeaderHeight + laneInnerPadding * 2,
    };
  });

  const edges: ActivityGraphEdge[] = model.edges
    .filter((edge) => (options.display.showNotes ? true : edge.kind !== 'note'))
    .filter((edge) => nodesById.has(edge.source) && nodesById.has(edge.target))
    .map((edge) => ({
      data: {
        display: options.display,
        kind: edge.kind,
        label: edge.label,
      },
      id: edge.id,
      label: edge.label,
      source: edge.source,
      target: edge.target,
      type: edge.kind === 'note' ? 'activityNoteEdge' : edge.kind === 'object' ? 'activityObjectEdge' : 'activityControlEdge',
    }));

  return { edges, nodes: graphNodes };
}

function getActivityNodeType(kind: ActivityNodeKind): string {
  switch (kind) {
    case 'start': return 'activityStart';
    case 'end': return 'activityEnd';
    case 'flowFinal': return 'activityFlowFinal';
    case 'object': return 'activityObject';
    case 'decision': case 'merge': return 'activityDecision';
    case 'fork': case 'join': return 'activityBar';
    case 'note': return 'activityNote';
    default: return 'activityAction';
  }
}

export async function buildActivityGraphAsync(
  model: ActivityModel,
  options: ActivityGraphBuildOptions,
): Promise<{
  edges: ActivityGraphEdge[];
  nodes: ActivityGraphNode[];
}> {
  const display = options.display;

  // Filter visible nodes and lanes (same as sync version)
  const visibleNodeDefs = model.nodes.filter((node) => display.showNotes || node.kind !== 'note');
  const visibleLaneIds = new Set(visibleNodeDefs.map((node) => node.laneId));
  const renderedLanes = model.lanes
    .slice()
    .sort((left, right) => left.order - right.order)
    .filter((lane) => lane.id !== defaultLaneId || model.lanes.length === 1 || visibleLaneIds.has(defaultLaneId));

  // Compute node sizes (same as sync version)
  const nodeSizes = new Map<string, { height: number; width: number }>();
  visibleNodeDefs.forEach((node) => {
    const estimatedSize = estimateActivityNodeSize(node.kind, node.label, display);
    const size = options.nodeSizes?.[node.id] ?? estimatedSize;
    nodeSizes.set(node.id, size);
  });

  // ---- SINGLE FLAT ELK LAYOUT (all nodes + all edges → topological Y) ----
  const elk = await loadElk();

  const elkAllNodes = visibleNodeDefs.filter((n) => n.kind !== 'note');
  const elkAllNodeIds = new Set(elkAllNodes.map((n) => n.id));
  const elkAllEdges = model.edges.filter(
    (e) => e.kind === 'control' && elkAllNodeIds.has(e.source) && elkAllNodeIds.has(e.target),
  );

  const elkGraph = {
    id: 'activity-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.max(32, Math.round(display.rankGap * 0.5))),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.max(48, display.rankGap)),
      'elk.spacing.edgeEdge': '18',
      'elk.spacing.nodeNode': String(Math.max(24, Math.round(display.fontSize * 1.6))),
    },
    children: elkAllNodes.map((node) => ({
      id: node.id,
      width: nodeSizes.get(node.id)!.width,
      height: nodeSizes.get(node.id)!.height,
    })),
    edges: elkAllEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const elkResult = await elk.layout(elkGraph);

  // Extract (x, y) from ELK; node x determines within‑lane order
  const elkPositions = new Map<string, { x: number; y: number }>();
  for (const child of elkResult.children ?? []) {
    if (child.x != null && child.y != null) {
      elkPositions.set(child.id, { x: child.x, y: child.y });
    }
  }

  // Per‑lane bounding box in ELK coordinates (used to separate lanes)
  const laneElkBboxes = new Map<string, { minX: number; maxX: number }>();
  for (const node of elkAllNodes) {
    const pos = elkPositions.get(node.id);
    if (!pos) continue;
    const size = nodeSizes.get(node.id)!;
    const bbox = laneElkBboxes.get(node.laneId) ?? { minX: Infinity, maxX: -Infinity };
    bbox.minX = Math.min(bbox.minX, pos.x);
    bbox.maxX = Math.max(bbox.maxX, pos.x + size.width);
    laneElkBboxes.set(node.laneId, bbox);
  }

  // ---- Position lanes side by side (based on ELK X extents) ----
  const laneBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const yOffset = laneHeaderHeight + laneInnerPadding;
  let laneX = 0;
  for (const lane of renderedLanes) {
    const bbox = laneElkBboxes.get(lane.id);
    const spanWidth = bbox ? bbox.maxX - bbox.minX : 0;
    const width = Math.max(220, spanWidth + laneInnerPadding * 2);
    laneBoxes.set(lane.id, { x: laneX, y: 0, width, height: 480 });
    laneX += width + display.laneGap;
  }

  // Shift each node by its lane offset, keeping ELK X ordering within the lane
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of elkAllNodes) {
    const box = laneBoxes.get(node.laneId);
    const elkPos = elkPositions.get(node.id);
    const bbox = laneElkBboxes.get(node.laneId);
    if (!box || !elkPos || !bbox) continue;
    positions.set(node.id, {
      x: elkPos.x - bbox.minX + box.x + laneInnerPadding,
      y: elkPos.y + yOffset,
    });
  }

  // ---- Build React Flow Nodes ----
  const graphNodes: ActivityGraphNode[] = [];

  // Lane nodes
  for (const lane of renderedLanes) {
    const box = laneBoxes.get(lane.id)!;
    graphNodes.push({
      data: {
        display,
        kind: 'lane',
        label: lane.label,
        onLabelEdit: lane.id === defaultLaneId ? undefined : options.onLabelEdit,
        selectedId: options.selectedId,
      },
      draggable: false,
      id: lane.id,
      position: { x: box.x, y: box.y },
      selectable: false,
      style: { ...umlNodeStyle(display), height: box.height, width: box.width, zIndex: 0 },
      type: 'activityLane',
    });
  }

  // Regular nodes
  for (const node of visibleNodeDefs) {
    const size = nodeSizes.get(node.id)!;
    const pos = node.kind === 'note'
      ? { x: 0, y: 0 } // repositioned relative to target later
      : (positions.get(node.id) ?? { x: 0, y: yOffset });

    graphNodes.push({
      data: {
        display,
        kind: node.kind,
        label: node.label,
        noteSide: node.noteSide,
        onLabelEdit: node.kind === 'action' || node.kind === 'decision' ? options.onLabelEdit : undefined,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
      },
      id: node.id,
      position: pos,
      style: {
        ...umlNodeStyle(display),
        height: size.height,
        width: size.width,
        zIndex: node.kind === 'note' ? 1 : 2,
      },
      type: getActivityNodeType(node.kind),
    });
  }

  // ---- Position notes relative to their targets ----
  const nodesById = new Map(graphNodes.map((n) => [n.id, n]));
  const NOTE_LANE_PADDING = 20;

  for (const node of visibleNodeDefs.filter((n) => n.kind === 'note' && n.targetRef)) {
    const noteNode = nodesById.get(node.id);
    const targetNode = nodesById.get(node.targetRef!);
    if (!noteNode || !targetNode) continue;

    const noteWidth = Number(noteNode.style?.width ?? 0);
    const targetWidth = Number(targetNode.style?.width ?? 0);

    noteNode.position = {
      x: (node.noteSide ?? 'right') === 'right'
        ? targetNode.position.x + targetWidth + 34
        : targetNode.position.x - noteWidth - 34,
      y: targetNode.position.y - 4,
    };

    // Note lane overflow prevention (same as sync version)
    const lane = laneBoxes.get(node.laneId);
    if (!lane) continue;
    const onRight = (node.noteSide ?? 'right') === 'right';
    const noteR = noteNode.position.x + noteWidth;
    const laneL = lane.x;
    const laneR = lane.x + lane.width;

    if (onRight && noteR > laneR - NOTE_LANE_PADDING) {
      const leftX = targetNode.position.x - noteWidth - 34;
      if (leftX >= laneL + NOTE_LANE_PADDING) {
        noteNode.position.x = leftX;
      }
    } else if (!onRight && noteNode.position.x < laneL + NOTE_LANE_PADDING) {
      const rightX = targetNode.position.x + targetWidth + 34;
      if (rightX + noteWidth <= laneR - NOTE_LANE_PADDING) {
        noteNode.position.x = rightX;
      }
    }
  }

  // ---- Adjust lane heights to encompass all content ----
  const nonLaneNodes = graphNodes.filter((n) => n.data.kind !== 'lane');
  const minY = nonLaneNodes.length > 0
    ? Math.min(...nonLaneNodes.map((n) => n.position.y))
    : 0;
  const maxY = nonLaneNodes.length > 0
    ? Math.max(...nonLaneNodes.map((n) => n.position.y + Number(n.style?.height ?? 0)))
    : yOffset + 200;

  for (const node of graphNodes) {
    if (node.data.kind !== 'lane') continue;
    node.position.y = minY - laneHeaderHeight - laneInnerPadding;
    node.style = { ...node.style, height: maxY - minY + laneHeaderHeight + laneInnerPadding * 2 };
  }

  // ---- Build edges ----
  const edges: ActivityGraphEdge[] = model.edges
    .filter((edge) => (display.showNotes ? true : edge.kind !== 'note'))
    .filter((edge) => nodesById.has(edge.source) && nodesById.has(edge.target))
    .map((edge) => ({
      data: { display, kind: edge.kind, label: edge.label },
      id: edge.id,
      label: edge.label,
      source: edge.source,
      target: edge.target,
      type: edge.kind === 'note' ? 'activityNoteEdge'
        : edge.kind === 'object' ? 'activityObjectEdge'
        : 'activityControlEdge',
    }));

  return { edges, nodes: graphNodes };
}
