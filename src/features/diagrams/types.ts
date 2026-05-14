export type DiagramType = 'er' | 'class' | 'sequence' | 'state' | 'flowchart';

export type RenderStatus = 'idle' | 'rendering' | 'success' | 'error';

export type ErInputMode = 'mermaid' | 'sql';

export interface DiagramDefinition {
  id: DiagramType;
  label: string;
  description: string;
  defaultTemplateId: string;
}

export interface DiagramTemplate {
  id: string;
  type: DiagramType;
  name: string;
  description: string;
  code: string;
  erInputMode?: ErInputMode;
}

export interface RenderResult {
  status: RenderStatus;
  svg: string;
  error: string | null;
}
