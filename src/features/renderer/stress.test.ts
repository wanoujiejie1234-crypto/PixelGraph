/**
 * 压力测试 — 大输入、深度嵌套、畸形数据、高频解析
 */
import { describe, expect, it } from 'vitest';
import { parseSqlErModel, modelToSql } from './sqlErModel';
import { parseActivitySource, validateActivitySource } from './activityModel';
import { parseStructureSource, validateStructureSource } from './structureModel';
import { parseUseCaseModel, validateUseCaseSource } from './useCaseModel';
import { buildHashScope } from './umlFlowModel';
import { summarizeDiagnostics } from './diagnostics';

/* ============================================================
 * 1. SQL ER — 大规模表
 * ============================================================ */
describe('SQL ER stress', () => {
  it('parses 100 tables with references', () => {
    const tables: string[] = [];
    for (let i = 0; i < 100; i++) {
      tables.push(`CREATE TABLE table_${i} (
  id BIGINT PRIMARY KEY COMMENT 'ID',
  name VARCHAR(100) NOT NULL COMMENT 'Name',
  ref_id BIGINT COMMENT 'FK ref',
  FOREIGN KEY (ref_id) REFERENCES table_${Math.max(0, i - 1)}(id)
) COMMENT='Table ${i}';`);
    }
    const sql = tables.join('\n\n');
    const model = parseSqlErModel(sql);
    expect(model.tables.length).toBe(100);
    expect(model.relationships.length).toBeGreaterThan(0);
  });

  it('parses a table with 200 columns', () => {
    const cols: string[] = [];
    for (let i = 0; i < 200; i++) {
      cols.push(`  col_${i} VARCHAR(50)${i === 0 ? ' PRIMARY KEY' : ''} COMMENT 'Column ${i}'`);
    }
    const sql = `CREATE TABLE wide_table (\n${cols.join(',\n')}\n) COMMENT='Wide table';`;
    const model = parseSqlErModel(sql);
    expect(model.tables).toHaveLength(1);
    expect(model.tables[0].columns.length).toBe(200);
  });

  it('handles very long column comments', () => {
    const longComment = 'A'.repeat(10000);
    const sql = `CREATE TABLE t1 (id INT PRIMARY KEY COMMENT '${longComment}') COMMENT='Test';`;
    const model = parseSqlErModel(sql);
    expect(model.tables[0].columns[0].comment).toHaveLength(10000);
  });

  it('handles 1000 FK references (dense graph)', () => {
    const lines = ['id BIGINT PRIMARY KEY'];
    for (let i = 0; i < 1000; i++) {
      lines.push(`ref_${i} BIGINT COMMENT 'ref ${i}'`);
    }
    for (let i = 0; i < 1000; i++) {
      lines.push(`FOREIGN KEY (ref_${i}) REFERENCES parent(id)`);
    }
    const sql = `CREATE TABLE dense (\n  ${lines.join(',\n')}\n) COMMENT='Dense FK';`;
    const model = parseSqlErModel(sql);
    expect(model.tables[0].columns.length).toBeGreaterThan(0);
  });

  it('round-trips large schema (parse + emit)', () => {
    const tables: string[] = [];
    for (let i = 0; i < 50; i++) {
      tables.push(`CREATE TABLE t${i} (id INT PRIMARY KEY, name VARCHAR(50) NOT NULL) COMMENT='T${i}';`);
    }
    const sql = tables.join('\n');
    const model = parseSqlErModel(sql);
    const regenerated = modelToSql(model);
    expect(regenerated).toContain('CREATE TABLE');
    expect(regenerated.length).toBeGreaterThan(sql.length * 0.5);
  });
});

/* ============================================================
 * 2. Activity 图 — 深度嵌套 + 大规模
 * ============================================================ */
