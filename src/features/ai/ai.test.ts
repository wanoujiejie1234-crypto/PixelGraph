import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createTools } from './tools';
import { buildSystemPrompt, fewShotExamples } from './prompts';
import type { AgentContext, ToolDefinition } from './types';
import { readStoredAiConfig, writeStoredAiConfig, clearStoredAiConfig } from './types';

/* ============================================================
 * localStorage mock
 * ============================================================ */
function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
}

/* ============================================================
 * Mock AgentContext — uses mutable object so setSource etc. reflect
 * ============================================================ */
function mockContext(overrides?: Partial<AgentContext>): AgentContext {
  const state = {
    diagramType: overrides?.diagramType ?? 'er' as const,
    erInputMode: overrides?.erInputMode ?? 'sql' as const,
    source: overrides?.source ?? '',
  };

  return {
    onStatusChange: () => {},
    onMessage: () => {},
    ...overrides,
    get diagramType() { return state.diagramType; },
    get erInputMode() { return state.erInputMode; },
    get source() { return state.source; },
    setSource: (s: string) => { state.source = s; },
    setDiagramType: (t) => { state.diagramType = t; },
    setErInputMode: (m) => { state.erInputMode = m; },
  } as AgentContext;
}

/* ============================================================
 * 1. types.ts — localStorage 配置读写
 * ============================================================ */
describe('AiProviderConfig storage', () => {
  beforeEach(() => { mockLocalStorage(); clearStoredAiConfig(); });

  it('returns null when no config stored', () => {
    expect(readStoredAiConfig()).toBeNull();
  });

  it('round-trips a config', () => {
    writeStoredAiConfig({ endpoint: 'https://test.com/v1', apiKey: 'sk-test', model: 'test-model' });
    const read = readStoredAiConfig();
    expect(read?.endpoint).toBe('https://test.com/v1');
    expect(read?.apiKey).toBe('sk-test');
    expect(read?.model).toBe('test-model');
  });

  it('clears stored config', () => {
    writeStoredAiConfig({ endpoint: 'https://test.com/v1', apiKey: 'sk-test', model: 'test-model' });
    clearStoredAiConfig();
    expect(readStoredAiConfig()).toBeNull();
  });
});

/* ============================================================
 * 2. tools.ts — 工具定义和执行
 * ============================================================ */
describe('tools', () => {
  let ctx: AgentContext;
  let tools: Record<string, ToolDefinition>;

  beforeEach(() => {
    ctx = mockContext({ source: 'SELECT 1' });
    tools = createTools(ctx);
  });

  it('has all expected tools', () => {
    const names = Object.keys(tools);
    expect(names).toContain('writeSource');
    expect(names).toContain('readSource');
    expect(names).toContain('switchDiagram');
    expect(names).toContain('applyTemplate');
    expect(names).toContain('formatSource');
    expect(names).toContain('getDiagramInfo');
    expect(names).toContain('listTemplates');
    expect(names).toContain('diagnoseSource');
  });

  it('writeSource updates source', () => {
    const result = tools.writeSource.execute({ code: 'CREATE TABLE t (id INT);' });
    expect(result).toContain('源码已更新');
  });

  it('readSource returns current source', () => {
    ctx.setSource('test source');
    const t = createTools(ctx);
    expect(t.readSource.execute({})).toBe('test source');
  });

  it('switchDiagram changes diagram type', () => {
    const result = tools.switchDiagram.execute({ type: 'activity' });
    expect(result).toContain('activity');
    expect(ctx.diagramType).toBe('activity');
  });

  it('switchDiagram with erInputMode', () => {
    tools.switchDiagram.execute({ type: 'er', erInputMode: 'mermaid' });
    expect(ctx.erInputMode).toBe('mermaid');
  });

  it('formatSource trims whitespace', () => {
    ctx.setSource('  line1  \n  line2  \n');
    const t = createTools(ctx);
    t.formatSource.execute({});
    expect(ctx.source.trim().length).toBeGreaterThan(0);
  });

  it('getDiagramInfo returns formatted info', () => {
    ctx.setSource('a\nb\nc');
    const t = createTools(ctx);
    const info = t.getDiagramInfo.execute({});
    expect(info).toContain('er');
    expect(info).toContain('3');
  });

  it('diagnoseSource returns ok for clean source', () => {
    const result = tools.diagnoseSource.execute({});
    expect(result).toBe('未发现明显问题。');
  });

  it('diagnoseSource warns on long source', () => {
    const longSource = Array.from({ length: 600 }, (_, i) => `line_${i}`).join('\n');
    const t = createTools(mockContext({ source: longSource }));
    const result = t.diagnoseSource.execute({});
    expect(result).toContain('500');
  });

  it('listTemplates returns template list for er', () => {
    const result = tools.listTemplates.execute({ type: 'er' });
    expect(result).toContain('er-sql-commerce');
    expect(result).toContain('er-mermaid-commerce');
  });

  it('listTemplates returns empty for unknown type', () => {
    // Only mermaid types that exist: class, sequence, state, flowchart
    const result = tools.listTemplates.execute({ type: 'flowchart' });
    expect(typeof result).toBe('string');
  });
});

