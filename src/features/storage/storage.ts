import { diagramTypes, type DiagramType, type ErInputMode } from '../diagrams/types';
import type { ErDisplaySettings, ErViewMode } from '../renderer/erGraphModel';
import type { MermaidStyleSettings } from '../renderer/mermaidRenderer';
import type { ActivityDisplaySettings } from '../renderer/activityModel';
import type { StructureDisplaySettings } from '../renderer/structureModel';
import type { UseCaseDisplaySettings } from '../renderer/useCaseModel';
import type { SimpleDisplaySettings } from '../renderer/simpleCanvasModel';

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
  activityDisplaySettings: 'pixelgraph:activityDisplaySettings',
  structureDisplaySettings: 'pixelgraph:structureDisplaySettings',
  useCaseDisplaySettings: 'pixelgraph:useCaseDisplaySettings',
  simpleDisplaySettings: 'pixelgraph:simpleDisplaySettings',
  umlEdgeLabels: 'pixelgraph:umlEdgeLabels',
  umlLocalLabels: 'pixelgraph:umlLocalLabels',
  umlNodePositions: 'pixelgraph:umlNodePositions',
  umlNodeSizes: 'pixelgraph:umlNodeSizes',
} as const;

export type ThemeMode = 'light' | 'dark';
export type Locale = 'zh' | 'en';

export interface StoredCanvasSettings {
  editorTextColor: string;
  exportScale: number;
}

export type StoredMermaidStyleSettings = Record<DiagramType, MermaidStyleSettings>;
export interface StoredStructureDisplaySettings {
  component: StructureDisplaySettings;
  deployment: StructureDisplaySettings;
  package: StructureDisplaySettings;
}
export type StoredSimpleDisplaySettings = Partial<Record<DiagramType, SimpleDisplaySettings>>;

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
  return diagramTypes.includes(value as DiagramType) ? (value as DiagramType) : null;
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

export function readStoredActivityDisplaySettings(fallback: ActivityDisplaySettings): ActivityDisplaySettings {
  return readJsonSetting(storageKeys.activityDisplaySettings, fallback);
}

export function writeStoredActivityDisplaySettings(settings: ActivityDisplaySettings): void {
  writeJsonSetting(storageKeys.activityDisplaySettings, settings);
}

export function readStoredStructureDisplaySettings(fallback: StoredStructureDisplaySettings): StoredStructureDisplaySettings {
  const value = readJsonSetting(storageKeys.structureDisplaySettings, fallback) as Partial<StoredStructureDisplaySettings>;
  return {
    component: { ...fallback.component, ...(value.component ?? {}) },
    deployment: { ...fallback.deployment, ...(value.deployment ?? {}) },
    package: { ...fallback.package, ...(value.package ?? {}) },
  };
}

export function writeStoredStructureDisplaySettings(settings: StoredStructureDisplaySettings): void {
  writeJsonSetting(storageKeys.structureDisplaySettings, settings);
}

export function readStoredUseCaseDisplaySettings(fallback: UseCaseDisplaySettings): UseCaseDisplaySettings {
  return readJsonSetting(storageKeys.useCaseDisplaySettings, fallback);
}

export function writeStoredUseCaseDisplaySettings(settings: UseCaseDisplaySettings): void {
  writeJsonSetting(storageKeys.useCaseDisplaySettings, settings);
}

export function readStoredSimpleDisplaySettings(fallback: StoredSimpleDisplaySettings): StoredSimpleDisplaySettings {
  return readJsonSetting(storageKeys.simpleDisplaySettings, fallback);
}

export function writeStoredSimpleDisplaySettings(settings: StoredSimpleDisplaySettings): void {
  writeJsonSetting(storageKeys.simpleDisplaySettings, settings);
}

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
export type StoredUmlEdgeLabel = StoredErEdgeLabel;
type StoredErEdgeLabels = Record<string, Record<string, StoredErEdgeLabel>>;
type StoredUmlNodePositions = Record<string, Record<string, { x: number; y: number }>>;
type StoredUmlNodeSizes = Record<string, Record<string, { height: number; width: number }>>;
type StoredUmlLocalLabels = Record<string, Record<string, string>>;
type StoredUmlEdgeLabels = Record<string, Record<string, StoredUmlEdgeLabel>>;

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

