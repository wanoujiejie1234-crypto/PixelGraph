import type { StoredUmlEdgeLabel } from '../storage/storage';
import {
  edgeLabelData,
  getScopedPosition,
  umlNodeStyle,
  type UmlDisplaySettingsBase,
  type UmlGraphEdge,
  type UmlGraphNode,
} from './umlFlowModel';

export interface Actor {
  isExternal: boolean;
  name: string;
}

export interface UseCaseItem {
  name: string;
}

export interface UseCaseNote {
  kind: 'note' | 'constraint';
  target: string;
  text: string;
}

export interface Association {
  actor: string;
  direction?: 'left-to-right' | 'right-to-left' | 'bidirectional' | 'none';
  useCase: string;
}

export interface IncludeRelation {
  from: string;
  to: string;
}

export interface ExtendRelation {
  from: string;
  to: string;
}

export interface GeneralizationRelation {
  from: string;
  to: string;
}

export interface DependencyRelation {
  from: string;
  to: string;
}

export interface UseCaseModel {
  actors: Actor[];
  associations: Association[];
  dependencies: DependencyRelation[];
  extends: ExtendRelation[];
  generalizations: GeneralizationRelation[];
  includes: IncludeRelation[];
  notes: UseCaseNote[];
  systemName: string;
  useCases: UseCaseItem[];
}

export type UseCaseAssociationArrow = 'none' | 'open';
export type UseCaseLineStyle = 'straight' | 'smooth' | 'bezier';

export interface UseCaseDisplaySettings extends UmlDisplaySettingsBase {
  actorSpacing: number;
  associationArrow: UseCaseAssociationArrow;
  lineColor: string;
  lineStyle: UseCaseLineStyle;
  lineWidth: number;
  showRelationLabels: boolean;
  showSystemBoundary: boolean;
  useCaseSpacing: number;
}

export interface UseCaseDiagnostic {
  level: 'error';
  message: string;
}

export interface UseCaseValidation {
  diagnostics: UseCaseDiagnostic[];
  hasFatalError: boolean;
}

export type UseCaseNodeKind = 'systemBoundary' | 'actor' | 'useCase' | 'note';
export type UseCaseEdgeKind = 'association' | 'include' | 'extend' | 'generalization' | 'dependency' | 'note';

export interface UseCaseNodeMetadata {
  actor?: Actor;
  note?: UseCaseNote;
  relation?: IncludeRelation | ExtendRelation | GeneralizationRelation | Association | DependencyRelation;
  useCase?: UseCaseItem;
}

export interface UseCaseGraphNodeData extends Record<string, unknown> {
  display: UseCaseDisplaySettings;
  kind: UseCaseNodeKind;
  label: string;
  metadata: UseCaseNodeMetadata;
  onLocalLabelEdit?: (nodeId: string, value: string) => void;
  onNodeResize?: (nodeId: string, size: { height: number; width: number }) => void;
  selectedId: string | null;
}

export interface UseCaseGraphEdgeData extends Record<string, unknown> {
  direction?: Association['direction'];
  display: UseCaseDisplaySettings;
  kind: UseCaseEdgeKind;
  label?: string;
  labelOffset?: { x: number; y: number };
  onLabelChange?: (edgeId: string, text: string) => void;
  onLabelOffsetChange?: (edgeId: string, offset: { x: number; y: number }, text: string) => void;
}

export type UseCaseGraphNode = UmlGraphNode<UseCaseGraphNodeData>;
export type UseCaseGraphEdge = UmlGraphEdge<UseCaseGraphEdgeData>;

