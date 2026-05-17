import type { DiagramType, ErInputMode } from '../diagrams/types';
import type { ErDisplaySettings, ErViewMode } from '../renderer/erGraphModel';
import type { MermaidStyleSettings } from '../renderer/mermaidRenderer';

export const storageKeys = {
  code: 'pixelgraph:lastDiagramCode',
  type: 'pixelgraph:lastDiagramType',
  theme: 'pixelgraph:theme',
  erInputMode: 'pixelgraph:erInputMode',
  locale: 'pixelgraph:locale',
  canvasSettings: 'pixelgraph:canvasSettings',
  erDisplaySettings: 'pixelgraph:erDisplaySettings',
  mermaidStyleSettings: 'pixelgraph:mermaidStyleSettings',
  erNodePositions: 'pixelgraph:erNodePositions',
  erNodeSizes: 'pixelgraph:erNodeSizes',
  erLocalLabels: 'pixelgraph:erLocalLabels',
  erEdgeLabels: 'pixelgraph:erEdgeLabels',
  erViewMode: 'pixelgraph:erViewMode',
} as const;

export type ThemeMode = 'light' | 'dark';
export type Locale = 'zh' | 'en';

export interface StoredCanvasSettings {
  editorTextColor: string;
  exportScale: number;
  transparentExport: boolean;
}

export type StoredMermaidStyleSettings = Record<DiagramType, MermaidStyleSettings>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readStoredCode(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(storageKeys.code);
}

export function writeStoredCode(code: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.code, code);
}

export function readStoredType(): DiagramType | null {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(storageKeys.type);
  return value === 'er' || value === 'class' || value === 'sequence' || value === 'state' || value === 'flowchart'
    ? value
    : null;
}

export function writeStoredType(type: DiagramType): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.type, type);
}

export function readStoredTheme(): ThemeMode {
  if (!canUseStorage()) return 'light';
  return window.localStorage.getItem(storageKeys.theme) === 'dark' ? 'dark' : 'light';
}

export function writeStoredTheme(theme: ThemeMode): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.theme, theme);
}

export function readStoredErInputMode(): ErInputMode {
  if (!canUseStorage()) return 'sql';
  return window.localStorage.getItem(storageKeys.erInputMode) === 'sql' ? 'sql' : 'mermaid';
}

export function writeStoredErInputMode(mode: ErInputMode): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.erInputMode, mode);
}

export function readStoredLocale(): Locale {
  if (!canUseStorage()) return 'zh';
  return window.localStorage.getItem(storageKeys.locale) === 'en' ? 'en' : 'zh';
}

export function writeStoredLocale(locale: Locale): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.locale, locale);
}

function readJsonSetting<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function writeJsonSetting<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or when quota is full; the app should keep running.
  }
}

export function readStoredCanvasSettings(fallback: StoredCanvasSettings): StoredCanvasSettings {
  return readJsonSetting(storageKeys.canvasSettings, fallback);
}

export function writeStoredCanvasSettings(settings: StoredCanvasSettings): void {
  writeJsonSetting(storageKeys.canvasSettings, settings);
}

export function readStoredErViewMode(): ErViewMode {
  if (!canUseStorage()) return 'database';
  return window.localStorage.getItem(storageKeys.erViewMode) === 'chen' ? 'chen' : 'database';
}

export function writeStoredErViewMode(mode: ErViewMode): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKeys.erViewMode, mode);
}

export function readStoredErDisplaySettings(fallback: ErDisplaySettings): ErDisplaySettings {
  return readJsonSetting(storageKeys.erDisplaySettings, fallback);
}

export function writeStoredErDisplaySettings(settings: ErDisplaySettings): void {
  writeJsonSetting(storageKeys.erDisplaySettings, settings);
}

const diagramTypes: DiagramType[] = ['er', 'class', 'sequence', 'state', 'flowchart'];

function isMermaidStyleSetting(value: unknown): value is Partial<MermaidStyleSettings> {
  return Boolean(value && typeof value === 'object' && ('fontSize' in value || 'rankSpacing' in value || 'lineColor' in value));
}

function normalizeMermaidStyleSettings(value: unknown, fallback: StoredMermaidStyleSettings): StoredMermaidStyleSettings {
  if (!value || typeof value !== 'object') return fallback;

  if (isMermaidStyleSetting(value)) {
    return Object.fromEntries(diagramTypes.map((type) => [type, { ...fallback[type], ...value }])) as StoredMermaidStyleSettings;
  }

  const scoped = value as Partial<Record<DiagramType, unknown>>;
  return Object.fromEntries(
    diagramTypes.map((type) => [
      type,
      isMermaidStyleSetting(scoped[type]) ? { ...fallback[type], ...scoped[type] } : fallback[type],
    ]),
  ) as StoredMermaidStyleSettings;
}

