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
  erViewMode: 'pixelgraph:erViewMode',
} as const;

export type ThemeMode = 'light' | 'dark';
export type Locale = 'zh' | 'en';

export interface StoredCanvasSettings {
  exportScale: number;
  transparentExport: boolean;
}

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
  if (!canUseStorage()) return 'mermaid';
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
  window.localStorage.setItem(key, JSON.stringify(value));
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

export function readStoredMermaidStyleSettings(fallback: MermaidStyleSettings): MermaidStyleSettings {
  return readJsonSetting(storageKeys.mermaidStyleSettings, fallback);
}

export function writeStoredMermaidStyleSettings(settings: MermaidStyleSettings): void {
  writeJsonSetting(storageKeys.mermaidStyleSettings, settings);
}

export function readStoredErNodePositions(): Record<string, { x: number; y: number }> {
  return readJsonSetting(storageKeys.erNodePositions, {});
}

export function writeStoredErNodePositions(positions: Record<string, { x: number; y: number }>): void {
  writeJsonSetting(storageKeys.erNodePositions, positions);
}
