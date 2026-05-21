import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import type { UseCaseGraphNode } from './useCaseModel';

function isActive(node: NodeProps<UseCaseGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function minSize(node: NodeProps<UseCaseGraphNode>): { height: number; width: number } {
  if (node.data.kind === 'systemBoundary') return { height: 220, width: 420 };
  if (node.data.kind === 'actor') return { height: 106, width: 84 };
  return { height: 48, width: 144 };
}

function Resizer(props: NodeProps<UseCaseGraphNode>) {
  const minimum = minSize(props);

  return (
    <NodeResizer
      color={String(props.data.display.accentColor)}
      handleClassName="er-resize-handle nodrag"
      isVisible={isActive(props)}
      lineClassName="er-resize-line"
      minHeight={minimum.height}
      minWidth={minimum.width}
      onResizeEnd={(_, params) => props.data.onNodeResize?.(props.id, { height: params.height, width: params.width })}
    />
  );
}

function EditableLabel({ className, node }: { className: string; node: NodeProps<UseCaseGraphNode> }) {
  return (
    <AutoFitInput
      className={`${className} nodrag`}
      maxFontSize={Number(node.data.display.fontSize)}
      minFontSize={9}
      onBlur={(event) => node.data.onLocalLabelEdit?.(node.id, event.currentTarget.value)}
      onChange={(event) => node.data.onLocalLabelEdit?.(node.id, event.target.value)}
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

export function UseCaseBoundaryNode(props: NodeProps<UseCaseGraphNode>) {
  return (
    <div className={`usecase-boundary-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <div className="usecase-boundary-header">
        <EditableLabel className="usecase-boundary-title" node={props} />
      </div>
    </div>
  );
}

export function UseCaseActorNode(props: NodeProps<UseCaseGraphNode>) {
  const actor = props.data.metadata.actor;

  return (
    <div className={`usecase-actor-node ${isActive(props) ? 'is-selected' : ''} ${actor?.isExternal ? 'is-external' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" id="actor-top-source" position={Position.Top} type="source" />
      <Handle className="er-handle" id="actor-top-target" position={Position.Top} type="target" />
      <Handle className="er-handle" id="actor-right-source" position={Position.Right} type="source" />
      <Handle className="er-handle" id="actor-left-source" position={Position.Left} type="source" />
      <div className="usecase-actor-figure" aria-hidden="true">
        <svg viewBox="0 0 64 88" role="img">
          <circle className="usecase-actor-line" cx="32" cy="13" r="10" />
          <path className="usecase-actor-line" d="M32 23v30" />
          <path className="usecase-actor-line" d="M10 35h44" />
          <path className="usecase-actor-line" d="M32 53 14 82" />
          <path className="usecase-actor-line" d="M32 53 50 82" />
        </svg>
      </div>
      <EditableLabel className="usecase-actor-label" node={props} />
      <Handle className="er-handle" id="actor-left-target" position={Position.Left} type="target" />
      <Handle className="er-handle" id="actor-right-target" position={Position.Right} type="target" />
      <Handle className="er-handle" id="actor-bottom-source" position={Position.Bottom} type="source" />
      <Handle className="er-handle" id="actor-bottom-target" position={Position.Bottom} type="target" />
    </div>
  );
}

export function UseCaseEllipseNode(props: NodeProps<UseCaseGraphNode>) {
  return (
    <div className={`usecase-ellipse-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" id="usecase-top-target" position={Position.Top} type="target" />
      <Handle className="er-handle" id="usecase-top-source" position={Position.Top} type="source" />
      <Handle className="er-handle" id="usecase-left-target" position={Position.Left} type="target" />
      <Handle className="er-handle" id="usecase-left-source" position={Position.Left} type="source" />
      <EditableLabel className="usecase-ellipse-label" node={props} />
      <Handle className="er-handle" id="usecase-right-source" position={Position.Right} type="source" />
      <Handle className="er-handle" id="usecase-right-target" position={Position.Right} type="target" />
      <Handle className="er-handle" id="usecase-bottom-source" position={Position.Bottom} type="source" />
      <Handle className="er-handle" id="usecase-bottom-target" position={Position.Bottom} type="target" />
    </div>
  );
}

export function UseCaseNoteNode(props: NodeProps<UseCaseGraphNode>) {
  const note = props.data.metadata.note;
  if (note?.kind === 'constraint') {
    return (
      <div className={`usecase-constraint-inline ${isActive(props) ? 'is-selected' : ''}`}>
        <Handle className="er-handle" id="usecase-note-left-target" position={Position.Left} type="target" />
        <Handle className="er-handle" id="usecase-note-right-source" position={Position.Right} type="source" />
        <span>{`{ ${note.text} }`}</span>
      </div>
    );
  }

  return (
    <div className={`structure-note-node usecase-note-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" id="usecase-note-left-target" position={Position.Left} type="target" />
      <Handle className="er-handle" id="usecase-note-right-source" position={Position.Right} type="source" />
      <div className="structure-note-fold" aria-hidden="true" />
      <EditableLabel className="structure-note-label" node={props} />
    </div>
  );
}
