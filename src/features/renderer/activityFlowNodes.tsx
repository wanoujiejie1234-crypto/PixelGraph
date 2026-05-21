import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import type { ActivityGraphNode } from './activityModel';

function isActive(node: NodeProps<ActivityGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function EditableLabel({ className, node }: { className: string; node: NodeProps<ActivityGraphNode> }) {
  if (!node.data.onLabelEdit) {
    return <div className={className}>{node.data.label}</div>;
  }

  return (
    <AutoFitInput
      className={`${className} nodrag`}
      maxFontSize={Number(node.data.display.fontSize)}
      minFontSize={9}
      onBlur={(event) => node.data.onLabelEdit?.(node.id, event.currentTarget.value)}
      onChange={(event) => node.data.onLabelEdit?.(node.id, event.target.value)}
      onDoubleClick={stop}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      onPointerDown={stop}
      spellCheck={false}
      value={node.data.label}
    />
  );
}

function Handles() {
  return (
    <>
      <Handle className="er-handle" id="top-target" position={Position.Top} type="target" />
      <Handle className="er-handle" id="bottom-source" position={Position.Bottom} type="source" />
      <Handle className="er-handle" id="left-target" position={Position.Left} type="target" />
      <Handle className="er-handle" id="right-source" position={Position.Right} type="source" />
    </>
  );
}

function Resizer(props: NodeProps<ActivityGraphNode>) {
  if (props.data.kind === 'lane' || props.data.kind === 'start' || props.data.kind === 'end' || props.data.kind === 'flowFinal') return null;
  return (
    <NodeResizer
      color={String(props.data.display.accentColor)}
      handleClassName="er-resize-handle nodrag"
      isVisible={isActive(props)}
      lineClassName="er-resize-line"
      minHeight={props.data.kind === 'fork' || props.data.kind === 'join' ? 8 : 32}
      minWidth={props.data.kind === 'fork' || props.data.kind === 'join' ? 72 : 96}
      onResizeEnd={(_, params) => props.data.onNodeResize?.(props.id, { height: params.height, width: params.width })}
    />
  );
}

export function ActivityLaneNode(props: NodeProps<ActivityGraphNode>) {
  return (
    <div className="activity-lane-node">
      <div className="activity-lane-header">
        <EditableLabel className="activity-lane-title" node={props} />
      </div>
    </div>
  );
}

export function ActivityActionNode(props: NodeProps<ActivityGraphNode>) {
  return (
    <div className={`activity-action-node ${isActive(props) ? 'is-selected' : ''}`} data-node-drag="true">
      <Resizer {...props} />
      <Handles />
      <EditableLabel className="activity-action-label" node={props} />
    </div>
  );
}

export function ActivityStartNode() {
  return (
    <div className="activity-start-node" data-node-drag="true">
      <Handles />
      <span className="activity-start-core" />
    </div>
  );
}

export function ActivityEndNode() {
  return (
    <div className="activity-end-node" data-node-drag="true">
      <Handles />
      <span className="activity-end-core" />
    </div>
  );
}

export function ActivityFlowFinalNode() {
  return (
    <div className="activity-end-node activity-flow-final-node" data-node-drag="true">
      <Handles />
      <span className="activity-flow-final-core" />
    </div>
  );
}

export function ActivityDecisionNode(props: NodeProps<ActivityGraphNode>) {
  const isMerge = props.data.kind === 'merge';
  return (
    <div className={`activity-decision-node ${isActive(props) ? 'is-selected' : ''} ${isMerge ? 'is-merge' : ''}`} data-node-drag="true">
      <Resizer {...props} />
      <Handles />
      <div className="activity-decision-shape">
        {isMerge ? null : <EditableLabel className="activity-decision-label" node={props} />}
      </div>
    </div>
  );
}

export function ActivityBarNode(props: NodeProps<ActivityGraphNode>) {
  return (
    <div className={`activity-bar-node ${isActive(props) ? 'is-selected' : ''} is-${props.data.kind}`} data-node-drag="true">
      <Resizer {...props} />
      <Handles />
      <div className="activity-bar-core" />
    </div>
  );
}

export function ActivityObjectNode(props: NodeProps<ActivityGraphNode>) {
  return (
    <div className={`activity-object-node ${isActive(props) ? 'is-selected' : ''}`} data-node-drag="true">
      <Resizer {...props} />
      <Handles />
      <EditableLabel className="activity-object-label" node={props} />
    </div>
  );
}

export function ActivityNoteNode(props: NodeProps<ActivityGraphNode>) {
  return (
    <div className={`activity-note-node ${isActive(props) ? 'is-selected' : ''}`} data-node-drag="true">
      <Resizer {...props} />
      <Handles />
      <div className="activity-note-fold" aria-hidden="true" />
      <div className="activity-note-label">{props.data.label}</div>
    </div>
  );
}
