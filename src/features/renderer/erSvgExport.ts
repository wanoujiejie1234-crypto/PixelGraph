import { getNodeSize, type ErGraphEdge, type ErGraphNode } from './erGraphModel';

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

function displayColors(node?: ErGraphNode): { accent: string; fill: string; stroke: string } {
  return {
    accent: String(node?.data.display.accentColor || '#507c69'),
    fill: String(node?.data.display.fillColor || '#ffffff'),
    stroke: String(node?.data.display.strokeColor || '#171817'),
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

function anchors(source: Bounds, target: Bounds): { end: Point; start: Point } {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      end: { x: dx >= 0 ? target.x : target.x + target.width, y: targetCenter.y },
      start: { x: dx >= 0 ? source.x + source.width : source.x, y: sourceCenter.y },
    };
  }

  return {
    end: { x: targetCenter.x, y: dy >= 0 ? target.y : target.y + target.height },
    start: { x: sourceCenter.x, y: dy >= 0 ? source.y + source.height : source.y },
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

function renderDatabaseNode(node: ErGraphNode): string {
  const bounds = nodeBounds(node);
  const table = node.data.metadata.table;
  const columns = node.data.columns ?? [];
  const title = truncate(node.data.label, 32);
  const subtitle = table && node.data.display.showComments ? table.name : '';
  const titleY = bounds.y + 28;
  const subtitleY = subtitle ? bounds.y + 53 : 0;
  const rowStart = bounds.y + (subtitle ? 66 : 46);

  const rows = columns
    .map((column, index) => {
      const rowY = rowStart + index * 30;
      const badge = column.isPrimaryKey ? 'PK' : column.isForeignKey ? 'FK' : '';
      const fieldLabel = truncate(node.data.display.showComments && column.comment ? column.comment : column.name, node.data.display.showTypes ? 18 : 28);
      const typeLabel = truncate(column.dataType, 16);
      return `
        <line class="pg-row-line" x1="${bounds.x}" x2="${bounds.x + bounds.width}" y1="${rowY}" y2="${rowY}" />
        <rect class="pg-badge ${column.isPrimaryKey ? 'pg-pk' : column.isForeignKey ? 'pg-fk' : ''}" x="${bounds.x + 10}" y="${rowY + 7}" width="26" height="16" rx="4" />
        ${badge ? text(badge, bounds.x + 23, rowY + 19, 'pg-badge-text', 'text-anchor="middle"') : ''}
        ${text(fieldLabel, bounds.x + 44, rowY + 20, 'pg-field')}
        ${node.data.display.showTypes ? text(typeLabel, bounds.x + bounds.width - 12, rowY + 20, 'pg-type', 'text-anchor="end"') : ''}
      `;
    })
    .join('');

  const empty = columns.length === 0 ? text('Fields hidden', bounds.x + 14, rowStart + 22, 'pg-muted') : '';

  return `
    <g class="pg-table-node">
      <rect class="pg-node-bg" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="8" />
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
    return `
      <g class="pg-chen-node">
        <ellipse class="pg-chen-attribute ${column?.isPrimaryKey ? 'pg-key' : ''}" cx="${centerX}" cy="${centerY}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" />
        ${text(label, centerX, centerY - (meta ? 3 : -4), 'pg-chen-label', 'text-anchor="middle"')}
        ${meta ? text(truncate(meta, 18), centerX, centerY + 15, 'pg-muted', 'text-anchor="middle"') : ''}
      </g>
    `;
  }

  if (node.type === 'chenRelationship') {
    const points = `${centerX},${bounds.y} ${bounds.x + bounds.width},${centerY} ${centerX},${bounds.y + bounds.height} ${bounds.x},${centerY}`;
    return `
      <g class="pg-chen-node">
        <polygon class="pg-chen-relationship" points="${points}" />
        ${text(label, centerX, centerY + 4, 'pg-chen-label', 'text-anchor="middle"')}
      </g>
    `;
  }

  const table = node.data.metadata.table;
  const meta = table && node.data.display.showComments ? table.name : '';
  return `
    <g class="pg-chen-node">
      <rect class="pg-chen-entity" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />
      ${text(label, centerX, centerY - (meta ? 4 : -5), 'pg-chen-label', 'text-anchor="middle"')}
      ${meta ? text(truncate(meta, 18), centerX, centerY + 17, 'pg-muted', 'text-anchor="middle"') : ''}
    </g>
  `;
}

function renderNode(node: ErGraphNode): string {
  return node.type === 'databaseTable' ? renderDatabaseNode(node) : renderChenNode(node);
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
      const label = edge.label ? String(edge.label) : '';
      const labelPoint = {
        x: points.start.x + (points.end.x - points.start.x) / 2,
        y: points.start.y + (points.end.y - points.start.y) / 2 - 8,
      };

      return `
        <g class="pg-edge">
          <path d="${path}" />
          ${label ? `<rect class="pg-edge-label-bg" x="${labelPoint.x - 56}" y="${labelPoint.y - 14}" width="112" height="20" rx="5" />` : ''}
          ${label ? text(truncate(label, 18), labelPoint.x, labelPoint.y, 'pg-edge-label', 'text-anchor="middle"') : ''}
        </g>
      `;
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
      .pg-badge { fill: transparent; }
      .pg-badge.pg-pk { fill: #e4f0e8; }
      .pg-badge.pg-fk { fill: #edf0ec; }
      .pg-badge-text, .pg-table-title, .pg-field, .pg-type, .pg-muted, .pg-chen-label, .pg-edge-label { font-family: "Geist", "Segoe UI", Arial, sans-serif; }
      .pg-table-title { fill: ${exportColors.stroke}; font-size: 15px; font-weight: 760; }
      .pg-field { fill: ${exportColors.stroke}; font-size: 12px; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
      .pg-type, .pg-muted { fill: ${colors.muted}; font-size: 10px; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
      .pg-badge-text { fill: ${exportColors.accent}; font-size: 9px; font-weight: 800; }
      .pg-chen-attribute { stroke: ${exportColors.accent}; fill: ${exportColors.fill}; }
      .pg-chen-attribute.pg-key { stroke-width: 2.2; }
      .pg-chen-relationship { fill: ${exportColors.fill}; stroke: ${exportColors.accent}; stroke-width: 2; }
      .pg-chen-label { fill: ${exportColors.stroke}; font-size: 13px; font-weight: 760; }
      .pg-edge path { fill: none; stroke: #66716a; stroke-width: 1.35; }
      .pg-edge-label-bg { fill: ${colors.surface}; opacity: 0.92; }
      .pg-edge-label { fill: ${colors.muted}; font-size: 10px; font-weight: 760; font-family: "Geist Mono", "SFMono-Regular", Consolas, monospace; }
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
