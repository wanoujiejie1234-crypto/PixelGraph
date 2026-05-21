import { useEffect, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { AutoFitInput } from './AutoFitInput';
import type { ErGraphNode } from './erGraphModel';

function isActive(node: NodeProps<ErGraphNode>): boolean {
  return node.data.selectedId === node.id || node.selected;
}

function diagnosticClass(node: NodeProps<ErGraphNode>): string {
  return node.data.diagnosticLevel ? `has-${node.data.diagnosticLevel}` : '';
}

function diagnosticValue(level?: 'warning' | 'error'): string {
  return level ?? 'none';
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
  if (node.data.kind === 'table') {
    const columnCount = node.data.columns?.length ?? 0;
    const hasCommentName = Boolean(node.data.display.showComments && node.data.metadata.table?.name);
    return {
      height: Math.max(128, 98 + (hasCommentName ? 22 : 0) + columnCount * 30),
      width: 260,
    };
  }
  if (node.data.kind === 'relationship') {
    const label = String(node.data.label ?? '');
    const estimatedWidth = Math.max(176, Math.min(300, 108 + Array.from(label).reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 14 : 8), 0)));
    return { height: 104, width: estimatedWidth };
  }
  if (node.data.kind === 'attribute') return { height: 46, width: 132 };
  return { height: 58, width: 138 };
}

function ChenMetaText({ children }: { children: React.ReactNode }) {
  return <span className="chen-meta-text">{children}</span>;
}

function ChenEntityGeometry({ entityKind }: { entityKind: 'strong' | 'weak' | 'associative' }) {
  if (entityKind === 'associative') {
    return (
      <>
        <div aria-hidden="true" className="chen-entity-frame chen-entity-frame-outer" />
        <div aria-hidden="true" className="chen-entity-frame chen-entity-frame-associative" />
      </>
    );
  }

  if (entityKind === 'weak') {
    return (
      <>
        <div aria-hidden="true" className="chen-entity-frame chen-entity-frame-outer" />
        <div aria-hidden="true" className="chen-entity-frame chen-entity-frame-inner" />
      </>
    );
  }

  return <div aria-hidden="true" className="chen-entity-frame chen-entity-frame-outer" />;
}

function ChenAttributeGeometry({
  attributeKind,
  isWeakKey,
}: {
  attributeKind: 'normal' | 'derived' | 'multivalued';
  isWeakKey: boolean;
}) {
  return (
    <>
      <div aria-hidden="true" className="chen-attribute-oval chen-attribute-oval-outer" />
      {attributeKind === 'multivalued' ? <div aria-hidden="true" className="chen-attribute-oval chen-attribute-oval-inner" /> : null}
      {isWeakKey ? <div aria-hidden="true" className="chen-attribute-weak-key" /> : null}
    </>
  );
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
    <AutoFitInput
      className="chen-title-input chen-relationship-input nodrag"
      data-autofit-mode="full"
      maxFontSize={Number(data.display.fontSize)}
      minFontSize={7}
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
  const entityKind = table?.entityKind ?? 'strong';

  return (
    <div className={`er-flow-node er-table-node er-table-node-${entityKind} ${diagnosticClass(props)} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <div className="er-table-head">
        <AutoFitInput
          className="er-node-title-input nodrag"
          maxFontSize={Number(data.display.fontSize)}
          minFontSize={9}
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
          <div className={`er-column-row ${column.diagnosticLevel ? `has-${column.diagnosticLevel}` : ''}`} data-diagnostic-level={diagnosticValue(column.diagnosticLevel)} key={column.name}>
            <span className={`er-column-badge ${column.isPrimaryKey ? 'is-pk' : column.isForeignKey ? 'is-fk' : column.keyKind === 'alternate' ? 'is-ak' : column.keyKind === 'unique' ? 'is-uk' : ''}`}>
              {column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : column.keyKind === 'alternate' ? 'AK' : column.keyKind === 'unique' ? 'UK' : ''}
            </span>
            <AutoFitInput
              className="er-column-name nodrag"
              maxFontSize={Math.max(9, Number(data.display.fontSize) - 3)}
              minFontSize={8}
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
  const entityKind = table?.entityKind ?? 'strong';

  return (
    <div className={`er-flow-node chen-flow-entity chen-flow-entity-${entityKind} ${diagnosticClass(props)} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <ChenEntityGeometry entityKind={entityKind} />
      <div className="chen-content-layer">
        <AutoFitInput
          className="chen-title-input nodrag"
          maxFontSize={Number(data.display.fontSize)}
          minFontSize={9}
          onChange={(event) => table && data.onEdit({ kind: tableEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
          onDoubleClick={stop}
          onPointerDown={stop}
          value={data.label}
        />
        {table && data.display.showComments ? <ChenMetaText>{table.name}</ChenMetaText> : null}
      </div>
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}

export function ChenAttributeNode(props: NodeProps<ErGraphNode>) {
  const { data } = props;
  const table = data.metadata.table;
  const column = data.metadata.column;
  const attributeKind = column?.attributeKind ?? 'normal';
  const isWeakKey = Boolean(column?.isWeakKey);

  return (
    <div className={`er-flow-node chen-flow-attribute chen-flow-attribute-${attributeKind} ${diagnosticClass(props)} ${column?.isPrimaryKey ? 'is-key' : ''} ${isWeakKey ? 'is-weak-key' : ''} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle" position={Position.Left} type="target" />
      <ChenAttributeGeometry attributeKind={attributeKind} isWeakKey={isWeakKey} />
      <div className="chen-content-layer">
        <AutoFitInput
          className="chen-title-input nodrag"
          maxFontSize={Number(data.display.fontSize)}
          minFontSize={9}
          onChange={(event) => table && column && data.onEdit({ columnName: column.name, kind: columnEditKind(data.display.showComments), tableName: table.name }, event.target.value)}
          onDoubleClick={stop}
          onPointerDown={stop}
          value={data.label}
        />
        {data.display.showTypes && column ? <ChenMetaText>{column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : column.dataType}</ChenMetaText> : null}
      </div>
      <Handle className="er-handle" position={Position.Right} type="source" />
    </div>
  );
}

export function ChenRelationshipNode(props: NodeProps<ErGraphNode>) {
  const { data, id } = props;
  const relationshipKind = data.metadata.relationship?.relationshipKind ?? 'nonIdentifying';

  return (
    <div className={`er-flow-node chen-flow-relationship chen-flow-relationship-${relationshipKind} ${diagnosticClass(props)} ${isActive(props) ? 'is-selected' : ''}`}>
      <Resizer {...props} />
      <Handle className="er-handle chen-relationship-handle" position={Position.Left} style={{ left: '7%' }} type="target" />
      <Handle className="er-handle chen-relationship-handle" position={Position.Top} style={{ top: '18%' }} type="target" />
      <div className="chen-relationship-shell">
        <div className="chen-relationship-diamond chen-relationship-diamond-outer">
          {relationshipKind === 'identifying' ? <div className="chen-relationship-diamond chen-relationship-diamond-inner" aria-hidden="true" /> : null}
          <div className="chen-relationship-content">
            <ChenRelationshipLabel data={data} id={id} />
          </div>
        </div>
      </div>
      <Handle className="er-handle chen-relationship-handle" position={Position.Bottom} style={{ bottom: '18%' }} type="source" />
      <Handle className="er-handle chen-relationship-handle" position={Position.Right} style={{ left: 'auto', right: '7%' }} type="source" />
    </div>
  );
}