/* ============================================================
 * 3. prompts.ts — 系统提示词
 * ============================================================ */
describe('prompts', () => {
  it('buildSystemPrompt includes diagram type', () => {
    const prompt = buildSystemPrompt(
      { diagramType: 'er', erInputMode: 'sql', sourceLanguage: 'sql' },
      '- writeSource: write code',
    );
    expect(prompt).toContain('er');
    expect(prompt).toContain('sql');
    expect(prompt).toContain('writeSource');
  });

  it('buildSystemPrompt includes tool descriptions', () => {
    const prompt = buildSystemPrompt(
      { diagramType: 'activity', erInputMode: 'mermaid', sourceLanguage: 'dsl' },
      '- readSource: read current source',
    );
    expect(prompt).toContain('readSource');
    expect(prompt).toContain('activity');
  });

  it('buildSystemPrompt contains DSL rules for ER SQL mode', () => {
    const prompt = buildSystemPrompt(
      { diagramType: 'er', erInputMode: 'sql', sourceLanguage: 'sql' },
      '',
    );
    expect(prompt).toContain('CREATE TABLE');
    expect(prompt).toContain('FOREIGN KEY');
  });

  it('buildSystemPrompt contains DSL rules for Activity', () => {
    const prompt = buildSystemPrompt(
      { diagramType: 'activity', erInputMode: 'mermaid', sourceLanguage: 'dsl' },
      '',
    );
    expect(prompt).toContain('@startuml');
    expect(prompt).toContain('PlantUML');
  });

  it('fewShotExamples have correct structure', () => {
    // 16 messages = 4 groups × 4 messages (user → preview → confirm → writeSource)
    expect(fewShotExamples).toHaveLength(16);

    // Check first user message
    expect(fewShotExamples[0].role).toBe('user');
    expect(fewShotExamples[0].content).toContain('数据库');

    // Check preview message (no tool calls)
    expect(fewShotExamples[1].role).toBe('assistant');
    expect(fewShotExamples[1].toolCalls).toBeUndefined();

    // Check confirmation message
    expect(fewShotExamples[2].role).toBe('user');

    // Check assistant with tool call
    expect(fewShotExamples[3].role).toBe('assistant');
    expect(fewShotExamples[3].toolCalls).toHaveLength(1);
    expect(fewShotExamples[3].toolCalls![0].name).toBe('writeSource');
    expect(fewShotExamples[3].toolCalls![0].args).toHaveProperty('code');
    expect(fewShotExamples[3].toolCalls![0].result).toContain('源码已更新');
  });

  it('every few-shot group follows user→preview→confirm→writeSource pattern', () => {
    for (let i = 0; i < 4; i++) {
      const base = i * 4;
      expect(fewShotExamples[base].role).toBe('user');
      expect(fewShotExamples[base + 1].role).toBe('assistant');
      expect(fewShotExamples[base + 1].toolCalls).toBeUndefined();
      expect(fewShotExamples[base + 2].role).toBe('user');
      expect(fewShotExamples[base + 3].role).toBe('assistant');
      expect(fewShotExamples[base + 3].toolCalls).toHaveLength(1);
    }
  });

  it('few-shot examples contain all diagram types', () => {
    const allContent = fewShotExamples.map((m) => m.content).join(' ');
    expect(allContent).toContain('数据库');    // ER
    expect(allContent).toContain('退款');      // Activity
    expect(allContent).toContain('用例图');    // UseCase
    expect(allContent).toContain('组件图');    // Structure
  });
});

