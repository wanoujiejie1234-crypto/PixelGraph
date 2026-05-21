import { describe, expect, it } from 'vitest';
import {
  parseStructureSource,
  getStructureEdgeArrow,
  isStructureContainerKind,
  isStructureSourceCompatible,
  formatStructureSource,
  validateStructureSource,
  defaultStructureDisplaySettings,
  darkStructureDisplaySettings,
} from './structureModel';

describe('getStructureEdgeArrow', () => {
  it('returns dashed for dependency', () => {
    expect(getStructureEdgeArrow('dependency')).toBe('dashed');
  });

  it('returns solid for assembly', () => {
    expect(getStructureEdgeArrow('assembly')).toBe('solid');
  });

  it('returns dashed for import', () => {
    expect(getStructureEdgeArrow('import')).toBe('dashed');
  });

  it('returns none for communication', () => {
    expect(getStructureEdgeArrow('communication')).toBe('none');
  });

  it('returns solid for generalization', () => {
    expect(getStructureEdgeArrow('generalization')).toBe('solid');
  });
});

describe('isStructureContainerKind', () => {
  it('returns true for package', () => {
    expect(isStructureContainerKind('package')).toBe(true);
  });

  it('returns true for node', () => {
    expect(isStructureContainerKind('node')).toBe(true);
  });

  it('returns false for component', () => {
    expect(isStructureContainerKind('component')).toBe(false);
  });

  it('returns false for interface', () => {
    expect(isStructureContainerKind('interface')).toBe(false);
  });
});

describe('isStructureSourceCompatible', () => {
  it('detects component source', () => {
    expect(isStructureSourceCompatible('@startuml\ncomponent "App" as app\n@enduml', 'component')).toBe(true);
  });

  it('handles empty source without crashing', () => {
    expect(isStructureSourceCompatible('', 'component')).toBe(true);
  });
});

describe('formatStructureSource', () => {
  it('trims trailing whitespace', () => {
    const result = formatStructureSource('@startuml\ncomponent "X"  \n@enduml  ');
    expect(result).toBe('@startuml\ncomponent "X"\n@enduml');
  });

  it('removes leading empty lines', () => {
    const result = formatStructureSource('\n\n@startuml\ncomponent "X"\n@enduml');
    expect(result).toBe('@startuml\ncomponent "X"\n@enduml');
  });
});

describe('validateStructureSource', () => {
  it('passes valid component source', () => {
    const validation = validateStructureSource('@startuml\ncomponent "App" as app\n@enduml', 'component');
    expect(validation.hasFatalError).toBe(false);
  });

  it('detects unknown target alias', () => {
    const validation = validateStructureSource('@startuml\ncomponent "App" as app\napp --> missing\n@enduml', 'component');
    expect(validation.hasFatalError).toBe(true);
  });

  it('detects unsupported node kind for diagram', () => {
    const validation = validateStructureSource('@startuml\ndatabase "db" as db\n@enduml', 'component');
    expect(validation.hasFatalError).toBe(true);
  });

  it('parses generalization and private import visibility', () => {
    const model = parseStructureSource('@startuml\npackage "A" as a\npackage "B" as b\na --|> b\na ..> b <<import>> [private]\n@enduml', 'package');
    expect(model.edges.some((edge) => edge.kind === 'generalization')).toBe(true);
    expect(model.edges.find((edge) => edge.kind === 'import')?.visibility).toBe('private');
  });
});

describe('defaultStructureDisplaySettings', () => {
  it('returns settings for component', () => {
    const s = defaultStructureDisplaySettings('component');
    expect(s.fontSize).toBeGreaterThan(0);
    expect(s.nodeScale).toBeGreaterThan(0);
  });
});

describe('darkStructureDisplaySettings', () => {
  it('has dark theme colors', () => {
    const s = darkStructureDisplaySettings('component');
    expect(s.textColor).toBeTruthy();
    expect(s.fillColor).toBeTruthy();
  });
});
