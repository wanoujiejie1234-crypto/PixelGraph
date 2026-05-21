import { describe, expect, it } from 'vitest';
import { isMermaidDiagramType, diagramTypes, type DiagramType } from './types';
import { getDiagramDefinition, diagramDefinitions } from './definitions';

describe('isMermaidDiagramType', () => {
  it('returns true for class', () => {
    expect(isMermaidDiagramType('class')).toBe(true);
  });

  it('returns true for sequence', () => {
    expect(isMermaidDiagramType('sequence')).toBe(true);
  });

  it('returns true for state', () => {
    expect(isMermaidDiagramType('state')).toBe(true);
  });

  it('returns true for flowchart', () => {
    expect(isMermaidDiagramType('flowchart')).toBe(true);
  });

  it('returns false for er', () => {
    expect(isMermaidDiagramType('er')).toBe(false);
  });

  it('returns false for activity', () => {
    expect(isMermaidDiagramType('activity')).toBe(false);
  });

  it('returns false for usecase', () => {
    expect(isMermaidDiagramType('usecase')).toBe(false);
  });
});

describe('getDiagramDefinition', () => {
  it('returns er definition by default for unknown type', () => {
    const def = getDiagramDefinition('unknown-type');
    expect(def.id).toBe('er');
  });

  it('returns null handling default', () => {
    const def = getDiagramDefinition(null);
    expect(def.id).toBe('er');
  });

  it('finds component definition', () => {
    const def = getDiagramDefinition('component');
    expect(def.id).toBe('component');
    expect(def.label).toBe('Component');
  });

  it('finds all diagram types in definitions', () => {
    const ids = diagramDefinitions.map((d) => d.id);
    diagramTypes.forEach((type) => {
      expect(ids).toContain(type);
    });
  });

  it('each definition has a defaultTemplateId', () => {
    diagramDefinitions.forEach((def) => {
      expect(def.defaultTemplateId).toBeTruthy();
    });
  });
});
