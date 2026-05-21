# PixelGraph AI Agent — 设计方案

## 1. 概述

### 目标
在 PixelGraph 现有手动编辑能力基础上，增加 AI Agent 协作模式。用户可以选择自己写 DSL，也可以让 AI 代劳，**两种方式并存、随时切换、共享同一份源码**。

### 核心理念
**DSL 即接口。** PixelGraph 的每种图都基于文本 DSL，AI 只需生成/修改 DSL 文本即可控制整个应用，无需改动底层渲染引擎。**用户和 AI 操作的是同一块编辑器文本**，谁都可以改，改完图表就更新。

---

## 2. 架构变化

```
双通道架构（两种入口，同一份源码，同一套渲染）：

  用户直接编辑 ───────────────────┐
                                  ├──→ 同一份源码 ──→ 解析器 ──→ 渲染引擎 ──→ 图表
  用户描述需求 → AI Agent 执行工具 ──┘
                    ├── writeSource()     写入源码
                    ├── switchDiagram()   切换图类型
                    ├── applyTemplate()   应用模板
                    ├── formatSource()    整理源码
                    ├── setSettings()     调整显示设置
                    └── exportDiagram()   导出 SVG/PNG/MD

  用户和 AI 编辑同源码，编辑器内容始终同步。
  用户随时可以切回手动模式直接改源码，AI 只是辅助。
```

**不改动现有的渲染流程**，只在上游增加 AI Agent 通道。用户手动编辑的路径完整保留，零侵入。

---

## 3. 新增模块

### 3.1 AI 聊天面板 (`src/features/ai/`)

```
src/features/ai/
├── AIPanel.tsx           # 聊天面板 UI 组件
├── AIPanel.css           # 聊天面板样式
├── agent.ts              # Agent 循环逻辑
├── tools.ts              # 工具定义（Agent 可调用的操作）
├── prompts.ts            # 系统提示词 / few-shot 示例
└── types.ts              # 消息、对话状态类型
```

### 3.2 聊天面板 UI

**位置**：编辑器左侧/右侧，三栏布局：
```
┌──────────────┬─────────────────┬──────────────┐
│  AI 聊天面板  │  源码编辑器       │  图表预览      │
│              │                  │              │
│ 用户：帮我设   │  CREATE TABLE... │  [ER 图]     │
│ 计一个电商数   │                  │              │
│ 据库          │                  │              │
│              │                  │              │
│ AI：好的，我   │                  │              │
│ 已生成电商    │                  │              │
│ 数据模型...   │                  │              │
└──────────────┴─────────────────┴──────────────┘
```

**折叠/展开**：聊天面板可折叠，默认展开，不挤占编辑空间。

### 3.3 交互模式

AI Agent 是**辅助层**，不是替代层。用户在任何时候都可以：

| 操作 | 手动编辑 | AI 代劳 |
|---|---|---|
| 写源码 | 直接打字，实时更新 | 说需求，AI 生成源码写入编辑器 |
| 改图表 | 光标定位修改 | 让 AI 增删改查 |
| 切类型 | 点顶部 Tab | 让 AI 切换 |
| 调样式 | 打开设置面板调色 | 让 AI 调整 |
| 选模板 | 点模板按钮 | 让 AI 根据需求推荐 |

**AI 修改源码后，用户仍然可以在编辑器中继续手动调整**。AI 写的是用户看得懂的 DSL，不是黑盒输出。用户对最终效果有完全的控制权。

### 3.4 完整类型定义（types.ts）

