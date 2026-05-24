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

async function callLlmStream(
  messages: unknown[],
  tools: unknown[],
  config: AiProviderConfig,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
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

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const result: LlmResponse = { content: '' };
  const toolCallsByIndex: Record<number, { id?: string; name?: string; args: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta: { content?: string | null; tool_calls?: Array<Record<string, unknown>> };
            finish_reason?: string | null;
          }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          result.content += delta.content;
          onToken(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index as number;
            if (!toolCallsByIndex[idx]) toolCallsByIndex[idx] = { args: '' };
            if (tc.id) toolCallsByIndex[idx].id = tc.id as string;
            if ((tc.function as Record<string, unknown> | undefined)?.name) {
              toolCallsByIndex[idx].name = (tc.function as Record<string, unknown>).name as string;
            }
            if ((tc.function as Record<string, unknown> | undefined)?.arguments) {
              toolCallsByIndex[idx].args += (tc.function as Record<string, unknown>).arguments as string;
            }
          }
        }
      } catch {
        // 跳过无法解析的行
      }
    }
  }

  // 处理缓冲区中可能残留的数据
  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data: ')) {
      const data = trimmed.slice(6);
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const delta = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0]?.delta as Record<string, unknown> | undefined;
          if (delta?.content) {
            result.content += delta.content as string;
            onToken(delta.content as string);
          }
        } catch {
          // 忽略
        }
      }
    }
  }

  const toolCallEntries = Object.values(toolCallsByIndex).filter((tc) => tc.id && tc.name);
  if (toolCallEntries.length > 0) {
    result.toolCalls = toolCallEntries.map((tc) => ({
      id: tc.id!,
      name: tc.name!,
      args: JSON.parse(tc.args || '{}') as Record<string, unknown>,
    }));
  }

  return result;
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

      // 第一次 LLM 调用：流式输出
      const response = await callLlmStream(
        llmMessages,
        llmTools,
        this.config,
        signal,
        (token) => this.context.onStreamingContent?.(token, false),
      );

      if (response.toolCalls?.length) {
        // 如果有流式内容，先结束流
        if (response.content) {
          this.context.onStreamingContent?.('', true);
        }

        const toolResults: ChatMessage['toolCalls'] = [];
        let hasWriteSourceSuccess = false;

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
            const result = await tool.execute(call.args);
            toolResults.push({
              id: call.id,
              name: call.name,
              args: call.args,
              result,
            });
            if (call.name === 'writeSource' && !result.startsWith('语法错误')) {
              hasWriteSourceSuccess = true;
            }
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

        // 跟进总结：流式输出
        this.context.onStatusChange('thinking');
        const followUp = await callLlmStream(
          messagesToLlmFormat(trimHistory(this.messages)),
          [],
          this.config,
          signal,
          (token) => this.context.onStreamingContent?.(token, false),
        );
        const finalContent = followUp.content || '已完成所有操作。';

        // 结束流，替换为永久消息
        this.context.onStreamingContent?.('', true);

        this.messages.push({
          id: this.nextId(),
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now(),
        });

        // 所有操作完成后，如果成功写入了源码，自动导航到图的工作区
        if (hasWriteSourceSuccess) {
          this.context.onAutoNavigate?.();
        }
      } else {
        // 纯文本响应：流结束后直接替换为永久消息
        this.context.onStreamingContent?.('', true);

        this.messages.push({
          id: this.nextId(),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        });
      }

      this.context.onStatusChange('idle');
    } catch (err) {
      // 发生错误时终止流
      this.context.onStreamingContent?.('', true);

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
