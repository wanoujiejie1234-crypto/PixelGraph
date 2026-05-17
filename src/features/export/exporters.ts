export type ExportFormat = 'SVG' | 'PNG' | 'Markdown';

export interface PngExportOptions {
  scale: number;
  transparent: boolean;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/gu, '-').slice(0, 19);
}

function getFilename(extension: string): string {
  return `pixelgraph-diagram-${getTimestamp()}.${extension}`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getSvgSize(svg: string): { width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  const width = Number.parseFloat(root.getAttribute('width') ?? '1200');
  const height = Number.parseFloat(root.getAttribute('height') ?? '800');
  return {
    width: Number.isFinite(width) ? width : 1200,
    height: Number.isFinite(height) ? height : 800,
  };
}

export async function copySource(source: string): Promise<void> {
  await navigator.clipboard.writeText(source);
}

export function downloadSvg(svg: string): void {
  if (!svg) {
    throw new Error('当前没有可导出的 SVG。');
  }

  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), getFilename('svg'));
}

export function downloadMarkdown(source: string, language = 'mermaid'): void {
  if (!source.trim()) {
    throw new Error('当前没有可导出的源码。');
  }
  const markdown = `\`\`\`${language}\n${source.trim()}\n\`\`\`\n`;
  downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), getFilename('md'));
}

export async function downloadPng(svg: string, options: PngExportOptions): Promise<void> {
  if (!svg) {
    throw new Error('当前没有可导出的 SVG。');
  }

  const { width, height } = getSvgSize(svg);
  const scale = Math.min(4, Math.max(1, options.scale));
  const image = new Image();
  image.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('PNG 导出失败：浏览器无法读取当前 SVG。'));
    image.src = svgToDataUrl(svg);
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('PNG 导出失败：当前浏览器不支持 Canvas。');
  }

  if (!options.transparent) {
    context.fillStyle = '#F6F7F4';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('PNG 导出失败：无法生成图片文件。');
  }

  downloadBlob(blob, getFilename('png'));
}
