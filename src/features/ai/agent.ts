import type { ChatMessage, ToolDefinition, AgentContext, LlmResponse, AiProviderConfig, FileAttachment } from './types';
import type { DiagramType, ErInputMode } from '../diagrams/types';
import { createTools } from './tools';
import { buildSystemPrompt, fewShotExamples } from './prompts';

const MAX_HISTORY = 20;

const FEW_SHOT_COUNT = 16; // fewShotExamples 共 16 条（4 组 × 4 条: user → preview → confirm → writeSource）

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const pinnedCount = 1 + FEW_SHOT_COUNT; // system + few-shot
  if (messages.length <= pinnedCount + MAX_HISTORY) return messages;
  return [
    ...messages.slice(0, pinnedCount), // 保留 system + few-shot
    ...messages.slice(-MAX_HISTORY),   // 保留最近对话
  ];
}

function buildToolsForLlm(tools: Record<string, ToolDefinition>) {
  return Object.entries(tools).map(([name, tool]) => ({
    type: 'function' as const,
    function: {
      name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function buildMultimodalContent(msg: ChatMessage): unknown {
  if (!msg.files?.length) return msg.content;

  const parts: Array<Record<string, unknown>> = [];
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content });
  }

  for (const file of msg.files) {
    if (file.type === 'image' && file.dataUri) {
      parts.push({ type: 'image_url', image_url: { url: file.dataUri } });
    } else if (file.type === 'text' && file.textContent) {
      parts.push({
        type: 'text',
        text: `--- 文件: ${file.name} ---\n${file.textContent}\n--- 文件结束 ---`,
      });
    }
  }

  return parts.length > 0 ? parts : msg.content;
}

function messagesToLlmFormat(messages: ChatMessage[]) {
  const result: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: buildMultimodalContent(msg) });
    } else if (msg.role === 'assistant') {
      const entry: Record<string, unknown> = { role: 'assistant', content: msg.content };
      if (msg.toolCalls?.length) {
        entry.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
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
  messages: unknown[],
  tools: unknown[],
  config: AiProviderConfig,
  signal?: AbortSignal,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: false,
  };
  if (tools.length) body.tools = tools;

  const response = await fetch(`${config.endpoint.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const choice = data.choices[0];
  if (!choice) throw new Error('LLM returned empty response');

  return {
    content: choice.message.content ?? '',
    toolCalls: choice.message.tool_calls
      ?.filter((tc) => tc.type === 'function')
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })),
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
      .map(([name, t]) => {
        const params = Object.entries(t.parameters.properties)
          .map(([k, v]) => {
            const required = t.parameters.required?.includes(k) ? ' (必填)' : '';
            return `    - ${k}${required}: ${(v as { description?: string }).description ?? k}`;
          })
          .join('\n');
        return `- ${name}: ${t.description}\n${params}`;
      })
      .join('\n\n');

    this.messages = [
      {
        id: this.nextId(),
        role: 'system',
        content: buildSystemPrompt(
          {
            diagramType: context.diagramType,
            erInputMode: context.erInputMode,
            sourceLanguage:
              context.diagramType === 'er' && context.erInputMode === 'sql' ? 'sql' : 'dsl',
          },
          toolDescs,
        ),
        timestamp: Date.now(),
      },
      // 注入带工具调用的 few-shot 示例，让模型学会调 writeSource 而非输出代码文本
      ...fewShotExamples,
    ];
  }

  private nextId(): string {
    this.msgId++;
    return `msg_${this.msgId}_${Date.now()}`;
  }

  getMessages(): ChatMessage[] {
    return this.messages.slice(1);
  }

  cancel(): void {
    this.abortController?.abort();
  }

  async send(userMessage: string, files?: FileAttachment[]): Promise<void> {
    this.messages.push({
      id: this.nextId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      files,
    });
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
            toolResults.push({
              id: call.id,
              name: call.name,
              args: call.args,
              result: `未知工具: ${call.name}`,
            });
            continue;
          }
          // 跟踪 switchDiagram 的结果，让后续 writeSource 校验时用正确的类型
          if (call.name === 'switchDiagram') {
            const args = call.args as { type: DiagramType; erInputMode?: ErInputMode };
            (this.context as unknown as Record<string, unknown>)._pendingDiagramType = args.type;
            if (args.erInputMode) {
              (this.context as unknown as Record<string, unknown>)._pendingErInputMode = args.erInputMode;
            }
          }
          this.context.onStatusChange('writing');
          try {
            toolResults.push({
              id: call.id,
              name: call.name,
              args: call.args,
              result: await tool.execute(call.args),
            });
          } catch (err) {
            toolResults.push({
              id: call.id,
              name: call.name,
              args: call.args,
              result: `错误: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }

        this.messages.push({
          id: this.nextId(),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          toolCalls: toolResults,
        });

        this.context.onStatusChange('thinking');
        const followUp = await callLlm(messagesToLlmFormat(trimHistory(this.messages)), [], this.config, signal);
        const finalContent = followUp.content || '已完成所有操作。';
        this.messages.push({
          id: this.nextId(),
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now(),
        });
        this.context.onMessage(finalContent);
      } else {
        this.messages.push({
          id: this.nextId(),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        });
        this.context.onMessage(response.content);
      }

      this.context.onStatusChange('idle');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.context.onStatusChange('idle');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.context.onMessage(`连接失败: ${errorMessage}`);
      this.context.onStatusChange('error');
    }

    this.abortController = null;
  }
}
