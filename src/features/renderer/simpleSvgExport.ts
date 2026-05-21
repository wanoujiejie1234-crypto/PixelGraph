import { SEQUENCE_MESSAGE_START_Y, SEQUENCE_MESSAGE_STEP, type SimpleGraphEdge, type SimpleGraphNode } from './simpleCanvasModel';

interface ExportOptions {
  transparent?: boolean;
}

function bounds(node: SimpleGraphNode): { height: number; width: number; x: number; y: number } {
  return {
    height: Number(node.height ?? node.style?.height ?? 80),
    width: Number(node.width ?? node.style?.width ?? 180),
    x: node.position.x,
    y: node.position.y,
  };
}

function escape(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
}

function text(value: string, x: number, y: number, className: string, extra = ''): string {
  return `<text class="${className}" x="${x}" y="${y}" ${extra}>${escape(value)}</text>`;
}

function renderClassMemberSvg(member: { visibility: string; name: string; type: string; parameters?: string; isMethod: boolean; isAbstract: boolean; isStatic: boolean }, x: number, y: number): string {
  const visSymbols: Record<string, string> = {
    '+': '\u25CB',
    '-': '\u25A1',
    '#': '\u25C6',
    '~': '\u25C7',
  };
  const vis = visSymbols[member.visibility] ?? '';
  const namePart = member.isAbstract ? `<tspan font-style="italic">${escape(member.name)}</tspan>` : escape(member.name);
  const paramsPart = member.parameters ? `(${escape(member.parameters)})` : member.isMethod ? '()' : '';
  const typePart = member.type ? `: ${escape(member.type)}` : '';
  const staticAttr = member.isStatic ? ' text-decoration="underline" text-underline-offset="2"' : '';
  return text(`${vis} ${namePart}${paramsPart}${typePart}`, x, y, 'pg-simple-meta', staticAttr);
}

function renderNode(node: SimpleGraphNode): string {
  const b = bounds(node);
  const label = String(node.data.label ?? '');
  if (node.data.kind === 'initial') return `<circle class="pg-simple-initial" cx="${b.x + b.width / 2}" cy="${b.y + b.height / 2}" r="${Math.min(b.width, b.height) / 2}" />`;
  if (node.data.kind === 'final') {
    const r = Math.min(b.width, b.height) / 2;
    return `<g><circle class="pg-simple-final-ring" cx="${b.x + b.width / 2}" cy="${b.y + b.height / 2}" r="${r}" /><circle class="pg-simple-initial" cx="${b.x + b.width / 2}" cy="${b.y + b.height / 2}" r="${Math.max(5, r - 7)}" /></g>`;
  }
  if (node.data.kind === 'choice') {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return `<g><path class="pg-simple-box" d="M ${cx} ${b.y} L ${b.x + b.width} ${cy} L ${cx} ${b.y + b.height} L ${b.x} ${cy} Z" />${text(label, cx, cy + 4, 'pg-simple-title', 'text-anchor="middle"')}</g>`;
  }
  if (node.data.kind === 'lifeline') {
    const cx = b.x + b.width / 2;
    return `<g><rect class="pg-simple-box" x="${b.x}" y="${b.y}" width="${b.width}" height="52" rx="6" />${text(label, cx, b.y + 32, 'pg-simple-title', 'text-anchor="middle"')}<line class="pg-simple-dashed" x1="${cx}" x2="${cx}" y1="${b.y + 52}" y2="${b.y + b.height}" /></g>`;
  }

  // Class-like nodes with structured members
  const members = node.data.members ?? [];
  if (members.length > 0) {
    const fields = members.filter((m: { isMethod: boolean }) => !m.isMethod);
    const methods = members.filter((m: { isMethod: boolean }) => m.isMethod);
    const headHeight = 48;
    const rowHeight = 20;
    const sectionPad = 10;
    const sepHeight = fields.length > 0 && methods.length > 0 ? 1 : 0;
    const fieldsHeight = fields.length > 0 ? fields.length * rowHeight + sectionPad : 0;
    const methodsHeight = methods.length > 0 ? methods.length * rowHeight + sectionPad : 0;
    const totalBody = fieldsHeight + sepHeight + methodsHeight;
    const totalHeight = headHeight + totalBody;

    let svg = `<g>`;
    svg += `<rect class="pg-simple-box" x="${b.x}" y="${b.y}" width="${b.width}" height="${totalHeight}" rx="6" />`;

    // Head section
    if (node.data.stereotype) {
      svg += text(`\u00AB${node.data.stereotype}\u00BB`, b.x + b.width / 2, b.y + 18, 'pg-simple-meta', 'text-anchor="middle"');
      svg += text(label, b.x + b.width / 2, b.y + 38, 'pg-simple-title', 'text-anchor="middle"');
    } else {
      svg += text(label, b.x + b.width / 2, b.y + 30, 'pg-simple-title', 'text-anchor="middle"');
    }

    let currentY = b.y + headHeight;

    // Fields section
    if (fields.length > 0) {
      currentY += 6;
      for (const f of fields) {
        svg += renderClassMemberSvg(f, b.x + 14, currentY);
        currentY += rowHeight;
      }
    }

    // Separator
    if (fields.length > 0 && methods.length > 0) {
      svg += `<line x1="${b.x + 8}" y1="${currentY}" x2="${b.x + b.width - 8}" y2="${currentY}" stroke="currentColor" stroke-width="1" opacity="0.35" />`;
    }

    // Methods section
    if (methods.length > 0) {
      currentY += 4;
      for (const m of methods) {
        svg += renderClassMemberSvg(m, b.x + 14, currentY);
        currentY += rowHeight;
      }
    }

    svg += `</g>`;
    return svg;
  }

  // Composite state container: render as bordered box with header
  const childIds = node.data.childIds as string[] | undefined;
  if (childIds?.length) {
    return `<g><rect class="pg-simple-box" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="8" fill="none" stroke-dasharray="8 6" /><line x1="${b.x}" x2="${b.x + b.width}" y1="${b.y + 48}" y2="${b.y + 48}" stroke="currentColor" stroke-width="1" opacity="0.3" stroke-dasharray="4 4" />${text(label, b.x + b.width / 2, b.y + 30, 'pg-simple-title', 'text-anchor="middle"')}</g>`;
  }

  // Fallback: flat rendering for state nodes and legacy
  const rows = node.data.details ?? [];
  return `<g><rect class="pg-simple-box" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="6" />${node.data.stereotype ? text(`<<${node.data.stereotype}>>`, b.x + b.width / 2, b.y + 18, 'pg-simple-meta', 'text-anchor="middle"') : ''}${text(label, b.x + b.width / 2, b.y + (node.data.stereotype ? 38 : 28), 'pg-simple-title', 'text-anchor="middle"')}${rows.map((row, index) => text(String(row), b.x + 14, b.y + 62 + index * 20, 'pg-simple-meta')).join('')}</g>`;
}

