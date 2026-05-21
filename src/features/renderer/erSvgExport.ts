import { getNodeSize, type ErGraphEdge, type ErGraphNode } from './erGraphModel';
import { crowfootLabelPoint, crowfootPrimitives, edgeDirection } from './erCrowfoot';

interface Bounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

interface ExportOptions {
  transparent: boolean;
}

const padding = 72;
const colors = {
  background: '#f4f5f1',
  border: '#cfd7cc',
  muted: '#647164',
  surface: '#ffffff',
  surfaceSoft: '#eef2ec',
};

function displayColors(node?: ErGraphNode): { accent: string; fill: string; fontSize: number; stroke: string; text: string } {
  return {
    accent: String(node?.data.display.accentColor || '#507c69'),
    fill: String(node?.data.display.fillColor || '#ffffff'),
    fontSize: Number(node?.data.display.fontSize || 15),
    stroke: String(node?.data.display.strokeColor || '#171817'),
    text: String(node?.data.display.textColor || node?.data.display.strokeColor || '#171817'),
  };
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(value: string, max = 30): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function nodeBounds(node: ErGraphNode): Bounds {
  const size = getNodeSize(node);
  return {
    height: size.height,
    width: size.width,
    x: node.position.x,
    y: node.position.y,
  };
}

function graphBounds(nodes: ErGraphNode[]): Bounds {
  if (nodes.length === 0) return { height: 420, width: 720, x: 0, y: 0 };

  const bounds = nodes.map(nodeBounds);
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  };
}

function center(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function anchors(source: Bounds, target: Bounds): { end: Point; endSide: 'left' | 'right' | 'top' | 'bottom'; start: Point; startSide: 'left' | 'right' | 'top' | 'bottom' } {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      end: { x: dx >= 0 ? target.x : target.x + target.width, y: targetCenter.y },
      endSide: dx >= 0 ? 'left' : 'right',
      start: { x: dx >= 0 ? source.x + source.width : source.x, y: sourceCenter.y },
      startSide: dx >= 0 ? 'right' : 'left',
    };
  }

  return {
    end: { x: targetCenter.x, y: dy >= 0 ? target.y : target.y + target.height },
    endSide: dy >= 0 ? 'top' : 'bottom',
    start: { x: sourceCenter.x, y: dy >= 0 ? source.y + source.height : source.y },
    startSide: dy >= 0 ? 'bottom' : 'top',
  };
}

