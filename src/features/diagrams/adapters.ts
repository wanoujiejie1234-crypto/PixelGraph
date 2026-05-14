import type { DiagramDefinition } from './types';

export type DiagramEngine = 'sql-er' | 'mermaid';

export interface DiagramAdapter {
  engine: DiagramEngine;
  rendererName: string;
  sourceLanguage: 'sql' | 'mermaid';
  sourceTitle: string;
  previewTitle: string;
  previewMeta: string;
  hint: string;
  supportsGraphEditing: boolean;
}

export interface AdapterMessages {
  chenMeta: string;
  chenTitle: string;
  mermaidSource: string;
  sqlHint: string;
  sqlSource: string;
  syntaxHint: string;
}

export function getDiagramAdapter(definition: DiagramDefinition, isSqlEr: boolean, text: AdapterMessages): DiagramAdapter {
  if (isSqlEr) {
    return {
      engine: 'sql-er',
      rendererName: '图形预览',
      sourceLanguage: 'sql',
      sourceTitle: text.sqlSource,
      previewTitle: text.chenTitle,
      previewMeta: text.chenMeta,
      hint: text.sqlHint,
      supportsGraphEditing: true,
    };
  }

  return {
    engine: 'mermaid',
    rendererName: '图形预览',
    sourceLanguage: 'mermaid',
    sourceTitle: text.mermaidSource,
    previewTitle: definition.description,
    previewMeta: definition.description,
    hint: text.syntaxHint,
    supportsGraphEditing: false,
  };
}