export function readStoredMermaidStyleSettings(fallback: StoredMermaidStyleSettings): StoredMermaidStyleSettings {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(storageKeys.mermaidStyleSettings);
  if (!raw) return fallback;

  try {
    return normalizeMermaidStyleSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredMermaidStyleSettings(settings: StoredMermaidStyleSettings): void {
  writeJsonSetting(storageKeys.mermaidStyleSettings, settings);
}

type StoredErNodePositions = Record<string, Record<string, { x: number; y: number }>>;
type StoredErNodeSizes = Record<string, Record<string, { height: number; width: number }>>;
type StoredErLocalLabels = Record<string, Record<string, string>>;
export interface StoredErEdgeLabel {
  dx: number;
  dy: number;
  text: string;
}
type StoredErEdgeLabels = Record<string, Record<string, StoredErEdgeLabel>>;

function isPosition(value: unknown): value is { x: number; y: number } {
  return Boolean(value && typeof value === 'object' && typeof (value as { x?: unknown }).x === 'number' && typeof (value as { y?: unknown }).y === 'number');
}

function isSize(value: unknown): value is { height: number; width: number } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { height?: unknown }).height === 'number' &&
      typeof (value as { width?: unknown }).width === 'number' &&
      (value as { height: number }).height > 0 &&
      (value as { width: number }).width > 0,
  );
}

function sanitizePositions(value: unknown): Record<string, { x: number; y: number }> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, { x: number; y: number }] => isPosition(entry[1])),
  );
}

function sanitizeSizes(value: unknown): Record<string, { height: number; width: number }> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, { height: number; width: number }] => isSize(entry[1])),
  );
}

function sanitizeLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function isEdgeLabel(value: unknown): value is StoredErEdgeLabel {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as StoredErEdgeLabel).dx === 'number' &&
      typeof (value as StoredErEdgeLabel).dy === 'number' &&
      typeof (value as StoredErEdgeLabel).text === 'string',
  );
}

function sanitizeEdgeLabels(value: unknown): Record<string, StoredErEdgeLabel> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, StoredErEdgeLabel] => isEdgeLabel(entry[1])));
}

export function readStoredErNodePositions(scope = 'default'): Record<string, { x: number; y: number }> {
  const stored = readJsonSetting<StoredErNodePositions | Record<string, { x: number; y: number }>>(storageKeys.erNodePositions, {});
  const scoped = stored as StoredErNodePositions;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizePositions(scoped[scope]);

  return sanitizePositions(stored);
}

export function writeStoredErNodePositions(scope: string, positions: Record<string, { x: number; y: number }>): void {
  const stored = readJsonSetting<StoredErNodePositions>(storageKeys.erNodePositions, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isPosition)),
  );
  writeJsonSetting(storageKeys.erNodePositions, {
    ...scopedEntries,
    [scope]: sanitizePositions(positions),
  });
}

export function readStoredErNodeSizes(scope = 'default'): Record<string, { height: number; width: number }> {
  const stored = readJsonSetting<StoredErNodeSizes | Record<string, { height: number; width: number }>>(storageKeys.erNodeSizes, {});
  const scoped = stored as StoredErNodeSizes;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeSizes(scoped[scope]);

  return sanitizeSizes(stored);
}

export function writeStoredErNodeSizes(scope: string, sizes: Record<string, { height: number; width: number }>): void {
  const stored = readJsonSetting<StoredErNodeSizes>(storageKeys.erNodeSizes, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isSize)),
  );
  writeJsonSetting(storageKeys.erNodeSizes, {
    ...scopedEntries,
    [scope]: sanitizeSizes(sizes),
  });
}

export function readStoredErLocalLabels(scope = 'default'): Record<string, string> {
  const stored = readJsonSetting<StoredErLocalLabels | Record<string, string>>(storageKeys.erLocalLabels, {});
  const scoped = stored as StoredErLocalLabels;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeLabels(scoped[scope]);

  return sanitizeLabels(stored);
}

export function writeStoredErLocalLabels(scope: string, labels: Record<string, string>): void {
  const stored = readJsonSetting<StoredErLocalLabels>(storageKeys.erLocalLabels, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every((item) => typeof item === 'string')),
  );
  writeJsonSetting(storageKeys.erLocalLabels, {
    ...scopedEntries,
    [scope]: sanitizeLabels(labels),
  });
}

export function readStoredErEdgeLabels(scope = 'default'): Record<string, StoredErEdgeLabel> {
  const stored = readJsonSetting<StoredErEdgeLabels | Record<string, StoredErEdgeLabel>>(storageKeys.erEdgeLabels, {});
  const scoped = stored as StoredErEdgeLabels;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeEdgeLabels(scoped[scope]);

  return sanitizeEdgeLabels(stored);
}

export function writeStoredErEdgeLabels(scope: string, labels: Record<string, StoredErEdgeLabel>): void {
  const stored = readJsonSetting<StoredErEdgeLabels>(storageKeys.erEdgeLabels, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isEdgeLabel)),
  );
  writeJsonSetting(storageKeys.erEdgeLabels, {
    ...scopedEntries,
    [scope]: sanitizeEdgeLabels(labels),
  });
}