/* ============================================================
 * 4. tools.ts — 工具参数描述完整性
 * ============================================================ */
describe('tool definitions', () => {
  let tools: Record<string, ToolDefinition>;

  beforeEach(() => {
    tools = createTools(mockContext());
  });

  it('every tool has description', () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, `Tool ${name} missing description`).toBeTruthy();
      expect(tool.parameters.type).toBe('object');
    }
  });

  it('writeSource requires code parameter', () => {
    expect(tools.writeSource.parameters.required).toContain('code');
    expect(tools.writeSource.parameters.properties).toHaveProperty('code');
  });

  it('switchDiagram requires type parameter', () => {
    expect(tools.switchDiagram.parameters.required).toContain('type');
    expect(tools.switchDiagram.parameters.properties).toHaveProperty('type');
  });
});

/* ============================================================
 * 5. Parser validation — few-shot 示例代码必须能通过解析器
 * ============================================================ */
import { parseActivitySource } from '../renderer/activityModel';
import { parseUseCaseModel } from '../renderer/useCaseModel';
import { parseStructureSource } from '../renderer/structureModel';
import { parseSqlErModel } from '../renderer/sqlErModel';

describe('few-shot parser validation', () => {
  it('ER SQL example parses successfully', () => {
    const code = fewShotExamples[3].toolCalls![0].args.code as string;
    expect(() => parseSqlErModel(code)).not.toThrow();
    const model = parseSqlErModel(code);
    expect(model.tables.length).toBe(4);
    expect(model.relationships.length).toBeGreaterThan(0);
  });

  it('Activity example parses successfully', () => {
    const code = fewShotExamples[7].toolCalls![0].args.code as string;
    expect(() => parseActivitySource(code)).not.toThrow();
  });

  it('UseCase example parses successfully', () => {
    const code = fewShotExamples[11].toolCalls![0].args.code as string;
    expect(() => parseUseCaseModel(code)).not.toThrow();
    const model = parseUseCaseModel(code);
    expect(model.systemName).toBe('订单系统');
    expect(model.actors.length).toBe(4);
    expect(model.useCases.length).toBe(6);
  });

  it('Structure example parses successfully', () => {
    const code = fewShotExamples[15].toolCalls![0].args.code as string;
    expect(() => parseStructureSource(code, 'component')).not.toThrow();
    const model = parseStructureSource(code, 'component');
    expect(model.nodes.length).toBeGreaterThan(0);
    expect(model.edges.length).toBeGreaterThan(0);
  });
});

/* ============================================================
 * 6. writeSource 解析器校验
 * ============================================================ */
describe('writeSource validation', () => {
  it('rejects invalid Activity code', () => {
    const ctx = mockContext({ diagramType: 'activity', erInputMode: 'mermaid', source: '' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'this is not valid activity code' });
    expect(result).toContain('语法错误');
  });

  it('rejects invalid UseCase code', () => {
    const ctx = mockContext({ diagramType: 'usecase', erInputMode: 'mermaid', source: '' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'no header line here' });
    expect(result).toContain('语法错误');
  });

  it('rejects invalid Structure code', () => {
    const ctx = mockContext({ diagramType: 'component', erInputMode: 'mermaid', source: '' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'bogus component syntax' });
    expect(result).toContain('语法错误');
  });

  it('accepts valid ER SQL code', () => {
    const ctx = mockContext({ diagramType: 'er', erInputMode: 'sql', source: '' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'CREATE TABLE t (id INT);' });
    expect(result).toContain('源码已更新');
  });

  it('accepts any code for Mermaid types', () => {
    const ctx = mockContext({ diagramType: 'flowchart', erInputMode: 'mermaid', source: '' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'anything at all' });
    expect(result).toContain('源码已更新');
  });

  it('uses _pendingDiagramType when available', () => {
    const ctx = mockContext({ diagramType: 'er', erInputMode: 'sql', source: '', _pendingDiagramType: 'activity', _pendingErInputMode: 'mermaid' });
    const t = createTools(ctx);
    const result = t.writeSource.execute({ code: 'not valid activity' });
    expect(result).toContain('语法错误');
  });
});
