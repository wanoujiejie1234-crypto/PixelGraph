import { describe, expect, it } from 'vitest';
import { buildSequenceMessageNumbers, parseClassMember, parseClassModel, parseSequenceModel, parseStateModel } from './simpleCanvasModel';

describe('parseClassMember', () => {
  it('parses field with visibility, name, and type (colon syntax)', () => {
    const member = parseClassMember('+name: String');
    expect(member).toMatchObject({ visibility: '+', name: 'name', type: 'String', isMethod: false });
  });

  it('parses field with visibility, type, and name (space syntax)', () => {
    const member = parseClassMember('+string source');
    expect(member).toMatchObject({ visibility: '+', name: 'source', type: 'string', isMethod: false });
  });

  it('parses method with parameters and return type', () => {
    const member = parseClassMember('+getName(): String');
    expect(member).toMatchObject({ visibility: '+', name: 'getName', type: 'String', isMethod: true });
    expect(member.parameters).toBeUndefined();
  });

  it('parses method with parameters and no return type', () => {
    const member = parseClassMember('#validate(input: string)');
    expect(member).toMatchObject({ visibility: '#', name: 'validate', parameters: 'input: string', type: '', isMethod: true });
  });

  it('detects abstract method from * suffix', () => {
    const member = parseClassMember('+calculate() : void*');
    expect(member.isAbstract).toBe(true);
    expect(member.type).toBe('void');
  });

  it('detects static field from $ suffix', () => {
    const member = parseClassMember('-instance: Singleton$');
    expect(member.isStatic).toBe(true);
    expect(member.type).toBe('Singleton');
  });

  it('falls back to raw name for unparseable lines', () => {
    const member = parseClassMember('some weird text here');
    expect(member.visibility).toBe('');
    expect(member.name).toBe('some weird text here');
    expect(member.type).toBe('');
    expect(member.isMethod).toBe(false);
  });
});

