import { describe, expect, it } from 'vitest';
import { buildHashScope, getScopedPosition, umlNodeStyle } from './umlFlowModel';

describe('buildHashScope', () => {
  it('produces stable hash for same input', () => {
    const a = buildHashScope('component', 'some source code');
    const b = buildHashScope('component', 'some source code');
    expect(a).toBe(b);
  });

  it('produces different hash for different source', () => {
    const a = buildHashScope('component', 'source one');
    const b = buildHashScope('component', 'source two');
    expect(a).not.toBe(b);
  });

  it('includes diagram type and subview prefix', () => {
    const hash = buildHashScope('deployment', 'data', 'custom');
    expect(hash).toContain('deployment:custom:');
  });

  it('defaults subview to default', () => {
    const hash = buildHashScope('package', 'content');
    expect(hash.startsWith('package:default:')).toBe(true);
  });
});

describe('getScopedPosition', () => {
  it('returns position from lookup', () => {
    const result = getScopedPosition('node1', { node1: { x: 10, y: 20 } }, { x: 0, y: 0 });
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('returns fallback when id not found', () => {
    const result = getScopedPosition('missing', {}, { x: 100, y: 200 });
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('returns fallback when positions is empty', () => {
    const result = getScopedPosition('node1', {}, { x: 0, y: 0 });
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

describe('umlNodeStyle', () => {
  const display = {
    accentColor: '#5E8D76',
    fillColor: '#EEF1EC',
    fontSize: 15,
    layoutDirection: 'LR' as const,
    nodeScale: 1,
    strokeColor: '#18181B',
    textColor: '#18181B',
  };

  it('returns CSS custom properties', () => {
    const style = umlNodeStyle(display);
    expect(style['--er-accent']).toBe('#5E8D76');
    expect(style['--er-font-size']).toBe('15px');
    expect(style['--er-node-scale']).toBe(1);
  });
});