export interface UseCaseGraphBuildOptions {
  display: UseCaseDisplaySettings;
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

const sections = ['actors', 'usecases', 'associations', 'includes', 'extends', 'generalizations', 'dependencies', 'notes', 'constraints'] as const;
type SectionName = (typeof sections)[number];

export const defaultUseCaseDisplaySettings: UseCaseDisplaySettings = {
  accentColor: '#507c69',
  actorSpacing: 96,
  associationArrow: 'none',
  fillColor: '#ffffff',
  fontSize: 15,
  layoutDirection: 'LR',
  lineColor: '#171817',
  lineStyle: 'smooth',
  lineWidth: 1.5,
  nodeScale: 1,
  showRelationLabels: true,
  showSystemBoundary: true,
  strokeColor: '#171817',
  textColor: '#171817',
  useCaseSpacing: 110,
};

export function actorId(name: string): string {
  return `actor:${name.toLowerCase()}`;
}

export function useCaseId(name: string): string {
  return `usecase:${name.toLowerCase()}`;
}

export function systemBoundaryId(): string {
  return 'system-boundary';
}

function associationId(relation: Association): string {
  return `association:${relation.actor.toLowerCase()}->${relation.useCase.toLowerCase()}`;
}

function includeId(relation: IncludeRelation): string {
  return `include:${relation.from.toLowerCase()}->${relation.to.toLowerCase()}`;
}

function extendId(relation: ExtendRelation): string {
  return `extend:${relation.from.toLowerCase()}->${relation.to.toLowerCase()}`;
}

function generalizationId(relation: GeneralizationRelation): string {
  return `generalization:${relation.from.toLowerCase()}->${relation.to.toLowerCase()}`;
}

function dependencyId(relation: DependencyRelation): string {
  return `dependency:${relation.from.toLowerCase()}->${relation.to.toLowerCase()}`;
}

function parseRelation(value: string): { direction?: Association['direction']; from: string; to: string } | null {
  const match = value.match(/^(.*?)\s*(<->|->|<-)\s*(.*?)$/u);
  if (!match) return null;
  const from = match[1].trim();
  const arrow = match[2];
  const to = match[3].trim();
  if (!from || !to) return null;
  return {
    direction: arrow === '<->' ? 'bidirectional' : arrow === '<-' ? 'right-to-left' : 'left-to-right',
    from,
    to,
  };
}

function formatActor(actor: Actor): string {
  return actor.isExternal ? `${actor.name} [external]` : actor.name;
}

function normalizeSectionOrder(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
}

function nodeIdForName(model: UseCaseModel, name: string): string {
  return model.actors.some((item) => item.name === name) ? actorId(name) : useCaseId(name);
}

export function formatUseCaseSource(source: string): string {
  try {
    return modelToUseCaseDsl(parseUseCaseModel(source));
  } catch {
    return normalizeSectionOrder(source);
  }
}

export function parseUseCaseModel(source: string): UseCaseModel {
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  const [headerLine = ''] = lines;
  const headerMatch = headerLine.trim().match(/^usecase\s+(.+)$/iu);

  if (!headerMatch) {
    throw new Error('第一行必须以 usecase 开头，并包含系统名称。');
  }

  const model: UseCaseModel = {
    actors: [],
    associations: [],
    dependencies: [],
    extends: [],
    generalizations: [],
    includes: [],
    notes: [],
    systemName: headerMatch[1].trim(),
    useCases: [],
  };

  let currentSection: SectionName | null = null;
  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) continue;

    if ((sections as readonly string[]).includes(line)) {
      currentSection = line as SectionName;
      continue;
    }

    if (!currentSection) {
      throw new Error(`未识别的 DSL 段落：${line}`);
    }

    if (currentSection === 'actors') {
      const external = /\[external\]\s*$/iu.test(line);
      const name = line.replace(/\s*\[external\]\s*$/iu, '').trim();
      if (!name) throw new Error('参与者名称不能为空。');
      model.actors.push({ isExternal: external, name });
      continue;
    }

    if (currentSection === 'usecases') {
      if (!line) throw new Error('用例名称不能为空。');
      model.useCases.push({ name: line });
      continue;
    }

    if (currentSection === 'notes' || currentSection === 'constraints') {
      const noteMatch = line.match(/^(.*?)\s*:\s*(.+)$/u);
      if (!noteMatch) {
        throw new Error(`Note or constraint format is invalid: ${line}`);
      }
      model.notes.push({
        kind: currentSection === 'constraints' ? 'constraint' : 'note',
        target: noteMatch[1].trim(),
        text: noteMatch[2].trim(),
      });
      continue;
    }

    const relation = parseRelation(line);
    if (!relation) {
      throw new Error(`关系格式无效：${line}`);
    }