function edgePath(start: Point, end: Point, straight: boolean): string {
  if (straight) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  const midX = start.x + (end.x - start.x) / 2;
  return `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
}

function text(value: string, x: number, y: number, className: string, extra = ''): string {
  return `<text class="${className}" x="${x}" y="${y}" ${extra}>${escapeXml(value)}</text>`;
}

function diagnosticClass(level?: 'warning' | 'error'): string {
  return level ? ` ${level}` : '';
}

function renderDatabaseNode(node: ErGraphNode): string {
  const bounds = nodeBounds(node);
  const table = node.data.metadata.table;
  const columns = node.data.columns ?? [];
  const entityKind = table?.entityKind ?? 'strong';
  const title = truncate(node.data.label, 32);
  const subtitle = table && node.data.display.showComments ? table.name : '';
  const titleY = bounds.y + 28;
  const subtitleY = subtitle ? bounds.y + 53 : 0;
  const rowStart = bounds.y + (subtitle ? 66 : 46);

  const rows = columns
    .map((column, index) => {
      const rowY = rowStart + index * 30;
      const badge =
        column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : column.keyKind === 'alternate' ? 'AK' : column.keyKind === 'unique' ? 'UK' : '';
      const fieldLabel = truncate(node.data.display.showComments && column.comment ? column.comment : column.name, node.data.display.showTypes ? 18 : 28);
      const typeLabel = truncate(column.dataType, 16);
      return `
        <g class="pg-table-row${diagnosticClass(column.diagnosticLevel)}">
          <line class="pg-row-line" x1="${bounds.x}" x2="${bounds.x + bounds.width}" y1="${rowY}" y2="${rowY}" />
          <rect class="pg-row-highlight" x="${bounds.x}" y="${rowY}" width="${bounds.width}" height="30" />
          <rect class="pg-badge ${column.isPrimaryKey ? 'pg-pk' : column.isForeignKey ? 'pg-fk' : column.keyKind === 'alternate' ? 'pg-ak' : column.keyKind === 'unique' ? 'pg-uk' : ''}" x="${bounds.x + 10}" y="${rowY + 7}" width="26" height="16" rx="4" />
          ${badge ? text(badge, bounds.x + 23, rowY + 19, 'pg-badge-text', 'text-anchor="middle"') : ''}
          ${text(fieldLabel, bounds.x + 44, rowY + 20, 'pg-field')}
          ${node.data.display.showTypes ? text(typeLabel, bounds.x + bounds.width - 12, rowY + 20, 'pg-type', 'text-anchor="end"') : ''}
        </g>
      `;
    })
    .join('');

  const empty = columns.length === 0 ? text('Fields hidden', bounds.x + 14, rowStart + 22, 'pg-muted') : '';

  return `
    <g class="pg-table-node${diagnosticClass(node.data.diagnosticLevel)}">
      <rect class="pg-node-bg" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="8" />
      ${entityKind === 'weak' ? `<rect class="pg-node-bg pg-node-inner" x="${bounds.x + 6}" y="${bounds.y + 6}" width="${Math.max(0, bounds.width - 12)}" height="${Math.max(0, bounds.height - 12)}" rx="6" />` : ''}
      <rect class="pg-table-head" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${subtitle ? 64 : 44}" rx="8" />
      ${text(title, bounds.x + 14, titleY, 'pg-table-title')}
      ${subtitle ? text(subtitle, bounds.x + 14, subtitleY, 'pg-muted') : ''}
      ${rows}
      ${empty}
    </g>
  `;
}

function renderChenNode(node: ErGraphNode): string {
  const bounds = nodeBounds(node);
  const label = truncate(node.data.label, node.type === 'chenRelationship' ? 14 : 22);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  if (node.type === 'chenAttribute') {
    const column = node.data.metadata.column;
    const meta = node.data.display.showTypes && column ? (column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : column.dataType) : '';
    const isDerived = column?.attributeKind === 'derived';
    const isMulti = column?.attributeKind === 'multivalued';
    const labelY = meta ? centerY - 4 : centerY + 5;
    return `
      <g class="pg-chen-node${diagnosticClass(node.data.diagnosticLevel)}">
        <ellipse class="pg-chen-attribute ${column?.isPrimaryKey ? 'pg-key' : ''} ${isDerived ? 'pg-derived' : ''}" cx="${centerX}" cy="${centerY}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" />
        ${isMulti ? `<ellipse class="pg-chen-attribute ${isDerived ? 'pg-derived' : ''}" cx="${centerX}" cy="${centerY}" rx="${Math.max(0, bounds.width / 2 - 6)}" ry="${Math.max(0, bounds.height / 2 - 6)}" />` : ''}
        ${column?.isWeakKey ? `<line class="pg-chen-weak-key" x1="${bounds.x + bounds.width * 0.18}" x2="${bounds.x + bounds.width * 0.82}" y1="${centerY + 12}" y2="${centerY + 12}" />` : ''}
        ${text(label, centerX, labelY, 'pg-chen-label', 'text-anchor="middle"')}
        ${meta ? text(truncate(meta, 18), centerX, centerY + 15, 'pg-muted', 'text-anchor="middle"') : ''}
      </g>
    `;
  }

  if (node.type === 'chenRelationship') {
    const points = `${centerX},${bounds.y + bounds.height * 0.28} ${bounds.x + bounds.width - 5},${centerY} ${centerX},${bounds.y + bounds.height * 0.72} ${bounds.x + 5},${centerY}`;
    const relationshipKind = node.data.metadata.relationship?.relationshipKind ?? 'nonIdentifying';
    const innerPoints = `${centerX},${bounds.y + bounds.height * 0.39} ${bounds.x + bounds.width - 30},${centerY} ${centerX},${bounds.y + bounds.height * 0.61} ${bounds.x + 30},${centerY}`;
    return `
      <g class="pg-chen-node${diagnosticClass(node.data.diagnosticLevel)}">
        <polygon class="pg-chen-relationship" points="${points}" />
        ${relationshipKind === 'identifying' ? `<polygon class="pg-chen-relationship pg-chen-relationship-inner" points="${innerPoints}" />` : ''}
        ${text(label, centerX, centerY + 5, 'pg-chen-label', 'text-anchor="middle"')}
      </g>
    `;
  }

  const table = node.data.metadata.table;
  const meta = table && node.data.display.showComments ? table.name : '';
  const entityKind = table?.entityKind ?? 'strong';
  const labelY = meta ? centerY - 5 : centerY + 5;
  return `
    <g class="pg-chen-node${diagnosticClass(node.data.diagnosticLevel)}">
      <rect class="pg-chen-entity" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />
      ${entityKind === 'weak' ? `<rect class="pg-chen-entity pg-chen-entity-inner" x="${bounds.x + 7}" y="${bounds.y + 7}" width="${Math.max(0, bounds.width - 14)}" height="${Math.max(0, bounds.height - 14)}" />` : ''}
      ${entityKind === 'associative' ? `<line class="pg-chen-associative" x1="${bounds.x + 12}" x2="${bounds.x + bounds.width - 12}" y1="${centerY}" y2="${centerY}" />` : ''}
      ${text(label, centerX, labelY, 'pg-chen-label', 'text-anchor="middle"')}
      ${meta ? text(truncate(meta, 18), centerX, centerY + 17, 'pg-muted', 'text-anchor="middle"') : ''}
    </g>
  `;
}

function renderNode(node: ErGraphNode): string {
  return node.type === 'databaseTable' ? renderDatabaseNode(node) : renderChenNode(node);
}

function labelPoint(start: Point, end: Point, labelOffset?: { x: number; y: number }, hasCustomOffset?: boolean): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const sideOffset = hasCustomOffset ? { x: 0, y: 0 } : { x: (-dy / length) * 16, y: (dx / length) * 16 };
  return {
    x: start.x + (end.x - start.x) / 2 + (labelOffset?.x ?? 0) + sideOffset.x,
    y: start.y + (end.y - start.y) / 2 - 8 + (labelOffset?.y ?? 0) + sideOffset.y,
  };
}

function renderCrowfootEndpoint(point: Point, direction: { x: number; y: number }, cardinality: string | undefined): string {
  return crowfootPrimitives(point, direction, cardinality)
    .map((primitive) =>
      primitive.type === 'circle'
        ? `<circle class="pg-crowfoot-circle" cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}" />`
        : `<line class="pg-crowfoot-line" x1="${primitive.start.x}" y1="${primitive.start.y}" x2="${primitive.end.x}" y2="${primitive.end.y}" />`,
    )
    .join('');
}

