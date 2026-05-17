import mermaid from 'mermaid';
import type { RenderResult } from '../diagrams/types';

export type MermaidCurve = 'basis' | 'linear' | 'step';

export interface MermaidStyleSettings {
  actorMargin: number;
  curve: MermaidCurve;
  fontSize: number;
  lineColor: string;
  mirrorActors: boolean;
  nodeBorderColor: string;
  nodeFillColor: string;
  rankSpacing: number;
  sequenceNumbers: boolean;
  textColor: string;
}

export const defaultMermaidStyleSettings: MermaidStyleSettings = {
  actorMargin: 64,
  curve: 'basis',
  fontSize: 15,
  lineColor: '#5E8D76',
  mirrorActors: true,
  nodeBorderColor: '#5E8D76',
  nodeFillColor: '#EEF1EC',
  rankSpacing: 64,
  sequenceNumbers: true,
  textColor: '#18181B',
};

export function getDiagramDirective(source: string): string {
  const firstLine = source.trimStart().split(/\r?\n/u)[0]?.trim() ?? '';
  return firstLine.replace(/\s+.*/u, '');
}

interface SequenceMessage {
  arrow: string;
  from: string;
  to: string;
}

interface SequenceFrame {
  from: string;
  path: number[];
  to: string;
}

const sequenceMessagePattern = /^(\s*)([^:\n]+?)(\s*[-.=]+(?:>>?|x|\))\s*)([^:\n]+?)(\s*:\s*)(.*)$/u;
const sequenceLegendNotePattern = /^\s*Note\s+(?:over|left of|right of)\b[^:\n]*:\s*.*(?:实线|虚线|同步|异步|solid|dashed|sync|async).*(?:\r?\n|$)/gimu;

function normalizeParticipant(value: string): string {
  return value.replace(/^["']|["']$/gu, '').trim();
}

function isSequenceDiagram(source: string): boolean {
  return getDiagramDirective(source) === 'sequenceDiagram';
}

function stripSequencePrefix(value: string): string {
  return value.replace(/^\s*\d+(?:\.\d+)*(?::|\s+)\s*/u, '').trim();
}

function isReturnArrow(arrow: string): boolean {
  return arrow.startsWith('--') || arrow.startsWith('..');
}

function isPushingCallArrow(arrow: string): boolean {
  return !isReturnArrow(arrow) && arrow.includes('>');
}

function computeSequenceLabels(messages: SequenceMessage[]): string[] {
  const childCounters = new Map<string, number>();
  let activeFrames: SequenceFrame[] = [];

  function pathKey(path: number[]): string {
    return path.join('.');
  }

  function nextChild(path: number[]): number {
    const key = pathKey(path);
    const next = (childCounters.get(key) ?? 0) + 1;
    childCounters.set(key, next);
    return next;
  }

  return messages.map((message) => {
    const current = activeFrames.at(-1);
    const isReturnToCaller =
      Boolean(current) &&
      isReturnArrow(message.arrow) &&
      message.from === current?.to &&
      message.to === current.from;

    if (isReturnToCaller && current) {
      activeFrames = activeFrames.slice(0, -1);
      return pathKey(current.path);
    }

    let contextIndex = -1;
    for (let index = activeFrames.length - 1; index >= 0; index -= 1) {
      if (activeFrames[index].to === message.from) {
        contextIndex = index;
        break;
      }
    }

    const contextPath = contextIndex >= 0 ? activeFrames[contextIndex].path : [];
    const labelPath = [...contextPath, nextChild(contextPath)];

    if (isPushingCallArrow(message.arrow)) {
      activeFrames = contextIndex >= 0 ? activeFrames.slice(0, contextIndex + 1) : [];
      activeFrames.push({ from: message.from, path: labelPath, to: message.to });
    }

    return pathKey(labelPath);
  });
}

function prefixSequenceMessages(source: string): string {
  const messages = source
    .split(/\r?\n/u)
    .map((line) => line.match(sequenceMessagePattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      arrow: match[3].trim(),
      from: normalizeParticipant(match[2]),
      to: normalizeParticipant(match[4]),
    }));
  const labels = computeSequenceLabels(messages);
  let messageIndex = 0;

  return source.replace(/^.*$/gmu, (line) => {
    const match = line.match(sequenceMessagePattern);
    if (!match) return line;

    const label = labels[messageIndex];
    messageIndex += 1;
    if (!label) return line;

    return `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}${label}: ${stripSequencePrefix(match[6])}`;
  });
}

function stripNativeSequenceNumbers(source: string): string {
  if (!isSequenceDiagram(source)) return source;
  return source.replace(/^\s*autonumber\b.*(?:\r?\n|$)/gimu, '');
}

function prepareMermaidSource(source: string, settings: MermaidStyleSettings): string {
  if (!isSequenceDiagram(source)) return source;

  const hadNativeAutonumber = /^\s*autonumber\b/imu.test(source);
  const withoutNativeNumbers = stripNativeSequenceNumbers(source);
  const withoutInlineLegend = withoutNativeNumbers.replace(sequenceLegendNotePattern, '');

  return settings.sequenceNumbers || hadNativeAutonumber ? prefixSequenceMessages(withoutInlineLegend) : withoutInlineLegend;
}

function configureMermaid(settings: MermaidStyleSettings): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    flowchart: {
      curve: settings.curve,
      nodeSpacing: settings.rankSpacing,
      rankSpacing: settings.rankSpacing,
    },
    sequence: {
      actorMargin: settings.actorMargin,
      mirrorActors: settings.mirrorActors,
      showSequenceNumbers: false,
    },
    themeVariables: {
      actorBkg: settings.nodeFillColor,
      actorBorder: settings.nodeBorderColor,
      actorTextColor: settings.textColor,
      classText: settings.textColor,
      fontFamily: 'Geist, Satoshi, Outfit, Segoe UI, Arial, sans-serif',
      fontSize: `${settings.fontSize}px`,
      lineColor: settings.lineColor,
      mainBkg: settings.nodeFillColor,
      noteBkgColor: '#E7EEE8',
      noteBorderColor: settings.nodeBorderColor,
      noteTextColor: settings.textColor,
      nodeBorder: settings.nodeBorderColor,
      primaryBorderColor: settings.nodeBorderColor,
      primaryColor: settings.nodeFillColor,
      primaryTextColor: settings.textColor,
      secondaryColor: '#DDE8E0',
      tertiaryColor: '#F4F7F2',
      textColor: settings.textColor,
    },
  });
}

function normalizeError(error: unknown): string {
  const prefix = 'Mermaid 渲染失败，请检查图表类型、箭头、括号、缩进或节点命名。';
  if (error instanceof Error) {
    return `${prefix}\n${error.message}`;
  }

  if (typeof error === 'string') {
    return `${prefix}\n${error}`;
  }

  return prefix;
}

export async function renderMermaid(source: string, settings: MermaidStyleSettings = defaultMermaidStyleSettings): Promise<RenderResult> {
  configureMermaid(settings);

  if (!source.trim()) {
    return {
      status: 'error',
      svg: '',
      error: '请输入 Mermaid 源码后再预览。',
    };
  }

  try {
    const renderSource = prepareMermaidSource(source, settings);
    await mermaid.parse(renderSource);
    const renderId = `pixelgraph-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(renderId, renderSource);

    return {
      status: 'success',
      svg,
      error: null,
    };
  } catch (error) {
    return {
      status: 'error',
      svg: '',
      error: normalizeError(error),
    };
  }
}
