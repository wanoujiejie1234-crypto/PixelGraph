import type { StructureEdgeKind, StructureGraphEdge, StructureGraphNode } from './structureModel';

interface Bounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface ExportOptions {
  transparent: boolean;
}

const padding = 72;
const palette = {
  background: '#f4f5f1',
  border: '#cfd7cc',
  muted: '#647164',
  surface: '#ffffff',
};

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function nodeBounds(node: StructureGraphNode): Bounds {
  return {
    height: Number(node.height ?? node.style?.height ?? 72),
    width: Number(node.width ?? node.style?.width ?? 180),
    x: node.position.x,
    y: node.position.y,
  };
}

function graphBounds(nodes: StructureGraphNode[]): Bounds {
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

function text(value: string, x: number, y: number, className: string, extra = ''): string {
  return `<text class="${className}" x="${x}" y="${y}" ${extra}>${escapeXml(value)}</text>`;
}

function fitTextSize(value: string, baseSize: number, maxWidth: number, minSize = 9): number {
  const estimatedWidth = Array.from(value).reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 1 : 0.58), 0) * baseSize;
  if (estimatedWidth <= maxWidth) return baseSize;
  return Math.max(minSize, Math.floor(baseSize * (maxWidth / estimatedWidth) * 100) / 100);
}

