export type DiagramType =
  | 'er'
  | 'activity'
  | 'usecase'
  | 'component'
  | 'deployment'
  | 'package'
  | 'class'
  | 'sequence'
  | 'state'
  | 'flowchart';

export const diagramTypes: DiagramType[] = ['er', 'activity', 'usecase', 'component', 'deployment', 'package', 'class', 'sequence', 'state', 'flowchart'];
export const mermaidDiagramTypes = ['class', 'sequence', 'state', 'flowchart'] as const;

export type MermaidDiagramType = (typeof mermaidDiagramTypes)[number];

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

export function isMermaidDiagramType(type: DiagramType): type is MermaidDiagramType {
  return (mermaidDiagramTypes as readonly string[]).includes(type);
}
