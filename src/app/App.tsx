import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { getDiagramAdapter } from '../features/diagrams/adapters';
import { diagramDefinitions, getDiagramDefinition } from '../features/diagrams/definitions';
import type { DiagramTemplate, DiagramType, ErInputMode, RenderResult } from '../features/diagrams/types';
import { SourceEditor } from '../features/editor/SourceEditor';
import { copySource, downloadMarkdown, downloadPng, downloadSvg, type ExportFormat } from '../features/export/exporters';
import { messages, type Messages } from '../features/i18n/messages';
import { DiagramViewport } from '../features/renderer/DiagramViewport';
import { MermaidPreview } from '../features/renderer/MermaidPreview';
import { defaultMermaidStyleSettings, getDiagramDirective, renderMermaid, type MermaidCurve, type MermaidStyleSettings } from '../features/renderer/mermaidRenderer';
import { defaultErDisplaySettings, type ErDisplaySettings, SqlErCanvas } from '../features/renderer/SqlErCanvas';
import {
  readStoredCanvasSettings,
  readStoredCode,
  readStoredErDisplaySettings,
  readStoredErInputMode,
  readStoredErViewMode,
  readStoredLocale,
  readStoredMermaidStyleSettings,
  readStoredTheme,
  readStoredType,
  writeStoredCanvasSettings,
  writeStoredCode,
  writeStoredErDisplaySettings,
  writeStoredErInputMode,
  writeStoredErViewMode,
  writeStoredLocale,
  writeStoredMermaidStyleSettings,
  writeStoredTheme,
  writeStoredType,
  type Locale,
  type StoredCanvasSettings,
  type StoredMermaidStyleSettings,
  type ThemeMode,
} from '../features/storage/storage';
import { getTemplateById, getTemplatesByType } from '../features/templates/templates';

const emptyRender: RenderResult = {
  error: null,
  status: 'idle',
  svg: '',
};

const lightCanvasSettings: StoredCanvasSettings = {
  editorTextColor: '#18181B',
  exportScale: 3,
  transparentExport: false,
};

const darkCanvasSettings: StoredCanvasSettings = {
  editorTextColor: '#F2F4EE',
  exportScale: 3,
  transparentExport: false,
};

const lightMermaidStyleSettings = defaultMermaidStyleSettings;

const darkMermaidStyleSettings: MermaidStyleSettings = {
  ...defaultMermaidStyleSettings,
  lineColor: '#9EC6AD',
  nodeBorderColor: '#9EC6AD',
  nodeFillColor: '#30362F',
  textColor: '#F2F4EE',
};

const lightErDisplaySettings = defaultErDisplaySettings;

const darkErDisplaySettings: ErDisplaySettings = {
  ...defaultErDisplaySettings,
  accentColor: '#9EC6AD',
  fillColor: '#30362F',
  strokeColor: '#F2F4EE',
  textColor: '#F2F4EE',
};

const initialType = readStoredType() ?? 'er';
const initialDefinition = getDiagramDefinition(initialType);
const initialTemplate = getTemplateById(initialDefinition.defaultTemplateId);

function getInitialErMode(): ErInputMode {
  if (initialType !== 'er') return 'mermaid';
  return readStoredErInputMode() ?? initialTemplate?.erInputMode ?? 'sql';
}

function getInitialCode(): string {
  return readStoredCode() ?? initialTemplate?.code ?? '';
}

function getLineCount(source: string): number {
  return source.length === 0 ? 1 : source.split('\n').length;
}

function getTemplateForType(type: DiagramType, erInputMode: ErInputMode): DiagramTemplate {
  const definition = getDiagramDefinition(type);
  const templates = getTemplatesByType(type);
  const preferred =
    type === 'er'
      ? templates.find((template) => template.erInputMode === erInputMode)
      : getTemplateById(definition.defaultTemplateId);
  const template = preferred ?? getTemplateById(definition.defaultTemplateId) ?? templates[0];

  if (!template) throw new Error(`Missing template for diagram type: ${type}`);
  return template;
}