function center(bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function renderNode(node: StructureGraphNode): string {
  const bounds = nodeBounds(node);
  const display = node.data.display;
  const label = String(node.data.label);
  const fontSize = fitTextSize(label, display.fontSize, bounds.width - 28, 9);
  const metadata = node.data.metadata
    ? text(String(node.data.metadata), bounds.x + 18, bounds.y + Math.min(bounds.height - 12, 48), 'pg-structure-meta', `style="font-size:${Math.max(10, display.fontSize - 3)}px"`)
    : '';

  if (['node', 'device'].includes(node.data.kind)) {
    const fill = display?.fillColor ?? palette.surface;
    const stroke = display?.strokeColor ?? '#171817';
    const d = 14;
    return `
      <g class="pg-structure-cube ${node.data.kind}">
        <polygon points="${bounds.x},${bounds.y + d} ${bounds.x + d},${bounds.y} ${bounds.x + bounds.width},${bounds.y} ${bounds.x + bounds.width - d},${bounds.y + d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="0.88" />
        <polygon points="${bounds.x + bounds.width - d},${bounds.y + d} ${bounds.x + bounds.width},${bounds.y} ${bounds.x + bounds.width},${bounds.y + bounds.height - d} ${bounds.x + bounds.width - d},${bounds.y + bounds.height}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="0.74" />
        <rect class="pg-structure-box" x="${bounds.x}" y="${bounds.y + d}" width="${bounds.width - d}" height="${bounds.height - d}" rx="3" />
        ${text('\u00AB' + node.data.kind + '\u00BB', bounds.x + 18, bounds.y + d + 18, 'pg-structure-meta', `style="font-size:${Math.max(10, display.fontSize - 3)}px"`)}
        ${text(label, bounds.x + 18, bounds.y + d + 36, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
        ${metadata}
      </g>
    `;
  }

  if (['execution'].includes(node.data.kind)) {
    const fill = display?.fillColor ?? palette.surface;
    const stroke = display?.strokeColor ?? '#171817';
    const d = 10;
    return `
      <g class="pg-structure-cube ${node.data.kind}">
        <polygon points="${bounds.x},${bounds.y + d} ${bounds.x + d},${bounds.y} ${bounds.x + bounds.width},${bounds.y} ${bounds.x + bounds.width - d},${bounds.y + d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="0.88" />
        <polygon points="${bounds.x + bounds.width - d},${bounds.y + d} ${bounds.x + bounds.width},${bounds.y} ${bounds.x + bounds.width},${bounds.y + bounds.height - d} ${bounds.x + bounds.width - d},${bounds.y + bounds.height}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" opacity="0.74" />
        <rect class="pg-structure-box" x="${bounds.x}" y="${bounds.y + d}" width="${bounds.width - d}" height="${bounds.height - d}" rx="3" />
        ${text('\u00ABexecutionEnvironment\u00BB', bounds.x + 18, bounds.y + d + 18, 'pg-structure-meta', `style="font-size:${Math.max(10, display.fontSize - 3)}px"`)}
        ${text(label, bounds.x + 18, bounds.y + d + 36, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
        ${metadata}
      </g>
    `;
  }

  if (['package', 'frame', 'folder', 'cloud', 'database'].includes(node.data.kind)) {
    return `
      <g class="pg-structure-container ${node.data.kind}">
        <rect class="pg-structure-box" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="16" />
        ${text(label, bounds.x + 18, bounds.y + 28, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
        ${metadata}
      </g>
    `;
  }

  if (node.data.kind === 'interface') {
    return `
      <g class="pg-structure-interface">
        <ellipse class="pg-structure-interface-shape" cx="${bounds.x + bounds.width / 2}" cy="${bounds.y + bounds.height / 2}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" />
        ${text(label, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 4, 'pg-structure-title', `text-anchor="middle" style="font-size:${fontSize}px"`)}
      </g>
    `;
  }

  if (node.data.kind === 'artifact') {
    return `
      <g class="pg-structure-artifact">
        <path class="pg-structure-box" d="M ${bounds.x} ${bounds.y + 8} L ${bounds.x + bounds.width - 18} ${bounds.y + 8} L ${bounds.x + bounds.width} ${bounds.y + 26} L ${bounds.x + bounds.width} ${bounds.y + bounds.height} L ${bounds.x} ${bounds.y + bounds.height} Z" />
        <path class="pg-structure-box-line" d="M ${bounds.x + bounds.width - 18} ${bounds.y + 8} L ${bounds.x + bounds.width - 18} ${bounds.y + 26} L ${bounds.x + bounds.width} ${bounds.y + 26}" />
        ${text(label, bounds.x + 18, bounds.y + 38, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
        ${metadata}
      </g>
    `;
  }

  if (node.data.kind === 'deployment-spec') {
    return `
      <g class="pg-structure-deployment-spec">
        <path class="pg-structure-box" d="M ${bounds.x} ${bounds.y + 8} L ${bounds.x + bounds.width - 18} ${bounds.y + 8} L ${bounds.x + bounds.width} ${bounds.y + 26} L ${bounds.x + bounds.width} ${bounds.y + bounds.height} L ${bounds.x} ${bounds.y + bounds.height} Z" />
        <path class="pg-structure-box-line" d="M ${bounds.x + bounds.width - 18} ${bounds.y + 8} L ${bounds.x + bounds.width - 18} ${bounds.y + 26} L ${bounds.x + bounds.width} ${bounds.y + 26}" />
        ${text('\u00ABdeploymentSpec\u00BB', bounds.x + 18, bounds.y + 22, 'pg-structure-meta', `style="font-size:${Math.max(10, display.fontSize - 3)}px"`)}
        ${text(label, bounds.x + 18, bounds.y + 38, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
        ${metadata}
      </g>
    `;
  }

  if (node.data.kind === 'note') {
    return `
      <g class="pg-structure-note">
        <path class="pg-structure-note-shape" d="M ${bounds.x} ${bounds.y} L ${bounds.x + bounds.width - 18} ${bounds.y} L ${bounds.x + bounds.width} ${bounds.y + 18} L ${bounds.x + bounds.width} ${bounds.y + bounds.height} L ${bounds.x} ${bounds.y + bounds.height} Z" />
        <path class="pg-structure-note-fold" d="M ${bounds.x + bounds.width - 18} ${bounds.y} L ${bounds.x + bounds.width - 18} ${bounds.y + 18} L ${bounds.x + bounds.width} ${bounds.y + 18}" />
        ${text(label, bounds.x + 18, bounds.y + 32, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
      </g>
    `;
  }

  return `
    <g class="pg-structure-component">
      <rect class="pg-structure-box" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="14" />
      ${text(label, bounds.x + 18, bounds.y + 34, 'pg-structure-title', `style="font-size:${fontSize}px"`)}
      ${metadata}
    </g>
  `;
}

function edgeAnchor(source: Bounds, target: Bounds): { end: { x: number; y: number }; start: { x: number; y: number } } {
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

function orthogonalPath(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const midX = start.x + (end.x - start.x) / 2;
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
}

function edgePath(start: { x: number; y: number }, end: { x: number; y: number }, style: string | undefined): string {
  if (style === 'straight') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  if (style === 'smooth') {
    const midX = start.x + (end.x - start.x) / 2;
    return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
  }
  return orthogonalPath(start, end);
}

function markerId(kind: StructureEdgeKind): string | undefined {
  if (kind === 'communication' || kind === 'note') return undefined;
  if (kind === 'realization' || kind === 'generalization') return 'structureHollowTriangle';
  if (kind === 'assembly') return 'structureSolidArrow';
  return 'structureOpenArrow';
}

function dash(kind: StructureEdgeKind, visibility?: 'private' | 'public'): string | undefined {
  if (kind === 'import' && visibility === 'private') return '3 3';
  if (kind === 'communication' || kind === 'assembly' || kind === 'note' || kind === 'generalization') return undefined;
  return '7 5';
}

function renderEdges(nodesById: Map<string, StructureGraphNode>, edges: StructureGraphEdge[]): string {
  return edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return '';
      const points = edgeAnchor(nodeBounds(source), nodeBounds(target));
      const label = edge.data?.label;
      const labelOffset = edge.data?.labelOffset ?? { x: 0, y: 0 };
      const midX = points.start.x + (points.end.x - points.start.x) / 2 + labelOffset.x;
      const midY = points.start.y + (points.end.y - points.start.y) / 2 - 8 + labelOffset.y;
      const path = edgePath(points.start, points.end, edge.data?.display.lineStyle);
      const kind = edge.data?.kind ?? 'dependency';
      const marker = markerId(kind);
      const dashed = dash(kind, edge.data?.visibility);
      return `
        <g class="pg-structure-edge">
          <path d="${path}"${marker ? ` marker-end="url(#${marker})"` : ''}${dashed ? ` stroke-dasharray="${dashed}"` : ''} />
          ${label ? text(String(label), midX, midY, 'pg-edge-label', 'text-anchor="middle"') : ''}
        </g>
      `;
    })
    .join('');
}

