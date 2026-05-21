import type { UseCaseGraphEdge, UseCaseGraphNode } from './useCaseModel';

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
const colors = {
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

function nodeBounds(node: UseCaseGraphNode): Bounds {
  return {
    height: Number(node.height ?? node.style?.height ?? 72),
    width: Number(node.width ?? node.style?.width ?? 180),
    x: node.position.x,
    y: node.position.y,
  };
}

function graphBounds(nodes: UseCaseGraphNode[]): Bounds {
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

function renderBoundary(node: UseCaseGraphNode): string {
  const bounds = nodeBounds(node);
  const display = node.data.display;
  const fontSize = fitTextSize(String(node.data.label), display.fontSize, bounds.width - 40, 10);
  return `
    <g class="pg-usecase-boundary">
      <rect class="pg-boundary-box" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="12" />
    </g>
  `;
}

function renderBoundaryTitle(node: UseCaseGraphNode): string {
  const bounds = nodeBounds(node);
  const display = node.data.display;
  const fontSize = fitTextSize(String(node.data.label), display.fontSize, bounds.width - 40, 10);
  return `
    <g class="pg-usecase-boundary-title-layer">
      ${text(String(node.data.label), bounds.x + 20, bounds.y + 28, 'pg-boundary-title', `style="font-size:${fontSize}px"`)}
    </g>
  `;
}

function renderActor(node: UseCaseGraphNode): string {
  const bounds = nodeBounds(node);
  const x = bounds.x + bounds.width / 2;
  const top = bounds.y + 10;
  const display = node.data.display;
  const fontSize = fitTextSize(String(node.data.label), Math.max(11, display.fontSize - 1), bounds.width - 4, 8);
  return `
    <g class="pg-usecase-actor">
      <circle class="pg-actor-line" cx="${x}" cy="${top + 18}" r="12" />
      <line class="pg-actor-line" x1="${x}" y1="${top + 30}" x2="${x}" y2="${top + 64}" />
      <line class="pg-actor-line" x1="${x - 22}" y1="${top + 42}" x2="${x + 22}" y2="${top + 42}" />
      <line class="pg-actor-line" x1="${x}" y1="${top + 64}" x2="${x - 18}" y2="${top + 96}" />
      <line class="pg-actor-line" x1="${x}" y1="${top + 64}" x2="${x + 18}" y2="${top + 96}" />
      ${text(String(node.data.label), x, bounds.y + bounds.height - 10, 'pg-actor-label', `text-anchor="middle" style="font-size:${fontSize}px"`)}
    </g>
  `;
}

function renderUseCase(node: UseCaseGraphNode): string {
  const bounds = nodeBounds(node);
  const c = center(bounds);
  const display = node.data.display;
  const fontSize = fitTextSize(String(node.data.label), Math.max(11, display.fontSize - 1), bounds.width - 28, 9);
  return `
    <g class="pg-usecase-node">
      <ellipse class="pg-usecase-ellipse" cx="${c.x}" cy="${c.y}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" />
      ${text(String(node.data.label), c.x, c.y + 4, 'pg-usecase-label', `text-anchor="middle" style="font-size:${fontSize}px"`)}
    </g>
  `;
}

function renderNode(node: UseCaseGraphNode): string {
  if (node.data.kind === 'systemBoundary') return renderBoundary(node);
  if (node.data.kind === 'actor') return renderActor(node);
  return renderUseCase(node);
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

function edgePath(start: { x: number; y: number }, end: { x: number; y: number }, style: string | undefined): string {
  if (style === 'straight') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

  const midX = start.x + (end.x - start.x) / 2;
  if (style === 'bezier') {
    return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
  }

  const radius = 18;
  const direction = end.x >= start.x ? 1 : -1;
  const cornerX = midX;
  const firstCornerX = cornerX - radius * direction;
  const secondCornerX = cornerX + radius * direction;
  return `M ${start.x} ${start.y} L ${firstCornerX} ${start.y} Q ${cornerX} ${start.y} ${cornerX} ${start.y + Math.sign(end.y - start.y || 1) * radius} L ${cornerX} ${end.y - Math.sign(end.y - start.y || 1) * radius} Q ${cornerX} ${end.y} ${secondCornerX} ${end.y} L ${end.x} ${end.y}`;
}

function renderEdges(nodesById: Map<string, UseCaseGraphNode>, edges: UseCaseGraphEdge[]): string {
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
      const marker =
        edge.data?.kind === 'generalization'
          ? ' marker-end="url(#hollowTriangle)"'
          : edge.data?.kind === 'association'
            ? edge.data.display.associationArrow === 'open'
              ? ' marker-end="url(#openArrow)"'
              : ''
            : ' marker-end="url(#openArrow)"';
      const dash = edge.data?.kind === 'include' || edge.data?.kind === 'extend' || edge.data?.kind === 'dependency' ? ' stroke-dasharray="7 5"' : '';
      return `
        <g class="pg-usecase-edge">
          <path d="${path}"${marker}${dash} />
          ${label ? text(String(label), midX, midY, 'pg-edge-label', 'text-anchor="middle"') : ''}
        </g>
      `;
    })
    .join('');
}

export function exportUseCaseGraphToSvg(nodes: UseCaseGraphNode[], edges: UseCaseGraphEdge[], options: ExportOptions): string {
  const display = nodes[0]?.data.display;
  const visibleNodes = nodes.filter((node) => (display?.showSystemBoundary ?? true) || node.data.kind !== 'systemBoundary');
  const bounds = graphBounds(visibleNodes);
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const lineColor = display?.lineColor ?? display?.strokeColor ?? '#171817';
  const boundaryNodes = visibleNodes.filter((node) => node.data.kind === 'systemBoundary');
  const foregroundNodes = visibleNodes.filter((node) => node.data.kind !== 'systemBoundary');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${width} ${height}">
    <defs>
      <marker id="openArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1 1 9 5 1 9" fill="none" stroke="${lineColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
      </marker>
      <marker id="hollowTriangle" viewBox="0 0 14 12" refX="12" refY="6" markerWidth="12" markerHeight="10" orient="auto-start-reverse">
        <path d="M1.5 1.5 12 6 1.5 10.5Z" fill="${display?.fillColor ?? colors.surface}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1.5" />
      </marker>
    </defs>
    <style>
      .pg-bg { fill: ${options.transparent ? 'transparent' : colors.background}; }
      .pg-boundary-box, .pg-usecase-ellipse { fill: ${display?.fillColor ?? colors.surface}; stroke: ${display?.strokeColor ?? '#171817'}; stroke-width: 1.7; }
      .pg-boundary-box { stroke-dasharray: 10 6; }
      .pg-boundary-title, .pg-usecase-label, .pg-actor-label, .pg-edge-label { fill: ${display?.textColor ?? '#171817'}; font-family: "Geist", "Segoe UI", Arial, sans-serif; }
      .pg-boundary-title { font-size: ${display?.fontSize ?? 15}px; font-weight: 760; }
      .pg-usecase-label, .pg-actor-label { font-size: ${Math.max(11, (display?.fontSize ?? 15) - 1)}px; font-weight: 680; }
      .pg-edge-label { font-size: ${Math.max(10, (display?.fontSize ?? 15) - 3)}px; font-family: "Geist Mono", Consolas, monospace; }
      .pg-actor-line { fill: none; stroke: ${display?.strokeColor ?? '#171817'}; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .pg-usecase-edge path { fill: none; stroke: ${lineColor}; stroke-width: ${display?.lineWidth ?? 1.5}; }
    </style>
    <rect class="pg-bg" x="${bounds.x - padding}" y="${bounds.y - padding}" width="${width}" height="${height}" />
    ${boundaryNodes.map(renderBoundary).join('')}
    ${renderEdges(nodesById, edges)}
    ${boundaryNodes.map(renderBoundaryTitle).join('')}
    ${foregroundNodes.map(renderNode).join('')}
  </svg>`;
}
