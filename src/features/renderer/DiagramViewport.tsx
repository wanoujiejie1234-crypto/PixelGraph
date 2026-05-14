import { useEffect, useRef, useState, type ReactNode } from 'react';
import { serializeSvgElement } from '../export/svgElementExport';

interface Point {
  x: number;
  y: number;
}

interface Props {
  children: ReactNode;
  className?: string;
  fitRequest: number;
  labels: {
    fit: string;
    reset: string;
  };
  onExportSvgReady: (svg: string) => void;
  onZoomChange: (zoom: number) => void;
  resetRequest: number;
  zoom: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(3))));
}

function getPoint(event: React.PointerEvent | React.WheelEvent, element: HTMLElement): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function canStartCanvasPan(target: EventTarget): boolean {
  if (!(target instanceof Element)) return true;
  return !target.closest('button, input, textarea, select, [data-node-drag], [data-no-canvas-pan]');
}

export function DiagramViewport({
  children,
  className = '',
  fitRequest,
  labels,
  onExportSvgReady,
  onZoomChange,
  resetRequest,
  zoom,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Point>({ x: 28, y: 28 });
  const [dragStart, setDragStart] = useState<{ pointerId: number; start: Point; origin: Point } | null>(null);

  useEffect(() => {
    const svg = viewportRef.current?.querySelector('svg');
    if (svg instanceof SVGSVGElement) {
      onExportSvgReady(serializeSvgElement(svg));
    }
  }, [children, onExportSvgReady, pan, zoom]);

  useEffect(() => {
    if (resetRequest === 0) return;
    setPan({ x: 28, y: 28 });
    onZoomChange(1);
  }, [onZoomChange, resetRequest]);

  useEffect(() => {
    if (fitRequest === 0) return;
    fitView();
  }, [fitRequest]);

  function fitView(): void {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const svg = content.querySelector('svg');
    const width = svg instanceof SVGSVGElement ? svg.viewBox.baseVal.width || svg.getBoundingClientRect().width : content.scrollWidth;
    const height = svg instanceof SVGSVGElement ? svg.viewBox.baseVal.height || svg.getBoundingClientRect().height : content.scrollHeight;
    if (!width || !height) return;

    const padding = 56;
    const nextZoom = clampZoom(Math.min((viewport.clientWidth - padding) / width, (viewport.clientHeight - padding) / height));
    onZoomChange(nextZoom);
    setPan({
      x: Math.max(18, (viewport.clientWidth - width * nextZoom) / 2),
      y: Math.max(18, (viewport.clientHeight - height * nextZoom) / 2),
    });
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>): void {
    if (!canStartCanvasPan(event.target)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: pan,
    });
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragStart) return;
    setPan({
      x: dragStart.origin.x + event.clientX - dragStart.start.x,
      y: dragStart.origin.y + event.clientY - dragStart.start.y,
    });
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragStart?.pointerId === event.pointerId) {
      setDragStart(null);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const pointer = getPoint(event, viewport);
    const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
    const modelPoint = {
      x: (pointer.x - pan.x) / zoom,
      y: (pointer.y - pan.y) / zoom,
    };

    onZoomChange(nextZoom);
    setPan({
      x: pointer.x - modelPoint.x * nextZoom,
      y: pointer.y - modelPoint.y * nextZoom,
    });
  }

  return (
    <div
      className={`diagram-viewport ${className}`}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onWheel={handleWheel}
      ref={viewportRef}
    >
      <div
        className="diagram-viewport-content"
        ref={contentRef}
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
      >
        {children}
      </div>
      <div className="viewport-hints" data-no-canvas-pan="true">
        <span>{Math.round(zoom * 100)}%</span>
        <span>{labels.fit}</span>
        <span>{labels.reset}</span>
      </div>
    </div>
  );
}
