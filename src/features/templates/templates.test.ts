import { describe, expect, it } from 'vitest';
import { getTemplatesByType, getTemplateById, diagramTemplates } from './templates';

describe('diagramTemplates data integrity', () => {
  it('has all required fields for each template', () => {
    diagramTemplates.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.type).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.code).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  it('has unique template IDs', () => {
    const ids = diagramTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getTemplatesByType', () => {
  it('returns templates for er type', () => {
    const templates = getTemplatesByType('er');
    expect(templates.length).toBeGreaterThanOrEqual(2);
    templates.forEach((t) => expect(t.type).toBe('er'));
  });

  it('returns templates for activity type', () => {
    const templates = getTemplatesByType('activity');
    expect(templates.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for unknown type', () => {
    const result = getTemplatesByType('unknown' as never);
    expect(result).toEqual([]);
  });
});

describe('getTemplateById', () => {
  it('finds the SQL ER template', () => {
    const template = getTemplateById('er-sql-commerce');
    expect(template).toBeDefined();
    expect(template?.name).toBe('订单数据模型');
    expect(template?.erInputMode).toBe('sql');
  });

  it('finds the Mermaid ER template', () => {
    const template = getTemplateById('er-mermaid-commerce');
    expect(template).toBeDefined();
    expect(template?.erInputMode).toBe('mermaid');
  });

  it('returns undefined for missing id', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined();
  });
});