function renderStandardEdge(edge: ErGraphEdge, start: Point, end: Point, path: string, straight: boolean): string {
  const label = edge.data?.label !== undefined ? String(edge.data.label) : edge.label ? String(edge.label) : '';
  const hasCustomOffset = Boolean(edge.data?.labelOffset);
  const labelOffset = edge.data?.labelOffset ?? { x: 0, y: 0 };
  const labelAnchor = labelPoint(start, end, labelOffset, hasCustomOffset);
  const level = edge.data?.diagnosticLevel;
  const relationshipKind = edge.data?.relationshipKind ?? 'identifying';

  return `
    <g class="pg-edge${diagnosticClass(level)} ${relationshipKind === 'nonIdentifying' ? 'pg-edge-dashed' : ''}">
      <path d="${path}" />
      ${label ? text(truncate(label, 18), labelAnchor.x, labelAnchor.y, 'pg-edge-label', 'text-anchor="middle"') : ''}
    </g>
  `;
}

function renderCrowfootEdge(edge: ErGraphEdge, start: Point, startSide: 'left' | 'right' | 'top' | 'bottom', end: Point, endSide: 'left' | 'right' | 'top' | 'bottom', path: string): string {
  const [fromCardinality = '1', toCardinality = 'N'] = String(edge.data?.cardinality ?? '1:N').split(':');
  const label = edge.data?.label ? truncate(String(edge.data.label), 18) : '';
  const constraintLabel = edge.data?.display.showConstraints && edge.data?.constraintText ? truncate(String(edge.data.constraintText), 24) : '';
  const fromDirection = edgeDirection(startSide, { x: end.x - start.x, y: end.y - start.y });
  const toDirection = edgeDirection(endSide, { x: start.x - end.x, y: start.y - end.y });
  const fromRolePoint = crowfootLabelPoint(start, fromDirection, 'from');
  const toRolePoint = crowfootLabelPoint(end, toDirection, 'to');
  const hasCustomOffset = Boolean(edge.data?.labelOffset);
  const labelOffset = edge.data?.labelOffset ?? { x: 0, y: 0 };
  const labelAnchor = labelPoint(start, end, labelOffset, hasCustomOffset);
  const level = edge.data?.diagnosticLevel;
  const relationshipKind = edge.data?.relationshipKind ?? 'nonIdentifying';

  return `
    <g class="pg-edge pg-crowfoot-edge${diagnosticClass(level)} ${relationshipKind === 'nonIdentifying' ? 'pg-edge-dashed' : ''}">
      <path d="${path}" />
      ${renderCrowfootEndpoint(start, fromDirection, fromCardinality)}
      ${renderCrowfootEndpoint(end, toDirection, toCardinality)}
      ${edge.data?.display.showRelationshipRoles && edge.data?.roleFrom ? text(truncate(String(edge.data.roleFrom), 18), fromRolePoint.x, fromRolePoint.y, 'pg-edge-role', 'text-anchor="middle"') : ''}
      ${label ? text(label, labelAnchor.x, labelAnchor.y, 'pg-edge-label', 'text-anchor="middle"') : ''}
      ${constraintLabel ? text(constraintLabel, labelAnchor.x, labelAnchor.y + 18, 'pg-edge-constraint', 'text-anchor="middle"') : ''}
      ${edge.data?.display.showRelationshipRoles && edge.data?.roleTo ? text(truncate(String(edge.data.roleTo), 18), toRolePoint.x, toRolePoint.y, 'pg-edge-role', 'text-anchor="middle"') : ''}
    </g>
  `;
}

