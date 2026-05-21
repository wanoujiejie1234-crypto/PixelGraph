import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import { SEQUENCE_MESSAGE_START_Y, SEQUENCE_MESSAGE_STEP, type SimpleGraphNode } from './simpleCanvasModel';

function isActive(node: NodeProps<SimpleGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function Resizer(props: NodeProps<SimpleGraphNode>) {
  if (props.data.kind === 'initial' || props.data.kind === 'final') return null;
  return (
    <NodeResizer
      color={String(props.data.display.accentColor)}
      handleClassName="er-resize-handle nodrag"
      isVisible={isActive(props)}
      lineClassName="er-resize-line"
      minHeight={props.data.kind === 'lifeline' ? 180 : 42}
      minWidth={props.data.kind === 'choice' ? 42 : 96}
      onResizeEnd={(_, params) => props.data.onNodeResize?.(props.id, { height: params.height, width: params.width })}
    />
  );
}

function EditableLabel({ className, node }: { className: string; node: NodeProps<SimpleGraphNode> }) {
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

function Handles({ visible }: { visible: boolean }) {
  const className = `er-handle ${visible ? 'is-visible' : ''}`;
  return (
    <>
      <Handle className={className} position={Position.Top} type="target" />
      <Handle className={className} position={Position.Bottom} type="source" />
      <Handle className={className} position={Position.Left} type="target" />
      <Handle className={className} position={Position.Right} type="source" />
      <Handle className={className} position={Position.Top} type="source" />
      <Handle className={className} position={Position.Bottom} type="target" />
      <Handle className={className} position={Position.Left} type="source" />
      <Handle className={className} position={Position.Right} type="target" />
    </>
  );
}

function SequenceSymbol({ type }: { type: string }) {
  if (type === 'actor') {
    return (
      <svg className="simple-sequence-symbol" height="30" viewBox="0 0 24 30" width="24" aria-hidden="true">
        <circle cx="12" cy="5.5" fill="none" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 9.5v10M5 14h14M7 29l5-9.5 5 9.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === 'boundary') {
    return (
      <svg className="simple-sequence-symbol" height="30" viewBox="0 0 30 30" width="30" aria-hidden="true">
        <path d="M6 4v22" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="17" cy="15" fill="none" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === 'control') {
    return (
      <svg className="simple-sequence-symbol" height="30" viewBox="0 0 30 30" width="30" aria-hidden="true">
        <circle cx="15" cy="15" fill="none" r="10" stroke="currentColor" strokeWidth="1.8" />
        <path d="M11 8h9v9M20 8l-10 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === 'entity') {
    return (
      <svg className="simple-sequence-symbol" height="30" viewBox="0 0 30 30" width="30" aria-hidden="true">
        <circle cx="15" cy="13" fill="none" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 25h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }
  return null;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility === '+') {
    return (
      <svg className="simple-vis-icon" viewBox="0 0 12 12" width="12" height="12" aria-label="public">
        <circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (visibility === '-') {
    return (
      <svg className="simple-vis-icon" viewBox="0 0 12 12" width="12" height="12" aria-label="private">
        <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (visibility === '#') {
    return (
      <svg className="simple-vis-icon" viewBox="0 0 12 12" width="12" height="12" aria-label="protected">
        <polygon points="6,2 10,6 6,10 2,6" fill="currentColor" />
      </svg>
    );
  }
  if (visibility === '~') {
    return (
      <svg className="simple-vis-icon" viewBox="0 0 12 12" width="12" height="12" aria-label="package">
        <path d="M1.5 4.5a5 5 0 0 1 9 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="6" cy="8" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  return <span className="simple-vis-icon-placeholder" />;
}

export function SimpleClassNode(props: NodeProps<SimpleGraphNode>) {
  const active = isActive(props);
  const members = props.data.members ?? [];
  const fields = members.filter((m) => !m.isMethod);
  const methods = members.filter((m) => m.isMethod);
  const hasStructured = members.length > 0;

  return (
    <div className={`simple-class-node simple-${props.data.kind} ${active ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles visible={active} />
      <div className="simple-class-head">
        {props.data.stereotype ? <span>{`<<${props.data.stereotype}>>`}</span> : null}
        <EditableLabel className="simple-node-title" node={props} />
      </div>
      {hasStructured ? (
        <div className="simple-class-body">
          {fields.length > 0 && (
            <div className="simple-class-section">
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  className={`simple-class-member${field.isAbstract ? ' is-abstract' : ''}${field.isStatic ? ' is-static' : ''}`}
                >
                  <VisibilityIcon visibility={field.visibility} />
                  <span className="simple-member-name">{field.name}</span>
                  {field.type && <span className="simple-member-type">{`: ${field.type}`}</span>}
                </div>
              ))}
            </div>
          )}
          {fields.length > 0 && methods.length > 0 && <div className="simple-class-separator" />}
          {methods.length > 0 && (
            <div className="simple-class-section">
              {methods.map((method, idx) => (
                <div
                  key={idx}
                  className={`simple-class-member${method.isAbstract ? ' is-abstract' : ''}${method.isStatic ? ' is-static' : ''}`}
                >
                  <VisibilityIcon visibility={method.visibility} />
                  <span className="simple-member-name">{method.name}</span>
                  <span className="simple-member-params">{`(${method.parameters ?? ''})`}</span>
                  {method.type && <span className="simple-member-type">{`: ${method.type}`}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        props.data.details?.length ? (
          <div className="simple-class-details">
            {props.data.details.map((detail, index) => (
              <div key={`${detail}-${index}`}>{detail}</div>
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}

export function SimpleLifelineNode(props: NodeProps<SimpleGraphNode>) {
  const active = isActive(props);
  const participantType = String(props.data.stereotype ?? 'participant');
  const hasSymbol = ['actor', 'boundary', 'control', 'entity'].includes(participantType);
  return (
    <div className={`simple-lifeline-node ${active ? 'is-selected' : ''} is-${participantType}`}>
      <Resizer {...props} />
      <Handles visible={active} />
      <div className={`simple-lifeline-head simple-sequence-${participantType}`}>
        {hasSymbol ? <SequenceSymbol type={participantType} /> : null}
        {participantType === 'actor' ? null : <span>{participantType}</span>}
        <EditableLabel className="simple-node-title" node={props} />
      </div>
      <div className="simple-lifeline-line" aria-hidden="true" />
      {props.data.activations?.map((act, idx) => {
        const nodeY = props.data.lifelineTop ?? 0;
        const top = SEQUENCE_MESSAGE_START_Y + act.startSequenceIndex * SEQUENCE_MESSAGE_STEP - nodeY + 2;
        const bottom = SEQUENCE_MESSAGE_START_Y + act.endSequenceIndex * SEQUENCE_MESSAGE_STEP - nodeY - 2;
        const height = Math.max(4, bottom - top);
        return (
          <div
            className="simple-activation-box"
            key={idx}
            style={{
              height: `${height}px`,
              top: `${top}px`,
              width: `${10 + (act.depth ?? 0) * 4}px`,
            }}
          />
        );
      })}
    </div>
  );
}

export function SimpleFragmentNode(props: NodeProps<SimpleGraphNode>) {
  const active = isActive(props);
  return (
    <div className={`simple-fragment-node ${active ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles visible={active} />
      <span className="simple-fragment-tag">{props.data.stereotype}</span>
      <EditableLabel className="simple-node-title" node={props} />
      {props.data.details?.map((detail) => <p key={detail}>{detail}</p>)}
    </div>
  );
}

export function SimpleStateNode(props: NodeProps<SimpleGraphNode>) {
  const active = isActive(props);
  if (props.data.kind === 'initial') {
    return (
      <div className="simple-pseudo-node simple-initial-node">
        <Handles visible={active} />
      </div>
    );
  }
  if (props.data.kind === 'final') {
    return (
      <div className="simple-pseudo-node simple-final-node">
        <Handles visible={active} />
        <span />
      </div>
    );
  }
  return (
    <div className={`simple-state-node simple-${props.data.kind} ${active ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles visible={active} />
      <EditableLabel className="simple-node-title" node={props} />
      {props.data.details?.map((detail) => <p className="simple-state-action" key={detail}>{detail}</p>)}
    </div>
  );
}

export function SimpleStateContainerNode(props: NodeProps<SimpleGraphNode>) {
  return (
    <div className="simple-state-container-node">
      <div className="simple-state-container-header">
        <EditableLabel className="simple-node-title" node={props} />
      </div>
    </div>
  );
}