function formatSource(source: string): string {
  const trimmedLines = source
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
  const lines = trimmedLines.split('\n');
  if (/^(classDiagram|sequenceDiagram|stateDiagram-v2|erDiagram)\b/iu.test(lines[0]?.trim() ?? '')) {
    return lines
      .map((line, index) => {
        if (index === 0 || !line.trim()) return line.trim();
        return `  ${line.trim()}`;
      })
      .join('\n');
  }

  if (/^(flowchart|graph)\b/iu.test(lines[0]?.trim() ?? '')) {
    return lines
      .map((line, index) => {
        if (index === 0 || !line.trim()) return line.trim();
        return `  ${line.trim()}`;
      })
      .join('\n');
  }

  return trimmedLines;
}

function formatSqlSource(source: string): string {
  return source
    .replace(/\s*,\s*/gu, ',\n  ')
    .replace(/\s+(CREATE\s+TABLE)\s+/giu, '\n\n$1 ')
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
}

function getSourcePlaceholder(type: DiagramType, erInputMode: ErInputMode, text: Messages): string {
  if (type === 'er' && erInputMode === 'sql') return text.sqlPlaceholder;
  const placeholders: Record<DiagramType, string> = {
    class: text.classPlaceholder,
    er: text.erMermaidPlaceholder,
    flowchart: text.flowchartPlaceholder,
    sequence: text.sequencePlaceholder,
    state: text.statePlaceholder,
  };
  return placeholders[type];
}

function getLocalizedDescription(type: DiagramType, text: Messages): string {
  const descriptions: Record<DiagramType, string> = {
    class: text.diagramDescriptionClass,
    er: text.diagramDescriptionEr,
    flowchart: text.diagramDescriptionFlowchart,
    sequence: text.diagramDescriptionSequence,
    state: text.diagramDescriptionState,
  };
  return descriptions[type];
}

function getLocalizedTemplateName(template: DiagramTemplate, text: Messages): string {
  const names: Record<string, string> = {
    'class-domain-model': text.templateClassDomain,
    'class-rendering-workbench': text.templateClassRenderer,
    'er-mermaid-commerce': text.templateErMermaidOrders,
    'er-sql-commerce': text.templateErSqlOrders,
    'flowchart-release-check': text.templateFlowchartReview,
    'flowchart-rendering-decision': text.templateFlowchartGeneration,
    'sequence-export-pipeline': text.templateSequenceExport,
    'sequence-login-review': text.templateSequenceLogin,
    'state-document-lifecycle': text.templateStateDraft,
    'state-payment-flow': text.templateStateOrder,
  };
  return names[template.id] ?? template.name;
}

function replaceThemeDefault<T extends object>(current: T, previousDefaults: T, nextDefaults: T, keys: Array<keyof T>): T {
  return keys.reduce((settings, key) => {
    if (current[key] !== previousDefaults[key]) return settings;
    return {
      ...settings,
      [key]: nextDefaults[key],
    };
  }, current);
}

function getThemeCanvasDefaults(theme: ThemeMode): StoredCanvasSettings {
  return theme === 'dark' ? darkCanvasSettings : lightCanvasSettings;
}

function getThemeMermaidDefaults(theme: ThemeMode): MermaidStyleSettings {
  return theme === 'dark' ? darkMermaidStyleSettings : lightMermaidStyleSettings;
}

function getThemeMermaidSettingsByType(theme: ThemeMode): StoredMermaidStyleSettings {
  const defaults = getThemeMermaidDefaults(theme);
  return {
    class: defaults,
    er: defaults,
    flowchart: defaults,
    sequence: defaults,
    state: defaults,
  };
}

function getThemeErDefaults(theme: ThemeMode): ErDisplaySettings {
  return theme === 'dark' ? darkErDisplaySettings : lightErDisplaySettings;
}

function migrateCanvasSettings(settings: StoredCanvasSettings, theme: ThemeMode): StoredCanvasSettings {
  const previous = theme === 'dark' ? lightCanvasSettings : darkCanvasSettings;
  return replaceThemeDefault(settings, previous, getThemeCanvasDefaults(theme), ['editorTextColor']);
}

