import type { DiagramDefinition } from './types';

export type DiagramEngine = 'sql-er' | 'uml-activity' | 'uml-usecase' | 'uml-component' | 'uml-deployment' | 'uml-package' | 'uml-class' | 'uml-sequence' | 'uml-state' | 'mermaid';

export interface DiagramAdapter {
  engine: DiagramEngine;
  exportLanguage: 'mermaid' | 'plantuml' | 'sql' | 'usecase' | 'activity';
  hint: string;
  previewMeta: string;
  previewTitle: string;
  rendererName: string;
  sourceLanguage: 'sql' | 'mermaid' | 'usecase' | 'activity' | 'plantuml';
  sourceTitle: string;
  supportsGraphEditing: boolean;
}

export interface AdapterMessages {
  activityMeta: string;
  activitySource: string;
  activityTitle: string;
  chenMeta: string;
  chenTitle: string;
  componentMeta: string;
  componentSource: string;
  componentTitle: string;
  deploymentMeta: string;
  deploymentSource: string;
  deploymentTitle: string;
  mermaidSource: string;
  packageMeta: string;
  packageSource: string;
  packageTitle: string;
  sqlHint: string;
  sqlSource: string;
  syntaxHint: string;
  useCaseMeta: string;
  useCaseSource: string;
  useCaseTitle: string;
}

export function getDiagramAdapter(definition: DiagramDefinition, isSqlEr: boolean, text: AdapterMessages): DiagramAdapter {
  if (isSqlEr) {
    return {
      engine: 'sql-er',
      exportLanguage: 'sql',
      hint: text.sqlHint,
      previewMeta: text.chenMeta,
      previewTitle: text.chenTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'sql',
      sourceTitle: text.sqlSource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'activity') {
    return {
      engine: 'uml-activity',
      exportLanguage: 'activity',
      hint: text.syntaxHint,
      previewMeta: text.activityMeta,
      previewTitle: text.activityTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'activity',
      sourceTitle: text.activitySource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'usecase') {
    return {
      engine: 'uml-usecase',
      exportLanguage: 'usecase',
      hint: text.syntaxHint,
      previewMeta: text.useCaseMeta,
      previewTitle: text.useCaseTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'usecase',
      sourceTitle: text.useCaseSource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'component') {
    return {
      engine: 'uml-component',
      exportLanguage: 'plantuml',
      hint: text.syntaxHint,
      previewMeta: text.componentMeta,
      previewTitle: text.componentTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'plantuml',
      sourceTitle: text.componentSource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'deployment') {
    return {
      engine: 'uml-deployment',
      exportLanguage: 'plantuml',
      hint: text.syntaxHint,
      previewMeta: text.deploymentMeta,
      previewTitle: text.deploymentTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'plantuml',
      sourceTitle: text.deploymentSource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'package') {
    return {
      engine: 'uml-package',
      exportLanguage: 'plantuml',
      hint: text.syntaxHint,
      previewMeta: text.packageMeta,
      previewTitle: text.packageTitle,
      rendererName: 'Diagram preview',
      sourceLanguage: 'plantuml',
      sourceTitle: text.packageSource,
      supportsGraphEditing: true,
    };
  }

  if (definition.id === 'class' || definition.id === 'sequence' || definition.id === 'state') {
    return {
      engine: definition.id === 'class' ? 'uml-class' : definition.id === 'sequence' ? 'uml-sequence' : 'uml-state',
      exportLanguage: 'mermaid',
      hint: text.syntaxHint,
      previewMeta: definition.description,
      previewTitle: definition.description,
      rendererName: 'Diagram preview',
      sourceLanguage: 'mermaid',
      sourceTitle: text.mermaidSource,
      supportsGraphEditing: true,
    };
  }

  return {
    engine: 'mermaid',
    exportLanguage: 'mermaid',
    hint: text.syntaxHint,
    previewMeta: definition.description,
    previewTitle: definition.description,
    rendererName: 'Diagram preview',
    sourceLanguage: 'mermaid',
    sourceTitle: text.mermaidSource,
    supportsGraphEditing: false,
  };
}
