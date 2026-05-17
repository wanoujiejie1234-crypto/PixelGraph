import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { serializeSvgElement } from '../export/svgElementExport';

interface MermaidPreviewStyleSettings {
  curve: string;
  lineColor: string;
  nodeBorderColor: string;
  nodeFillColor: string;
  sequenceNumbers: boolean;
  textColor: string;
}

interface Props {
  onExportSvgReady?: (svg: string) => void;
  svg: string;
  source: string;
  styleSettings?: MermaidPreviewStyleSettings;
  onSourceChange: (source: string) => void;
}

function isSequenceDiagram(source: string): boolean {
  return /^sequenceDiagram\b/iu.test(source.trimStart());
}

function isStateDiagram(source: string): boolean {
  return /^stateDiagram(?:-v2)?\b/iu.test(source.trimStart());
}

function hideNativeSequenceNumbers(root: HTMLElement): void {
  root.querySelectorAll<SVGElement>('.sequenceNumber').forEach((element) => {
    element.style.display = 'none';
  });
  root.querySelectorAll<SVGMarkerElement>('marker[id$="-sequencenumber"]').forEach((marker) => {
    marker.remove();
  });
  root.querySelectorAll<SVGLineElement>('line[marker-start*="-sequencenumber"], line[marker-end*="-sequencenumber"]').forEach((line) => {
    line.remove();
  });
}

function applyHierarchicalSequenceNumbers(root: HTMLElement, source: string, enabled: boolean): void {
  if (!isSequenceDiagram(source)) return;
  hideNativeSequenceNumbers(root);
  if (!enabled && !/^\s*autonumber\b/imu.test(source)) return;
  root.querySelectorAll<SVGTextElement>('.messageText').forEach((text) => {
    text.classList.add('pixelgraph-sequence-message-text');
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function replaceFirstEdgeLabel(source: string, previous: string, next: string): string {
  if (previous === next) return source;

  const escaped = escapeRegExp(previous);
  const edgeWithLabel = new RegExp(`(:\\s*)${escaped}(\\s*)$`, 'mu');
  if (edgeWithLabel.test(source)) return source.replace(edgeWithLabel, `$1${next}$2`);

  const stateEdgeLabel = new RegExp(`(-->[^:\\n]*:\\s*)${escaped}(\\s*)$`, 'mu');
  if (stateEdgeLabel.test(source)) return source.replace(stateEdgeLabel, `$1${next}$2`);

  return source.replace(previous, next);
}

function isEditableLabel(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const label = element.textContent?.trim() ?? '';
  if (!label) return false;
  return Boolean(element.closest('.edgeLabel'));
}

function applyStateLineStyle(root: HTMLElement, source: string, curve: string | undefined): void {
  if (!isStateDiagram(source)) return;

  root.querySelectorAll<SVGPathElement>('.edgePath path, path.transition, g.edge path').forEach((path) => {
    path.style.strokeLinejoin = curve === 'step' ? 'miter' : 'round';
    path.style.strokeLinecap = curve === 'linear' ? 'butt' : 'round';
    if (curve === 'step') path.style.strokeDasharray = '0';
  });
}

export function MermaidPreview({ onExportSvgReady, svg, source, styleSettings, onSourceChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(source);
  const previewStyle = useMemo(
    () =>
      ({
        '--mermaid-line': styleSettings?.lineColor,
        '--mermaid-node-border': styleSettings?.nodeBorderColor,
        '--mermaid-node-fill': styleSettings?.nodeFillColor,
        '--mermaid-text': styleSettings?.textColor,
      }) as CSSProperties,
    [styleSettings],
  );

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    applyHierarchicalSequenceNumbers(root, sourceRef.current, Boolean(styleSettings?.sequenceNumbers));
    applyStateLineStyle(root, sourceRef.current, styleSettings?.curve);

    const labels = Array.from(root.querySelectorAll('.edgeLabel p'));
    labels.forEach((label) => {
      if (!isEditableLabel(label)) return;
      label.setAttribute('contenteditable', 'true');
      label.setAttribute('spellcheck', 'false');
      label.setAttribute('data-no-canvas-pan', 'true');
      label.classList.add('mermaid-editable-label');
      label.addEventListener('keydown', handleKeyDown);
      label.addEventListener('blur', handleBlur);
    });

    function handleKeyDown(event: Event): void {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault();
        (keyboardEvent.currentTarget as HTMLElement).blur();
      }
    }

    function handleBlur(event: Event): void {
      const target = event.currentTarget as HTMLElement;
      const previous = target.dataset.previousLabel ?? '';
      const next = target.textContent?.trim() ?? '';
      if (!previous) return;
      sourceRef.current = replaceFirstEdgeLabel(sourceRef.current, previous, next);
      onSourceChange(sourceRef.current);
    }

    labels.forEach((label) => {
      if (label instanceof HTMLElement) label.dataset.previousLabel = label.textContent?.trim() ?? '';
    });

    const frame = window.requestAnimationFrame(() => {
      const exportSvg = root.querySelector('svg');
      if (exportSvg instanceof SVGSVGElement) onExportSvgReady?.(serializeSvgElement(exportSvg));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      labels.forEach((label) => {
        label.removeEventListener('keydown', handleKeyDown);
        label.removeEventListener('blur', handleBlur);
      });
    };
  }, [onExportSvgReady, onSourceChange, source, styleSettings?.curve, styleSettings?.sequenceNumbers, svg]);

  return <div className="svg-preview" dangerouslySetInnerHTML={{ __html: svg }} ref={rootRef} style={previewStyle} />;
}