```typescript
// src/features/ai/types.ts

export interface AiProviderConfig {
  endpoint: string;   // 如 https://api.openai.com/v1
  apiKey: string;
  model: string;      // 如 deepseek-chat / gpt-4o
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface AgentContext {
  diagramType: DiagramType;
  erInputMode: ErInputMode;
  source: string;
  setSource: (source: string) => void;
  setDiagramType: (type: DiagramType) => void;
  setErInputMode: (mode: ErInputMode) => void;
  onStatusChange: (status: AgentStatus) => void;
  onMessage: (content: string) => void;
}

export type AgentStatus = 'idle' | 'thinking' | 'writing' | 'error';

export interface ToolDefinition {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => string | Promise<string>;
}

export interface LlmResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

// localStorage 读写
const STORAGE_KEY = 'pixelgraph_ai_config';

export function readStoredAiConfig(): AiProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeStoredAiConfig(config: AiProviderConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearStoredAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

---

## 4. 工具定义（Agent Tools）

Agent 通过以下工具控制应用，每个工具都是对已有功能的封装：

| 工具 | 参数 | 作用 |
|---|---|---|
| `writeSource(code)` | `code: string` | **写入源码**，触发预览自动更新 |
| `readSource()` | 无 | **读取当前源码** |
| `switchDiagram(type, mode?)` | `type: DiagramType`, `mode?: ErInputMode` | **切换图类型**（ER/Activity/UseCase/...） |
| `applyTemplate(templateId)` | `templateId: string` | **加载模板** |
| `formatSource()` | 无 | **格式化当前源码** |
| `getDiagramInfo()` | 无 | **获取当前图元信息**（节点数、边数、属性等） |
| `setSetting(key, value)` | `key: string`, `value: unknown` | **调整显示设置**（颜色、字体、间距等） |
| `exportDiagram(format)` | `format: 'svg' | 'png' | 'md'` | **导出图表** |
| `listTemplates(type?)` | `type?: DiagramType` | **列举可用模板** |
| `diagnoseSource()` | 无 | **检查当前源码错误** |

### 完整工具实现（tools.ts）

```typescript
// src/features/ai/tools.ts
import type { DiagramType, ErInputMode } from '../diagrams/types';
import { getTemplatesByType, getTemplateById } from '../templates/templates';
import type { AgentContext, ToolDefinition } from './types';

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
      execute: ({ code }: { code: string }) => {
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
      description: '切换图表类型。支持：er, activity, usecase, component, deployment, package, class, sequence, state, flowchart。如果切换到 ER 图可以指定 erInputMode（sql 或 mermaid）。',
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
      execute: ({ type, erInputMode }: { type: DiagramType; erInputMode?: ErInputMode }) => {
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
      execute: ({ templateId }: { templateId: string }) => {
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
          .split('\n').map((l) => l.replace(/\s+$/u, '')).join('\n').trim();
        context.setSource(formatted);
        return '源码已格式化。';
      },
    },

    getDiagramInfo: {
      description: '获取当前图表的信息，包括类型、引擎、源码长度等。',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        const lines = context.source.split('\n').length;
        return `当前图类型: ${context.diagramType}\n输入模式: ${context.erInputMode}\n源码行数: ${lines}\n源码字符数: ${context.source.length}`;
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
        const templates = getTemplatesByType(type ?? context.diagramType);
        if (templates.length === 0) return '当前类型没有可用模板。';
        return templates.map((t) => `- ${t.id}: ${t.name} — ${t.description}`).join('\n');
      },
    },

    diagnoseSource: {
      description: '检查当前 DSL 源码是否有语法错误或结构问题。',
      parameters: { type: 'object', properties: {} },
      execute: () => {
        const source = context.source;
        if (!source || !source.trim()) return '源码为空。';
        const issues: string[] = [];
        if (source.split('\n').length > 500)
          issues.push('源码行数过多(>500行)，可能影响渲染性能。');
        if (source.split("'").length % 2 === 0)
          issues.push('检测到未闭合的单引号。');
        return issues.length ? issues.join('\n') : '未发现明显问题。';
      },
    },
  };
}
```

---

## 5. Agent 循环逻辑（agent.ts）
### 完整实现

```typescript
// src/features/ai/agent.ts
import type { ChatMessage, ToolDefinition, AgentContext, LlmResponse, AiProviderConfig } from './types';
import { createTools } from './tools';
import { buildSystemPrompt } from './prompts';

const MAX_HISTORY = 20;

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY + 1) return messages;
  return [messages[0], ...messages.slice(-MAX_HISTORY)];
}

function buildToolsForLlm(tools: Record<string, ToolDefinition>) {
  return Object.entries(tools).map(([name, tool]) => ({
    type: 'function' as const,
    function: { name, description: tool.description, parameters: tool.parameters },
  }));
}

function messagesToLlmFormat(messages: ChatMessage[]) {
  const result: Array<Record<string, unknown>> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const entry: Record<string, unknown> = { role: 'assistant', content: msg.content };
      if (msg.toolCalls?.length) {
        entry.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id, type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
        result.push(entry);
        for (const tc of msg.toolCalls) {
          result.push({ role: 'tool', content: tc.result ?? 'ok', tool_call_id: tc.id });
        }
      } else {
        result.push(entry);
      }
    }
  }
  return result;
}