/** Map internal marker IDs to SVG export marker IDs. */
function svgMarkerId(marker: string): string {
  if (marker === 'pg-hollow-triangle') return 'hollowTriangle';
  if (marker === 'pg-solid-diamond') return 'solidDiamond';
  if (marker === 'pg-hollow-diamond') return 'hollowDiamond';
  if (marker === 'pg-open-arrow') return 'openArrow';
  if (marker === 'pg-structure-solid-arrow') return 'syncArrow';
  return 'openArrow';
}

function markerAttr(startMarker?: string, endMarker?: string): string {
  let attr = '';
  if (startMarker) attr += ` marker-start="url(#${svgMarkerId(startMarker)})"`;
  if (endMarker) attr += ` marker-end="url(#${svgMarkerId(endMarker)})"`;
  return attr;
}

export function exportSimpleGraphToSvg(nodes: SimpleGraphNode[], edges: SimpleGraphEdge[], options: ExportOptions = {}): string {
  const allBounds = nodes.map(bounds);
  const isSequence = nodes.some((n) => n.data?.kind === 'lifeline');
  let minY = Math.min(0, ...allBounds.map((b) => b.y)) - 60;
  const minX = Math.min(0, ...allBounds.map((b) => b.x)) - 60;
  let maxY = Math.max(300, ...allBounds.map((b) => b.y + b.height)) + 60;
  let maxX = Math.max(400, ...allBounds.map((b) => b.x + b.width)) + 60;

  if (isSequence) {
    const seqMinY = edges.reduce((acc, e) => {
      const idx = e.data?.sequenceIndex;
      if (idx === undefined) return acc;
      return Math.min(acc, SEQUENCE_MESSAGE_START_Y + idx * SEQUENCE_MESSAGE_STEP - 40);
    }, Infinity);
    const seqMaxY = edges.reduce((acc, e) => {
      const idx = e.data?.sequenceIndex;
      if (idx === undefined) return acc;
      return Math.max(acc, SEQUENCE_MESSAGE_START_Y + idx * SEQUENCE_MESSAGE_STEP + 40);
    }, -Infinity);
    if (Number.isFinite(seqMinY)) minY = Math.min(minY, seqMinY);
    if (Number.isFinite(seqMaxY)) maxY = Math.max(maxY, seqMaxY);
  }
  const display = nodes[0]?.data.display ?? edges[0]?.data?.display;
  const lineColor = display?.lineColor ?? display?.strokeColor ?? '#171817';
  const fill = display?.fillColor ?? '#ffffff';
  const textColor = display?.textColor ?? '#171817';

  const nodeMap = new Map(nodes.map((node) => [node.id, bounds(node)]));
  const edgeMarkup = edges
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return '';
      const sx = source.x + source.width / 2;
      const tx = target.x + target.width / 2;
      const seqIndex = edge.data?.sequenceIndex;
      const sy = seqIndex !== undefined ? SEQUENCE_MESSAGE_START_Y + seqIndex * SEQUENCE_MESSAGE_STEP : source.y + source.height / 2;
      const ty = seqIndex !== undefined ? sy : target.y + target.height / 2;
      const dash = edge.data?.kind === 'dependency' || edge.data?.kind === 'realization' || edge.data?.kind === 'reply' ? ' stroke-dasharray="7 5"' : '';
      const isSelf = seqIndex !== undefined && Math.abs(sx - tx) < 1;
      let pathD: string;
      let labelX: number;
      let labelY: number;
      if (isSelf) {
        const w = 36;
        const h = 28;
        pathD = `M ${sx} ${sy} L ${sx + w} ${sy} L ${sx + w} ${sy + h} L ${sx} ${sy + h}`;
        labelX = sx + w + 16;
        labelY = sy + h / 2;
      } else {
        pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
        labelX = (sx + tx) / 2;
        labelY = sy - 8;
      }
      const sequenceNumber = edge.data?.sequenceNumber ? String(edge.data.sequenceNumber) : '';
      const labelText = edge.data?.label ? String(edge.data.label) : '';
      const numberedLabel = sequenceNumber && labelText ? `${sequenceNumber} ${labelText}` : sequenceNumber || labelText;
      const srcCard = edge.data?.sourceCardinality ? String(edge.data.sourceCardinality) : '';
      const tgtCard = edge.data?.targetCardinality ? String(edge.data.targetCardinality) : '';
      const srcCardMarkup = srcCard ? text(srcCard, sx - 12, sy + 14, 'pg-simple-meta', 'text-anchor="end" font-size="11"') : '';
      const tgtCardMarkup = tgtCard ? text(tgtCard, tx + 12, ty + 14, 'pg-simple-meta', 'text-anchor="start" font-size="11"') : '';
      return `<g><path d="${pathD}"${markerAttr(edge.data?.startMarker, edge.data?.endMarker)}${dash} />${numberedLabel ? text(numberedLabel, labelX, labelY, 'pg-simple-meta', 'text-anchor="middle"') : ''}${srcCardMarkup}${tgtCardMarkup}</g>`;
    })
    .join('');

  const syncArrowDef = isSequence
    ? `<marker id="syncArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1 1 9 5 1 9Z" fill="${lineColor}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1.2" /></marker>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX - minX}" height="${maxY - minY}" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">
    <defs>
      <marker id="openArrow" viewBox="0 0 14 14" refX="12" refY="7" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M1 1 12 7 1 13" fill="none" stroke="${lineColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></marker>
      <marker id="hollowTriangle" viewBox="0 0 22 18" refX="18" refY="9" markerWidth="18" markerHeight="16" orient="auto-start-reverse"><path d="M2 2 19 9 2 16Z" fill="${fill}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1.8" /></marker>
      <marker id="solidDiamond" viewBox="0 0 18 18" refX="15" refY="9" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M3 9 9 3 15 9 9 15Z" fill="${lineColor}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1" /></marker>
      <marker id="hollowDiamond" viewBox="0 0 18 18" refX="15" refY="9" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M3 9 9 3 15 9 9 15Z" fill="${fill}" stroke="${lineColor}" stroke-linejoin="round" stroke-width="1.8" /></marker>
      ${syncArrowDef}
    <style>
      .pg-simple-box,.pg-simple-final-ring{fill:${fill};stroke:${display?.strokeColor ?? lineColor};stroke-width:1.5}
      .pg-simple-initial{fill:${display?.strokeColor ?? lineColor};stroke:${display?.strokeColor ?? lineColor};stroke-width:1.5}
      .pg-simple-title{fill:${textColor};font-family:"Geist","Segoe UI",Arial,sans-serif;font-size:${display?.fontSize ?? 15}px;font-weight:720}
      .pg-simple-meta{fill:${textColor};font-family:"Geist Mono",Consolas,monospace;font-size:${Math.max(10, (display?.fontSize ?? 15) - 3)}px}
      .pg-simple-dashed{stroke:${lineColor};stroke-width:1.2;stroke-dasharray:7 6}
      path{fill:none;stroke:${lineColor};stroke-width:${display?.lineWidth ?? 1.5}}
    </style>
    ${options.transparent ? '' : `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="${fill}" opacity="0.18" />`}
    ${edgeMarkup}
    ${nodes.map(renderNode).join('')}
  </svg>`;
}