function migrateMermaidSettings(settings: MermaidStyleSettings, theme: ThemeMode): MermaidStyleSettings {
  const previous = theme === 'dark' ? lightMermaidStyleSettings : darkMermaidStyleSettings;
  return {
    ...replaceThemeDefault(settings, previous, getThemeMermaidDefaults(theme), ['lineColor', 'nodeBorderColor', 'nodeFillColor', 'textColor']),
    sequenceNumbers: true,
  };
}

function migrateMermaidSettingsByType(settings: StoredMermaidStyleSettings, theme: ThemeMode): StoredMermaidStyleSettings {
  return {
    class: migrateMermaidSettings(settings.class, theme),
    er: migrateMermaidSettings(settings.er, theme),
    flowchart: migrateMermaidSettings(settings.flowchart, theme),
    sequence: migrateMermaidSettings(settings.sequence, theme),
    state: migrateMermaidSettings(settings.state, theme),
  };
}

function migrateErSettings(settings: ErDisplaySettings, theme: ThemeMode): ErDisplaySettings {
  const previous = theme === 'dark' ? lightErDisplaySettings : darkErDisplaySettings;
  return replaceThemeDefault(settings, previous, getThemeErDefaults(theme), ['accentColor', 'fillColor', 'strokeColor', 'textColor']);
}

function getSourceActionLabel(type: DiagramType, erInputMode: ErInputMode, text: Messages): string {
  if (type === 'er' && erInputMode === 'sql') return text.inputSqlEr;
  if (type === 'er') return text.inputMermaidEr;
  const labels: Record<Exclude<DiagramType, 'er'>, string> = {
    class: text.inputClassDiagram,
    flowchart: text.inputFlowchart,
    sequence: text.inputSequenceDiagram,
    state: text.inputStateDiagram,
  };
  return labels[type];
}

