import { useCallback, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';

interface Props extends ComponentPropsWithoutRef<'input'> {
  maxFontSize?: number;
  minFontSize?: number;
}

function numberFromPixels(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AutoFitInput({ maxFontSize, minFontSize = 9, value, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fitText = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const computed = window.getComputedStyle(input);
    const baseSize = maxFontSize ?? numberFromPixels(computed.getPropertyValue('--auto-fit-base-size'), numberFromPixels(computed.fontSize, 14));
    input.style.fontSize = `${baseSize}px`;

    const available = input.clientWidth;
    if (available <= 0 || input.scrollWidth <= available) return;
    const fullMode = input.dataset.autofitMode === 'full';

    if (fullMode) {
      let nextSize = baseSize;
      while (nextSize > minFontSize && input.scrollWidth > available) {
        nextSize = Math.max(minFontSize, Math.floor((nextSize - 0.25) * 100) / 100);
        input.style.fontSize = `${nextSize}px`;
      }
      return;
    }

    const nextSize = Math.max(minFontSize, Math.floor(baseSize * (available / input.scrollWidth) * 100) / 100);
    input.style.fontSize = `${nextSize}px`;
  }, [maxFontSize, minFontSize]);

  useLayoutEffect(() => {
    fitText();
    const input = inputRef.current;
    if (!input || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => fitText());
    observer.observe(input);
    if (input.parentElement) observer.observe(input.parentElement);

    return () => observer.disconnect();
  }, [fitText, value]);

  return <input {...props} ref={inputRef} value={value} />;
}
