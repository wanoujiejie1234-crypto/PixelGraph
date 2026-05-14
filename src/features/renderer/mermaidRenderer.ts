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
  sequenceNumbers: false,
  textColor: '#18181B',
};

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
      showSequenceNumbers: settings.sequenceNumbers,
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
      nodeBorder: settings.nodeBorderColor,
      noteBkgColor: settings.nodeFillColor,
      noteTextColor: settings.textColor,
      primaryBorderColor: settings.nodeBorderColor,
      primaryColor: settings.nodeFillColor,
      primaryTextColor: settings.textColor,
      secondaryColor: '#FFFFFF',
      tertiaryColor: '#F6F7F4',
      textColor: settings.textColor,
    },
  });
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Mermaid 渲染失败，请检查图表语法。';
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
    await mermaid.parse(source);
    const renderId = `pixelgraph-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(renderId, source);

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