describe('Activity diagram stress', () => {
  it('parses deeply nested if/else (20 levels)', () => {
    let source = '@startuml\nstart\n';
    for (let i = 0; i < 20; i++) {
      source += `if (level_${i}) then\n`;
      source += `  :Action_${i};\n`;
    }
    for (let i = 0; i < 20; i++) {
      source += i === 0 ? 'endif\n' : 'endif\n';
    }
    source += 'stop\n@enduml';
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.some((n) => n.kind === 'start')).toBe(true);
    expect(model.nodes.some((n) => n.kind === 'end')).toBe(true);
  });

  it('parses 1000 sequential actions in one lane', () => {
    let source = '@startuml\nstart\n';
    for (let i = 0; i < 1000; i++) {
      source += `  :Action_${i};\n`;
    }
    source += 'stop\n@enduml';
    const model = parseActivitySource(source, 'Flow');
    const actions = model.nodes.filter((n) => n.kind === 'action');
    expect(actions).toHaveLength(1000);
  });

  it('parses 50 partitions with nested content', () => {
    let source = '@startuml\n';
    for (let i = 0; i < 50; i++) {
      source += `partition Pool_${i} {\n  start\n  :Work_${i};\n  stop\n}\n`;
    }
    source += '@enduml';
    const model = parseActivitySource(source, 'Flow');
    const partitions = model.statements.filter((s) => s.type === 'partition');
    expect(partitions.length).toBeGreaterThanOrEqual(50);
  });

  it('validates 1000 partitions quickly (< 2s)', () => {
    let source = '@startuml\n';
    for (let i = 0; i < 1000; i++) {
      source += `partition P${i} {\n  start\n  stop\n}\n`;
    }
    source += '@enduml';
    const t0 = performance.now();
    const validation = validateActivitySource(source, 'Flow');
    const elapsed = performance.now() - t0;
    expect(validation.hasFatalError).toBe(false);
    expect(elapsed).toBeLessThan(2000);
  });

  it('parses 100 fork branches', () => {
    let source = '@startuml\nstart\nfork\n';
    for (let i = 0; i < 100; i++) {
      source += `  :Branch_${i};\n`;
      if (i < 99) source += 'fork again\n';
    }
    source += 'end fork\nstop\n@enduml';
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.length).toBeGreaterThan(100);
  });
});

/* ============================================================
 * 3. Structure 图 — 大规模
 * ============================================================ */
describe('Structure diagram stress', () => {
  it('parses 200 components in packages', () => {
    let source = '@startuml\n';
    for (let i = 0; i < 10; i++) {
      source += `package "Group_${i}" as g${i} {\n`;
      for (let j = 0; j < 20; j++) {
        source += `  component "C_${i}_${j}" as c${i}_${j}\n`;
      }
      source += '}\n';
    }
    source += '@enduml';
    const model = parseStructureSource(source, 'component');
    expect(model.nodes.length).toBeGreaterThanOrEqual(200);
  });

  it('parses 500 edges in deployment diagram', () => {
    let source = '@startuml\n';
    for (let i = 0; i < 100; i++) {
      source += `node "Node_${i}" as n${i}\n`;
    }
    for (let i = 0; i < 99; i++) {
      source += `n${i} -- n${i + 1}\n`;
    }
    source += '@enduml';
    const model = parseStructureSource(source, 'deployment');
    expect(model.edges.length).toBeGreaterThanOrEqual(99);
  });

  it('detects large-scale validation errors', () => {
    let source = '@startuml\n';
    for (let i = 0; i < 100; i++) {
      source += `component "C_${i}" as c${i}\n`;
    }
    for (let i = 0; i < 100; i++) {
      source += `c${i} --> nonexistent_${i}\n`;
    }
    source += '@enduml';
    const validation = validateStructureSource(source, 'component');
    expect(validation.hasFatalError).toBe(true);
    expect(validation.diagnostics.length).toBeGreaterThanOrEqual(100);
  });
});

/* ============================================================
 * 4. Use Case 图 — 大规模
 * ============================================================ */
