import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import type { StructureGraphNode } from './structureModel';

function isActive(node: NodeProps<StructureGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function minSize(node: NodeProps<StructureGraphNode>): { height: number; width: number } {
  if (node.data.kind === 'interface') return { height: 58, width: 108 };
  if (node.data.kind === 'artifact') return { height: 62, width: 156 };
  if (node.data.kind === 'component') return { height: 76, width: 180 };
  if (node.data.kind === 'note') return { height: 72, width: 148 };
  if (node.data.kind === 'port') return { height: 24, width: 36 };
  if (node.data.kind === 'deployment-spec') return { height: 86, width: 150 };
  if (node.data.kind === 'execution') return { height: 108, width: 188 };
  return { height: 176, width: 248 };
}

function Resizer(props: NodeProps<StructureGraphNode>) {
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

function EditableLabel({ className, node }: { className: string; node: NodeProps<StructureGraphNode> }) {
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

function Metadata({ node }: { node: NodeProps<StructureGraphNode> }) {
  if (!node.data.metadata) return null;
  return <p className="structure-node-stereotype">{node.data.metadata}</p>;
}

function Handles() {
  return (
    <>
      <Handle className="er-handle" id="structure-left-target" position={Position.Left} type="target" />
      <Handle className="er-handle" id="structure-right-source" position={Position.Right} type="source" />
      <Handle className="er-handle" id="structure-top-target" position={Position.Top} type="target" />
      <Handle className="er-handle" id="structure-bottom-source" position={Position.Bottom} type="source" />
      <Handle className="er-handle" id="structure-left-source" position={Position.Left} type="source" />
      <Handle className="er-handle" id="structure-right-target" position={Position.Right} type="target" />
      <Handle className="er-handle" id="structure-top-source" position={Position.Top} type="source" />
      <Handle className="er-handle" id="structure-bottom-target" position={Position.Bottom} type="target" />
    </>
  );
}

export function StructureContainerNode(props: NodeProps<StructureGraphNode>) {
  const className =
    props.data.kind === 'package'
      ? 'structure-package-node'
      : props.data.kind === 'execution'
        ? 'structure-execution-node'
        : ['cloud', 'node', 'device', 'database'].includes(props.data.kind)
          ? 'structure-deployment-node'
          : 'structure-group-node';

  if (props.data.kind === 'package') {
    return (
      <div className={`${className} structure-${props.data.kind} ${isActive(props) ? 'is-selected' : ''}`}>
        <Resizer {...props} />
        <Handles />
        <div className="structure-package-tab">
          <EditableLabel className="structure-package-title" node={props} />
        </div>
        <div className="structure-package-body">
          <Metadata node={props} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} structure-${props.data.kind} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      {props.data.kind === 'execution' && (
        <svg className="structure-container-cube-bg" viewBox="0 0 120 90" aria-hidden="true">
          <path className="cube-top" d="M16 18 L32 6 H110 L94 18 Z" />
          <path className="cube-right" d="M94 18 L110 6 V62 L94 74 Z" />
          <rect className="cube-front" x="16" y="18" width="78" height="56" rx="1" />
        </svg>
      )}
      <div className="structure-node-tab" aria-hidden="true" />
      <div className="structure-group-header">
        <span className="structure-node-stereotype">{'\u00AB'}{props.data.kind}{'\u00BB'}</span>
        <EditableLabel className="structure-group-title" node={props} />
      </div>
      <Metadata node={props} />
    </div>
  );
}

function ContainerShapeLabel({ node, stereotype }: { node: NodeProps<StructureGraphNode>; stereotype: string }) {
  return (
    <div className="structure-shape-label">
        <span className="structure-node-stereotype">{'\u00AB'}{stereotype}{'\u00BB'}</span>
      <EditableLabel className="structure-group-title" node={node} />
      <Metadata node={node} />
    </div>
  );
}

export function StructureCloudNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-cloud-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <svg className="structure-cloud-shape" viewBox="0 0 120 80" aria-hidden="true">
        <path d="M15 65 Q0 55 5 40 Q8 25 25 20 Q30 5 50 5 Q70 5 80 18 Q95 12 108 25 Q118 35 115 55 Q112 68 98 70 L20 68Z" />
      </svg>
      <ContainerShapeLabel node={props} stereotype="cloud" />
    </div>
  );
}

export function StructureDatabaseNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-database-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <svg className="structure-database-shape" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="16" rx="38" ry="12" />
        <path d="M12 16 V76 Q12 92 50 92 Q88 92 88 76 V16" />
        <ellipse cx="50" cy="76" rx="38" ry="12" />
      </svg>
      <ContainerShapeLabel node={props} stereotype="database" />
    </div>
  );
}

