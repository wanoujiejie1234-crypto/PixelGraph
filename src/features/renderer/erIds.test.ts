import { describe, expect, it } from 'vitest';
import {
  tableNodeId,
  entityNodeId,
  columnNodeId,
  relationshipNodeId,
  relationshipTargetId,
  databaseEdgeId,
  chenFromEdgeId,
  chenToEdgeId,
} from './erIds';

describe('erIds', () => {
  it('tableNodeId normalizes to lowercase', () => {
    expect(tableNodeId('Orders')).toBe('table:orders');
  });

  it('entityNodeId normalizes to lowercase', () => {
    expect(entityNodeId('User Account')).toBe('entity:user account');
  });

  it('columnNodeId combines table and column', () => {
    expect(columnNodeId('orders', 'total_amount')).toBe('column:orders:total_amount');
  });

  it('relationshipNodeId uses relationship id', () => {
    expect(relationshipNodeId({ id: 'rel-1' })).toBe('relationship:rel-1');
  });

  it('databaseEdgeId combines from and to tables', () => {
    expect(databaseEdgeId('users', 'orders')).toBe('database:table:users->table:orders');
  });

  it('chenFromEdgeId uses relationship fromTable', () => {
    expect(chenFromEdgeId({ id: 'r1', fromTable: 'users' })).toContain('relationship-from');
  });

  it('chenToEdgeId uses relationship toTable', () => {
    expect(chenToEdgeId({ id: 'r1', toTable: 'orders' })).toContain('relationship-to');
  });
});