function renderEdges(nodesById: Map<string, ErGraphNode>, edges: ErGraphEdge[]): string {
  return edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return '';

      const points = anchors(nodeBounds(source), nodeBounds(target));
      const straight = edge.type === 'straight';
      const path = edgePath(points.start, points.end, straight);
      if (edge.type === 'crowFootEr') return renderCrowfootEdge(edge, points.start, points.startSide, points.end, points.endSide, path);
      return renderStandardEdge(edge, points.start, points.end, path, straight);
    })
    .join('');
}

export function exportErGraphToSvg(nodes: ErGraphNode[], edges: ErGraphEdge[], options: ExportOptions): string {
  const bounds = graphBounds(nodes);
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const offsetX = padding - bounds.x;
  const offsetY = padding - bounds.y;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const exportColors = displayColors(nodes[0]);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
      .pg-bg { fill: ${options.transparent ? 'transparent' : colors.background}; }
      .pg-grid { fill: none; stroke: ${colors.border}; stroke-width: 1; opacity: 0.42; }
      .pg-node-bg, .pg-chen-entity, .pg-chen-attribute, .pg-chen-relationship {
        fill: ${exportColors.fill};
        stroke: ${exportColors.stroke};
        stroke-width: 1.6;
      }
      .pg-node-bg { filter: drop-shadow(0 12px 18px rgba(37,44,38,0.10)); }
      .pg-table-head { fill: ${colors.surfaceSoft}; stroke: none; }
      .pg-row-line { stroke: ${colors.border}; stroke-width: 1; opacity: 0.72; }
      .pg-row-highlight { fill: transparent; }
      .pg-table-row.warning .pg-row-highlight { fill: rgba(185,121,35,0.10); }
      .pg-table-row.error .pg-row-highlight { fill: rgba(154,61,50,0.12); }
      .pg-badge { fill: transparent; }
      .pg-badge.pg-pk { fill: #e4f0e8; }
      .pg-badge.pg-fk { fill: #edf0ec; }
      .pg-badge.pg-ak { fill: #f0ebdf; }
      .pg-badge.pg-uk { fill: #ecefe8; }
      .pg-badge-text, .pg-table-title, .pg-field, .pg-type, .pg-muted, .pg-chen-label, .pg-edge-label, .pg-edge-role, .pg-edge-constraint { font-family: "Geist", "Segoe UI", Arial, sans-serif; }
      .pg-table-title { fill: ${exportColors.text}; font-size: ${exportColors.fontSize}px; font-weight: 760; }
      .pg-field { fill: ${exportColors.text}; font-size: ${Math.max(10, exportColors.fontSize - 3)}px; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
      .pg-type, .pg-muted, .pg-edge-role, .pg-edge-constraint { fill: ${colors.muted}; font-size: ${Math.max(9, exportColors.fontSize - 5)}px; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
      .pg-badge-text { fill: ${exportColors.accent}; font-size: ${Math.max(8, exportColors.fontSize - 6)}px; font-weight: 800; }
      .pg-chen-entity { stroke: ${exportColors.stroke}; }
      .pg-chen-entity-inner, .pg-chen-relationship-inner { fill: none; }
      .pg-chen-associative { stroke: ${exportColors.accent}; stroke-width: 1.8; stroke-dasharray: 5 4; }
      .pg-chen-attribute { stroke: ${exportColors.accent}; fill: ${exportColors.fill}; }
      .pg-chen-attribute.pg-key { stroke-width: 2.2; }
      .pg-chen-attribute.pg-derived { stroke-dasharray: 5 4; }
      .pg-chen-weak-key { stroke: ${exportColors.accent}; stroke-width: 1.6; }
      .pg-chen-relationship { fill: color-mix(in srgb, ${exportColors.accent} 14%, ${exportColors.fill}); stroke: ${exportColors.accent}; stroke-width: 2; }
      .pg-chen-label { fill: ${exportColors.text}; font-size: ${Math.max(11, exportColors.fontSize - 1)}px; font-weight: 760; }
      .pg-edge path, .pg-crowfoot-line, .pg-crowfoot-circle { fill: none; stroke: #66716a; stroke-width: 1.6; }
      .pg-crowfoot-circle { fill: ${exportColors.fill}; }
      .pg-edge.warning path, .pg-edge.warning .pg-crowfoot-line, .pg-edge.warning .pg-crowfoot-circle { stroke: #b97923; }
      .pg-edge.error path, .pg-edge.error .pg-crowfoot-line, .pg-edge.error .pg-crowfoot-circle { stroke: #9a3d32; }
      .pg-edge-dashed path { stroke-dasharray: 7 5; }
      .pg-edge-label { fill: ${exportColors.text}; font-size: ${Math.max(9, exportColors.fontSize - 5)}px; font-weight: 760; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
      .pg-table-node.warning .pg-node-bg, .pg-chen-node.warning .pg-chen-entity, .pg-chen-node.warning .pg-chen-attribute, .pg-chen-node.warning .pg-chen-relationship { stroke: #b97923; }
      .pg-table-node.error .pg-node-bg, .pg-chen-node.error .pg-chen-entity, .pg-chen-node.error .pg-chen-attribute, .pg-chen-node.error .pg-chen-relationship { stroke: #9a3d32; }
    </style>
    <rect class="pg-bg" width="${width}" height="${height}" />
    <defs>
      <pattern id="pg-grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path class="pg-grid" d="M 28 0 L 0 0 0 28" />
      </pattern>
    </defs>
    ${options.transparent ? '' : `<rect width="${width}" height="${height}" fill="url(#pg-grid)" />`}
    <g transform="translate(${offsetX} ${offsetY})">
      ${renderEdges(nodesById, edges)}
      ${nodes.map(renderNode).join('')}
    </g>
  </svg>`;
}
