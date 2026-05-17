import type { DiagramDefinition } from './types';

export const diagramDefinitions: DiagramDefinition[] = [
  {
    id: 'er',
    label: 'ER',
    description: '实体关系图',
    defaultTemplateId: 'er-sql-commerce',
  },
  {
    id: 'class',
    label: 'Class',
    description: '类图',
    defaultTemplateId: 'class-rendering-workbench',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    description: '时序图',
    defaultTemplateId: 'sequence-export-pipeline',
  },
  {
    id: 'state',
    label: 'State',
    description: '状态图',
    defaultTemplateId: 'state-document-lifecycle',
  },
  {
    id: 'flowchart',
    label: 'Flow',
    description: '流程图',
    defaultTemplateId: 'flowchart-rendering-decision',
  },
];

export function getDiagramDefinition(type: string | null): DiagramDefinition {
  return diagramDefinitions.find((diagram) => diagram.id === type) ?? diagramDefinitions[0];
}