async function callLlm(
  messages: unknown[], tools: unknown[],
  config: AiProviderConfig, signal?: AbortSignal,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model: config.model, messages, stream: false,
  };
  if (tools.length) body.tools = tools;

  const response = await fetch(
    `${config.endpoint.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body), signal,
    },
  );
  if (!response.ok) {
    throw new Error(`LLM API error (${response.status}): ${await response.text().catch(() => 'unknown')}`);
  }
  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> } }>;
  };
  const choice = data.choices[0];
  if (!choice) throw new Error('LLM returned empty response');
  return {
    content: choice.message.content ?? '',
    toolCalls: choice.message.tool_calls
      ?.filter((tc) => tc.type === 'function')
      .map((tc) => ({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
  };
}

export class DiagramAgent {
  private messages: ChatMessage[];
  private tools: Record<string, ToolDefinition>;
  private context: AgentContext;
  private config: AiProviderConfig;
  private msgId = 0;
  private abortController: AbortController | null = null;

  constructor(context: AgentContext, config: AiProviderConfig) {
    this.context = context;
    this.config = config;
    this.tools = createTools(context);

    const toolDescs = Object.entries(this.tools)
      .map(([n, t]) => `- ${n}: ${t.description}\n` +
        Object.entries(t.parameters.properties)
          .map(([k, v]) => `    - ${k}${t.parameters.required?.includes(k) ? ' (必填)' : ''}: ${(v as { description?: string }).description ?? k}`)
          .join('\n'))
      .join('\n\n');

    this.messages = [{
      id: this.nextId(), role: 'system',
      content: buildSystemPrompt({
        diagramType: context.diagramType, erInputMode: context.erInputMode,
        sourceLanguage: context.diagramType === 'er' && context.erInputMode === 'sql' ? 'sql' : 'dsl',
      }, toolDescs),
      timestamp: Date.now(),
    }];
  }

  private nextId() { this.msgId++; return `msg_${this.msgId}_${Date.now()}`; }
  getMessages() { return this.messages.slice(1); }
  cancel() { this.abortController?.abort(); }

  async send(userMessage: string): Promise<void> {
    this.messages.push({ id: this.nextId(), role: 'user', content: userMessage, timestamp: Date.now() });
    this.context.onStatusChange('thinking');
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const llmTools = buildToolsForLlm(this.tools);
      const llmMessages = messagesToLlmFormat(trimHistory(this.messages));
      const response = await callLlm(llmMessages, llmTools, this.config, signal);

      if (response.toolCalls?.length) {
        const toolResults: ChatMessage['toolCalls'] = [];
        for (const call of response.toolCalls) {
          const tool = this.tools[call.name];
          if (!tool) {
            toolResults.push({ id: call.id, name: call.name, args: call.args, result: `未知工具: ${call.name}` });
            continue;
          }
          this.context.onStatusChange('writing');
          try {
            toolResults.push({ id: call.id, name: call.name, args: call.args, result: await tool.execute(call.args) });
          } catch (err) {
            toolResults.push({ id: call.id, name: call.name, args: call.args, result: `错误: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
        this.messages.push({ id: this.nextId(), role: 'assistant', content: response.content, timestamp: Date.now(), toolCalls: toolResults });

        this.context.onStatusChange('thinking');
        const followUp = await callLlm(messagesToLlmFormat(trimHistory(this.messages)), [], this.config, signal);
        const finalContent = followUp.content || '已完成所有操作。';
        this.messages.push({ id: this.nextId(), role: 'assistant', content: finalContent, timestamp: Date.now() });
        this.context.onMessage(finalContent);
      } else {
        this.messages.push({ id: this.nextId(), role: 'assistant', content: response.content, timestamp: Date.now() });
        this.context.onMessage(response.content);
      }
      this.context.onStatusChange('idle');
    } catch (err) {
      if ((err as Error).name === 'AbortError') { this.context.onStatusChange('idle'); return; }
      this.context.onMessage(`连接失败: ${err instanceof Error ? err.message : String(err)}`);
      this.context.onStatusChange('error');
    }
    this.abortController = null;
  }
}
```

### LLM 接入

AI 面板提供配置入口，用户填入自己的 API 信息即可使用当前的大模型。

**配置方式**：AI 面板有个齿轮图标，点开填写 endpoint / apiKey / model。配置存储到 localStorage（key: `pixelgraph_ai_config`）。支持 OpenAI 兼容格式的任意 Provider。

**支持的模型范围**：取决于用户填的 endpoint。推荐使用支持 function calling 的模型。

---

## 6. 提示词工程（prompts.ts）

### 6.1 b>> 完整实现

```typescript
// src/features/ai/prompts.ts
import type { DiagramType, ErInputMode } from '../diagrams/types';