export function StructureDeviceNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-device-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <svg className="structure-node-cube-shape" viewBox="0 0 120 90" aria-hidden="true">
        <path className="cube-top" d="M16 18 L32 6 H110 L94 18 Z" />
        <path className="cube-right" d="M94 18 L110 6 V62 L94 74 Z" />
        <rect className="cube-front" x="16" y="18" width="78" height="56" rx="1" />
      </svg>
      <ContainerShapeLabel node={props} stereotype="device" />
    </div>
  );
}

export function StructureNodeBox(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-node-box ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <svg className="structure-node-cube-shape" viewBox="0 0 120 90" aria-hidden="true">
        <path className="cube-top" d="M16 18 L32 6 H110 L94 18 Z" />
        <path className="cube-right" d="M94 18 L110 6 V62 L94 74 Z" />
        <rect className="cube-front" x="16" y="18" width="78" height="56" rx="1" />
      </svg>
      <ContainerShapeLabel node={props} stereotype="node" />
    </div>
  );
}

export function StructureComponentNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-component-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <div className="structure-component-glyph" aria-hidden="true">
        <span />
        <span />
      </div>
      <EditableLabel className="structure-component-title" node={props} />
      <Metadata node={props} />
      {props.data.providedInterfaces?.map((iface, index) => (
        <div className="structure-provided-interface" key={iface} style={{ top: 18 + index * 24 }}>
          <span className="interface-lollipop" aria-hidden="true" />
          <span>{iface}</span>
        </div>
      ))}
      {props.data.requiredInterfaces?.map((iface, index) => (
        <div className="structure-required-interface" key={iface} style={{ top: 18 + index * 24 }}>
          <span className="interface-socket" aria-hidden="true" />
          <span>{iface}</span>
        </div>
      ))}
    </div>
  );
}

export function StructurePortNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-port-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <EditableLabel className="structure-port-label" node={props} />
    </div>
  );
}

export function StructureDeploymentSpecNode(props: NodeProps<StructureGraphNode>) {
  const properties = props.data.specProperties ?? [];
  return (
    <div className={`deployment-spec-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <div className="structure-artifact-fold" aria-hidden="true" />
      <EditableLabel className="deployment-spec-title" node={props} />
      <div className="deployment-spec-properties">
        {properties.map((property) => (
          <div className="deployment-spec-row" key={property.name}>
            <span className="spec-prop-name">{property.name}</span>
            <span>=</span>
            <span className="spec-prop-value">{property.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StructureInterfaceNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-interface-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <div className="structure-interface-shape" aria-hidden="true" />
      <EditableLabel className="structure-interface-label" node={props} />
      <Metadata node={props} />
    </div>
  );
}

export function StructureArtifactNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-artifact-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <div className="structure-artifact-fold" aria-hidden="true" />
      <EditableLabel className="structure-artifact-title" node={props} />
      <Metadata node={props} />
    </div>
  );
}

export function StructureNoteNode(props: NodeProps<StructureGraphNode>) {
  return (
    <div className={`structure-note-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handles />
      <div className="structure-note-fold" aria-hidden="true" />
      <EditableLabel className="structure-note-label" node={props} />
      {props.data.description ? <p className="structure-note-target">{props.data.description}</p> : null}
    </div>
  );
}
