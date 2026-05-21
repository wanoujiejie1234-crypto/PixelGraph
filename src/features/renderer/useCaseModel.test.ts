import { describe, expect, it } from 'vitest';
import {
  parseUseCaseModel,
  validateUseCaseSource,
  formatUseCaseSource,
  actorId,
  useCaseId,
  systemBoundaryId,
} from './useCaseModel';

describe('useCase IDs', () => {
  it('actorId includes actor prefix', () => {
    expect(actorId('Customer')).toBe('actor:customer');
  });

  it('useCaseId includes usecase prefix', () => {
    expect(useCaseId('Place Order')).toBe('usecase:place order');
  });

  it('systemBoundaryId is system-boundary', () => {
    expect(systemBoundaryId()).toBe('system-boundary');
  });
});

describe('formatUseCaseSource', () => {
  it('normalizes source through model round-trip', () => {
    const source = `usecase System
actors
  Customer
usecases
  Login
associations
  Customer -> Login`;
    const result = formatUseCaseSource(source);
    expect(result).toContain('Customer');
    expect(result).toContain('Login');
  });

  it('handles empty source', () => {
    expect(formatUseCaseSource('')).toBe('');
  });
});

describe('parseUseCaseModel', () => {
  it('parses a simple use case model', () => {
    const source = `usecase Order System
actors
  Customer
usecases
  Place Order
associations
  Customer -> Place Order`;
    const model = parseUseCaseModel(source);
    expect(model.systemName).toBe('Order System');
    expect(model.actors.length).toBeGreaterThan(0);
    expect(model.useCases.length).toBeGreaterThan(0);
    expect(model.associations.length).toBeGreaterThan(0);
  });

  it('parses association navigation direction', () => {
    const source = `usecase Order System
actors
  Customer
usecases
  Place Order
associations
  Customer <-> Place Order`;
    const model = parseUseCaseModel(source);
    expect(model.associations[0]?.direction).toBe('bidirectional');
  });

  it('parses includes and extends', () => {
    const source = `usecase Payment
actors
  User
usecases
  Pay
  Auth
includes
  Pay -> Auth`;
    const model = parseUseCaseModel(source);
    expect(model.includes.length).toBeGreaterThan(0);
  });

  it('handles empty source gracefully', () => {
    expect(() => parseUseCaseModel('')).toThrow('usecase');
  });

  it('fails on invalid first line', () => {
    expect(() => parseUseCaseModel('not valid')).toThrow();
  });
});

describe('validateUseCaseSource', () => {
  it('validates correct use case source', () => {
    const validation = validateUseCaseSource(`usecase System
actors
  User
usecases
  Login
associations
  User -> Login`);
    expect(validation.hasFatalError).toBe(false);
  });

  it('reports empty source', () => {
    const validation = validateUseCaseSource('');
    expect(validation.hasFatalError).toBe(true);
  });

  it('detects duplicate actors', () => {
    const validation = validateUseCaseSource(`usecase System
actors
  User
  User
usecases
  Login
associations
  User -> Login`);
    expect(validation.diagnostics.some((d) => d.message.includes('User'))).toBe(true);
  });
});
