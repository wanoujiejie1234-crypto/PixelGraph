import { Handle, Position, type NodeProps } from '@xyflow/react';
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

export function DatabaseTableNode(props: NodeProps<ErGraphNode>) {
  const { data, id } = props;
  const table = data.metadata.table;
  const collapsed = Boolean(table && data.columns?.length === 0 && table.columns.length > 0);

  return (
    <div className={`er-flow-node er-table-node ${isActive(props) ? 'is-selected' : ''}`}>
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
  const { data } = props;

  return (
    <div className={`er-flow-node chen-flow-relationship ${isActive(props) ? 'is-selected' : ''}`}>
      <Handle className="er-handle" position={Position.Left} type="target" />
      <div className="chen-relationship-shape" aria-hidden="true" />
      <input
        className="chen-title-input nodrag"
        onChange={(event) => data.onLocalLabelEdit?.(props.id, event.target.value)}
        onDoubleClick={stop}
        onPointerDown={stop}
        value={data.label}
      />
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}
