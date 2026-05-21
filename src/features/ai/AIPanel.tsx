import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagramType, ErInputMode } from '../diagrams/types';
import { DiagramAgent } from './agent';
import type { ChatMessage, FileAttachment } from './types';
import { AI_CONFIG } from './config';
import './AIPanel.css';

interface AIPanelProps {
  diagramType: DiagramType;
  erInputMode: ErInputMode;
  source: string;
  setSource: (source: string) => void;
  setDiagramType: (type: DiagramType) => void;
  setErInputMode: (mode: ErInputMode) => void;
}

export function AIPanel({
  diagramType,
  erInputMode,
  source,
  setSource,
  setDiagramType,
  setErInputMode,
}: AIPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [status, setStatus] = useState<string>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const agentRef = useRef<DiagramAgent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TEXT_EXTS = new Set([
    // 代码 / 配置
    'sql', 'txt', 'dsl', 'puml', 'mmd', 'json', 'yaml', 'yml', 'md', 'csv',
    'xml', 'toml', 'ini', 'cfg', 'conf', 'log', 'py', 'js', 'ts', 'tsx', 'jsx',
    'css', 'html', 'sh', 'bat',
    // 文档类
    'pdf', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  ]);
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);

  // Refs for mutable values so agent's context never goes stale
  const sourceRef = useRef(source);
  const diagramTypeRef = useRef(diagramType);
  const erInputModeRef = useRef(erInputMode);
  sourceRef.current = source;
  diagramTypeRef.current = diagramType;
  erInputModeRef.current = erInputMode;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
      reader.readAsText(file, 'utf-8');
    });
  };

  const readFileAsDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  const getFileExt = (name: string): string => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  };

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: FileAttachment[] = [];
    for (const file of Array.from(fileList)) {
      const ext = getFileExt(file.name);
      const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (IMAGE_EXTS.has(ext)) {
        const dataUri = await readFileAsDataUri(file);
        newFiles.push({ id, name: file.name, type: 'image', dataUri, size: file.size });
      } else if (TEXT_EXTS.has(ext)) {
        const textContent = await readFileAsText(file);
        if (textContent.length > 50000) {
          // 截断超大文件
          newFiles.push({
            id, name: file.name, type: 'text',
            textContent: textContent.slice(0, 50000) + `\n\n\n[文件已截断，原大小: ${file.size} 字节]`,
            size: file.size,
          });
        } else {
          newFiles.push({ id, name: file.name, type: 'text', textContent, size: file.size });
        }
      } else {
        // 未知类型：尝试按文本读取
        try {
          const textContent = await readFileAsText(file);
          newFiles.push({ id, name: file.name, type: 'text', textContent: textContent.slice(0, 50000), size: file.size });
        } catch {
          // 忽略无法读取的文件
        }
      }
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const buildContext = useCallback(
    () => ({
      get diagramType() { return diagramTypeRef.current; },
      get erInputMode() { return erInputModeRef.current; },
      get source() { return sourceRef.current; },
      setSource,
      setDiagramType,
      setErInputMode,
      onStatusChange: (s: string) => setStatus(s),
      onMessage: (content: string) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content,
            timestamp: Date.now(),
          },
        ]);
      },
    }),
    [setSource, setDiagramType, setErInputMode],
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() && files.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      files: files.length > 0 ? [...files] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setFiles([]);

    if (!agentRef.current) {
      agentRef.current = new DiagramAgent(buildContext(), AI_CONFIG);
    }
    await agentRef.current.send(input, userMsg.files);
  }, [input, files, buildContext]);

  const clearChat = useCallback(() => {
    setMessages([]);
    agentRef.current = null;
    setStatus('idle');
    setFiles([]);
  }, []);

  if (!isOpen) {
    return (
      <button className="ai-toggle" onClick={() => setIsOpen(true)} type="button" title="打开 AI 助手">
        AI
      </button>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside className="ai-panel">
      <div className="ai-header">
        <strong>AI 助手</strong>
        <span className={`ai-status-dot ${status}`} />
        <span className="ai-status-text">{status === 'idle' ? '就绪' : status}</span>
        <button className="ai-clear-btn" onClick={clearChat} type="button" title="新对话">
          ＋
        </button>
        <button className="ai-close-btn" onClick={() => setIsOpen(false)} type="button" title="收起">
          −
        </button>
      </div>

      <div className="ai-messages">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            描述你想画的图，AI 帮你生成 DSL 源码。<br />
            支持上传图片或代码文件供 AI 参考。
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`ai-message ${msg.role}`}>
              {msg.files?.length ? (
                <div className="ai-msg-files">
                  {msg.files.map((f) => (
                    <div key={f.id} className="ai-msg-file">
                      {f.type === 'image' && f.dataUri ? (
                        <img src={f.dataUri} alt={f.name} className="ai-msg-img" />
                      ) : (
                        <span className="ai-msg-file-label">{f.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {msg.content ? <div className="ai-msg-text">{msg.content}</div> : null}
              {msg.toolCalls?.length ? (
                <div className="ai-tool-calls">
                  {msg.toolCalls.map((tc) => (
                    <code key={tc.id}>
                      {tc.name}: {tc.result}
                    </code>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {files.length > 0 && (
        <div className="ai-file-chips">
          {files.map((f) => (
            <span key={f.id} className="ai-file-chip" title={f.name}>
              <span className="ai-file-chip-ext">{f.type === 'image' ? '🖼' : '📄'}</span>
              <span className="ai-file-chip-name">{f.name}</span>
              <span className="ai-file-chip-size">{formatFileSize(f.size)}</span>
              <button className="ai-file-chip-remove" onClick={() => removeFile(f.id)} type="button">×</button>
            </span>
          ))}
        </div>
      )}

      <div
        className={`ai-input-row ${isDragOver ? 'ai-drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="ai-input-wrap">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="描述你想要的图表…"
            rows={2}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".sql,.txt,.dsl,.puml,.mmd,.json,.yaml,.yml,.md,.csv,.xml,.toml,.ini,.cfg,.conf,.log,.py,.js,.ts,.tsx,.jsx,.css,.html,.sh,.bat,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.pdf,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp"
            className="ai-file-input"
            onChange={(e) => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ''; } }}
          />
          <button
            className="ai-file-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
            title="上传文件"
          >
            📎
          </button>
        </div>
        <button className="ai-send-btn" onClick={handleSend} type="button">
          发送
        </button>
      </div>
    </aside>
  );
}
