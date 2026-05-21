import { estimateActivityNodeSize, type ActivityDisplaySettings, type ActivityGraphEdge, type ActivityGraphNode } from './activityModel';

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

function nodeBounds(node: ActivityGraphNode): Bounds {
  return {
    height: Number(node.style?.height ?? node.height ?? 72),
    width: Number(node.style?.width ?? node.width ?? 180),
    x: node.position.x,
    y: node.position.y,
  };
}

function graphBounds(nodes: ActivityGraphNode[]): Bounds {
  if (nodes.length === 0) return { height: 420, width: 720, x: 0, y: 0 };
  const bounds = nodes.map(nodeBounds);
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
}

function text(value: string, x: number, y: number, className: string, extra = ''): string {
  return `<text class="${className}" x="${x}" y="${y}" ${extra}>${escapeXml(value)}</text>`;
}

function center(bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function fitTextSize(value: string, baseSize: number, maxWidth: number, minSize = 9): number {
  const estimatedWidth = Array.from(value).reduce((sum, char) => sum + (/[\u3400-\u9fff]/u.test(char) ? 1 : 0.58), 0) * baseSize;
  if (estimatedWidth <= maxWidth) return baseSize;
  return Math.max(minSize, Math.floor(baseSize * (maxWidth / estimatedWidth) * 100) / 100);
}

function diamondPath(bounds: Bounds): string {
  const c = center(bounds);
  return `M ${c.x} ${bounds.y} L ${bounds.x + bounds.width} ${c.y} L ${c.x} ${bounds.y + bounds.height} L ${bounds.x} ${c.y} Z`;
}

function barPath(bounds: Bounds): string {
  return `M ${bounds.x} ${bounds.y} H ${bounds.x + bounds.width} V ${bounds.y + bounds.height} H ${bounds.x} Z`;
}

function notePath(bounds: Bounds): string {
  const fold = 16;
  return `M ${bounds.x} ${bounds.y} H ${bounds.x + bounds.width - fold} L ${bounds.x + bounds.width} ${bounds.y + fold} V ${bounds.y + bounds.height} H ${bounds.x} Z`;
}

function renderNode(node: ActivityGraphNode, display: ActivityDisplaySettings): string {
  const bounds = nodeBounds(node);
  const c = center(bounds);
  const label = String(node.data.label ?? '');
  const fontSize = fitTextSize(label, display.fontSize, bounds.width - 28, 9);
  if (node.data.kind === 'lane') {
    return `
      <g class="pg-activity-lane">
        <rect class="pg-activity-lane-box" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="10" />
        <line class="pg-activity-lane-divider" x1="${bounds.x}" y1="${bounds.y + 54}" x2="${bounds.x + bounds.width}" y2="${bounds.y + 54}" />
        ${text(label, c.x, bounds.y + 34, 'pg-activity-lane-title', 'text-anchor="middle"')}
      </g>
    `;
  }

  if (node.data.kind === 'start') {
    return `<g class="pg-activity-node"><circle class="pg-activity-start" cx="${c.x}" cy="${c.y}" r="${bounds.width / 2}" /></g>`;
  }

  if (node.data.kind === 'end') {
    const outer = bounds.width / 2;
    return `
      <g class="pg-activity-node">
        <circle class="pg-activity-end-ring" cx="${c.x}" cy="${c.y}" r="${outer}" />
        <circle class="pg-activity-end-core" cx="${c.x}" cy="${c.y}" r="${Math.max(6, outer - 5)}" />
      </g>
    `;
  }

  if (node.data.kind === 'flowFinal') {
    const outer = bounds.width / 2;
    return `
      <g class="pg-activity-node">
        <circle class="pg-activity-start" cx="${c.x}" cy="${c.y}" r="${outer}" />
        <circle class="pg-activity-flow-final-core" cx="${c.x}" cy="${c.y}" r="${Math.max(5, outer - 7)}" />
      </g>
    `;
  }

  if (node.data.kind === 'decision' || node.data.kind === 'merge') {
    return `
      <g class="pg-activity-node">
        <path class="pg-activity-decision" d="${diamondPath(bounds)}" />
        ${node.data.kind === 'merge' ? '' : text(label, c.x, c.y + 4, 'pg-activity-label', `text-anchor="middle" style="font-size:${fontSize}px"`)}
      </g>
    `;
  }

  if (node.data.kind === 'fork' || node.data.kind === 'join') {
    return `<g class="pg-activity-node"><path class="pg-activity-bar" d="${barPath(bounds)}" /></g>`;
  }

  if (node.data.kind === 'note') {
    const lines = label.split('\n');
    return `
      <g class="pg-activity-node">
        <path class="pg-activity-note" d="${notePath(bounds)}" />
        <path class="pg-activity-note-fold" d="M ${bounds.x + bounds.width - 16} ${bounds.y} V ${bounds.y + 16} H ${bounds.x + bounds.width}" />
        ${lines
          .map((line, index) =>
            text(line, bounds.x + 14, bounds.y + 22 + index * Math.max(16, display.fontSize), 'pg-activity-note-label', `style="font-size:${Math.max(11, fontSize - 1)}px"`),
          )
          .join('')}
      </g>
    `;
  }

  if (node.data.kind === 'object') {
    return `
      <g class="pg-activity-node">
        <rect class="pg-activity-object" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="6" />
        ${text(label, c.x, c.y + 5, 'pg-activity-label', `text-anchor="middle" style="font-size:${fontSize}px"`)}
      </g>
    `;
  }

  return `
    <g class="pg-activity-node">
      <rect class="pg-activity-action" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="18" />
      ${text(label, c.x, c.y + 5, 'pg-activity-label', `text-anchor="middle" style="font-size:${fontSize}px"`)}
    </g>
  `;
}

function edgePath(source: Bounds, target: Bounds): { labelX: number; labelY: number; path: string } {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const midY = sourceCenter.y + (targetCenter.y - sourceCenter.y) / 2;
  const path = `M ${sourceCenter.x} ${source.y + source.height} L ${sourceCenter.x} ${midY} L ${targetCenter.x} ${midY} L ${targetCenter.x} ${target.y}`;
  return { labelX: (sourceCenter.x + targetCenter.x) / 2, labelY: midY, path };
}

function straightPath(source: Bounds, target: Bounds): string {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  return `M ${sourceCenter.x} ${sourceCenter.y} L ${targetCenter.x} ${targetCenter.y}`;
}

function renderEdges(nodesById: Map<string, ActivityGraphNode>, edges: ActivityGraphEdge[]): string {
  return edges
    .map((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) return '';
      const edgeData = edge.data;
      const sourceBounds = nodeBounds(source);
      const targetBounds = nodeBounds(target);
      if (edgeData?.kind === 'note') {
        return `<g class="pg-activity-edge"><path class="pg-activity-note-edge" d="${straightPath(sourceBounds, targetBounds)}" /></g>`;
      }
      if (edgeData?.kind === 'object') {
        const sourceCenter = center(sourceBounds);
        const targetCenter = center(targetBounds);
        return `
          <g class="pg-activity-edge">
            <path class="pg-activity-object-edge" d="M ${sourceCenter.x} ${sourceCenter.y} L ${targetCenter.x} ${targetCenter.y}" marker-end="url(#activityOpenArrow)" />
            ${edgeData?.label ? text(String(edgeData.label), (sourceCenter.x + targetCenter.x) / 2, (sourceCenter.y + targetCenter.y) / 2 - 8, 'pg-activity-edge-label', 'text-anchor="middle"') : ''}
          </g>
        `;
      }
      const path = edgePath(sourceBounds, targetBounds);
      return `
        <g class="pg-activity-edge">
          <path class="pg-activity-control-edge" d="${path.path}" marker-end="url(#activityArrow)" />
          ${edgeData?.label ? text(String(edgeData.label), path.labelX, path.labelY - 8, 'pg-activity-edge-label', 'text-anchor="middle"') : ''}
        </g>
      `;
    })
    .join('');
}

