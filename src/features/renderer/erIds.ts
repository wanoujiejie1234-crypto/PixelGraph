import type { SqlRelationship } from './sqlErModel';

function normalize(value: string): string {
  return value.toLowerCase();
}

export function tableNodeId(tableName: string): string {
  return `table:${normalize(tableName)}`;
}

export function entityNodeId(tableName: string): string {
  return `entity:${normalize(tableName)}`;
}

export function columnNodeId(tableName: string, columnName: string): string {
  return `column:${normalize(tableName)}:${normalize(columnName)}`;
}

export function relationshipNodeId(relationship: Pick<SqlRelationship, 'id'>): string {
  return `relationship:${normalize(relationship.id)}`;
}

export function relationshipTargetId(fromTable: string, toTable: string): string {
  return `relationship:${tableNodeId(fromTable)}->${tableNodeId(toTable)}`;
}

export function databaseEdgeId(fromTable: string, toTable: string): string {
  return `database:${tableNodeId(fromTable)}->${tableNodeId(toTable)}`;
}

export function chenFromEdgeId(relationship: Pick<SqlRelationship, 'id' | 'fromTable'>): string {
  return `relationship-from:${entityNodeId(relationship.fromTable)}->${relationshipNodeId(relationship)}`;
}

export function chenToEdgeId(relationship: Pick<SqlRelationship, 'id' | 'toTable'>): string {
  return `relationship-to:${relationshipNodeId(relationship)}->${entityNodeId(relationship.toTable)}`;
}
