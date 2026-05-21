import { describe, expect, it } from 'vitest';
import { summarizeDiagnostics, type DiagramDiagnostic } from './diagnostics';

describe('summarizeDiagnostics', () => {
  it('returns null for empty diagnostics', () => {
    expect(summarizeDiagnostics([])).toBeNull();
  });

  it('formats a single error', () => {
    const diagnostics: DiagramDiagnostic[] = [
      { code: 'E001', level: 'error', message: 'Unknown column type' },
    ];
    expect(summarizeDiagnostics(diagnostics)).toBe('Error: Unknown column type');
  });

  it('formats a warning with line number', () => {
    const diagnostics: DiagramDiagnostic[] = [
      { code: 'W001', level: 'warning', message: 'Nullable PK', sourceRange: { line: 5 } },
    ];
    expect(summarizeDiagnostics(diagnostics)).toBe('Warning: L5 Nullable PK');
  });

  it('formats a warning with line and column', () => {
    const diagnostics: DiagramDiagnostic[] = [
      { code: 'W002', level: 'warning', message: 'Ambiguous type', sourceRange: { line: 3, column: 12 } },
    ];
    expect(summarizeDiagnostics(diagnostics)).toBe('Warning: L3:12 Ambiguous type');
  });

  it('joins multiple diagnostics with newlines', () => {
    const diagnostics: DiagramDiagnostic[] = [
      { code: 'E001', level: 'error', message: 'Syntax error' },
      { code: 'W001', level: 'warning', message: 'Deprecated syntax' },
    ];
    expect(summarizeDiagnostics(diagnostics)).toBe('Error: Syntax error\nWarning: Deprecated syntax');
  });
});