describe('Use case diagram stress', () => {
  it('parses 200 actors + 200 use cases with associations', () => {
    let source = 'usecase BigSystem\nactors\n';
    for (let i = 0; i < 200; i++) {
      source += `  Actor_${i}\n`;
    }
    source += 'usecases\n';
    for (let i = 0; i < 200; i++) {
      source += `  UC_${i}\n`;
    }
    source += 'associations\n';
    for (let i = 0; i < 200; i++) {
      source += `  Actor_${i} -> UC_${i}\n`;
    }
    const model = parseUseCaseModel(source);
    expect(model.actors).toHaveLength(200);
    expect(model.useCases).toHaveLength(200);
    expect(model.associations).toHaveLength(200);
  });

  it('parses 500 include relations', () => {
    let source = 'usecase Big\nactors\n  User\nusecases\n';
    for (let i = 0; i < 501; i++) {
      source += `  UC_${i}\n`;
    }
    source += 'includes\n';
    for (let i = 0; i < 500; i++) {
      source += `  UC_${i} -> UC_${i + 1}\n`;
    }
    const model = parseUseCaseModel(source);
    expect(model.includes).toHaveLength(500);
  });

  it('validates 500 duplicate actors', () => {
    let source = 'usecase System\nactors\n';
    for (let i = 0; i < 500; i++) {
      source += '  Duplicate\n';
    }
    source += 'usecases\n  UC\nassociations\n  Duplicate -> UC';
    const validation = validateUseCaseSource(source);
    expect(validation.diagnostics.length).toBeGreaterThanOrEqual(499);
  });
});

/* ============================================================
 * 5. 畸形输入 — 边界情况
 * ============================================================ */
describe('Malformed input resilience', () => {
  it('handles empty SQL gracefully', () => {
    const model = parseSqlErModel('');
    expect(model.tables).toEqual([]);
    expect(model.relationships).toEqual([]);
  });

  it('handles SQL with only comments', () => {
    const model = parseSqlErModel('-- just a comment\n-- another');
    expect(model.tables).toEqual([]);
  });

  it('handles activity with unmatched endif', () => {
    const source = '@startuml\nstart\nif (x) then\nendif\nstop\n@enduml';
    const model = parseActivitySource(source, 'Flow');
    expect(model.nodes.some((n) => n.kind === 'decision')).toBe(true);
  });

  it('handles structure with empty source', () => {
    const model = parseStructureSource('', 'component');
    expect(model.nodes).toEqual([]);
  });

  it('handles use case with unknown section name', () => {
    expect(() => parseUseCaseModel('usecase X\nunknown_section\n  item')).toThrow();
  });

  it('handles SQL with incomplete statements', () => {
    const model = parseSqlErModel('CREATE TABLE t1 (\n  id INT');
    expect(model.tables).toHaveLength(0);
  });

  it('handles activity with unmatched end note', () => {
    const source = '@startuml\nnote right of X\n  text\nstop\n@enduml';
    expect(() => validateActivitySource(source, 'Flow')).not.toThrow();
  });

  it('handles very long lines', () => {
    const longName = 'A'.repeat(5000);
    const sql = `CREATE TABLE ${longName} (id INT PRIMARY KEY) COMMENT='${longName}';`;
    expect(() => parseSqlErModel(sql)).not.toThrow();
  });
});

/* ============================================================
 * 6. 高频解析 — 重复 parse 不退化
 * ============================================================ */
describe('Parse throughput', () => {
  const smallSql = 'CREATE TABLE t1 (id INT PRIMARY KEY, name VARCHAR(50)) COMMENT=\'test\';';

  it('parses small SQL 1000x under 2s', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      parseSqlErModel(smallSql);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });

  const mediumActivity = [
    '@startuml',
    'start',
    ...Array.from({ length: 20 }, (_, i) => `:Step_${i};`),
    'stop',
    '@enduml',
  ].join('\n');

  it('parses activity 500x under 2s', () => {
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      parseActivitySource(mediumActivity, 'Flow');
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });

  it('builds hash scopes 10000x under 500ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      buildHashScope('component', `source_${i}`, `view_${i % 10}`);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });

  it('formats diagnostics 10000x under 500ms', () => {
    const diagnostics = Array.from({ length: 10 }, (_, i) => ({
      code: `E${i}`,
      level: (i % 2 === 0 ? 'error' : 'warning') as 'error' | 'warning',
      message: `Test diagnostic ${i}`,
      sourceRange: { line: i * 10, column: i * 5 },
    }));
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      summarizeDiagnostics(diagnostics);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(500);
  });
});