interface PromptContext {
  diagramType: DiagramType;
  erInputMode: ErInputMode;
  sourceLanguage: string;
}

export function buildSystemPrompt(context: PromptContext, toolDescriptions: string): string {
  return `你是一个专业的图表 DSL 生成助手，帮助用户创建和编辑软件工程图表。
你的所有输出必须是完整可用的 DSL 代码，不能使用省略号或占位符。

## 当前上下文
- 当前图类型: ${context.diagramType}
- 当前 DSL 语言: ${context.sourceLanguage}
${context.diagramType === 'er' ? `- ER 图模式: ${context.erInputMode}` : ''}

## 通用规则
1. 始终输出完整的 DSL 代码，不要省略任何部分
2. 如果用户的描述不够清晰，主动问清楚再生成
3. 生成的代码必须符合对应 DSL 的语法规范
4. 生成完毕后告诉用户做了什么，以及如何进一步调整
5. 优先使用已有模板的格式作为参考

## 各图类型 DSL 规范

### ER 图 — SQL 模式
以 CREATE TABLE 语句定义实体和关系：
- CREATE TABLE table_name ( columns ) COMMENT='注释';
- 主键用 PRIMARY KEY 标记在列定义后
- 外键用 FOREIGN KEY (col) REFERENCES parent(col)
- 支持列注释 COMMENT 'xxx'
- 表注释用 COMMENT='xxx'

### ER 图 — Mermaid 模式
erDiagram
  ENTITY ||--o{ OTHER : relation
  ENTITY { type field PK }

### Activity 图
PlantUML 子集，@startuml/@enduml：
start / stop, :Action;, if/then/else/endif,
fork/fork again/end fork, partition { }, note right of

### Use Case 图
自定义 DSL：usecase 名称, actors, usecases,
associations, includes, extends, generalizations

### 结构图（Component/Deployment/Package）
PlantUML 风格：package/node, component/artifact, --> 关系

### 类图 / 时序图 / 状态图 / 流程图
标准 Mermaid 语法

## 可用工具
${toolDescriptions}

## 输出约束
1. 修改图表时使用 writeSource 工具写入完整的 DSL 代码
2. 不要输出"这是代码"之类的引导语，直接输出 DSL 代码给 writeSource
3. 在 text 回复中解释你做了什么，而不是展示代码
4. 如需切换图类型，先调 switchDiagram 再调 writeSource
5. 用户需求不明确时，先问清楚再执行
6. 生成的 DSL 必须完整可用，不要用 // ... 之类的省略`;
}

