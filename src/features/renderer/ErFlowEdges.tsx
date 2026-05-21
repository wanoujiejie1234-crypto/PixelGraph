import { useEffect, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import type { ErGraphEdge, ErGraphNode } from './erGraphModel';
import { crowfootLabelPoint, crowfootPrimitives, edgeDirection, type Point } from './erCrowfoot';

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

export function EditableErEdge(props: EdgeProps<ErGraphEdge>) {
  const { id, data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style } = props;
  const flow = useReactFlow<ErGraphNode, ErGraphEdge>();
  const [dragStart, setDragStart] = useState<{ origin: { x: number; y: number }; pointerId: number; start: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = useState(String(data?.label ?? ''));
  const offset = data?.labelOffset ?? { x: 0, y: 0 };
  const isChenRelationshipEdge = props.source.startsWith('relationship:') || props.target.startsWith('relationship:');
  const [path, labelX, labelY] = isChenRelationshipEdge
    ? getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      })
    : getBezierPath({
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
  const sideOffset = hasCustomOffset ? { x: 0, y: 0 } : { x: (-dy / length) * (isChenRelationshipEdge ? 10 : 16), y: (dx / length) * (isChenRelationshipEdge ? 10 : 16) };
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

  const relationshipKind = data?.relationshipKind ?? 'nonIdentifying';
  const roleLabel =
    data?.display.showRelationshipRoles && (data?.roleFrom || data?.roleTo)
      ? [data?.roleFrom, data?.roleTo].filter(Boolean).join(' / ')
      : '';
  const diagnosticStyle =
    data?.diagnosticLevel === 'error'
      ? { stroke: '#9a3d32', strokeWidth: 2.2 }
      : data?.diagnosticLevel === 'warning'
        ? { stroke: '#b97923', strokeWidth: 1.9 }
        : {};

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          ...diagnosticStyle,
          strokeDasharray: relationshipKind === 'identifying' ? undefined : style?.strokeDasharray,
          strokeWidth: relationshipKind === 'identifying' ? 1.9 : style?.strokeWidth,
        }}
      />
      {roleLabel ? (
        <EdgeLabelRenderer>
          <div
            className="er-edge-label er-edge-role-label nodrag nopan"
            data-no-canvas-pan="true"
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y - 18}px)` } as React.CSSProperties}
          >
            <span>{roleLabel}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
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
            <AutoFitInput
              aria-label="ER edge label"
              maxFontSize={Math.max(9, Number(data.display.fontSize) - 5)}
              minFontSize={8}
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

function endpointPoint(x: number, y: number): Point {
  return { x, y };
}

function CrowfootGeometry({
  cardinality,
  label,
  direction,
  point,
  stroke,
}: {
  cardinality: string | undefined;
  label?: string;
  direction: { x: number; y: number };
  point: Point;
  stroke: string;
}) {
  const labelPoint = crowfootLabelPoint(point, direction, 'from');
  return (
    <g className="er-crowfoot-geometry">
      {crowfootPrimitives(point, direction, cardinality).map((primitive, index) =>
        primitive.type === 'circle' ? (
          <circle cx={primitive.center.x} cy={primitive.center.y} fill="#ffffff" key={`circle-${index}`} r={primitive.radius} stroke={stroke} strokeWidth={1.7} />
        ) : (
          <line key={`line-${index}`} stroke={stroke} strokeLinecap="round" strokeWidth={1.7} x1={primitive.start.x} x2={primitive.end.x} y1={primitive.start.y} y2={primitive.end.y} />
        ),
      )}
      {label ? (
        <text className="er-crowfoot-cardinality" fill={stroke} style={{ fontFamily: 'var(--mono)' }} textAnchor="middle" x={labelPoint.x} y={labelPoint.y - 16}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function CrowFootErEdge(props: EdgeProps<ErGraphEdge>) {
  const { id, data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style } = props;
  const edgeData = data ?? {
    cardinality: '1:N',
    display: {
      accentColor: '#507c69',
      attributeVisibility: 'keys' as const,
      fillColor: '#ffffff',
      fontSize: 15,
      layoutDirection: 'LR' as const,
      nodeScale: 1,
      notationStyle: 'crowfoot' as const,
      showCardinality: true,
      showComments: true,
      showConstraints: true,
      showRelationshipRoles: true,
      showTypes: true,
      strokeColor: '#171817',
      textColor: '#171817',
      viewMode: 'crowfoot' as const,
    },
  };
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: 12,
    offset: 18,
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const relationshipKind = edgeData.relationshipKind ?? 'nonIdentifying';
  const roleFrom = edgeData.display.showRelationshipRoles ? edgeData.roleFrom : undefined;
  const roleTo = edgeData.display.showRelationshipRoles ? edgeData.roleTo : undefined;
  const constraintLabel = edgeData.display.showConstraints ? edgeData.constraintText : undefined;
  const [fromCardinality = '1', toCardinality = 'N'] = String(edgeData.cardinality ?? '1:N').split(':');
  const cardinalityLabelFrom = edgeData.display.showCardinality ? fromCardinality : undefined;
  const cardinalityLabelTo = edgeData.display.showCardinality ? toCardinality : undefined;
  const diagnosticStyle =
    edgeData.diagnosticLevel === 'error'
      ? { stroke: '#9a3d32', strokeWidth: 2.2 }
      : edgeData.diagnosticLevel === 'warning'
        ? { stroke: '#b97923', strokeWidth: 1.9 }
        : {};
  const stroke = String(diagnosticStyle.stroke ?? style?.stroke ?? edgeData.display.strokeColor ?? '#171817');
  const fromDirection = edgeDirection(sourcePosition, { x: targetX - sourceX, y: targetY - sourceY });
  const toDirection = edgeDirection(targetPosition, { x: sourceX - targetX, y: sourceY - targetY });
  const fromRolePoint = crowfootLabelPoint(endpointPoint(sourceX, sourceY), fromDirection, 'from');
  const toRolePoint = crowfootLabelPoint(endpointPoint(targetX, targetY), toDirection, 'to');

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          ...diagnosticStyle,
          strokeDasharray: relationshipKind === 'identifying' ? undefined : '7 5',
          strokeWidth: relationshipKind === 'identifying' ? 1.9 : 1.5,
        }}
      />
      <svg className="er-crowfoot-overlay" height="100%" width="100%">
        <CrowfootGeometry cardinality={fromCardinality} direction={fromDirection} label={cardinalityLabelFrom} point={endpointPoint(sourceX, sourceY)} stroke={stroke} />
        <CrowfootGeometry cardinality={toCardinality} direction={toDirection} label={cardinalityLabelTo} point={endpointPoint(targetX, targetY)} stroke={stroke} />
      </svg>
      {roleFrom ? (
        <EdgeLabelRenderer>
          <div className="er-edge-label er-edge-role-label nodrag nopan" data-no-canvas-pan="true" style={{ transform: `translate(-50%, -50%) translate(${fromRolePoint.x}px, ${fromRolePoint.y}px)` } as React.CSSProperties}>
            <span>{roleFrom}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {edgeData.label ? (
        <EdgeLabelRenderer>
          <div className="er-edge-label nodrag nopan" data-no-canvas-pan="true" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` } as React.CSSProperties}>
            <span>{edgeData.label}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {constraintLabel ? (
        <EdgeLabelRenderer>
          <div className="er-edge-label er-edge-constraint-label nodrag nopan" data-no-canvas-pan="true" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 18}px)` } as React.CSSProperties}>
            <span>{constraintLabel}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {roleTo ? (
        <EdgeLabelRenderer>
          <div className="er-edge-label er-edge-role-label nodrag nopan" data-no-canvas-pan="true" style={{ transform: `translate(-50%, -50%) translate(${toRolePoint.x}px, ${toRolePoint.y}px)` } as React.CSSProperties}>
            <span>{roleTo}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
