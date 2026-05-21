import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { useEffect, useState } from 'react';
import type { UseCaseGraphEdge, UseCaseGraphNode } from './useCaseModel';

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function useDraggableLabel(props: EdgeProps<UseCaseGraphEdge>) {
  const { data, id, sourceX, sourceY, targetX, targetY } = props;
  const flow = useReactFlow<UseCaseGraphNode, UseCaseGraphEdge>();
  const [dragStart, setDragStart] = useState<{ origin: { x: number; y: number }; pointerId: number; start: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = useState(String(data?.label ?? ''));
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const sideOffset = data?.labelOffset ? { x: 0, y: 0 } : { x: (-dy / length) * 14, y: (dx / length) * 14 };

  useEffect(() => {
    setDraft(String(data?.label ?? ''));
  }, [data?.label]);

  function commit(value = draft): void {
    data?.onLabelChange?.(id, value.trim());
  }

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

  return { commit, draft, endDrag, moveDrag, setDraft, sideOffset, startDrag };
}

function getUseCasePath(props: EdgeProps<UseCaseGraphEdge>): readonly [string, number, number] {
  const style = props.data?.display.lineStyle ?? 'smooth';
  const path =
    style === 'straight'
      ? getStraightPath(props)
      : style === 'bezier'
        ? getBezierPath(props)
        : getSmoothStepPath({
    borderRadius: 18,
    offset: 18,
    sourcePosition: props.sourcePosition,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetPosition: props.targetPosition,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return [path[0], path[1], path[2]];
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
        className="er-edge-label usecase-edge-label nodrag nopan"
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

export function UseCaseAssociationEdge(props: EdgeProps<UseCaseGraphEdge>) {
  const display = props.data?.display;
  const [path] = getUseCasePath(props);
  const direction = props.data?.direction ?? (display?.associationArrow === 'open' ? 'left-to-right' : 'none');
  const markerEnd = direction === 'left-to-right' || direction === 'bidirectional' ? 'url(#pg-usecase-open-arrow)' : undefined;
  const markerStart = direction === 'right-to-left' || direction === 'bidirectional' ? 'url(#pg-usecase-open-arrow)' : undefined;

  return (
    <BaseEdge
      id={props.id}
      markerEnd={markerEnd}
      markerStart={markerStart}
      path={path}
      style={{
        ...props.style,
        stroke: display?.lineColor ?? display?.strokeColor,
        strokeWidth: display?.lineWidth ?? 1.5,
      }}
    />
  );
}

export function UseCaseRelationEdge(props: EdgeProps<UseCaseGraphEdge>) {
  const { data, id, style } = props;
  const [path, labelX, labelY] = getUseCasePath(props);
  const { draft, endDrag, moveDrag, sideOffset, startDrag } = useDraggableLabel(props);
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const x = labelX + offset.x + sideOffset.x;
  const y = labelY + offset.y + sideOffset.y;
  const display = data?.display;

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd="url(#pg-usecase-open-arrow)"
        path={path}
        style={{
          ...style,
          stroke: display?.lineColor ?? display?.strokeColor,
          strokeDasharray: '7 7',
          strokeWidth: display?.lineWidth ?? 1.5,
        }}
      />
      {data?.label ? <FixedLabel draft={draft} endDrag={endDrag} moveDrag={moveDrag} startDrag={startDrag} x={x} y={y} /> : null}
    </>
  );
}

export function UseCaseGeneralizationEdge(props: EdgeProps<UseCaseGraphEdge>) {
  const display = props.data?.display;
  const [path] = getUseCasePath(props);

  return (
    <BaseEdge
      id={props.id}
      markerEnd="url(#pg-usecase-hollow-triangle)"
      path={path}
      style={{
        ...props.style,
        stroke: display?.lineColor ?? display?.strokeColor,
        strokeDasharray: '0',
        strokeWidth: display?.lineWidth ?? 1.5,
      }}
    />
  );
}
