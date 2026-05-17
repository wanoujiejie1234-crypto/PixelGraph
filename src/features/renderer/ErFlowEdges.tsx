import { useEffect, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import type { ErGraphEdge, ErGraphNode } from './erGraphModel';

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

export function EditableErEdge(props: EdgeProps<ErGraphEdge>) {
  const { id, data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style } = props;
  const flow = useReactFlow<ErGraphNode, ErGraphEdge>();
  const [dragStart, setDragStart] = useState<{ origin: { x: number; y: number }; pointerId: number; start: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = useState(String(data?.label ?? ''));
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const [path, labelX, labelY] = getSmoothStepPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const hasCustomOffset = Boolean(data?.labelOffset);
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const sideOffset = hasCustomOffset ? { x: 0, y: 0 } : { x: (-dy / length) * 16, y: (dx / length) * 16 };
  const x = labelX + offset.x + sideOffset.x;
  const y = labelY + offset.y + sideOffset.y;

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
    data?.onLabelOffsetChange?.(id, {
      x: dragStart.origin.x + current.x - dragStart.start.x,
      y: dragStart.origin.y + current.y - dragStart.start.y,
    }, draft);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragStart?.pointerId === event.pointerId) setDragStart(null);
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {data?.label !== undefined ? (
        <EdgeLabelRenderer>
          <div
            className="er-edge-label nodrag nopan"
            data-no-canvas-pan="true"
            onDoubleClick={stop}
            onPointerCancel={endDrag}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            style={{ '--label-length': Math.max(1, draft.length), transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` } as React.CSSProperties}
          >
            <input
              aria-label="ER edge label"
              onBlur={() => commit()}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              onPointerDown={stop}
              spellCheck={false}
              value={draft}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
