import type { DiagramType, ErInputMode } from '../diagrams/types';

export interface AiProviderConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'text';
  /** 文本文件内容（text 类型时有效） */
  textContent?: string;
  /** base64 数据 URI（image 类型时有效） */
  dataUri?: string;
  /** 原始文件大小（字节） */
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  files?: FileAttachment[];
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
  /** agent 内部跟踪的下一个图类型（switchDiagram 刚执行但 React state 未刷新时使用） */
  _pendingDiagramType?: DiagramType;
  _pendingErInputMode?: ErInputMode;
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

const STORAGE_KEY = 'pixelgraph_ai_config';

export function readStoredAiConfig(): AiProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AiProviderConfig) : null;
  } catch {
    return null;
  }
}

export function writeStoredAiConfig(config: AiProviderConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearStoredAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