export function exportActivityGraphToSvg(nodes: ActivityGraphNode[], edges: ActivityGraphEdge[], options: ExportOptions): string {
  const bounds = graphBounds(nodes);
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const display = (nodes.find((node) => node.data.kind !== 'lane')?.data.display ?? nodes[0]?.data.display) as ActivityDisplaySettings;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const laneNodes = nodes.filter((node) => node.data.kind === 'lane');
  const regularNodes = nodes.filter((node) => node.data.kind !== 'lane');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${width} ${height}">
    <defs>
      <marker id="activityArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1 1 9 5 1 9" fill="none" stroke="${display.strokeColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
      </marker>
      <marker id="activityOpenArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M1 1 9 5 1 9" fill="none" stroke="${display.strokeColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" />
      </marker>
    </defs>
    <style>
      .pg-bg { fill: ${options.transparent ? 'transparent' : colors.background}; }
      .pg-activity-lane-box { fill: color-mix(in srgb, ${display.fillColor} 26%, transparent); stroke: ${colors.border}; stroke-width: 1.2; }
      .pg-activity-lane-divider { stroke: ${colors.border}; stroke-width: 1; }
      .pg-activity-lane-title, .pg-activity-label, .pg-activity-edge-label, .pg-activity-note-label { fill: ${display.textColor}; font-family: "Geist", "Segoe UI", Arial, sans-serif; }
      .pg-activity-lane-title { font-size: ${display.fontSize}px; font-weight: 760; }
      .pg-activity-label { font-size: ${display.fontSize}px; font-weight: 680; }
      .pg-activity-edge-label { font-size: ${Math.max(10, display.fontSize - 3)}px; font-family: "Geist Mono", Consolas, monospace; }
      .pg-activity-action, .pg-activity-decision, .pg-activity-note { fill: ${display.fillColor}; stroke: ${display.strokeColor}; stroke-width: 1.5; }
      .pg-activity-object { fill: color-mix(in srgb, ${display.fillColor} 84%, ${colors.surface}); stroke: ${display.strokeColor}; stroke-width: 1.5; }
      .pg-activity-start, .pg-activity-end-core, .pg-activity-bar { fill: ${display.strokeColor}; stroke: ${display.strokeColor}; stroke-width: 1.5; }
      .pg-activity-end-ring { fill: ${display.fillColor}; stroke: ${display.strokeColor}; stroke-width: 1.5; }
      .pg-activity-flow-final-core { fill: ${display.fillColor}; stroke: none; }
      .pg-activity-control-edge, .pg-activity-note-edge { fill: none; stroke: ${display.strokeColor}; stroke-width: 1.5; }
      .pg-activity-object-edge { fill: none; stroke: ${display.strokeColor}; stroke-width: 1.4; stroke-dasharray: 7 5; }
      .pg-activity-note-edge { stroke-dasharray: 5 4; }
      .pg-activity-note-fold { fill: none; stroke: ${display.strokeColor}; stroke-width: 1.2; }
    </style>
    <rect class="pg-bg" x="${bounds.x - padding}" y="${bounds.y - padding}" width="${width}" height="${height}" />
    ${laneNodes.map((node) => renderNode(node, display)).join('')}
    ${renderEdges(nodesById, edges)}
    ${regularNodes.map((node) => renderNode(node, display)).join('')}
  </svg>`;
}
