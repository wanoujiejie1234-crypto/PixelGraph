import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { useEffect, useState } from 'react';
import type { StructureEdgeKind, StructureGraphEdge, StructureGraphNode } from './structureModel';

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function useDraggableLabel(props: EdgeProps<StructureGraphEdge>) {
  const { data, id, sourceX, sourceY, targetX, targetY } = props;
  const flow = useReactFlow<StructureGraphNode, StructureGraphEdge>();
  const [dragStart, setDragStart] = useState<{ origin: { x: number; y: number }; pointerId: number; start: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = useState(String(data?.label ?? ''));
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const sideOffset = data?.labelOffset ? { x: 0, y: 0 } : { x: (-dy / length) * 12, y: (dx / length) * 12 };

  useEffect(() => {
    setDraft(String(data?.label ?? ''));
  }, [data?.label]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setDragStart({ origin: { x: offset.x + sideOffset.x, y: offset.y + sideOffset.y }, pointerId: event.pointerId, start });
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragStart) return;
    event.stopPropagation();
    const current = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    data?.onLabelOffsetChange?.(
      id,
      {
        x: dragStart.origin.x + current.x - dragStart.start.x,
        y: dragStart.origin.y + current.y - dragStart.start.y,
      },
      draft,
    );
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragStart?.pointerId === event.pointerId) setDragStart(null);
  }

  return { draft, endDrag, moveDrag, sideOffset, startDrag };
}

function getPath(props: EdgeProps<StructureGraphEdge>): readonly [string, number, number] {
  const style = props.data?.display.lineStyle ?? 'orthogonal';
  if (style === 'straight') {
    const [path, labelX, labelY] = getStraightPath(props);
    return [path, labelX, labelY];
  }
  if (style === 'smooth') {
    const [path, labelX, labelY] = getBezierPath(props);
    return [path, labelX, labelY];
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: 16,
    offset: 18,
    sourcePosition: props.sourcePosition,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetPosition: props.targetPosition,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return [path, labelX, labelY];
}

function FixedLabel({
  draft,
  endDrag,
  moveDrag,
  startDrag,
  x,
  y,
}: {
  draft: string;
  endDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  moveDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  startDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  x: number;
  y: number;
}) {
  return (
    <EdgeLabelRenderer>
      <div
        className="er-edge-label structure-edge-label nodrag nopan"
        data-no-canvas-pan="true"
        onDoubleClick={stop}
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        style={{ '--label-length': Math.max(1, draft.length), transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` } as React.CSSProperties}
      >
        <span>{draft}</span>
      </div>
    </EdgeLabelRenderer>
  );
}

function markerId(kind: StructureEdgeKind): string | undefined {
  if (kind === 'communication' || kind === 'note') return undefined;
  if (kind === 'assembly') return 'pg-structure-solid-arrow';
  if (kind === 'realization' || kind === 'generalization') return 'pg-structure-hollow-triangle';
  if (kind === 'import' || kind === 'merge') return 'pg-structure-open-arrow';
  return 'pg-structure-open-arrow';
}

function dashForKind(kind: StructureEdgeKind, visibility?: 'private' | 'public'): string | undefined {
  if (kind === 'import' && visibility === 'private') return '3 3';
  if (kind === 'communication' || kind === 'assembly' || kind === 'note' || kind === 'delegation' || kind === 'generalization') return undefined;
  return '7 6';
}

export function StructureRelationEdge(props: EdgeProps<StructureGraphEdge>) {
  const { data, id, style } = props;
  const [path, labelX, labelY] = getPath(props);
  const { draft, endDrag, moveDrag, sideOffset, startDrag } = useDraggableLabel(props);
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const x = labelX + offset.x + sideOffset.x;
  const y = labelY + offset.y + sideOffset.y;
  const display = data?.display;
  const kind = data?.kind ?? 'dependency';
  const marker = markerId(kind);
  const dash = dashForKind(kind, data?.visibility);

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd={marker ? `url(#${marker})` : undefined}
        path={path}
        style={{
          ...style,
          stroke: display?.lineColor ?? display?.strokeColor,
          strokeDasharray: dash,
          strokeWidth: display?.lineWidth ?? 1.5,
        }}
      />
      {data?.label ? <FixedLabel draft={draft} endDrag={endDrag} moveDrag={moveDrag} startDrag={startDrag} x={x} y={y} /> : null}
    </>
  );
}
