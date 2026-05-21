import type { DiagramType, ErInputMode } from '../diagrams/types';
import { getTemplatesByType, getTemplateById } from '../templates/templates';
import type { DiagramTemplate } from '../diagrams/types';
import type { AgentContext, ToolDefinition } from './types';
import { validateSqlErSource } from '../renderer/sqlErModel';
import { validateActivitySource } from '../renderer/activityModel';
import { validateUseCaseSource } from '../renderer/useCaseModel';
import { validateStructureSource } from '../renderer/structureModel';
import type { StructureDiagramKind } from '../renderer/structureModel';

/** 根据图类型和模式选择校验函数，返回校验结果文本，null 表示跳过校验 */
function validateCode(code: string, diagramType: DiagramType, erInputMode: ErInputMode): string | null {
  if (diagramType === 'er' && erInputMode === 'sql') {
    const result = validateSqlErSource(code);
    if (result.hasFatalError) {
      return result.diagnostics.map((d) => `${d.level}: ${d.message}`).join('\n');
    }
    return null;
  }

  if (diagramType === 'activity') {
    const result = validateActivitySource(code);
    if (result.hasFatalError) {
      return result.diagnostics.map((d) => `${d.level}: ${d.message}`).join('\n');
    }
    return null;
  }

  if (diagramType === 'usecase') {
    const result = validateUseCaseSource(code);
    if (result.hasFatalError) {
      return result.diagnostics.map((d) => `${d.level}: ${d.message}`).join('\n');
    }
    return null;
  }

  if (diagramType === 'component' || diagramType === 'deployment' || diagramType === 'package') {
    const kind: StructureDiagramKind = diagramType;
    const result = validateStructureSource(code, kind);
    if (result.hasFatalError) {
      return result.diagnostics.map((d) => `${d.level}: ${d.message}`).join('\n');
    }
    return null;
  }

  // Mermaid 类型（class/sequence/state/flowchart）和 ER Mermaid 模式跳过校验
  return null;
}

export function createTools(context: AgentContext): Record<string, ToolDefinition> {
  return {
    writeSource: {
      description: '写入图表 DSL 源码到编辑器，自动触发预览更新。必须提供完整的 DSL 代码，不能省略。',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '完整的图表 DSL 源码' },
        },
        required: ['code'],
      },
      execute: (args: Record<string, unknown>) => {
        const code = String(args.code ?? '');
        // 使用 pending 值（switchDiagram 刚执行但 React state 未刷新时优先）
        const dt = context._pendingDiagramType ?? context.diagramType;
        const em = context._pendingErInputMode ?? context.erInputMode;
        const validationError = validateCode(code, dt, em);
        if (validationError) {
          return `语法错误，请修正后重试：\n${validationError}`;
        }
        context.setSource(code);
        return '源码已更新，图表预览将自动刷新。';
      },
    },

    readSource: {
      description: '读取当前编辑器中的 DSL 源码内容，用于了解当前图表的结构和数据。',
      parameters: { type: 'object', properties: {} },
      execute: () => context.source,
    },

    switchDiagram: {
      description: '切换图表类型。支持：er, activity, usecase, component, deployment, package, class, sequence, state, flowchart。切换到 ER 图时可指定 erInputMode（sql 或 mermaid）。',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['er', 'activity', 'usecase', 'component', 'deployment', 'package', 'class', 'sequence', 'state', 'flowchart'],
            description: '目标图表类型',
          },
          erInputMode: {
            type: 'string',
            enum: ['sql', 'mermaid'],
            description: 'ER 图输入模式（仅 type=er 时有效）',
          },
        },
        required: ['type'],
      },
      execute: (args: Record<string, unknown>) => {
        const type = args.type as DiagramType;
        const erInputMode = args.erInputMode as ErInputMode | undefined;
        context.setDiagramType(type);
        if (erInputMode) context.setErInputMode(erInputMode);
        return `已切换到 ${type} 图。`;
      },
    },

    applyTemplate: {
      description: '加载指定 ID 的模板到编辑器，用模板的 DSL 代码替换当前源码。先用 listTemplates 查看可用模板。',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: '模板 ID' },
        },
        required: ['templateId'],
      },
      execute: (args: Record<string, unknown>) => {
        const templateId = String(args.templateId ?? '');
        const template = getTemplateById(templateId);
        if (!template) return `未找到模板: ${templateId}`;
        context.setSource(template.code);
        return `已加载模板「${template.name}」。`;
      },
    },

    formatSource: {
      description: '格式化当前编辑器中的 DSL 源码，整理缩进和空格。',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        const formatted = context.source
          .split('\n')
          .map((l) => l.replace(/\s+$/u, ''))
          .join('\n')
          .trim();
        context.setSource(formatted);
        return '源码已格式化。';
      },
    },

    getDiagramInfo: {
      description: '获取当前图表的信息，包括类型、引擎、源码长度等。',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        const lines = context.source.split('\n').length;
        return [
          `当前图类型: ${context.diagramType}`,
          `输入模式: ${context.erInputMode}`,
          `源码行数: ${lines}`,
          `源码字符数: ${context.source.length}`,
        ].join('\n');
      },
    },

    listTemplates: {
      description: '列出当前图表类型下所有可用的模板。',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: '图表类型，不传则使用当前图类型' },
        },
      },
      execute: ({ type }: { type?: DiagramType }) => {
        const templates: DiagramTemplate[] = type
          ? getTemplatesByType(type)
          : getTemplatesByType(context.diagramType);
        if (templates.length === 0) return '当前类型没有可用模板。';
        return templates
          .map((t) => `- ${t.id}: ${t.name} — ${t.description}`)
          .join('\n');
      },
    },

    diagnoseSource: {
      description: '检查当前 DSL 源码是否有语法错误或结构问题。',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        const source = context.source;
        if (!source || !source.trim()) return '源码为空。';
        const issues: string[] = [];
        if (source.split('\n').length > 500) {
          issues.push('警告: 源码行数过多(>500行)，可能影响渲染性能。');
        }
        if (source.split("'").length % 2 === 0) {
          issues.push('检测到未闭合的单引号，请检查字符串。');
        }
        return issues.length ? issues.join('\n') : '未发现明显问题。';
      },
    },
  };
}