    if (currentSection === 'associations') model.associations.push({ actor: relation.from, direction: relation.direction ?? 'none', useCase: relation.to });
    if (currentSection === 'includes') model.includes.push(relation);
    if (currentSection === 'extends') model.extends.push(relation);
    if (currentSection === 'generalizations') model.generalizations.push(relation);
    if (currentSection === 'dependencies') model.dependencies.push(relation);
  }

  return model;
}

export function validateUseCaseSource(source: string): UseCaseValidation {
  try {
    const model = parseUseCaseModel(source);
    const diagnostics: UseCaseDiagnostic[] = [];
    const actorNames = new Set<string>();
    const useCaseNames = new Set<string>();

    if (!model.systemName.trim()) diagnostics.push({ level: 'error', message: '系统名称不能为空。' });

    model.actors.forEach((actor) => {
      if (actorNames.has(actor.name)) diagnostics.push({ level: 'error', message: `参与者重复：${actor.name}` });
      actorNames.add(actor.name);
    });

    model.useCases.forEach((item) => {
      if (useCaseNames.has(item.name)) diagnostics.push({ level: 'error', message: `用例重复：${item.name}` });
      useCaseNames.add(item.name);
    });

    model.associations.forEach((relation) => {
      if (!actorNames.has(relation.actor)) diagnostics.push({ level: 'error', message: `Association 未找到参与者：${relation.actor}` });
      if (!useCaseNames.has(relation.useCase)) diagnostics.push({ level: 'error', message: `Association 未找到用例：${relation.useCase}` });
    });

    model.includes.forEach((relation) => {
      if (!useCaseNames.has(relation.from)) diagnostics.push({ level: 'error', message: `Include 起点必须是用例：${relation.from}` });
      if (!useCaseNames.has(relation.to)) diagnostics.push({ level: 'error', message: `Include 终点必须是用例：${relation.to}` });
    });

    model.extends.forEach((relation) => {
      if (!useCaseNames.has(relation.from)) diagnostics.push({ level: 'error', message: `Extend 起点必须是用例：${relation.from}` });
      if (!useCaseNames.has(relation.to)) diagnostics.push({ level: 'error', message: `Extend 终点必须是用例：${relation.to}` });
    });

    model.generalizations.forEach((relation) => {
      const actorPair = actorNames.has(relation.from) && actorNames.has(relation.to);
      const useCasePair = useCaseNames.has(relation.from) && useCaseNames.has(relation.to);
      if (!actorPair && !useCasePair) {
        diagnostics.push({ level: 'error', message: `Generalization 必须发生在参与者之间或用例之间：${relation.from} -> ${relation.to}` });
      }
    });

    model.dependencies.forEach((relation) => {
      const fromExists = actorNames.has(relation.from) || useCaseNames.has(relation.from);
      const toExists = actorNames.has(relation.to) || useCaseNames.has(relation.to);
      if (!fromExists) diagnostics.push({ level: 'error', message: `Dependency 起点未找到：${relation.from}` });
      if (!toExists) diagnostics.push({ level: 'error', message: `Dependency 终点未找到：${relation.to}` });
    });

    model.notes.forEach((note) => {
      const targetExists = actorNames.has(note.target) || useCaseNames.has(note.target);
      if (!targetExists) diagnostics.push({ level: 'error', message: `${note.kind === 'constraint' ? 'Constraint' : 'Note'} target not found: ${note.target}` });
    });

    return {
      diagnostics,
      hasFatalError: diagnostics.length > 0,
    };
  } catch (error) {
    return {
      diagnostics: [{ level: 'error', message: error instanceof Error ? error.message : 'Use Case DSL 解析失败。' }],
      hasFatalError: true,
    };
  }
}