export const fewShotExamples = [
  {
    role: 'user' as const,
    content: '帮我设计一个电商数据库，有用户、商品、订单',
  },
  {
    role: 'assistant' as const,
    content: `我来为你设计电商数据模型，包含用户、商品和订单三张核心表。

CREATE TABLE users (
  id BIGINT PRIMARY KEY COMMENT '用户ID',
  email VARCHAR(120) NOT NULL COMMENT '邮箱',
  display_name VARCHAR(80) NOT NULL COMMENT '显示名',
  created_at DATETIME NOT NULL COMMENT '注册时间'
) COMMENT='用户';

CREATE TABLE products (
  id BIGINT PRIMARY KEY COMMENT '商品ID',
  name VARCHAR(200) NOT NULL COMMENT '商品名称',
  price DECIMAL(10,2) NOT NULL COMMENT '价格',
  stock INT NOT NULL COMMENT '库存'
) COMMENT='商品';

CREATE TABLE orders (
  id BIGINT PRIMARY KEY COMMENT '订单ID',
  user_id BIGINT NOT NULL COMMENT '下单用户',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  status VARCHAR(32) NOT NULL COMMENT '订单状态',
  created_at DATETIME NOT NULL COMMENT '下单时间',
  FOREIGN KEY (user_id) REFERENCES users(id)
) COMMENT='订单';

已生成 3 张表，包含主键和外键关系。你可以：
1. 让我补充订单明细表
2. 给商品表加分类字段
3. 切换到其他视图查看`,
  },
  {
    role: 'user' as const,
    content: '画一个登录流程的活动图',
  },
  {
    role: 'assistant' as const,
    content: `@startuml
start
:输入账号密码;
if (验证通过?) then (是)
  :生成Token;
  :跳转首页;
else (否)
  :显示错误提示;
  :重试;
endif
stop
@enduml

已生成登录流程活动图，包含验证判断分支。你可以：
1. 加一个"忘记密码"分支
2. 加上泳道区分前端/后端
3. 补充更多的错误处理`,
  },
  {
    role: 'user' as const,
    content: '画一个订单系统的用例图',
  },
  {
    role: 'assistant' as const,
    content: `usecase 订单系统
actors
  顾客
  管理员
  支付平台 [external]
usecases
  浏览商品
  提交订单
  支付订单
  查看订单状态
  取消订单
  管理商品
associations
  顾客 -> 浏览商品
  顾客 -> 提交订单
  顾客 -> 支付订单
  顾客 -> 查看订单状态
  顾客 -> 取消订单
  管理员 -> 管理商品
includes
  提交订单 -> 支付订单
generalizations
  VIP顾客 -> 顾客

已生成订单系统用例图。你可以：
1. 添加更多的角色和用例
2. 补充 extends 关系
3. 添加系统边界`,
  },
];
```

---

## 7. AI 训练与优化方案

AI Agent 的效果取决于提示词质量。以下是一个持续迭代的优化计划。

### 7.1 离线评测集

构建一个评测数据集，每次修改提示词后自动跑一遍，防止回归：

```typescript
// tests/ai-eval/prompts.eval.ts
interface EvalCase {
  name: string;
  userMessage: string;
  diagramType: DiagramType;
  expectedTools?: string[];       // 期望调用的工具
  expectedSourcePatterns?: RegExp[]; // 期望生成的源码包含的关键模式
}

const evalCases: EvalCase[] = [
  {
    name: 'SQL ER 电商设计',
    userMessage: '设计一个博客数据库，有用户、文章、分类',
    diagramType: 'er',
    expectedTools: ['writeSource'],
    expectedSourcePatterns: [
      /CREATE TABLE/i,
      /PRIMARY KEY/i,
      /FOREIGN KEY/i,
    ],
  },
  {
    name: '活动图登录流程',
    userMessage: '画一个登录流程图，有验证判断',
    diagramType: 'activity',
    expectedTools: ['writeSource'],
    expectedSourcePatterns: [
      /@startuml/i,
      /start/i,
      /if.*then/i,
      /endif/i,
      /stop/i,
    ],
  },
  {
    name: 'UseCase 用例图',
    userMessage: '画一个点外卖的用例图',
    diagramType: 'usecase',
    expectedTools: ['writeSource'],
    expectedSourcePatterns: [
      /^usecase/i,
      /actors/i,
      /usecases/i,
    ],
  },
  {
    name: '切换图类型',
    userMessage: '帮我看看当前还有什么模板可以用',
    diagramType: 'er',
    expectedTools: ['listTemplates'],
  },
];
```

### 7.2 评测运行器

```typescript
// tests/ai-eval/runner.ts
// 思路：对每个 EvalCase，用当前 prompt + LLM 跑一遍 Agent，
// 检查工具调用和源码是否符合预期。