export function readStoredUmlNodePositions(
  scope = 'default',
  fallback?: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  const stored = readJsonSetting<StoredUmlNodePositions | Record<string, { x: number; y: number }>>(storageKeys.umlNodePositions, {});
  const scoped = stored as StoredUmlNodePositions;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizePositions(scoped[scope]);

  const sanitized = sanitizePositions(stored);
  if (Object.keys(sanitized).length > 0) return sanitized;
  return sanitizePositions(fallback);
}

export function writeStoredUmlNodePositions(scope: string, positions: Record<string, { x: number; y: number }>): void {
  const stored = readJsonSetting<StoredUmlNodePositions>(storageKeys.umlNodePositions, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isPosition)),
  );
  writeJsonSetting(storageKeys.umlNodePositions, {
    ...scopedEntries,
    [scope]: sanitizePositions(positions),
  });
}

export function readStoredUmlNodeSizes(
  scope = 'default',
  fallback?: Record<string, { height: number; width: number }>,
): Record<string, { height: number; width: number }> {
  const stored = readJsonSetting<StoredUmlNodeSizes | Record<string, { height: number; width: number }>>(storageKeys.umlNodeSizes, {});
  const scoped = stored as StoredUmlNodeSizes;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeSizes(scoped[scope]);

  const sanitized = sanitizeSizes(stored);
  if (Object.keys(sanitized).length > 0) return sanitized;
  return sanitizeSizes(fallback);
}

export function writeStoredUmlNodeSizes(scope: string, sizes: Record<string, { height: number; width: number }>): void {
  const stored = readJsonSetting<StoredUmlNodeSizes>(storageKeys.umlNodeSizes, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isSize)),
  );
  writeJsonSetting(storageKeys.umlNodeSizes, {
    ...scopedEntries,
    [scope]: sanitizeSizes(sizes),
  });
}

export function readStoredUmlLocalLabels(scope = 'default', fallback?: Record<string, string>): Record<string, string> {
  const stored = readJsonSetting<StoredUmlLocalLabels | Record<string, string>>(storageKeys.umlLocalLabels, {});
  const scoped = stored as StoredUmlLocalLabels;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeLabels(scoped[scope]);

  const sanitized = sanitizeLabels(stored);
  if (Object.keys(sanitized).length > 0) return sanitized;
  return sanitizeLabels(fallback);
}

export function writeStoredUmlLocalLabels(scope: string, labels: Record<string, string>): void {
  const stored = readJsonSetting<StoredUmlLocalLabels>(storageKeys.umlLocalLabels, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every((item) => typeof item === 'string')),
  );
  writeJsonSetting(storageKeys.umlLocalLabels, {
    ...scopedEntries,
    [scope]: sanitizeLabels(labels),
  });
}

export function readStoredUmlEdgeLabels(
  scope = 'default',
  fallback?: Record<string, StoredUmlEdgeLabel>,
): Record<string, StoredUmlEdgeLabel> {
  const stored = readJsonSetting<StoredUmlEdgeLabels | Record<string, StoredUmlEdgeLabel>>(storageKeys.umlEdgeLabels, {});
  const scoped = stored as StoredUmlEdgeLabels;
  if (scoped[scope] && typeof scoped[scope] === 'object') return sanitizeEdgeLabels(scoped[scope]);

  const sanitized = sanitizeEdgeLabels(stored);
  if (Object.keys(sanitized).length > 0) return sanitized;
  return sanitizeEdgeLabels(fallback);
}

export function writeStoredUmlEdgeLabels(scope: string, labels: Record<string, StoredUmlEdgeLabel>): void {
  const stored = readJsonSetting<StoredUmlEdgeLabels>(storageKeys.umlEdgeLabels, {});
  const scopedEntries = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => value && typeof value === 'object' && Object.values(value).every(isEdgeLabel)),
  );
  writeJsonSetting(storageKeys.umlEdgeLabels, {
    ...scopedEntries,
    [scope]: sanitizeEdgeLabels(labels),
  });
}