export function modelToUseCaseDsl(model: UseCaseModel): string {
  const sectionsContent = [
    ['actors', model.actors.map((actor) => `  ${formatActor(actor)}`)],
    ['usecases', model.useCases.map((item) => `  ${item.name}`)],
    [
      'associations',
      model.associations.map((relation) => `  ${relation.actor} ${relation.direction === 'right-to-left' ? '<-' : relation.direction === 'bidirectional' ? '<->' : '->'} ${relation.useCase}`),
    ],
    ['includes', model.includes.map((relation) => `  ${relation.from} -> ${relation.to}`)],
    ['extends', model.extends.map((relation) => `  ${relation.from} -> ${relation.to}`)],
    ['generalizations', model.generalizations.map((relation) => `  ${relation.from} -> ${relation.to}`)],
    ['dependencies', model.dependencies.map((relation) => `  ${relation.from} -> ${relation.to}`)],
    ['notes', model.notes.filter((note) => note.kind === 'note').map((note) => `  ${note.target}: ${note.text}`)],
    ['constraints', model.notes.filter((note) => note.kind === 'constraint').map((note) => `  ${note.target}: ${note.text}`)],
  ] as const;

  return [
    `usecase ${model.systemName.trim()}`,
    '',
    ...sectionsContent.flatMap(([title, rows], index) => {
      const block = [title, ...rows];
      if (index < sectionsContent.length - 1) block.push('');
      return block;
    }),
  ]
    .join('\n')
    .trim();
}

export function renameUseCaseModelLabel(model: UseCaseModel, nodeId: string, nextValue: string): UseCaseModel {
  const next = nextValue.trim();
  if (!next) return model;

  if (nodeId === systemBoundaryId()) {
    return { ...model, systemName: next };
  }

  const actor = model.actors.find((item) => actorId(item.name) === nodeId);
  if (actor) {
    return {
      ...model,
      actors: model.actors.map((item) => (item.name === actor.name ? { ...item, name: next } : item)),
      associations: model.associations.map((relation) => ({
        ...relation,
        actor: relation.actor === actor.name ? next : relation.actor,
      })),
      dependencies: model.dependencies.map((relation) => ({
        from: relation.from === actor.name ? next : relation.from,
        to: relation.to === actor.name ? next : relation.to,
      })),
      generalizations: model.generalizations.map((relation) => ({
        from: relation.from === actor.name ? next : relation.from,
        to: relation.to === actor.name ? next : relation.to,
      })),
    };
  }

  const useCase = model.useCases.find((item) => useCaseId(item.name) === nodeId);
  if (useCase) {
    return {
      ...model,
      associations: model.associations.map((relation) => ({
        ...relation,
        useCase: relation.useCase === useCase.name ? next : relation.useCase,
      })),
      dependencies: model.dependencies.map((relation) => ({
        from: relation.from === useCase.name ? next : relation.from,
        to: relation.to === useCase.name ? next : relation.to,
      })),
      extends: model.extends.map((relation) => ({
        from: relation.from === useCase.name ? next : relation.from,
        to: relation.to === useCase.name ? next : relation.to,
      })),
      generalizations: model.generalizations.map((relation) => ({
        from: relation.from === useCase.name ? next : relation.from,
        to: relation.to === useCase.name ? next : relation.to,
      })),
      includes: model.includes.map((relation) => ({
        from: relation.from === useCase.name ? next : relation.from,
        to: relation.to === useCase.name ? next : relation.to,
      })),
      useCases: model.useCases.map((item) => (item.name === useCase.name ? { ...item, name: next } : item)),
    };
  }

  return model;
}

function defaultNodeSize(node: UseCaseGraphNode): { height: number; width: number } {
  const scale = Math.min(1.45, Math.max(0.72, node.data.display.nodeScale || 1));
  if (node.data.kind === 'systemBoundary') return { height: 440 * scale, width: 780 * scale };
  if (node.data.kind === 'actor') return { height: 112 * scale, width: 92 * scale };
  if (node.data.kind === 'note') return { height: 84 * scale, width: 188 * scale };
  return { height: 54 * scale, width: 176 * scale };
}