export function App() {
  const [diagramType, setDiagramType] = useState<DiagramType>(initialType);
  const [erInputMode, setErInputMode] = useState<ErInputMode>(getInitialErMode);
  const [source, setSource] = useState(getInitialCode);
  const [renderResult, setRenderResult] = useState<RenderResult>(emptyRender);
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState<string>(messages[readStoredLocale()].saved);
  const [exportNotice, setExportNotice] = useState<string>(messages[readStoredLocale()].exportReady);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportSvg, setExportSvg] = useState('');
  const [sqlErError, setSqlErError] = useState<string | null>(null);
  const [canvasSettings, setCanvasSettings] = useState<StoredCanvasSettings>(() => migrateCanvasSettings(readStoredCanvasSettings(getThemeCanvasDefaults(readStoredTheme())), readStoredTheme()));
  const [mermaidStyleSettingsByType, setMermaidStyleSettingsByType] = useState<StoredMermaidStyleSettings>(() =>
    migrateMermaidSettingsByType(readStoredMermaidStyleSettings(getThemeMermaidSettingsByType(readStoredTheme())), readStoredTheme()),
  );
  const [erDisplaySettings, setErDisplaySettings] = useState<ErDisplaySettings>(() => ({
    ...migrateErSettings(readStoredErDisplaySettings(getThemeErDefaults(readStoredTheme())), readStoredTheme()),
    viewMode: readStoredErViewMode(),
  }));
  const [fitRequest, setFitRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const text = messages[locale];

  const currentDefinition = useMemo(() => getDiagramDefinition(diagramType), [diagramType]);
  const isSqlEr = diagramType === 'er' && erInputMode === 'sql';
  const localizedDefinition = useMemo(
    () => ({ ...currentDefinition, description: getLocalizedDescription(currentDefinition.id, text) }),
    [currentDefinition, text],
  );
  const adapter = useMemo(() => getDiagramAdapter(localizedDefinition, isSqlEr, text), [localizedDefinition, isSqlEr, text]);
  const isRendering = adapter.engine === 'mermaid' && renderResult.status === 'rendering';
  const previewError = adapter.engine === 'sql-er' ? sqlErError : renderResult.error;
  const lineCount = getLineCount(source);
  const sourcePlaceholder = getSourcePlaceholder(diagramType, erInputMode, text);
  const sourceActionLabel = getSourceActionLabel(diagramType, erInputMode, text);
  const mermaidDirective = getDiagramDirective(source);
  const mermaidStyleSettings = mermaidStyleSettingsByType[diagramType];
  const setCurrentMermaidStyleSettings = (updater: (value: MermaidStyleSettings) => MermaidStyleSettings): void => {
    setMermaidStyleSettingsByType((settings) => ({
      ...settings,
      [diagramType]: updater(settings[diagramType]),
    }));
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStoredTheme(theme);
    setCanvasSettings((settings) => migrateCanvasSettings(settings, theme));
    setMermaidStyleSettingsByType((settings) => migrateMermaidSettingsByType(settings, theme));
    setErDisplaySettings((settings) => ({
      ...migrateErSettings(settings, theme),
      viewMode: settings.viewMode,
    }));
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    writeStoredLocale(locale);
  }, [locale]);

  useEffect(() => {
    writeStoredType(diagramType);
  }, [diagramType]);

  useEffect(() => {
    writeStoredErInputMode(erInputMode);
  }, [erInputMode]);

  useEffect(() => {
    writeStoredCanvasSettings(canvasSettings);
  }, [canvasSettings]);

  useEffect(() => {
    writeStoredMermaidStyleSettings(mermaidStyleSettingsByType);
  }, [mermaidStyleSettingsByType]);

  useEffect(() => {
    writeStoredErDisplaySettings(erDisplaySettings);
    writeStoredErViewMode(erDisplaySettings.viewMode);
  }, [erDisplaySettings]);

  useEffect(() => {
    function handleFullscreenChange(): void {
      setIsFullscreen(document.fullscreenElement === previewShellRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setSaveState(text.saving);
    const timer = window.setTimeout(() => {
      writeStoredCode(source);
      setSaveState(text.saved);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [source, text.saved, text.saving]);

  useEffect(() => {
    if (adapter.engine !== 'mermaid') return;
    let cancelled = false;
    setRenderResult((previous) => ({ error: null, status: 'rendering', svg: previous.svg }));
    const timer = window.setTimeout(() => {
      void renderMermaid(source, mermaidStyleSettings).then((result) => {
        if (!cancelled) setRenderResult(result);
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [adapter.engine, mermaidStyleSettings, source]);

  function chooseDiagramType(type: DiagramType): void {
    const nextMode = type === 'er' ? erInputMode : 'mermaid';
    const nextTemplate = getTemplateForType(type, nextMode);
    setDiagramType(type);
    setSource(nextTemplate.code);
    setZoom(1);
    setResetRequest((value) => value + 1);
    setExportNotice(`${getLocalizedTemplateName(nextTemplate, text)} ${text.loaded}`);
  }

  function chooseErInputMode(mode: ErInputMode): void {
    const nextTemplate = getTemplateForType('er', mode);
    setErInputMode(mode);
    setSource(nextTemplate.code);
    setZoom(1);
    setResetRequest((value) => value + 1);
    setExportNotice(mode === 'sql' ? `${text.sqlMode} ${text.loaded}` : `${text.mermaidMode} ${text.loaded}`);
  }

  function chooseTemplate(template: DiagramTemplate): void {
    setSource(template.code);
    setZoom(1);
    setResetRequest((value) => value + 1);
    setExportNotice(`${getLocalizedTemplateName(template, text)} ${text.loaded}`);
  }

  function resetSettings(): void {
    setCanvasSettings(getThemeCanvasDefaults(theme));
    setMermaidStyleSettingsByType(getThemeMermaidSettingsByType(theme));
    setErDisplaySettings(getThemeErDefaults(theme));
    setZoom(1);
    setResetRequest((value) => value + 1);
    setExportNotice(text.settingsReset);
  }

  async function handleCopySource(): Promise<void> {
    try {
      await copySource(source);
      setExportNotice(text.copied);
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : 'Copy failed.');
    }
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    try {
      const svg = exportSvg || renderResult.svg;
      if ((format === 'SVG' || format === 'PNG') && (!svg || previewError)) {
        setExportNotice(text.exportUnavailable);
        return;
      }
      if (format === 'SVG') downloadSvg(svg);
      if (format === 'PNG') await downloadPng(svg, { scale: canvasSettings.exportScale, transparent: canvasSettings.transparentExport });
      if (format === 'Markdown') downloadMarkdown(source, adapter.sourceLanguage);
      setExportNotice(`${format} ${text.exportDone}`);
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : `${format} export failed.`);
    }
  }

  async function toggleFullscreen(): Promise<void> {
    const previewShell = previewShellRef.current;
    if (!previewShell) return;
    try {
      if (document.fullscreenElement === previewShell) await document.exitFullscreen();
      else await previewShell.requestFullscreen();
    } catch {
      setExportNotice(text.noPermission);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar" aria-label="Application toolbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">{text.appSubtitle}</p>
            <h1>PixelGraph</h1>
          </div>
        </div>

        <nav className="diagram-tabs" aria-label={text.diagramKind}>
          {diagramDefinitions.map((diagram) => (
            <button className={`tab ${diagram.id === diagramType ? 'is-active' : ''}`} key={diagram.id} onClick={() => chooseDiagramType(diagram.id)} type="button">
              {diagram.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className="secondary-button" onClick={() => setLocale((value) => (value === 'zh' ? 'en' : 'zh'))} type="button">
            {text.language}
          </button>
          <button className="secondary-button" onClick={() => setSettingsOpen((value) => !value)} type="button">
            {settingsOpen ? text.closeSettings : text.settings}
          </button>
          <button aria-label={text.theme} className="icon-button" onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))} type="button">
            <span className="theme-glyph" aria-hidden="true" />
          </button>
          <button className="primary-button" onClick={() => void handleExport('SVG')} type="button">
            {text.export}
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <aside className="settings-drawer" aria-label={text.settings}>
          <div className="settings-actions">
            <div>
              <h3>{text.settings}</h3>
              <p>{text.resetSettingsHint}</p>
            </div>
            <button className="secondary-button" onClick={resetSettings} type="button">
              {text.resetSettings}
            </button>
          </div>
          <section>
            <h3>{text.canvasSettings}</h3>
            <label>
              {text.editorTextColor}
              <input type="color" value={canvasSettings.editorTextColor} onChange={(event) => setCanvasSettings((value) => ({ ...value, editorTextColor: event.target.value }))} />
              <span>{canvasSettings.editorTextColor}</span>
            </label>
            <label>
              {text.exportScale}
              <input type="range" min="1" max="4" step="1" value={canvasSettings.exportScale} onChange={(event) => setCanvasSettings((value) => ({ ...value, exportScale: Number(event.target.value) }))} />
              <span>{canvasSettings.exportScale}x</span>
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={canvasSettings.transparentExport} onChange={(event) => setCanvasSettings((value) => ({ ...value, transparentExport: event.target.checked }))} />
              {text.transparentExport}
            </label>
          </section>
          {adapter.engine === 'sql-er' ? (
            <section>
              <h3>{text.erSettings}</h3>
              <label>
                {text.erViewMode}
                <select value={erDisplaySettings.viewMode} onChange={(event) => setErDisplaySettings((value) => ({ ...value, viewMode: event.target.value === 'chen' ? 'chen' : 'database' }))}>
                  <option value="database">{text.databaseEr}</option>
                  <option value="chen">{text.chenEr}</option>
                </select>
              </label>
              <label>
                {text.layoutDirection}
                <select value={erDisplaySettings.layoutDirection} onChange={(event) => setErDisplaySettings((value) => ({ ...value, layoutDirection: event.target.value === 'TB' ? 'TB' : 'LR' }))}>
                  <option value="LR">LR</option>
                  <option value="TB">TB</option>
                </select>
              </label>
              <label>
                {text.attributeVisibility}
                <select value={erDisplaySettings.attributeVisibility} onChange={(event) => setErDisplaySettings((value) => ({ ...value, attributeVisibility: event.target.value === 'all' ? 'all' : event.target.value === 'none' ? 'none' : 'keys' }))}>
                  <option value="all">{text.allFields}</option>
                  <option value="keys">{text.keysOnly}</option>
                  <option value="none">{text.hideFields}</option>
                </select>
              </label>
              <label>
                {text.nodeScale}
                <input type="range" min="0.75" max="1.4" step="0.05" value={erDisplaySettings.nodeScale} onChange={(event) => setErDisplaySettings((value) => ({ ...value, nodeScale: Number(event.target.value) }))} />
                <span>{Math.round(erDisplaySettings.nodeScale * 100)}%</span>
              </label>
              <label>
                {text.fontSize}
                <input type="range" min="11" max="24" step="1" value={erDisplaySettings.fontSize} onChange={(event) => setErDisplaySettings((value) => ({ ...value, fontSize: Number(event.target.value) }))} />
                <span>{erDisplaySettings.fontSize}px</span>
              </label>
              <label>
                {text.accentColor}
                <input type="color" value={erDisplaySettings.accentColor} onChange={(event) => setErDisplaySettings((value) => ({ ...value, accentColor: event.target.value }))} />
                <span>{erDisplaySettings.accentColor}</span>
              </label>
              <label>
                {text.fillColor}
                <input type="color" value={erDisplaySettings.fillColor} onChange={(event) => setErDisplaySettings((value) => ({ ...value, fillColor: event.target.value }))} />
                <span>{erDisplaySettings.fillColor}</span>
              </label>
              <label>
                {text.strokeColor}
                <input type="color" value={erDisplaySettings.strokeColor} onChange={(event) => setErDisplaySettings((value) => ({ ...value, strokeColor: event.target.value }))} />
                <span>{erDisplaySettings.strokeColor}</span>
              </label>
              <label>
                {text.textColor}
                <input type="color" value={erDisplaySettings.textColor} onChange={(event) => setErDisplaySettings((value) => ({ ...value, textColor: event.target.value }))} />
                <span>{erDisplaySettings.textColor}</span>
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={erDisplaySettings.showTypes} onChange={(event) => setErDisplaySettings((value) => ({ ...value, showTypes: event.target.checked }))} />
                {text.showTypes}
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={erDisplaySettings.showComments} onChange={(event) => setErDisplaySettings((value) => ({ ...value, showComments: event.target.checked }))} />
                {text.showComments}
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={erDisplaySettings.showCardinality} onChange={(event) => setErDisplaySettings((value) => ({ ...value, showCardinality: event.target.checked }))} />
                {text.showCardinality}
              </label>
            </section>
          ) : (
            <section>
              <h3>{text.diagramSettings}</h3>
              {(diagramType === 'flowchart' || diagramType === 'class' || diagramType === 'state') ? (
                <label>
                  {text.rankSpacing}
                  <input type="range" min="32" max="120" step="4" value={mermaidStyleSettings.rankSpacing} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, rankSpacing: Number(event.target.value) }))} />
                  <span>{mermaidStyleSettings.rankSpacing}px</span>
                </label>
              ) : null}
              {diagramType === 'flowchart' || diagramType === 'state' ? (
                <label>
                  {text.curveStyle}
                  <select value={mermaidStyleSettings.curve} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, curve: event.target.value as MermaidCurve }))}>
                    <option value="basis">{text.curveBasis}</option>
                    <option value="linear">{text.curveLinear}</option>
                    <option value="step">{text.curveStep}</option>
                  </select>
                </label>
              ) : null}
              <label>
                {text.fontSize}
                <input type="range" min="11" max="22" step="1" value={mermaidStyleSettings.fontSize} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, fontSize: Number(event.target.value) }))} />
                <span>{mermaidStyleSettings.fontSize}px</span>
              </label>
              <label>
                {text.nodeFillColor}
                <input type="color" value={mermaidStyleSettings.nodeFillColor} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, nodeFillColor: event.target.value }))} />
                <span>{mermaidStyleSettings.nodeFillColor}</span>
              </label>
              <label>
                {text.nodeBorderColor}
                <input type="color" value={mermaidStyleSettings.nodeBorderColor} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, nodeBorderColor: event.target.value }))} />
                <span>{mermaidStyleSettings.nodeBorderColor}</span>
              </label>
              <label>
                {text.lineColor}
                <input type="color" value={mermaidStyleSettings.lineColor} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, lineColor: event.target.value }))} />
                <span>{mermaidStyleSettings.lineColor}</span>
              </label>
              <label>
                {text.textColor}
                <input type="color" value={mermaidStyleSettings.textColor} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, textColor: event.target.value }))} />
                <span>{mermaidStyleSettings.textColor}</span>
              </label>
              {diagramType === 'sequence' ? (
                <>
                  <label>
                    {text.actorMargin}
                    <input type="range" min="32" max="120" step="4" value={mermaidStyleSettings.actorMargin} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, actorMargin: Number(event.target.value) }))} />
                    <span>{mermaidStyleSettings.actorMargin}px</span>
                  </label>
                  <label className="inline-check">
                    <input type="checkbox" checked={mermaidStyleSettings.sequenceNumbers} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, sequenceNumbers: event.target.checked }))} />
                    {text.sequenceNumbers}
                  </label>
                  <label className="inline-check">
                    <input type="checkbox" checked={mermaidStyleSettings.mirrorActors} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, mirrorActors: event.target.checked }))} />
                    {text.mirrorActors}
                  </label>
                </>
              ) : null}
            </section>
          )}
        </aside>
      ) : null}

      <main className="workspace">
        <section className="editor-panel" aria-labelledby="editorTitle">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{adapter.sourceTitle}</p>
              <h2 id="editorTitle">{text.sourceEditor}</h2>
            </div>
            <div className={`status-pill ${isRendering ? 'is-rendering' : ''}`}>
              <span className="status-dot" aria-hidden="true" />
              <span>{isRendering ? text.rendering : previewError ? text.error : text.ready}</span>
            </div>
          </div>

          {diagramType === 'er' ? (
            <div className="mode-strip" aria-label="ER input mode">
              <button className={`mode-button ${erInputMode === 'sql' ? 'is-active' : ''}`} onClick={() => chooseErInputMode('sql')} type="button">
                {text.sqlMode}
              </button>
              <button className={`mode-button ${erInputMode === 'mermaid' ? 'is-active' : ''}`} onClick={() => chooseErInputMode('mermaid')} type="button">
                {text.mermaidMode}
              </button>
            </div>
          ) : null}

          <div className="template-strip" aria-label={sourceActionLabel}>
            <button className="template-button is-active" onClick={() => chooseTemplate(getTemplateForType(diagramType, erInputMode))} type="button">
              {sourceActionLabel}
            </button>
          </div>

          <SourceEditor
            error={previewError}
            formatLabel={text.formatSource}
            lineCountLabel={`${lineCount} ${text.lineCount}`}
            onChange={setSource}
            onFormat={() => setSource((value) => (isSqlEr ? formatSqlSource(value) : formatSource(value)))}
            placeholder={sourcePlaceholder}
            source={source}
            textColor={canvasSettings.editorTextColor}
            title={text.source}
          />

          <div className="editor-footer">
            <span>{saveState}</span>
          </div>
        </section>

        <section className="preview-panel" aria-labelledby="previewTitle">
          <div className="panel-header preview-header">
            <div>
              <p className="eyebrow">{text.livePreview}</p>
              <h2 id="previewTitle">{adapter.previewTitle}</h2>
            </div>
            <div className="zoom-controls" aria-label="Zoom controls">
              {adapter.engine === 'mermaid' ? (
                <>
                  <button aria-label={text.zoomOut} className="icon-button" onClick={() => setZoom((value) => Math.max(0.25, Number((value - 0.1).toFixed(2))))} type="button">
                    -
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button aria-label={text.zoomIn} className="icon-button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.1).toFixed(2))))} type="button">
                    +
                  </button>
                </>
              ) : null}
              <button className="secondary-button compact-button" onClick={() => setFitRequest((value) => value + 1)} type="button">
                {text.fitView}
              </button>
              <button className="secondary-button compact-button" onClick={() => setResetRequest((value) => value + 1)} type="button">
                {text.resetView}
              </button>
              <button className="fullscreen-button" onClick={() => void toggleFullscreen()} type="button">
                {isFullscreen ? text.exitFullscreen : text.fullscreen}
              </button>
            </div>
          </div>

          <div className="canvas-shell" ref={previewShellRef}>
            <div className="canvas-meta">
              <span>{adapter.engine === 'mermaid' && mermaidDirective ? `${adapter.previewMeta} / ${mermaidDirective}` : adapter.previewMeta}</span>
            </div>
            <div className={`diagram-stage ${isRendering ? 'is-updating' : ''}`} aria-live="polite">
              {adapter.engine === 'sql-er' ? (
                <ErrorBoundary
                  resetKey={`${diagramType}:${erInputMode}:${source}`}
                  fallback={(error) => (
                    <div className="er-flow-shell">
                      <div className="er-error-state">
                        <strong>ER 预览遇到运行时错误</strong>
                        <p>图表没有丢失。请继续修改左侧 SQL，预览区会在下一次输入后自动恢复。</p>
                        <pre>{error.message}</pre>
                      </div>
                    </div>
                  )}
                >
                  <SqlErCanvas
                    displaySettings={erDisplaySettings}
                    fitRequest={fitRequest}
                    resetRequest={resetRequest}
                    source={source}
                    text={text}
                    transparentExport={canvasSettings.transparentExport}
                    onDisplaySettingsChange={setErDisplaySettings}
                    onErrorChange={setSqlErError}
                    onExportSvgReady={setExportSvg}
                    onSourceChange={setSource}
                  />
                </ErrorBoundary>
              ) : renderResult.status === 'error' ? (
                <div className="error-panel">
                  <strong>{text.mermaidFailed}</strong>
                  <p>{renderResult.error}</p>
                </div>
              ) : (
                <DiagramViewport
                  className="mermaid-viewport"
                  fitRequest={fitRequest}
                  labels={{ fit: text.fitView, reset: text.resetView }}
                  onExportSvgReady={setExportSvg}
                  onZoomChange={setZoom}
                  resetRequest={resetRequest}
                  zoom={zoom}
                >
                  <MermaidPreview
                    onExportSvgReady={setExportSvg}
                    onSourceChange={setSource}
                    source={source}
                    styleSettings={mermaidStyleSettings}
                    svg={renderResult.svg}
                  />
                </DiagramViewport>
              )}
            </div>
          </div>

          <div className="export-row" aria-label="Export actions">
            <button className="secondary-button" onClick={handleCopySource} type="button">
              {text.copy}
            </button>
            <button className="secondary-button" onClick={() => void handleExport('SVG')} type="button">
              SVG
            </button>
            <button className="secondary-button" onClick={() => void handleExport('PNG')} type="button">
              PNG {canvasSettings.exportScale}x
            </button>
            <button className="secondary-button" onClick={() => void handleExport('Markdown')} type="button">
              Markdown
            </button>
            <p>{exportNotice}</p>
          </div>
        </section>
      </main>

      <aside className="workspace-status" aria-label="Workspace status">
        <span>
          <strong>{text.guideEditTitle}</strong>
          {text.guideEditBody}
        </span>
        <span>
          <strong>{text.guidePreviewTitle}</strong>
          {text.guidePreviewBody}
        </span>
        <span>
          <strong>{text.guideExportTitle}</strong>
          {text.guideExportBody}
        </span>
      </aside>
    </div>
  );
}
