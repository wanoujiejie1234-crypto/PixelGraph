function copyComputedStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  const important = [
    'color',
    'fill',
    'stroke',
    'stroke-width',
    'font-family',
    'font-size',
    'font-weight',
    'opacity',
    'paint-order',
    'stroke-linecap',
    'stroke-linejoin',
    'text-decoration',
    'dominant-baseline',
    'text-anchor',
  ];

  important.forEach((property) => {
    const value = computed.getPropertyValue(property);
    if (value) {
      (target as HTMLElement | SVGElement).style.setProperty(property, value);
    }
  });

  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children[index];
    if (targetChild) copyComputedStyles(child, targetChild);
  });
}

export function serializeSvgElement(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  copyComputedStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.style.removeProperty('transform');
  clone.removeAttribute('style');
  const viewBox = svg.viewBox.baseVal;

  if (viewBox.width && viewBox.height) {
    const padding = Number(svg.dataset.exportPadding ?? 48);
    const x = Math.floor(viewBox.x - padding);
    const y = Math.floor(viewBox.y - padding);
    const width = Math.ceil(viewBox.width + padding * 2);
    const height = Math.ceil(viewBox.height + padding * 2);
    clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
  }

  return new XMLSerializer().serializeToString(clone);
}