function applyNodeSize(node: UseCaseGraphNode, options: UseCaseGraphBuildOptions): UseCaseGraphNode {
  const size = options.nodeSizes[node.id] ?? defaultNodeSize(node);
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

type ActorBand = 'bottom' | 'left' | 'right' | 'top';

function collectConnectedNames(model: UseCaseModel): { actors: Set<string>; useCases: Set<string> } {
  const actorNames = new Set(model.actors.map((actor) => actor.name));
  const useCaseNames = new Set(model.useCases.map((item) => item.name));
  const actors = new Set<string>();
  const useCases = new Set<string>();

  model.associations.forEach((relation) => {
    if (actorNames.has(relation.actor) && useCaseNames.has(relation.useCase)) {
      actors.add(relation.actor);
      useCases.add(relation.useCase);
    }
  });

  [...model.includes, ...model.extends].forEach((relation) => {
    if (useCaseNames.has(relation.from) && useCaseNames.has(relation.to)) {
      useCases.add(relation.from);
      useCases.add(relation.to);
    }
  });

  model.generalizations.forEach((relation) => {
    const actorPair = actorNames.has(relation.from) && actorNames.has(relation.to);
    if (actorPair) {
      actors.add(relation.from);
      actors.add(relation.to);
    }
    if (useCaseNames.has(relation.from) && useCaseNames.has(relation.to)) {
      useCases.add(relation.from);
      useCases.add(relation.to);
    }
  });

  model.dependencies.forEach((relation) => {
    if (actorNames.has(relation.from)) actors.add(relation.from);
    if (actorNames.has(relation.to)) actors.add(relation.to);
    if (useCaseNames.has(relation.from)) useCases.add(relation.from);
    if (useCaseNames.has(relation.to)) useCases.add(relation.to);
  });

  return { actors, useCases };
}

function actorBandForIndex(index: number, layoutDirection: UseCaseDisplaySettings['layoutDirection']): ActorBand {
  if (layoutDirection === 'TB') return index % 2 === 0 ? 'top' : 'bottom';
  return index % 2 === 0 ? 'left' : 'right';
}

function actorSourceHandle(side: ActorBand): string {
  if (side === 'left') return 'actor-right-source';
  if (side === 'right') return 'actor-left-source';
  return side === 'top' ? 'actor-bottom-source' : 'actor-top-source';
}

function actorTargetHandle(side: ActorBand): string {
  if (side === 'left') return 'actor-right-target';
  if (side === 'right') return 'actor-left-target';
  return side === 'top' ? 'actor-bottom-target' : 'actor-top-target';
}

function actorChainTargetHandle(side: ActorBand): string {
  if (side === 'left') return 'actor-left-target';
  if (side === 'right') return 'actor-right-target';
  return side === 'top' ? 'actor-top-target' : 'actor-bottom-target';
}

function useCaseTargetHandleForActor(side: ActorBand): string {
  if (side === 'right') return 'usecase-right-target';
  if (side === 'top') return 'usecase-top-target';
  if (side === 'bottom') return 'usecase-bottom-target';
  return 'usecase-left-target';
}

export function buildUseCaseGraph(model: UseCaseModel, options: UseCaseGraphBuildOptions): { edges: UseCaseGraphEdge[]; nodes: UseCaseGraphNode[] } {
  const inheritedAssociations: Association[] = [];
  model.generalizations.forEach((relation) => {
    const isActorPair = model.actors.some((item) => item.name === relation.from) && model.actors.some((item) => item.name === relation.to);
    if (!isActorPair) return;
    model.associations
      .filter((association) => association.actor === relation.to)
      .forEach((association) => {
        const exists = model.associations.some((item) => item.actor === relation.from && item.useCase === association.useCase);
        if (!exists) inheritedAssociations.push({ ...association, actor: relation.from });
      });
  });
  const allAssociations = [...model.associations, ...inheritedAssociations];
  const connected = collectConnectedNames(model);
  allAssociations.forEach((relation) => {
    connected.actors.add(relation.actor);
    connected.useCases.add(relation.useCase);
  });
  const visibleActors = model.actors.filter((actor) => connected.actors.has(actor.name));
  const visibleUseCases = model.useCases.filter((item) => connected.useCases.has(item.name));
  const visibleActorNames = new Set(visibleActors.map((actor) => actor.name));
  const visibleUseCaseNames = new Set(visibleUseCases.map((item) => item.name));
  const actorParents = new Map<string, string>();
  const actorChildren = new Map<string, string[]>();
  model.generalizations.forEach((relation) => {
    const isActorPair = model.actors.some((item) => item.name === relation.from) && model.actors.some((item) => item.name === relation.to);
    if (!isActorPair) return;
    actorParents.set(relation.from, relation.to);
    const children = actorChildren.get(relation.to) ?? [];
    children.push(relation.from);
    actorChildren.set(relation.to, children);
  });
  const rootActors = visibleActors.filter((actor) => !actorParents.has(actor.name));
  const actorSides = new Map<string, ActorBand>();
  const assignActorBand = (name: string, side: ActorBand): void => {
    actorSides.set(name, side);
    for (const child of actorChildren.get(name) ?? []) assignActorBand(child, side);
  };
  rootActors.forEach((actor, index) => assignActorBand(actor.name, actorBandForIndex(index, options.display.layoutDirection)));

  if (visibleUseCases.length === 0) {
    return { edges: [], nodes: [] };
  }

  const boundaryNode: UseCaseGraphNode = applyNodeSize(
    {
      data: {
        display: options.display,
        kind: 'systemBoundary',
        label: options.localLabels[systemBoundaryId()] ?? model.systemName,
        metadata: {},
        onLocalLabelEdit: options.onLocalLabelEdit,
        onNodeResize: options.onNodeResize,
        selectedId: options.selectedId,
      },
      id: systemBoundaryId(),
      position: getScopedPosition(systemBoundaryId(), options.positions, { x: 220, y: 120 }),
      style: umlNodeStyle(options.display),
      type: 'useCaseBoundary',
    },
    options,
  );

  const actorNodes = visibleActors.map((actor, index) =>
    applyNodeSize(
      {
        data: {
          display: options.display,
          kind: 'actor',
          label: options.localLabels[actorId(actor.name)] ?? actor.name,
          metadata: { actor },
          onLocalLabelEdit: options.onLocalLabelEdit,
          onNodeResize: options.onNodeResize,
          selectedId: options.selectedId,
        },
        id: actorId(actor.name),
        position: getScopedPosition(actorId(actor.name), options.positions, {
          x: 24,
          y: 150 + index * options.display.actorSpacing,
        }),
        style: umlNodeStyle(options.display),
        type: 'useCaseActor',
      },
      options,
    ),
  );

  const useCaseNodes = visibleUseCases.map((item, index) =>
    applyNodeSize(
      {
        data: {
          display: options.display,
          kind: 'useCase',
          label: options.localLabels[useCaseId(item.name)] ?? item.name,
          metadata: { useCase: item },
          onLocalLabelEdit: options.onLocalLabelEdit,
          onNodeResize: options.onNodeResize,
          selectedId: options.selectedId,
        },
        id: useCaseId(item.name),
        position: getScopedPosition(useCaseId(item.name), options.positions, {
          x: 320 + (index % 2) * 240,
          y: 180 + Math.floor(index / 2) * options.display.useCaseSpacing,
        }),
        style: umlNodeStyle(options.display),
        type: 'useCaseEllipse',
      },
      options,
    ),
  );

  const noteNodes = model.notes
    .filter((note) => visibleActorNames.has(note.target) || visibleUseCaseNames.has(note.target))
    .map((note, index) =>
      applyNodeSize(
        {
          data: {
            display: options.display,
            kind: 'note',
            label: options.localLabels[`note:${note.kind}:${note.target}:${index}`] ?? note.text,
            metadata: { note },
            onLocalLabelEdit: options.onLocalLabelEdit,
            onNodeResize: options.onNodeResize,
            selectedId: options.selectedId,
          },
          id: `note:${note.kind}:${note.target}:${index}`,
          position: getScopedPosition(`note:${note.kind}:${note.target}:${index}`, options.positions, {
            x: 620,
            y: 140 + index * 92,
          }),
          style: umlNodeStyle(options.display),
          type: 'useCaseNote',
        },
        options,
      ),
    );

  const hasVisibleEndpoint = (name: string): boolean => visibleActorNames.has(name) || visibleUseCaseNames.has(name);

  const edges: UseCaseGraphEdge[] = [
    ...allAssociations
      .filter((relation) => visibleActorNames.has(relation.actor) && visibleUseCaseNames.has(relation.useCase))
      .map((relation) => {
        const side = actorSides.get(relation.actor) ?? 'left';
        return {
          data: {
            display: options.display,
            direction: relation.direction ?? 'none',
            kind: 'association' as const,
            metadata: { relation },
          },
          id: associationId(relation),
          source: actorId(relation.actor),
          sourceHandle: actorSourceHandle(side),
          target: useCaseId(relation.useCase),
          targetHandle: useCaseTargetHandleForActor(side),
          type: 'useCaseAssociation',
        };
      }),
    ...model.includes.filter((relation) => visibleUseCaseNames.has(relation.from) && visibleUseCaseNames.has(relation.to)).map((relation) => {
      const id = includeId(relation);
      return {
        data: {
          kind: 'include' as const,
          metadata: { relation },
          ...edgeLabelData(
            id,
            options.display.showRelationLabels ? '<<include>>' : undefined,
            options.display,
            options.edgeLabels,
            options.onEdgeLabelChange,
            options.onEdgeLabelOffsetChange,
          ),
        },
        id,
        label: options.display.showRelationLabels ? '<<include>>' : undefined,
        source: useCaseId(relation.from),
        target: useCaseId(relation.to),
        type: 'useCaseRelation',
      };
    }),
    ...model.extends.filter((relation) => visibleUseCaseNames.has(relation.from) && visibleUseCaseNames.has(relation.to)).map((relation) => {
      const id = extendId(relation);
      return {
        data: {
          kind: 'extend' as const,
          metadata: { relation },
          ...edgeLabelData(
            id,
            options.display.showRelationLabels ? '<<extend>>' : undefined,
            options.display,
            options.edgeLabels,
            options.onEdgeLabelChange,
            options.onEdgeLabelOffsetChange,
          ),
        },
        id,
        label: options.display.showRelationLabels ? '<<extend>>' : undefined,
        source: useCaseId(relation.from),
        target: useCaseId(relation.to),
        type: 'useCaseRelation',
      };
    }),
    ...model.generalizations.flatMap((relation) => {
      const actorPair = model.actors.some((item) => item.name === relation.from) && model.actors.some((item) => item.name === relation.to);
      const useCasePair = visibleUseCaseNames.has(relation.from) && visibleUseCaseNames.has(relation.to);
      if (!actorPair && !useCasePair) return [];

      const source = nodeIdForName(model, relation.from);
      const target = nodeIdForName(model, relation.to);
      const sourceSide = actorSides.get(relation.from);
      const targetSide = actorSides.get(relation.to);
      return {
        data: {
          display: options.display,
          kind: 'generalization' as const,
          metadata: { relation },
        },
        id: generalizationId(relation),
        source,
        sourceHandle: actorPair && sourceSide ? actorSourceHandle(sourceSide) : undefined,
        target,
        targetHandle: actorPair && targetSide ? actorChainTargetHandle(targetSide) : undefined,
        type: 'useCaseGeneralization',
      };
    }),
    ...model.dependencies.filter((relation) => hasVisibleEndpoint(relation.from) && hasVisibleEndpoint(relation.to)).map((relation) => {
      const id = dependencyId(relation);
      const source = nodeIdForName(model, relation.from);
      const target = nodeIdForName(model, relation.to);
      const sourceSide = actorSides.get(relation.from);
      const targetSide = actorSides.get(relation.to);
      return {
        data: {
          kind: 'dependency' as const,
          metadata: { relation },
          ...edgeLabelData(id, undefined, options.display, options.edgeLabels, options.onEdgeLabelChange, options.onEdgeLabelOffsetChange),
        },
        id,
        source,
        sourceHandle: sourceSide ? actorSourceHandle(sourceSide) : undefined,
        target,
        targetHandle: targetSide ? actorTargetHandle(targetSide) : undefined,
        type: 'useCaseRelation',
      };
    }),
    ...model.notes
      .filter((note) => hasVisibleEndpoint(note.target))
      .map((note, index) => ({
        data: {
          display: options.display,
          kind: 'note' as const,
          label: note.kind === 'constraint' ? '{constraint}' : undefined,
        },
        id: `note-edge:${note.kind}:${note.target}:${index}`,
        source: nodeIdForName(model, note.target),
        target: `note:${note.kind}:${note.target}:${index}`,
        type: 'useCaseRelation',
      })),
  ];

  return {
    edges,
    nodes: [boundaryNode, ...actorNodes, ...useCaseNodes, ...noteNodes],
  };
}

export function getUseCaseModelSignature(model: UseCaseModel, display: UseCaseDisplaySettings): string {
  return JSON.stringify({
    actors: model.actors,
    associations: model.associations,
    dependencies: model.dependencies,
    display,
    extends: model.extends,
    generalizations: model.generalizations,
    includes: model.includes,
    notes: model.notes,
    systemName: model.systemName,
    useCases: model.useCases,
  });
}