describe('simple editable Mermaid parsers', () => {
  it('parses class diagram classes, members, and relationships', () => {
    const model = parseClassModel(`classDiagram
  class WorkspaceState {
    +string source
    +switchDiagram(type)
  }
  interface Renderer
  WorkspaceState ..|> Renderer`);

    expect(model.nodes.map((node) => node.label)).toContain('WorkspaceState');
    expect(model.nodes.find((node) => node.label === 'WorkspaceState')?.details).toContain('+string source');
    expect(model.nodes.find((node) => node.label === 'WorkspaceState')?.members).toHaveLength(2);
    expect(model.nodes.find((node) => node.label === 'WorkspaceState')?.members?.[0]).toMatchObject({ visibility: '+', name: 'source', type: 'string', isMethod: false });
    expect(model.nodes.find((node) => node.label === 'WorkspaceState')?.members?.[1]).toMatchObject({ visibility: '+', name: 'switchDiagram', type: '', isMethod: true });
    expect(model.edges[0]?.kind).toBe('realization');
  });

  it('parses class diagram with interface and enum nodes', () => {
    const model = parseClassModel(`classDiagram
  interface Renderer {
    +render() : void
  }
  enum Status {
    ACTIVE
    INACTIVE
  }
  class ConcreteRenderer`);

    expect(model.nodes.find((n) => n.kind === 'interface')).toBeDefined();
    expect(model.nodes.find((n) => n.kind === 'enum')).toBeDefined();
    expect(model.nodes.find((n) => n.kind === 'interface')?.members).toHaveLength(1);
  });

  it('parses inline class member syntax', () => {
    const model = parseClassModel(`classDiagram
  class User
  User : +name: String
  User : +login() : bool`);

    const user = model.nodes.find((n) => n.label === 'User');
    expect(user?.details).toHaveLength(2);
    expect(user?.members).toHaveLength(2);
    expect(user?.members?.[0]).toMatchObject({ visibility: '+', name: 'name', type: 'String', isMethod: false });
    expect(user?.members?.[1]).toMatchObject({ visibility: '+', name: 'login', type: 'bool', isMethod: true });
  });

  it('parses sequence participants and message kinds', () => {
    const model = parseSequenceModel(`sequenceDiagram
  actor User as 用户
  participant Renderer
  User->>Renderer: render
  Renderer--)User: done`);

    expect(model.nodes).toHaveLength(2);
    expect(model.edges.map((edge) => edge.kind)).toEqual(['message', 'reply']);
  });

  it('keeps sequence participant stereotypes and implicit lifelines', () => {
    const model = parseSequenceModel(`sequenceDiagram
  boundary Editor
  control Parser
  entity Store
  Editor->>Parser: parse
  Parser->>Cache: miss
  Parser->>Store: load`);

    expect(model.nodes.find((node) => node.label === 'Editor')?.stereotype).toBe('boundary');
    expect(model.nodes.find((node) => node.label === 'Parser')?.stereotype).toBe('control');
    expect(model.nodes.find((node) => node.label === 'Store')?.stereotype).toBe('entity');
    expect(model.nodes.find((node) => node.label === 'Cache')?.kind).toBe('lifeline');
    expect(model.nodes.find((node) => node.label === 'Cache')?.stereotype).toBeUndefined();
  });

  it('builds hierarchical sequence message numbers from call flow', () => {
    const numbers = buildSequenceMessageNumbers([
      { id: 'e1', kind: 'message', sequenceIndex: 0, source: 'user', target: 'editor' },
      { id: 'e2', kind: 'message', sequenceIndex: 1, source: 'editor', target: 'renderer' },
      { id: 'e3', kind: 'reply', sequenceIndex: 2, source: 'renderer', target: 'preview' },
      { id: 'e4', kind: 'reply', sequenceIndex: 3, source: 'preview', target: 'renderer' },
      { id: 'e5', kind: 'message', sequenceIndex: 4, source: 'renderer', target: 'exporter' },
      { id: 'e6', kind: 'reply', sequenceIndex: 5, source: 'renderer', target: 'editor' },
      { id: 'e7', kind: 'message', sequenceIndex: 6, source: 'user', target: 'exporter' },
    ]);

    expect(numbers).toEqual({
      e1: '1',
      e2: '1.1',
      e3: '1.1.1',
      e4: '1.1.1',
      e5: '1.1.2',
      e6: '1.1',
      e7: '2',
    });
  });

  it('parses state transitions and pseudo states', () => {
    const model = parseStateModel(`stateDiagram-v2
  [*] --> Draft
  Draft --> Published: publish
  Published --> [*]`);

    expect(model.nodes.some((node) => node.kind === 'initial')).toBe(true);
    expect(model.nodes.some((node) => node.kind === 'final')).toBe(true);
    expect(model.edges).toHaveLength(3);
  });

  it('deduplicates multiple [*] to single initial and final nodes', () => {
    const model = parseStateModel(`stateDiagram-v2
  [*] --> Draft
  [*] --> Archived
  Draft --> Published
  Published --> [*]
  Archived --> [*]`);

    const initials = model.nodes.filter((n) => n.kind === 'initial');
    const finals = model.nodes.filter((n) => n.kind === 'final');
    expect(initials).toHaveLength(1);
    expect(finals).toHaveLength(1);
    expect(model.edges).toHaveLength(5);
  });

  it('parses state with quoted label and alias', () => {
    const model = parseStateModel(`stateDiagram-v2
  state "Order Pending" as Pending
  Pending --> Paid: pay`);

    expect(model.nodes.find((n) => n.id === 'state:pending')?.label).toBe('Order Pending');
    expect(model.edges).toHaveLength(1);
  });

  it('parses <<choice>> and <<history>> pseudo-state stereotypes', () => {
    const model = parseStateModel(`stateDiagram-v2
  [*] --> New
  New --> <<choice>>
  <<choice>> --> Approved: valid
  <<choice>> --> Rejected: invalid
  Approved --> [*]
  Rejected --> [*]`);

    expect(model.nodes.filter((n) => n.kind === 'choice')).toHaveLength(1);
    expect(model.edges).toHaveLength(6);
  });

  it('parses state <<choice>> declaration', () => {
    const model = parseStateModel(`stateDiagram-v2
  state <<choice>>
  [*] --> <<choice>>`);

    expect(model.nodes.filter((n) => n.kind === 'choice')).toHaveLength(1);
  });

  it('parses entry/exit/do actions as node details', () => {
    const model = parseStateModel(`stateDiagram-v2
  state Working
  Working: entry / open connection
  Working: exit / close connection
  Working: do / process data`);

    const working = model.nodes.find((n) => n.label === 'Working');
    expect(working?.details).toEqual([
      'entry: open connection',
      'exit: close connection',
      'do: process data',
    ]);
  });

  it('parses composite state with children flattened', () => {
    const model = parseStateModel(`stateDiagram-v2
  state Working {
    [*] --> Idle
    Idle --> Processing
    Processing --> Done
    Done --> [*]
  }`);

    // Parent state exists
    expect(model.nodes.some((n) => n.label === 'Working')).toBe(true);
    // Children should have prefixed IDs
    expect(model.nodes.some((n) => n.id === 'state:working.idle')).toBe(true);
    expect(model.nodes.some((n) => n.id === 'state:working.processing')).toBe(true);
    expect(model.nodes.some((n) => n.id === 'state:working.done')).toBe(true);
    // Internal initial/final
    const initials = model.nodes.filter((n) => n.kind === 'initial');
    const finals = model.nodes.filter((n) => n.kind === 'final');
    expect(initials).toHaveLength(1);
    expect(finals).toHaveLength(1);
    expect(model.edges).toHaveLength(4);
    // Parent-child relationship tracking
    const working = model.nodes.find((n) => n.label === 'Working');
    expect(working?.children).toBeDefined();
    expect(working?.children).toContain('state:working.idle');
    expect(working?.children).toContain('state:working.processing');
    expect(working?.children).toContain('state:working.done');
    const idle = model.nodes.find((n) => n.id === 'state:working.idle');
    expect(idle?.parentId).toBe('state:working');
    // Global initial/final are NOT children of the composite state
    expect(working?.children).not.toContain('state:initial');
  });
});