export function exportStructureGraphToSvg(nodes: StructureGraphNode[], edges: StructureGraphEdge[], options: ExportOptions): string {
  const display = nodes[0]?.data.display;
  const bounds = graphBounds(nodes);
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const lineColor = display?.lineColor ?? display?.strokeColor ?? '#171817';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${width} ${height}">
    <defs>
      <marker id="structureOpenArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1 1 9 5 1 9" fill="none" stroke="${lineColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
      </marker>
      <marker id="structureSolidArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1 1 9 5 1 9Z" fill="${lineColor}" stroke="${lineColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" />
      </marker>
      <marker id="structureHollowTriangle" viewBox="0 0 14 12" refX="12" refY="6" markerWidth="12" markerHeight="10" orient="auto-start-reverse">
        <path d="M1.5 1.5 12 6 1.5 10.5Z" fill="${display?.fillColor ?? palette.surface}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1.5" />
      </marker>
    </defs>
    <style>
      .pg-bg { fill: ${options.transparent ? 'transparent' : palette.background}; }
      .pg-structure-box, .pg-structure-interface-shape { fill: ${display?.fillColor ?? palette.surface}; stroke: ${display?.strokeColor ?? '#171817'}; stroke-width: 1.7; }
      .pg-structure-box-line, .pg-structure-note-fold { fill: none; stroke: ${display?.strokeColor ?? '#171817'}; stroke-width: 1.4; }
      .pg-structure-note-shape { fill: color-mix(in srgb, ${display?.fillColor ?? palette.surface} 92%, ${display?.accentColor ?? '#507c69'}); stroke: ${display?.strokeColor ?? '#171817'}; stroke-width: 1.5; }
      .pg-structure-title, .pg-structure-meta, .pg-edge-label { fill: ${display?.textColor ?? '#171817'}; font-family: "Geist", "Segoe UI", Arial, sans-serif; }
      .pg-structure-title { font-size: ${display?.fontSize ?? 15}px; font-weight: 760; }
      .pg-structure-meta { font-size: ${Math.max(10, (display?.fontSize ?? 15) - 3)}px; font-family: "Geist Mono", Consolas, monospace; opacity: 0.76; }
      .pg-edge-label { font-size: ${Math.max(10, (display?.fontSize ?? 15) - 3)}px; font-family: "Geist Mono", Consolas, monospace; }
      .pg-structure-edge path { fill: none; stroke: ${lineColor}; stroke-width: ${display?.lineWidth ?? 1.5}; }
    </style>
    <rect class="pg-bg" x="${bounds.x - padding}" y="${bounds.y - padding}" width="${width}" height="${height}" />
    ${renderEdges(nodesById, edges)}
    ${nodes.map(renderNode).join('')}
  </svg>`;
}
