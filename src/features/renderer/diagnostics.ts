export type DiagramDiagnosticLevel = 'error' | 'warning';

export interface DiagramDiagnostic {
  code: string;
  level: DiagramDiagnosticLevel;
  message: string;
  sourceRange?: {
    column?: number;
    line?: number;
  };
  targetId?: string;
  targetKind?: string;
}

export function summarizeDiagnostics(diagnostics: DiagramDiagnostic[]): string | null {
  if (diagnostics.length === 0) return null;
  return diagnostics
    .map((item) => {
      const prefix = item.level === 'warning' ? 'Warning' : 'Error';
      const location =
        item.sourceRange?.line != null
          ? `L${item.sourceRange.line}${item.sourceRange.column != null ? `:${item.sourceRange.column}` : ''} `
          : '';
      return `${prefix}: ${location}${item.message}`;
    })
    .join('\n');
}
