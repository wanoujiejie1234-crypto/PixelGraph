import { describe, expect, it } from 'vitest';
import { parseActivitySource, validateActivitySource, formatActivitySource } from './activityModel';

describe('parseActivitySource', () => {
  it('parses a simple activity with partition and actions', () => {
    const source = `@startuml
partition UI {
  start
  :Click Submit;
  :Show Spinner;
  stop
}
@enduml`;
    const model = parseActivitySource(source, 'Flow');
    const lanes = model.statements.filter((s) => s.type === 'partition');
    expect(lanes).toHaveLength(1);
    expect(model.nodes.some((n) => n.kind === 'action')).toBe(true);
  });

  it('parses start and stop', () => {
    const source = `@startuml
start
:Process;
stop
@enduml`;
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.some((n) => n.kind === 'start')).toBe(true);
    expect(model.nodes.some((n) => n.kind === 'end')).toBe(true);
    expect(model.nodes.some((n) => n.kind === 'action')).toBe(true);
  });

  it('parses if/else', () => {
    const source = `@startuml
start
if (condition) then (yes)
  :Approved;
else (no)
  :Rejected;
endif
stop
@enduml`;
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.some((n) => n.kind === 'decision')).toBe(true);
  });

  it('parses fork/join', () => {
    const source = `@startuml
start
fork
  :Task A;
fork again
  :Task B;
end fork
stop
@enduml`;
    const model = parseActivitySource(source, 'Flow');
    const forks = model.statements.filter((s) => s.type === 'fork');
    expect(forks.length).toBeGreaterThan(0);
  });

  it('parses note', () => {
    const source = `@startuml
start
:Action;
note right of Action
  This is a note
end note
stop
@enduml`;
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.some((n) => n.kind === 'note')).toBe(true);
  });

  it('uses default lane label when no partitions', () => {
    const source = `@startuml
start
stop
@enduml`;
    const model = parseActivitySource(source, 'DefaultLane');
    expect(model.lanes.some((l) => l.label === 'DefaultLane')).toBe(true);
  });
});

describe('validateActivitySource', () => {
  it('validates correct source', () => {
    const validation = validateActivitySource('@startuml\nstart\nstop\n@enduml', 'Flow');
    expect(validation.hasFatalError).toBe(false);
    expect(validation.diagnostics.filter((d) => d.level === 'error')).toHaveLength(0);
  });

  it('validates source without @startuml wrapper', () => {
    const validation = validateActivitySource('start\nstop', 'Flow');
    expect(validation.hasFatalError).toBe(false);
  });

  it('downgrades unknown statements to warnings', () => {
    const validation = validateActivitySource('start\nskinparam monochrome true\nstop', 'Flow');
    expect(validation.hasFatalError).toBe(false);
    expect(validation.diagnostics.some((item) => item.level === 'warning' && item.message.includes('Skipped'))).toBe(true);
  });
});

describe('formatActivitySource', () => {
  it('removes trailing whitespace', () => {
    const result = formatActivitySource('@startuml\n  :Action;  \n@enduml  ', 'Flow');
    expect(result).not.toContain('  ;');
  });
});