async function runEval(llm: LLMClient): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const test of evalCases) {
    const agent = new DiagramAgent({ diagramType: test.diagramType });
    await agent.send(test.userMessage);

    const passed = {
      name: test.name,
      toolsCorrect: test.expectedTools
        ? test.expectedTools.every((t) => agent.lastToolCalls?.some((c) => c.name === t))
        : true,
      sourceMatches: test.expectedSourcePatterns
        ? test.expectedSourcePatterns.every((p) => p.test(agent.lastSource))
        : true,
    };

    results.push(passed);
  }

  return results;
}
```

### 7.3 优化迭代周期

```
收集失败案例 → 分析根因 → 修改提示词 → 跑评测集 → 验证通过 → 部署
```

| 阶段 | 操作 | 频率 |
|---|---|---|
| **数据收集** | 记录 Agent 每次失败的工具调用和用户反馈 | 持续 |
| **根因分析** | 判断是提示词不清 / few-shot 缺失 / 工具定义问题 | 每周 |
| **提示词迭代** | 补充 few-shot、优化规则描述、调整输出约束 | 按需 |
| **回归验证** | 全量评测集 + 新增 case | 每次修改后 |
| **版本发布** | 更新 prompts.ts，打 tag | 稳定后 |

### 7.4 典型优化场景

| 现象 | 根因 | 解法 |
|---|---|---|
| AI 生成不完整的 DSL | 缺少"完整输出"约束 | 强化系统提示词中的完整输出要求 |
| AI 不调 writeSource，只给代码文本 | 工具调用意识弱 | 加 few-shot 示例展示工具调用流程 |
| AI 生成的 SQL 语法不对 | 缺少 SQL 语法指导 | 在规则中补充 CREATE TABLE 语法细节 |
| AI 生成过多无关文案 | 输出约束不够严格 | 增加"直接输出代码，不要引导语"约束 |
| AI 不理解 UseCase 格式 | few-shot 不足 | 补充 UseCase 的完整示例 |
| AI 在错误场景切换图类型 | 上下文理解不够 | 增加"先确认再操作"的规则 |

### 7.5 用户反馈闭环

在 AI 面板中增加隐式反馈收集：

```typescript
// 用户手动修改了 Agent 生成的源码 → 说明生成有偏差
useEffect(() => {
  if (lastAgentSource && source !== lastAgentSource) {
    logEvent('ai_source_overridden', {
      agentSource: lastAgentSource,
      userSource: source,
    });
  }
}, [source]);

// 用户重新生成（清空 AI 回复重试）→ 说明不满意
function logRetry(messageId: string) {
  logEvent('ai_retry', { messageId });
}
```

这些数据可以导出分析，定向优化提示词。不收集用户源码本身，只收集事件类型和频次。

---

## 8. 集成到现有 App.tsx

### 8.1 AIPanel 组件（AIPanel.tsx）

```tsx
// src/features/ai/AIPanel.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagramType, ErInputMode } from '../diagrams/types';
import { DiagramAgent } from './agent';
import type { ChatMessage, AiProviderConfig } from './types';
import { readStoredAiConfig, writeStoredAiConfig } from './types';
import './AIPanel.css';

interface AIPanelProps {
  diagramType: DiagramType;
  erInputMode: ErInputMode;
  source: string;
  setSource: (source: string) => void;
  setDiagramType: (type: DiagramType) => void;
  setErInputMode: (mode: ErInputMode) => void;
}

