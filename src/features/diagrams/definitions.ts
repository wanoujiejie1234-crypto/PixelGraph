import type { DiagramDefinition } from './types';

export const diagramDefinitions: DiagramDefinition[] = [
  {
    defaultTemplateId: 'er-sql-commerce',
    description: 'Entity relationship diagram',
    id: 'er',
    label: 'ER',
  },
  {
    defaultTemplateId: 'activity-recharge-flow',
    description: 'Activity diagram',
    id: 'activity',
    label: 'Activity',
  },
  {
    defaultTemplateId: 'usecase-order-system',
    description: 'Use case diagram',
    id: 'usecase',
    label: 'Use Case',
  },
  {
    defaultTemplateId: 'component-pixelgraph-workbench',
    description: 'Component diagram',
    id: 'component',
    label: 'Component',
  },
  {
    defaultTemplateId: 'deployment-pixelgraph-local',
    description: 'Deployment diagram',
    id: 'deployment',
    label: 'Deployment',
  },
  {
    defaultTemplateId: 'package-pixelgraph-layered',
    description: 'Package diagram',
    id: 'package',
    label: 'Package',
  },
  {
    defaultTemplateId: 'class-rendering-workbench',
    description: 'Class diagram',
    id: 'class',
    label: 'Class',
  },
  {
    defaultTemplateId: 'sequence-export-pipeline',
    description: 'Sequence diagram',
    id: 'sequence',
    label: 'Sequence',
  },
  {
    defaultTemplateId: 'state-document-lifecycle',
    description: 'State diagram',
    id: 'state',
    label: 'State',
  },
  {
    defaultTemplateId: 'flowchart-rendering-decision',
    description: 'Flowchart',
    id: 'flowchart',
    label: 'Flow',
  },
];

export function getDiagramDefinition(type: string | null): DiagramDefinition {
  return diagramDefinitions.find((diagram) => diagram.id === type) ?? diagramDefinitions[0];
}
