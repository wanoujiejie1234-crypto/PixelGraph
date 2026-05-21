import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { SEQUENCE_MESSAGE_START_Y, SEQUENCE_MESSAGE_STEP, type SimpleEdgeKind, type SimpleGraphEdge, type SimpleGraphNode } from './simpleCanvasModel';

function markerForKind(kind: SimpleEdgeKind): string | undefined {
  if (kind === 'generalization' || kind === 'realization') return 'pg-hollow-triangle';
  if (kind === 'aggregation') return 'pg-hollow-diamond';
  if (kind === 'composition') return 'pg-solid-diamond';
  if (kind === 'message') return 'pg-structure-solid-arrow';
  if (kind === 'asyncMessage' || kind === 'reply') return 'pg-open-arrow';
  return kind === 'association' ? undefined : 'pg-open-arrow';
}

function dashForKind(kind: SimpleEdgeKind): string | undefined {
  if (kind === 'dependency' || kind === 'realization' || kind === 'reply') return '7 6';
  return undefined;
}

/**
 * Edge styles for each UML relationship type — matching Astah-style visual distinction.
 * - generalization:  solid line + hollow triangle at parent end
 * - realization:     dashed line + hollow triangle at interface end
 * - dependency:      dashed line + open arrow at dependent end
 * - association:     solid line (no marker for plain; open arrow for directed --&gt;)
 * - aggregation:     solid line + hollow diamond at owner end
 * - composition:     solid line + solid diamond   at owner end
 */
function edgeStyle(kind: SimpleEdgeKind, lineWidth: number): { dash?: string } {
  return { dash: dashForKind(kind) };
}

function getPath(props: EdgeProps<SimpleGraphEdge>): readonly [string, number, number] {
  const { data } = props;
  const isSequenceMessage = data?.sequenceIndex !== undefined;

  if (isSequenceMessage) {
    const messageY = SEQUENCE_MESSAGE_START_Y + (data.sequenceIndex ?? 0) * SEQUENCE_MESSAGE_STEP;
    if (Math.abs(props.sourceX - props.targetX) < 1) {
      const w = 36;
      const h = 28;
      const loopPath = `M ${props.sourceX} ${messageY} L ${props.sourceX + w} ${messageY} L ${props.sourceX + w} ${messageY + h} L ${props.sourceX} ${messageY + h}`;
      return [loopPath, props.sourceX + w + 16, messageY + h / 2];
    }
    const [path, labelX] = getStraightPath({
      sourceX: props.sourceX,
      sourceY: messageY,
      targetX: props.targetX,
      targetY: messageY,
    });
    return [path, labelX, messageY - 12];
  }

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

export function SimpleEdge(props: EdgeProps<SimpleGraphEdge>) {
  const { data, id } = props;
  const flow = useReactFlow<SimpleGraphNode, SimpleGraphEdge>();
  const [draft, setDraft] = useState(String(data?.label ?? ''));
  const [dragStart, setDragStart] = useState<{ origin: { x: number; y: number }; pointerId: number; start: { x: number; y: number } } | null>(null);
  const [path, labelX, labelY] = getPath(props);
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const endMarker = data?.endMarker;
  const startMarker = data?.startMarker;
  const dash = dashForKind(data?.kind ?? 'association');


  useEffect(() => setDraft(String(data?.label ?? '')), [data?.label]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ origin: offset, pointerId: event.pointerId, start: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragStart) return;
    const current = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    data?.onLabelOffsetChange?.(id, { x: dragStart.origin.x + current.x - dragStart.start.x, y: dragStart.origin.y + current.y - dragStart.start.y }, draft);
  }

  const sourceEdgeX = props.sourceX;
  const sourceEdgeY = props.sourceY;
  const targetEdgeX = props.targetX;
  const targetEdgeY = props.targetY;

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd={endMarker ? `url(#${endMarker})` : undefined}
        markerStart={startMarker ? `url(#${startMarker})` : undefined}
        path={path}
        style={{ ...props.style, stroke: data?.display.lineColor ?? data?.display.strokeColor, strokeDasharray: dash, strokeWidth: data?.display.lineWidth ?? 1.5 }}
      />
      {data?.sourceCardinality ? (
        <EdgeLabelRenderer>
          <div
            className="er-edge-label simple-edge-label nodrag nopan"
            data-no-canvas-pan="true"
            style={{ transform: `translate(-50%, -50%) translate(${sourceEdgeX - 10}px, ${sourceEdgeY - 12}px)`, fontSize: '0.72rem', color: 'var(--er-text, var(--ink))' }}
          >
            {data.sourceCardinality}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {data?.targetCardinality ? (
        <EdgeLabelRenderer>
          <div
            className="er-edge-label simple-edge-label nodrag nopan"
            data-no-canvas-pan="true"
            style={{ transform: `translate(-50%, -50%) translate(${targetEdgeX + 10}px, ${targetEdgeY - 12}px)`, fontSize: '0.72rem', color: 'var(--er-text, var(--ink))' }}
          >
            {data.targetCardinality}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className={`er-edge-label simple-edge-label nodrag nopan ${data.sequenceNumber ? 'has-sequence-number' : ''}`}
            data-no-canvas-pan="true"
            onPointerCancel={() => setDragStart(null)}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => setDragStart(null)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX + offset.x}px, ${labelY + offset.y - 10}px)` }}
          >
            {data.sequenceNumber ? <strong>{data.sequenceNumber}</strong> : null}
            <span>{draft}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