export function AIPanel({ diagramType, erInputMode, source, setSource, setDiagramType, setErInputMode }: AIPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<AiProviderConfig>(() =>
    readStoredAiConfig() ?? { endpoint: '', apiKey: '', model: '' },
  );
  const agentRef = useRef<DiagramAgent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Agent 上下文：diagramType/erInputMode 变化时重建 Agent
  const context = useCallback(() => ({
    diagramType,
    erInputMode,
    source,
    setSource,
    setDiagramType,
    setErInputMode,
    onStatusChange: (s: string) => setStatus(s),
    onMessage: (content: string) => {
      setMessages((prev) => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant' as const,
        content,
        timestamp: Date.now(),
      }]);
    },
  }), [diagramType, erInputMode, source, setSource, setDiagramType, setErInputMode]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !config.endpoint) return;
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (!agentRef.current) {
      agentRef.current = new DiagramAgent(context() as Parameters<typeof DiagramAgent>[0], config);
    }
    await agentRef.current.send(input);
  }, [input, config, context]);

  const saveConfig = useCallback(() => {
    writeStoredAiConfig(config);
    setConfigOpen(false);
    // 配置变更时重建 Agent
    agentRef.current = null;
  }, [config]);

  const clearChat = useCallback(() => {
    setMessages([]);
    agentRef.current = null;
    setStatus('idle');
  }, []);

  if (!isOpen) {
    return (
      <button className="ai-toggle" onClick={() => setIsOpen(true)} type="button" title="打开 AI 助手">
        AI
      </button>
    );
  }

  return (
    <aside className="ai-panel">
      <div className="ai-header">
        <strong>AI 助手</strong>
        <span className={`ai-status-dot ${status}`} />
        <span className="ai-status-text">{status === 'idle' ? '就绪' : status}</span>
        <button className="ai-config-btn" onClick={() => setConfigOpen((v) => !v)} type="button" title="配置">⚙</button>
        <button className="ai-clear-btn" onClick={clearChat} type="button" title="清空对话">×</button>
        <button className="ai-close-btn" onClick={() => setIsOpen(false)} type="button" title="收起">−</button>
      </div>

      {configOpen ? (
        <div className="ai-config">
          <label>API 地址
            <input value={config.endpoint} onChange={(e) => setConfig((v) => ({ ...v, endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" />
          </label>
          <label>API Key
            <input type="password" value={config.apiKey} onChange={(e) => setConfig((v) => ({ ...v, apiKey: e.target.value }))} placeholder="sk-..." />
          </label>
          <label>模型
            <input value={config.model} onChange={(e) => setConfig((v) => ({ ...v, model: e.target.value }))} placeholder="gpt-4o / deepseek-chat" />
          </label>
          <button className="ai-save-config" onClick={saveConfig} type="button">保存配置</button>
        </div>
      ) : null}

      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            描述你想画的图，AI 帮你生成 DSL 源码。
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`ai-message ${msg.role}`}>
              {msg.content}
              {msg.toolCalls?.length ? (
                <div className="ai-tool-calls">
                  {msg.toolCalls.map((tc) => <code key={tc.id}>{tc.name}: {tc.result}</code>)}
                </div>
              ) : null}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="描述你想要的图表…"
          rows={2}
        />
        <button className="ai-send-btn" onClick={handleSend} type="button" disabled={!config.endpoint}>
          发送
        </button>
      </div>
    </aside>
  );
}
```

### 8.2 样式（AIPanel.css）

```css
/* src/features/ai/AIPanel.css */
.ai-toggle {
  width: 40px; height: 40px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
  align-self: flex-start;
  margin-top: 8px;
}
.ai-panel {
  width: 280px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border-radius: 8px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
  align-self: flex-start;
}
.ai-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 0.82rem;
}
.ai-header strong { flex: 1; }
.ai-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.ai-status-dot.idle { background: #4ade80; }
.ai-status-dot.thinking { background: #facc15; animation: pulse 1s infinite; }
.ai-status-dot.writing { background: #60a5fa; animation: pulse 0.6s infinite; }
.ai-status-dot.error { background: #f87171; }
.ai-status-text { font-size: 0.75rem; color: var(--text-secondary); }
@keyframes pulse { 50% { opacity: 0.4; } }
.ai-config-btn, .ai-clear-btn, .ai-close-btn {
  background: none; border: none; cursor: pointer; font-size: 0.9rem;
  padding: 2px 4px; border-radius: 4px; line-height: 1;
}
.ai-config-btn:hover, .ai-clear-btn:hover, .ai-close-btn:hover { background: var(--surface-soft); }
.ai-config {
  padding: 10px; display: grid; gap: 8px; border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
}
.ai-config label { display: grid; gap: 2px; }
.ai-config input {
  border: 1px solid var(--border); border-radius: 5px; padding: 5px 8px; font-size: 0.8rem;
}
.ai-save-config {
  padding: 5px 12px; border-radius: 6px; border: 1px solid var(--accent);
  background: var(--accent); color: #fff; cursor: pointer; font-size: 0.8rem;
}
.ai-messages {
  overflow-y: auto; padding: 10px; display: grid; gap: 10px;
  max-height: 400px; min-height: 120px;
}
.ai-welcome { font-size: 0.82rem; color: var(--text-secondary); padding: 20px 8px; text-align: center; }
.ai-message { padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; line-height: 1.5; white-space: pre-wrap; }
.ai-message.user { background: var(--surface-soft); border: 1px solid var(--border); }
.ai-message.assistant {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
}
.ai-tool-calls { margin-top: 6px; display: grid; gap: 2px; }
.ai-tool-calls code { font-size: 0.75rem; color: var(--text-secondary); background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; }
.ai-input-row {
  display: grid; grid-template-columns: 1fr auto; gap: 6px;
  padding: 8px; border-top: 1px solid var(--border);
}
.ai-input-row textarea {
  border: 1px solid var(--border); border-radius: 7px; padding: 6px 10px;
  font-size: 0.82rem; resize: none; min-height: 36px;
}
.ai-send-btn {
  padding: 6px 14px; border-radius: 7px; border: 1px solid var(--accent);
  background: var(--accent); color: #fff; cursor: pointer; font-weight: 600; font-size: 0.82rem;
  align-self: end;
}
.ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

### 8.3 集成到 App.tsx

在 App.tsx 顶部导入并在 JSX 的 workspace 中插入：

```typescript
// 顶部导入
import { AIPanel } from '../features/ai/AIPanel';

// JSX 中的 workspace 区域
<main className="workspace">
  <AIPanel                                // ← 新增
    diagramType={diagramType}
    erInputMode={erInputMode}
    source={source}
    setSource={setSource}
    setDiagramType={chooseDiagramType}
    setErInputMode={chooseErInputMode}
  />

  <section className="editor-panel">...</section>
  <section className="preview-panel">...</section>
</main>
```

CSS 布局调整（三栏）：

```css
.workspace {
  display: grid;
  grid-template-columns: auto 1fr 1fr; /* AI面板 | 编辑器 | 预览 */
  gap: 8px;
  padding: 8px;
}
```

---

## 9. 样式设计（AIPanel.css）

聊天面板沿用现有设计系统：

```css
/* AIPanel.css — 遵循 DESIGN.md 规范 */
.ai-panel {
  --panel-width: 280px;
  width: var(--panel-width);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border-radius: 8px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

.ai-messages {
  overflow-y: auto;
  padding: 12px;
  display: grid;
  gap: 12px;
}

.ai-message {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.84rem;
  line-height: 1.55;
}

.ai-message.user {
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.ai-message.assistant {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
}

.ai-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--border);
}

.ai-input-row textarea {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 12px;
  font-size: 0.84rem;
  resize: none;
  min-height: 40px;
}
```

---

## 10. 实施步骤

| 阶段 | 任务 | 预估 |
|---|---|---|
| **Phase 1** | 创建 types.ts、定义 ChatMessage/ToolCall 类型 | 0.5d |
|  | 实现 tools.ts：封装 readSource/writeSource/switchDiagram 等 | 1d |
|  | 实现 agent.ts：Agent 循环逻辑 + LLM 调用 | 1d |
|  | 实现 prompts.ts：系统提示词 + few-shot 示例 | 0.5d |
| **Phase 2** | 实现 AIPanel.tsx：聊天 UI + 消息列表 + 输入框 | 1d |
|  | AIPanel.css：遵循 DESIGN.md 的样式 | 0.5d |
|  | 集成到 App.tsx：三栏布局调整 | 0.5d |
| **Phase 3** | 对话历史持久化（localStorage） | 0.5d |
|  | 流式输出（打字机效果） | 0.5d |
|  | 错误处理 / Token 用量显示 | 0.5d |
| **Phase 4** | 测试：AI Agent 端到端测试 | 1d |
|  | 文档 + 使用引导 | 0.5d |

**总计约 8 人日。**

---

## 11. 不做的事情

- ❌ 不改渲染引擎（sqlErModel / activityModel / structureModel / mermaidRenderer 保持不动）
- ❌ 不替换现有手动编辑模式（用户和 AI 双通道并行）
- ❌ 不改变现有编辑器组件（textArea 保持原样，AI 通过 setSource 写入）
- ❌ 不引入状态管理库（React state + localStorage 够用）
- ❌ 不强依赖特定 LLM Provider（通过抽象层支持切换）
- ❌ 不做云同步 / 协作 / 桌面端

---

## 12. 效果示例

### 场景：数据库设计

```
用户：帮我设计一个博客系统的数据库

Agent 执行：
1. switchDiagram('er', 'sql')     → 切换到 ER 图 SQL 模式
2. writeSource(`CREATE TABLE users ...`)  → 写入建表语句
3. 渲染引擎自动更新               → 用户看到 ER 图

用户：给文章表加一个分类字段

Agent 执行：
1. readSource()                   → 读取当前 SQL
2. 分析并追加 category_id 字段
3. writeSource(新SQL)            → 更新源码，图表自动刷新
```

### 场景：架构图设计

```
用户：画一个微服务部署图

Agent 执行：
1. switchDiagram('deployment')
2. 生成含多个 node/artifact 的 DSL
3. writeSource → 出图

用户：把数据库换成 MySQL

Agent 执行：
1. readSource → 查找 database 节点
2. 更新为 MySQL 标注
3. writeSource → 图表反映变更
```
