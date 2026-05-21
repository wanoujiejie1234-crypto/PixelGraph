import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, getStraightPath, type EdgeProps } from '@xyflow/react';
import type { ActivityGraphEdge } from './activityModel';

function getActivityPath(props: EdgeProps<ActivityGraphEdge>): readonly [string, number, number] {
  if (props.data?.kind === 'note' || props.data?.kind === 'object') {
    const [path, labelX, labelY] = getStraightPath(props);
    return [path, labelX, labelY];
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: 14,
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

function FixedLabel({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <EdgeLabelRenderer>
      <div
        className="er-edge-label activity-edge-label nodrag nopan"
        data-no-canvas-pan="true"
        style={{ '--label-length': Math.max(1, label.length), transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` } as React.CSSProperties}
      >
        <span>{label}</span>
      </div>
    </EdgeLabelRenderer>
  );
}

export function ActivityControlEdge(props: EdgeProps<ActivityGraphEdge>) {
  const [path, labelX, labelY] = getActivityPath(props);
  const display = props.data?.display;
  const label = props.data?.label || props.label;

  return (
    <>
      <BaseEdge
        id={props.id}
        markerEnd="url(#pg-activity-arrow)"
        path={path}
        style={{
          ...props.style,
          stroke: display?.strokeColor ?? '#171817',
          strokeWidth: 1.5,
        }}
      />
      {label ? <FixedLabel label={String(label)} x={labelX} y={labelY - 8} /> : null}
    </>
  );
}

export function ActivityObjectEdge(props: EdgeProps<ActivityGraphEdge>) {
  const [path, labelX, labelY] = getActivityPath(props);
  const display = props.data?.display;
  const label = props.data?.label || props.label;

  return (
    <>
      <BaseEdge
        id={props.id}
        markerEnd="url(#pg-activity-open-arrow)"
        path={path}
        style={{
          ...props.style,
          stroke: display?.strokeColor ?? '#171817',
          strokeDasharray: '7 5',
          strokeWidth: 1.4,
        }}
      />
      {label ? <FixedLabel label={String(label)} x={labelX} y={labelY - 8} /> : null}
    </>
  );
}

export function ActivityNoteEdge(props: EdgeProps<ActivityGraphEdge>) {
  const [path] = getActivityPath(props);
  const display = props.data?.display;
  return (
    <BaseEdge
      id={props.id}
      path={path}
      style={{
        ...props.style,
        stroke: display?.strokeColor ?? '#171817',
        strokeDasharray: '5 4',
        strokeWidth: 1.2,
      }}
    />
  );
}
