import { useEffect, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import type { ErGraphNode } from './erGraphModel';

function isActive(node: NodeProps<ErGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function tableEditKind(showComments: boolean): 'table-comment' | 'table-name' {
  return showComments ? 'table-comment' : 'table-name';
}

function columnEditKind(showComments: boolean): 'column-comment' | 'column-name' {
  return showComments ? 'column-comment' : 'column-name';
}

function minSize(node: NodeProps<ErGraphNode>): { height: number; width: number } {
  if (node.data.kind === 'table') return { height: 128, width: 260 };
  if (node.data.kind === 'relationship') return { height: 64, width: 118 };
  if (node.data.kind === 'attribute') return { height: 46, width: 132 };
  return { height: 58, width: 138 };
}

function Resizer(props: NodeProps<ErGraphNode>) {
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

function ChenRelationshipLabel({ data, id }: Pick<NodeProps<ErGraphNode>, 'data' | 'id'>) {
  const [draft, setDraft] = useState(data.label);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    if (!isComposing) setDraft(data.label);
  }, [data.label, isComposing]);

  function commit(value = draft): void {
    data.onLocalLabelEdit?.(id, value.trim());
  }

  return (
    <input
      className="chen-title-input chen-relationship-input nodrag"
      onBlur={() => commit()}
      onChange={(event) => {
        setDraft(event.target.value);
        if (!isComposing) commit(event.target.value);
      }}
      onCompositionEnd={(event) => {
        setIsComposing(false);
        setDraft(event.currentTarget.value);
        commit(event.currentTarget.value);
      }}
      onCompositionStart={() => setIsComposing(true)}
      onDoubleClick={stop}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      onPointerDown={stop}
      title={draft}
      value={draft}
    />
  );
}

export function DatabaseTableNode(props: NodeProps<ErGraphNode>) {
  const { data, id } = props;
  const table = data.metadata.table;
  const collapsed = Boolean(table && data.columns?.length === 0 && table.columns.length > 0);

  return (
    <div className={`er-flow-node er-table-node ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <div className="er-table-head">
        <input
          className="er-node-title-input nodrag"
          onChange={(event) => table && data.onEdit({ kind: tableEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
          onDoubleClick={stop}
          onPointerDown={stop}
          value={data.label}
        />
        {table ? (
          <button className="er-collapse-button nodrag" onClick={() => data.setCollapsed?.(table.name, !collapsed)} onPointerDown={stop} type="button">
            {collapsed ? '+' : '-'}
          </button>
        ) : null}
      </div>
      {table && data.display.showComments ? <div className="er-table-name">{table.name}</div> : null}
      <div className="er-column-list">
        {(data.columns ?? []).map((column) => (
          <div className="er-column-row" key={column.name}>
            <span className={`er-column-badge ${column.isPrimaryKey ? 'is-pk' : column.isForeignKey ? 'is-fk' : ''}`}>
              {column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : ''}
            </span>
            <input
              className="er-column-name nodrag"
              onChange={(event) => table && data.onEdit({ columnName: column.name, kind: columnEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
              onDoubleClick={stop}
              onPointerDown={stop}
              value={data.display.showComments && column.comment ? column.comment : column.name}
            />
            {data.display.showTypes ? <span className="er-column-type">{column.dataType}</span> : null}
          </div>
        ))}
        {collapsed ? <div className="er-column-empty">fields hidden</div> : null}
      </div>
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}

export function ChenEntityNode(props: NodeProps<ErGraphNode>) {
  const { data } = props;
  const table = data.metadata.table;

  return (
    <div className={`er-flow-node chen-flow-entity ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <input
        className="chen-title-input nodrag"
        onChange={(event) => table && data.onEdit({ kind: tableEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
        onDoubleClick={stop}
        onPointerDown={stop}
        value={data.label}
      />
      {table && data.display.showComments ? <span>{table.name}</span> : null}
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}

export function ChenAttributeNode(props: NodeProps<ErGraphNode>) {
  const { data } = props;
  const table = data.metadata.table;
  const column = data.metadata.column;

  return (
    <div className={`er-flow-node chen-flow-attribute ${column?.isPrimaryKey ? 'is-key' : ''} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <input
        className="chen-title-input nodrag"
        onChange={(event) => table && column && data.onEdit({ columnName: column.name, kind: columnEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
        onDoubleClick={stop}
        onPointerDown={stop}
        value={data.label}
      />
      {data.display.showTypes && column ? <span>{column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : column.dataType}</span> : null}
    </div>
  );
}

export function ChenRelationshipNode(props: NodeProps<ErGraphNode>) {
  const { data, id } = props;

  return (
    <div className={`er-flow-node chen-flow-relationship ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <div className="chen-relationship-shape" aria-hidden="true" />
      <ChenRelationshipLabel data={data} id={id} />
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}
