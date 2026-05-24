import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { getDiagramAdapter } from '../features/diagrams/adapters';
import { getDiagramDefinition, diagramDefinitions } from '../features/diagrams/definitions';
import { diagramTypes, type DiagramTemplate, type DiagramType, type ErInputMode, type RenderResult } from '../features/diagrams/types';
import { SourceEditor } from '../features/editor/SourceEditor';
import { copySource, downloadMarkdown, downloadPng, downloadSvg, type ExportFormat } from '../features/export/exporters';
import { messages, type Messages } from '../features/i18n/messages';
import { ActivityCanvas, defaultActivityDisplaySettings, formatActivitySource, type ActivityDisplaySettings } from '../features/renderer/ActivityCanvas';
import { DiagramViewport } from '../features/renderer/DiagramViewport';
import { DiagramMarkers } from '../features/renderer/DiagramMarkers';
import { MermaidPreview } from '../features/renderer/MermaidPreview';
import { SimpleCanvas, darkSimpleDisplaySettings, defaultSimpleDisplaySettings, type SimpleDisplaySettings } from '../features/renderer/SimpleCanvas';
import { defaultMermaidStyleSettings, getDiagramDirective, renderMermaid, type MermaidCurve, type MermaidStyleSettings } from '../features/renderer/mermaidRenderer';
import { defaultErDisplaySettings, SqlErCanvas, type ErDisplaySettings } from '../features/renderer/SqlErCanvas';
import type { DiagramDiagnostic } from '../features/renderer/diagnostics';
import {
  StructureCanvas,
  darkStructureDisplaySettings,
  defaultStructureDisplaySettings,
  formatStructureSource,
  isStructureSourceCompatible,
  type StructureDisplaySettings,
} from '../features/renderer/StructureCanvas';
import { defaultUseCaseDisplaySettings, formatUseCaseSource, UseCaseCanvas, type UseCaseDisplaySettings } from '../features/renderer/UseCaseCanvas';
import {
  readStoredActivityDisplaySettings,
  readStoredCanvasSettings,
  readStoredCode,
  readStoredErDisplaySettings,
  readStoredErInputMode,
  readStoredErViewMode,
  readStoredLocale,
  readStoredMermaidStyleSettings,
  readStoredTheme,
  readStoredType,
  readStoredUseCaseDisplaySettings,
  readStoredStructureDisplaySettings,
  readStoredSimpleDisplaySettings,
  writeStoredActivityDisplaySettings,
  writeStoredCanvasSettings,
  writeStoredCode,
  writeStoredErDisplaySettings,
  writeStoredErInputMode,
  writeStoredErViewMode,
  writeStoredLocale,
  writeStoredMermaidStyleSettings,
  writeStoredTheme,
  writeStoredType,
  writeStoredUseCaseDisplaySettings,
  writeStoredStructureDisplaySettings,
  writeStoredSimpleDisplaySettings,
  type Locale,
  type StoredCanvasSettings,
  type StoredMermaidStyleSettings,
  type StoredStructureDisplaySettings,
  type StoredSimpleDisplaySettings,
  type ThemeMode,
} from '../features/storage/storage';
import { getTemplateById, getTemplatesByType } from '../features/templates/templates';
import { AIPanel } from '../features/ai/AIPanel';

const emptyRender: RenderResult = {
  error: null,
  status: 'idle',
  svg: '',
};

const lightCanvasSettings: StoredCanvasSettings = {
  editorTextColor: '#18181B',
  exportScale: 3,
};

const darkCanvasSettings: StoredCanvasSettings = {
  editorTextColor: '#F2F4EE',
  exportScale: 3,
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

const lightUseCaseDisplaySettings = defaultUseCaseDisplaySettings;

const darkUseCaseDisplaySettings: UseCaseDisplaySettings = {
  ...defaultUseCaseDisplaySettings,
  accentColor: '#9EC6AD',
  fillColor: '#30362F',
  lineColor: '#F2F4EE',
  strokeColor: '#F2F4EE',
  textColor: '#F2F4EE',
};

const lightActivityDisplaySettings = defaultActivityDisplaySettings;

const darkActivityDisplaySettings: ActivityDisplaySettings = {
  ...defaultActivityDisplaySettings,
  accentColor: '#9EC6AD',
  fillColor: '#30362F',
  strokeColor: '#F2F4EE',
  textColor: '#F2F4EE',
};

const structureDiagramTypes = ['component', 'deployment', 'package'] as const;
type StructureDiagramType = (typeof structureDiagramTypes)[number];

function isStructureDiagramType(type: DiagramType): type is StructureDiagramType {
  return (structureDiagramTypes as readonly string[]).includes(type);
}

const initialType = readStoredType() ?? 'er';
const initialDefinition = getDiagramDefinition(initialType);
const initialTemplate = getTemplateById(initialDefinition.defaultTemplateId);
const flowLayoutTypes = new Set<DiagramType>(['flowchart']);
const rankedLayoutTypes = new Set<DiagramType>(['class', 'flowchart', 'state']);

function getInitialErMode(): ErInputMode {
  if (initialType !== 'er') return 'mermaid';
  const storedCode = readStoredCode();
  if (/^\s*CREATE\s+TABLE\b/iu.test(storedCode ?? '')) return 'sql';
  return readStoredErInputMode() ?? initialTemplate?.erInputMode ?? 'sql';
}

function getInitialCode(): string {
  const stored = readStoredCode();
  if (!stored) return initialTemplate?.code ?? '';
  if (isStructureDiagramType(initialType) && !isStructureSourceCompatible(stored, initialType)) {
    return initialTemplate?.code ?? '';
  }
  return stored;
}

function getLineCount(source: string): number {
  return source.length === 0 ? 1 : source.split('\n').length;
}

function getTemplateForType(type: DiagramType, erInputMode: ErInputMode): DiagramTemplate {
  const definition = getDiagramDefinition(type);
  const templates = getTemplatesByType(type);
  const preferred = type === 'er' ? templates.find((template) => template.erInputMode === erInputMode) : getTemplateById(definition.defaultTemplateId);
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
    activity: text.activityDslPlaceholder,
    class: text.classPlaceholder,
    component: text.componentDslPlaceholder,
    deployment: text.deploymentDslPlaceholder,
    er: text.erMermaidPlaceholder,
    flowchart: text.flowchartPlaceholder,
    package: text.packageDslPlaceholder,
    sequence: text.sequencePlaceholder,
    state: text.statePlaceholder,
    usecase: text.useCaseDslPlaceholder,
  };
  return placeholders[type];
}

function getLocalizedDescription(type: DiagramType, text: Messages): string {
  const descriptions: Record<DiagramType, string> = {
    activity: text.diagramDescriptionActivity,
    class: text.diagramDescriptionClass,
    component: text.diagramDescriptionComponent,
    deployment: text.diagramDescriptionDeployment,
    er: text.diagramDescriptionEr,
    flowchart: text.diagramDescriptionFlowchart,
    package: text.diagramDescriptionPackage,
    sequence: text.diagramDescriptionSequence,
    state: text.diagramDescriptionState,
    usecase: text.diagramDescriptionUseCase,
  };
  return descriptions[type];
}

function getLocalizedTemplateName(template: DiagramTemplate, text: Messages): string {
  const names: Record<string, string> = {
    'activity-recharge-flow': text.templateActivityRecharge,
    'class-domain-model': text.templateClassDomain,
    'class-rendering-workbench': text.templateClassRenderer,
    'component-pixelgraph-workbench': text.templateComponentOrderPlatform,
    'deployment-pixelgraph-local': text.templateDeploymentOrderPlatform,
    'er-mermaid-commerce': text.templateErMermaidOrders,
    'er-sql-commerce': text.templateErSqlOrders,
    'flowchart-release-check': text.templateFlowchartReview,
    'flowchart-rendering-decision': text.templateFlowchartGeneration,
    'package-pixelgraph-layered': text.templatePackageLayeredArchitecture,
    'sequence-export-pipeline': text.templateSequenceExport,
    'sequence-login-review': text.templateSequenceLogin,
    'state-document-lifecycle': text.templateStateDraft,
    'state-payment-flow': text.templateStateOrder,
    'usecase-order-system': text.templateUseCaseOrderSystem,
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
  return Object.fromEntries(diagramTypes.map((type) => [type, defaults])) as StoredMermaidStyleSettings;
}

function getThemeErDefaults(theme: ThemeMode): ErDisplaySettings {
  return theme === 'dark' ? darkErDisplaySettings : lightErDisplaySettings;
}

function getThemeUseCaseDefaults(theme: ThemeMode): UseCaseDisplaySettings {
  return theme === 'dark' ? darkUseCaseDisplaySettings : lightUseCaseDisplaySettings;
}

function getThemeActivityDefaults(theme: ThemeMode): ActivityDisplaySettings {
  return theme === 'dark' ? darkActivityDisplaySettings : lightActivityDisplaySettings;
}

function getThemeStructureDefaults(theme: ThemeMode, kind: StructureDiagramType): StructureDisplaySettings {
  return theme === 'dark' ? darkStructureDisplaySettings(kind) : defaultStructureDisplaySettings(kind);
}

function getThemeStructureSettingsByType(theme: ThemeMode): StoredStructureDisplaySettings {
  return {
    component: getThemeStructureDefaults(theme, 'component'),
    deployment: getThemeStructureDefaults(theme, 'deployment'),
    package: getThemeStructureDefaults(theme, 'package'),
  };
}

function getThemeSimpleDefaults(theme: ThemeMode): SimpleDisplaySettings {
  return theme === 'dark' ? darkSimpleDisplaySettings() : defaultSimpleDisplaySettings;
}

function getThemeSimpleSettingsByType(theme: ThemeMode): StoredSimpleDisplaySettings {
  return {
    class: getThemeSimpleDefaults(theme),
    sequence: getThemeSimpleDefaults(theme),
    state: getThemeSimpleDefaults(theme),
  };
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
  return Object.fromEntries(diagramTypes.map((type) => [type, migrateMermaidSettings(settings[type], theme)])) as StoredMermaidStyleSettings;
}

function migrateErSettings(settings: ErDisplaySettings, theme: ThemeMode): ErDisplaySettings {
  const previous = theme === 'dark' ? lightErDisplaySettings : darkErDisplaySettings;
  return replaceThemeDefault(settings, previous, getThemeErDefaults(theme), ['accentColor', 'fillColor', 'strokeColor', 'textColor']);
}

function migrateUseCaseSettings(settings: UseCaseDisplaySettings, theme: ThemeMode): UseCaseDisplaySettings {
  const previous = theme === 'dark' ? lightUseCaseDisplaySettings : darkUseCaseDisplaySettings;
  return {
    ...getThemeUseCaseDefaults(theme),
    ...replaceThemeDefault(settings, previous, getThemeUseCaseDefaults(theme), ['accentColor', 'fillColor', 'lineColor', 'strokeColor', 'textColor']),
  };
}

function migrateActivitySettings(settings: ActivityDisplaySettings, theme: ThemeMode): ActivityDisplaySettings {
  const previous = theme === 'dark' ? lightActivityDisplaySettings : darkActivityDisplaySettings;
  return {
    ...getThemeActivityDefaults(theme),
    ...replaceThemeDefault(settings, previous, getThemeActivityDefaults(theme), ['accentColor', 'fillColor', 'strokeColor', 'textColor']),
  };
}

function migrateStructureSettings(
  kind: StructureDiagramType,
  settings: StructureDisplaySettings,
  theme: ThemeMode,
): StructureDisplaySettings {
  const previous = theme === 'dark' ? defaultStructureDisplaySettings(kind) : darkStructureDisplaySettings(kind);
  const nextDefaults = getThemeStructureDefaults(theme, kind);
  return {
    ...nextDefaults,
    ...replaceThemeDefault(settings, previous, nextDefaults, ['accentColor', 'fillColor', 'lineColor', 'strokeColor', 'textColor']),
  };
}

function migrateStructureSettingsByType(settings: StoredStructureDisplaySettings, theme: ThemeMode): StoredStructureDisplaySettings {
  return {
    component: migrateStructureSettings('component', settings.component, theme),
    deployment: migrateStructureSettings('deployment', settings.deployment, theme),
    package: migrateStructureSettings('package', settings.package, theme),
  };
}

function migrateSimpleSettings(settings: SimpleDisplaySettings | undefined, theme: ThemeMode): SimpleDisplaySettings {
  const defaults = getThemeSimpleDefaults(theme);
  const previous = theme === 'dark' ? defaultSimpleDisplaySettings : darkSimpleDisplaySettings();
  return {
    ...defaults,
    ...replaceThemeDefault(settings ?? defaults, previous, defaults, ['accentColor', 'fillColor', 'lineColor', 'strokeColor', 'textColor']),
  };
}

function migrateSimpleSettingsByType(settings: StoredSimpleDisplaySettings, theme: ThemeMode): StoredSimpleDisplaySettings {
  return {
    ...settings,
    class: migrateSimpleSettings(settings.class, theme),
    sequence: migrateSimpleSettings(settings.sequence, theme),
    state: migrateSimpleSettings(settings.state, theme),
  };
}

function getSourceActionLabel(type: DiagramType, erInputMode: ErInputMode, text: Messages): string {
  if (type === 'er' && erInputMode === 'sql') return text.inputSqlEr;
  if (type === 'er') return text.inputMermaidEr;
  const labels: Record<Exclude<DiagramType, 'er'>, string> = {
    activity: text.inputActivityDsl,
    class: text.inputClassDiagram,
    component: text.inputComponentDsl,
    deployment: text.inputDeploymentDsl,
    flowchart: text.inputFlowchart,
    package: text.inputPackageDsl,
    sequence: text.inputSequenceDiagram,
    state: text.inputStateDiagram,
    usecase: text.inputUseCaseDsl,
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
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [canvasDiagnostics, setCanvasDiagnostics] = useState<DiagramDiagnostic[]>([]);
  const [diagramTabsOpen, setDiagramTabsOpen] = useState(false);
  const [canvasSettings, setCanvasSettings] = useState<StoredCanvasSettings>(() => migrateCanvasSettings(readStoredCanvasSettings(getThemeCanvasDefaults(readStoredTheme())), readStoredTheme()));
  const [mermaidStyleSettingsByType, setMermaidStyleSettingsByType] = useState<StoredMermaidStyleSettings>(() =>
    migrateMermaidSettingsByType(readStoredMermaidStyleSettings(getThemeMermaidSettingsByType(readStoredTheme())), readStoredTheme()),
  );
  const [erDisplaySettings, setErDisplaySettings] = useState<ErDisplaySettings>(() => ({
    ...migrateErSettings(readStoredErDisplaySettings(getThemeErDefaults(readStoredTheme())), readStoredTheme()),
    viewMode: readStoredErViewMode(),
  }));
  const [useCaseDisplaySettings, setUseCaseDisplaySettings] = useState<UseCaseDisplaySettings>(() =>
    migrateUseCaseSettings(readStoredUseCaseDisplaySettings(getThemeUseCaseDefaults(readStoredTheme())), readStoredTheme()),
  );
  const [activityDisplaySettings, setActivityDisplaySettings] = useState<ActivityDisplaySettings>(() =>
    migrateActivitySettings(readStoredActivityDisplaySettings(getThemeActivityDefaults(readStoredTheme())), readStoredTheme()),
  );
  const [structureDisplaySettingsByType, setStructureDisplaySettingsByType] = useState<StoredStructureDisplaySettings>(() =>
    migrateStructureSettingsByType(readStoredStructureDisplaySettings(getThemeStructureSettingsByType(readStoredTheme())), readStoredTheme()),
  );
  const [simpleDisplaySettingsByType, setSimpleDisplaySettingsByType] = useState<StoredSimpleDisplaySettings>(() =>
    migrateSimpleSettingsByType(readStoredSimpleDisplaySettings(getThemeSimpleSettingsByType(readStoredTheme())), readStoredTheme()),
  );
  const [fitRequest, setFitRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
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
  const previewError = adapter.engine === 'mermaid' ? renderResult.error : canvasError;
  const lineCount = getLineCount(source);
  const sourcePlaceholder = getSourcePlaceholder(diagramType, erInputMode, text);
  const sourceActionLabel = getSourceActionLabel(diagramType, erInputMode, text);
  const mermaidDirective = getDiagramDirective(source);
  const mermaidStyleSettings = mermaidStyleSettingsByType[diagramType];
  const structureDisplaySettings = isStructureDiagramType(diagramType) ? structureDisplaySettingsByType[diagramType] : null;
  const simpleDiagramTypes = ['class', 'sequence', 'state'] as const;
  const isSimpleDiagramType = (type: DiagramType): type is 'class' | 'sequence' | 'state' => (simpleDiagramTypes as readonly string[]).includes(type);
  const simpleDisplaySettings = isSimpleDiagramType(diagramType) ? simpleDisplaySettingsByType[diagramType] ?? getThemeSimpleDefaults(theme) : null;

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
    setErDisplaySettings((settings) => ({ ...migrateErSettings(settings, theme), viewMode: settings.viewMode }));
    setUseCaseDisplaySettings((settings) => migrateUseCaseSettings(settings, theme));
    setActivityDisplaySettings((settings) => migrateActivitySettings(settings, theme));
    setStructureDisplaySettingsByType((settings) => migrateStructureSettingsByType(settings, theme));
    setSimpleDisplaySettingsByType((settings) => migrateSimpleSettingsByType(settings, theme));
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
    writeStoredUseCaseDisplaySettings(useCaseDisplaySettings);
  }, [useCaseDisplaySettings]);

  useEffect(() => {
    writeStoredActivityDisplaySettings(activityDisplaySettings);
  }, [activityDisplaySettings]);

  useEffect(() => {
    writeStoredStructureDisplaySettings(structureDisplaySettingsByType);
  }, [structureDisplaySettingsByType]);

  useEffect(() => {
    writeStoredSimpleDisplaySettings(simpleDisplaySettingsByType);
  }, [simpleDisplaySettingsByType]);

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
    const nextTemplate = getTemplateForType(type, erInputMode);
    setDiagramType(type);
    setSource(nextTemplate.code);
    setDiagramTabsOpen(false);
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
    setUseCaseDisplaySettings(getThemeUseCaseDefaults(theme));
    setActivityDisplaySettings(getThemeActivityDefaults(theme));
    setStructureDisplaySettingsByType(getThemeStructureSettingsByType(theme));
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
      if (format === 'PNG') await downloadPng(svg, { scale: canvasSettings.exportScale, transparent: false });
      if (format === 'Markdown') downloadMarkdown(source, adapter.exportLanguage);
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
      <DiagramMarkers
        fillColor={
          adapter.engine === 'sql-er'
            ? erDisplaySettings.fillColor
            : adapter.engine === 'uml-usecase'
              ? useCaseDisplaySettings.fillColor
              : simpleDisplaySettings
                ? simpleDisplaySettings.fillColor
              : isStructureDiagramType(diagramType) && structureDisplaySettings
                ? structureDisplaySettings.fillColor
                : theme === 'dark'
                  ? '#30362F'
                  : '#ffffff'
        }
        strokeColor={
          adapter.engine === 'sql-er'
            ? erDisplaySettings.strokeColor
            : adapter.engine === 'uml-usecase'
              ? useCaseDisplaySettings.lineColor
              : simpleDisplaySettings
                ? simpleDisplaySettings.lineColor
              : isStructureDiagramType(diagramType) && structureDisplaySettings
                ? structureDisplaySettings.lineColor
                : theme === 'dark'
                  ? '#F2F4EE'
                  : '#171817'
        }
      />
      <header className="topbar" aria-label="Application toolbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">{text.appSubtitle}</p>
            <h1>PixelGraph</h1>
          </div>
        </div>

        <div className={`diagram-tabs-shell ${diagramTabsOpen ? 'is-open' : ''}`}>
          <nav className="diagram-tabs" aria-label={text.diagramKind} aria-expanded={diagramTabsOpen}>
            {diagramDefinitions.map((diagram) => (
              <button className={`tab ${diagram.id === diagramType ? 'is-active' : ''}`} key={diagram.id} onClick={() => chooseDiagramType(diagram.id)} type="button">
                {diagram.label}
              </button>
            ))}
          </nav>
          <button
            aria-expanded={diagramTabsOpen}
            aria-label={diagramTabsOpen ? text.collapseDiagramTypes : text.moreDiagramTypes}
            className="diagram-tabs-toggle"
            onClick={() => setDiagramTabsOpen((value) => !value)}
            type="button"
          >
            <span>{diagramTabsOpen ? text.collapseDiagramTypes : text.moreDiagramTypes}</span>
            <span aria-hidden="true">{diagramTabsOpen ? '−' : '+'}</span>
          </button>
        </div>

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
            <p className="settings-hint">{text.exportScaleHint}</p>
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
          ) : adapter.engine === 'uml-activity' ? (
            <section>
              <h3>{text.diagramSettings}</h3>
              <label>
                {text.nodeScale}
                <input type="range" min="0.75" max="1.4" step="0.05" value={activityDisplaySettings.nodeScale} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, nodeScale: Number(event.target.value) }))} />
                <span>{Math.round(activityDisplaySettings.nodeScale * 100)}%</span>
              </label>
              <label>
                {text.fontSize}
                <input type="range" min="11" max="24" step="1" value={activityDisplaySettings.fontSize} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, fontSize: Number(event.target.value) }))} />
                <span>{activityDisplaySettings.fontSize}px</span>
              </label>
              <label>
                {text.rankSpacing}
                <input type="range" min="56" max="180" step="4" value={activityDisplaySettings.rankGap} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, rankGap: Number(event.target.value) }))} />
                <span>{activityDisplaySettings.rankGap}px</span>
              </label>
              <label>
                {text.layoutSpacing}
                <input type="range" min="16" max="64" step="4" value={activityDisplaySettings.laneGap} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, laneGap: Number(event.target.value) }))} />
                <span>{activityDisplaySettings.laneGap}px</span>
              </label>
              <label>
                {text.accentColor}
                <input type="color" value={activityDisplaySettings.accentColor} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, accentColor: event.target.value }))} />
                <span>{activityDisplaySettings.accentColor}</span>
              </label>
              <label>
                {text.fillColor}
                <input type="color" value={activityDisplaySettings.fillColor} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, fillColor: event.target.value }))} />
                <span>{activityDisplaySettings.fillColor}</span>
              </label>
              <label>
                {text.strokeColor}
                <input type="color" value={activityDisplaySettings.strokeColor} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, strokeColor: event.target.value }))} />
                <span>{activityDisplaySettings.strokeColor}</span>
              </label>
              <label>
                {text.textColor}
                <input type="color" value={activityDisplaySettings.textColor} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, textColor: event.target.value }))} />
                <span>{activityDisplaySettings.textColor}</span>
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={activityDisplaySettings.showNotes} onChange={(event) => setActivityDisplaySettings((value) => ({ ...value, showNotes: event.target.checked }))} />
                {text.showComments}
              </label>
            </section>
          ) : adapter.engine === 'uml-usecase' ? (
            <section>
              <h3>{text.diagramSettings}</h3>
              <label>
                {text.layoutDirection}
                <select value={useCaseDisplaySettings.layoutDirection} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, layoutDirection: event.target.value === 'TB' ? 'TB' : 'LR' }))}>
                  <option value="LR">LR</option>
                  <option value="TB">TB</option>
                </select>
              </label>
              <label>
                {text.nodeScale}
                <input type="range" min="0.75" max="1.4" step="0.05" value={useCaseDisplaySettings.nodeScale} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, nodeScale: Number(event.target.value) }))} />
                <span>{Math.round(useCaseDisplaySettings.nodeScale * 100)}%</span>
              </label>
              <label>
                {text.fontSize}
                <input type="range" min="11" max="24" step="1" value={useCaseDisplaySettings.fontSize} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, fontSize: Number(event.target.value) }))} />
                <span>{useCaseDisplaySettings.fontSize}px</span>
              </label>
              <label>
                {text.actorMargin}
                <input type="range" min="56" max="160" step="4" value={useCaseDisplaySettings.actorSpacing} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, actorSpacing: Number(event.target.value) }))} />
                <span>{useCaseDisplaySettings.actorSpacing}px</span>
              </label>
              <label>
                {text.rankSpacing}
                <input type="range" min="56" max="180" step="4" value={useCaseDisplaySettings.useCaseSpacing} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, useCaseSpacing: Number(event.target.value) }))} />
                <span>{useCaseDisplaySettings.useCaseSpacing}px</span>
              </label>
              <label>
                {text.accentColor}
                <input type="color" value={useCaseDisplaySettings.accentColor} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, accentColor: event.target.value }))} />
                <span>{useCaseDisplaySettings.accentColor}</span>
              </label>
              <label>
                {text.fillColor}
                <input type="color" value={useCaseDisplaySettings.fillColor} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, fillColor: event.target.value }))} />
                <span>{useCaseDisplaySettings.fillColor}</span>
              </label>
              <label>
                {text.strokeColor}
                <input type="color" value={useCaseDisplaySettings.strokeColor} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, strokeColor: event.target.value }))} />
                <span>{useCaseDisplaySettings.strokeColor}</span>
              </label>
              <label>
                {text.lineColor}
                <input type="color" value={useCaseDisplaySettings.lineColor} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, lineColor: event.target.value }))} />
                <span>{useCaseDisplaySettings.lineColor}</span>
              </label>
              <label>
                {text.lineWidth}
                <input type="range" min="1" max="3.2" step="0.1" value={useCaseDisplaySettings.lineWidth} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, lineWidth: Number(event.target.value) }))} />
                <span>{useCaseDisplaySettings.lineWidth.toFixed(1)}px</span>
              </label>
              <label>
                {text.curveStyle}
                <select value={useCaseDisplaySettings.lineStyle} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, lineStyle: event.target.value === 'straight' || event.target.value === 'bezier' ? event.target.value : 'smooth' }))}>
                  <option value="smooth">{text.curveStep}</option>
                  <option value="bezier">{text.curveBasis}</option>
                  <option value="straight">{text.curveLinear}</option>
                </select>
              </label>
              <label>
                {text.associationArrow}
                <select value={useCaseDisplaySettings.associationArrow} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, associationArrow: event.target.value === 'open' ? 'open' : 'none' }))}>
                  <option value="none">{text.associationArrowNone}</option>
                  <option value="open">{text.associationArrowOpen}</option>
                </select>
              </label>
              <label>
                {text.textColor}
                <input type="color" value={useCaseDisplaySettings.textColor} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, textColor: event.target.value }))} />
                <span>{useCaseDisplaySettings.textColor}</span>
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={useCaseDisplaySettings.showSystemBoundary} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, showSystemBoundary: event.target.checked }))} />
                {text.showSystemBoundary}
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={useCaseDisplaySettings.showRelationLabels} onChange={(event) => setUseCaseDisplaySettings((value) => ({ ...value, showRelationLabels: event.target.checked }))} />
                {text.showRelationLabels}
              </label>
            </section>
          ) : adapter.engine === 'uml-component' || adapter.engine === 'uml-deployment' || adapter.engine === 'uml-package' ? (
            <section>
              <h3>{text.diagramSettings}</h3>
              {structureDisplaySettings ? (
                <>
                  <label>
                    {text.layoutDirection}
                    <select
                      value={structureDisplaySettings.layoutDirection}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], layoutDirection: event.target.value === 'TB' ? 'TB' : 'LR' },
                            }))
                          : undefined
                      }
                    >
                      <option value="LR">LR</option>
                      <option value="TB">TB</option>
                    </select>
                  </label>
                  <label>
                    {text.nodeScale}
                    <input
                      type="range"
                      min="0.75"
                      max="1.4"
                      step="0.05"
                      value={structureDisplaySettings.nodeScale}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], nodeScale: Number(event.target.value) },
                            }))
                          : undefined
                      }
                    />
                    <span>{Math.round(structureDisplaySettings.nodeScale * 100)}%</span>
                  </label>
                  <label>
                    {text.fontSize}
                    <input
                      type="range"
                      min="11"
                      max="24"
                      step="1"
                      value={structureDisplaySettings.fontSize}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], fontSize: Number(event.target.value) },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.fontSize}px</span>
                  </label>
                  <label>
                    {text.rankSpacing}
                    <input
                      type="range"
                      min="72"
                      max="180"
                      step="4"
                      value={structureDisplaySettings.rankGap}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], rankGap: Number(event.target.value) },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.rankGap}px</span>
                  </label>
                  <label>
                    {text.accentColor}
                    <input
                      type="color"
                      value={structureDisplaySettings.accentColor}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], accentColor: event.target.value },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.accentColor}</span>
                  </label>
                  <label>
                    {text.fillColor}
                    <input
                      type="color"
                      value={structureDisplaySettings.fillColor}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], fillColor: event.target.value },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.fillColor}</span>
                  </label>
                  <label>
                    {text.strokeColor}
                    <input
                      type="color"
                      value={structureDisplaySettings.strokeColor}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], strokeColor: event.target.value },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.strokeColor}</span>
                  </label>
                  <label>
                    {text.lineColor}
                    <input
                      type="color"
                      value={structureDisplaySettings.lineColor}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], lineColor: event.target.value },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.lineColor}</span>
                  </label>
                  <label>
                    {text.lineWidth}
                    <input
                      type="range"
                      min="1"
                      max="3.2"
                      step="0.1"
                      value={structureDisplaySettings.lineWidth}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], lineWidth: Number(event.target.value) },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.lineWidth.toFixed(1)}px</span>
                  </label>
                  <label>
                    {text.textColor}
                    <input
                      type="color"
                      value={structureDisplaySettings.textColor}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], textColor: event.target.value },
                            }))
                          : undefined
                      }
                    />
                    <span>{structureDisplaySettings.textColor}</span>
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={structureDisplaySettings.showMetadata}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], showMetadata: event.target.checked },
                            }))
                          : undefined
                      }
                    />
                    {text.showMetadata}
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={structureDisplaySettings.showRelationLabels}
                      onChange={(event) =>
                        isStructureDiagramType(diagramType)
                          ? setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...value[diagramType], showRelationLabels: event.target.checked },
                            }))
                          : undefined
                      }
                    />
                    {text.showRelationLabels}
                  </label>
                  {diagramType !== 'package' ? (
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={structureDisplaySettings.showGroupFrames}
                        onChange={(event) =>
                          isStructureDiagramType(diagramType)
                            ? setStructureDisplaySettingsByType((value) => ({
                                ...value,
                                [diagramType]: { ...value[diagramType], showGroupFrames: event.target.checked },
                              }))
                            : undefined
                        }
                      />
                      {text.showGroupFrames}
                    </label>
                  ) : null}
                  {diagramType === 'component' ? (
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={structureDisplaySettings.showInterfaces}
                        onChange={(event) =>
                          setStructureDisplaySettingsByType((value) => ({
                            ...value,
                            component: { ...value.component, showInterfaces: event.target.checked },
                          }))
                        }
                      />
                      {text.showInterfaces}
                    </label>
                  ) : null}
                  {diagramType === 'deployment' ? (
                    <>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={structureDisplaySettings.showArtifacts}
                          onChange={(event) =>
                            setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              deployment: { ...value.deployment, showArtifacts: event.target.checked },
                            }))
                          }
                        />
                        {text.showArtifacts}
                      </label>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={structureDisplaySettings.showProtocolLabels}
                          onChange={(event) =>
                            setStructureDisplaySettingsByType((value) => ({
                              ...value,
                              deployment: { ...value.deployment, showProtocolLabels: event.target.checked },
                            }))
                          }
                        />
                        {text.showProtocolLabels}
                      </label>
                    </>
                  ) : null}
                  {diagramType === 'package' ? (
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={structureDisplaySettings.showContainerHeaders}
                        onChange={(event) =>
                          setStructureDisplaySettingsByType((value) => ({
                            ...value,
                            package: { ...value.package, showContainerHeaders: event.target.checked },
                          }))
                        }
                      />
                      {text.showPackageHeaders}
                    </label>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : adapter.engine === 'uml-class' || adapter.engine === 'uml-sequence' || adapter.engine === 'uml-state' ? (
            simpleDisplaySettings ? (
              <section>
                <h3>{text.diagramSettings}</h3>
                <label>
                  {text.layoutDirection}
                  <select
                    value={simpleDisplaySettings.layoutDirection}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), layoutDirection: event.target.value === 'LR' ? 'LR' : 'TB' },
                          }))
                        : undefined
                    }
                  >
                    <option value="TB">TB</option>
                    <option value="LR">LR</option>
                  </select>
                </label>
                <label>
                  {text.nodeScale}
                  <input
                    type="range"
                    min="0.75"
                    max="1.4"
                    step="0.05"
                    value={simpleDisplaySettings.nodeScale}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), nodeScale: Number(event.target.value) },
                          }))
                        : undefined
                    }
                  />
                  <span>{Math.round(simpleDisplaySettings.nodeScale * 100)}%</span>
                </label>
                <label>
                  {text.fontSize}
                  <input
                    type="range"
                    min="11"
                    max="24"
                    step="1"
                    value={simpleDisplaySettings.fontSize}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), fontSize: Number(event.target.value) },
                          }))
                        : undefined
                    }
                  />
                  <span>{simpleDisplaySettings.fontSize}px</span>
                </label>
                <label>
                  {text.rankSpacing}
                  <input
                    type="range"
                    min="56"
                    max="180"
                    step="4"
                    value={simpleDisplaySettings.rankGap}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), rankGap: Number(event.target.value) },
                          }))
                        : undefined
                    }
                  />
                  <span>{simpleDisplaySettings.rankGap}px</span>
                </label>
                {diagramType === 'state' ? (
                  <label>
                    {text.curveStyle}
                    <select
                      value={simpleDisplaySettings.lineStyle}
                      onChange={(event) =>
                        isSimpleDiagramType(diagramType)
                          ? setSimpleDisplaySettingsByType((value) => ({
                              ...value,
                              [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), lineStyle: event.target.value as 'orthogonal' | 'smooth' | 'straight' },
                            }))
                          : undefined
                      }
                    >
                      <option value="smooth">{text.curveBasis}</option>
                      <option value="straight">{text.curveLinear}</option>
                      <option value="orthogonal">{text.curveStep}</option>
                    </select>
                  </label>
                ) : null}
                <label>
                  {text.fillColor}
                  <input
                    type="color"
                    value={simpleDisplaySettings.fillColor}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), fillColor: event.target.value },
                          }))
                        : undefined
                    }
                  />
                  <span>{simpleDisplaySettings.fillColor}</span>
                </label>
                <label>
                  {text.lineColor}
                  <input
                    type="color"
                    value={simpleDisplaySettings.lineColor}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), lineColor: event.target.value, strokeColor: event.target.value },
                          }))
                        : undefined
                    }
                  />
                  <span>{simpleDisplaySettings.lineColor}</span>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={simpleDisplaySettings.showDetails}
                    onChange={(event) =>
                      isSimpleDiagramType(diagramType)
                        ? setSimpleDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: { ...(value[diagramType] ?? getThemeSimpleDefaults(theme)), showDetails: event.target.checked },
                          }))
                        : undefined
                    }
                  />
                  {text.showMetadata}
                </label>
              </section>
            ) : null
          ) : (
            <section>
              <h3>{text.diagramSettings}</h3>
              {rankedLayoutTypes.has(diagramType) ? (
                <label>
                  {text.rankSpacing}
                  <input type="range" min="32" max="120" step="4" value={mermaidStyleSettings.rankSpacing} onChange={(event) => setCurrentMermaidStyleSettings((value) => ({ ...value, rankSpacing: Number(event.target.value) }))} />
                  <span>{mermaidStyleSettings.rankSpacing}px</span>
                </label>
              ) : null}
              {diagramType === 'state' || flowLayoutTypes.has(diagramType) ? (
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
            onFormat={() =>
              setSource((value) => {
                if (isSqlEr) return formatSqlSource(value);
                if (diagramType === 'activity') return formatActivitySource(value, text.activityTitle);
                if (diagramType === 'usecase') return formatUseCaseSource(value);
                if (isStructureDiagramType(diagramType)) return formatStructureSource(value);
                return formatSource(value);
              })
            }
            placeholder={sourcePlaceholder}
            source={source}
            textColor={canvasSettings.editorTextColor}
            title={text.source}
          />

          <div className="editor-footer">
            <span>{saveState}</span>
          </div>
          {canvasDiagnostics.length > 0 ? (
            <div className="error-panel">
              <strong>{text.error}</strong>
              <p>{canvasDiagnostics.map((item) => `${item.level === 'warning' ? 'Warning' : 'Error'}: ${item.message}`).join('\n')}</p>
            </div>
          ) : null}
        </section>

        <section className="preview-panel" aria-labelledby="previewTitle">
          <div className="panel-header preview-header" style={{ position: 'relative' }}>
            <button className={`ai-header-btn${aiOpen ? ' is-active' : ''}`} onClick={() => setAiOpen((v) => !v)} type="button" title="AI 助手">
              <span className="ai-header-btn-text">AI</span>
            </button>
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
            <div className={`ai-dialog-wrapper${aiOpen ? '' : ' ai-hidden'}`}>
              <AIPanel
                diagramType={diagramType}
                erInputMode={erInputMode}
                source={source}
                setSource={setSource}
                setDiagramType={chooseDiagramType}
                setErInputMode={chooseErInputMode}
                onClose={() => setAiOpen(false)}
              />
            </div>
          </div>

          <div className="canvas-shell" ref={previewShellRef}>
            <div className="canvas-meta">
              <span>{adapter.engine === 'mermaid' && mermaidDirective ? `${adapter.previewMeta} / ${mermaidDirective}` : adapter.previewMeta}</span>
            </div>
            <div className={`diagram-stage ${isRendering ? 'is-updating' : ''}`} aria-live="polite">
              {adapter.engine === 'sql-er' ? (
                <SqlErCanvas
                  displaySettings={erDisplaySettings}
                  onDiagnosticsChange={setCanvasDiagnostics}
                  fitRequest={fitRequest}
                  onDisplaySettingsChange={setErDisplaySettings}
                  onErrorChange={setCanvasError}
                  onExportSvgReady={setExportSvg}
                  onSourceChange={setSource}
                  resetRequest={resetRequest}
                  source={source}
                  text={text}
                  themeMode={theme}
                />
              ) : adapter.engine === 'uml-activity' ? (
                <ErrorBoundary
                  resetKey={`${diagramType}:${source}`}
                  fallback={(error) => (
                    <div className="er-flow-shell activity-flow-shell">
                      <div className="er-error-state">
                        <strong>{text.activityInvalidTitle}</strong>
                        <p>{text.activityInvalidBody}</p>
                        <pre>{error.message}</pre>
                      </div>
                    </div>
                  )}
                >
                  <ActivityCanvas
                    defaultLaneLabel={text.activityTitle}
                    displaySettings={activityDisplaySettings}
                    fitRequest={fitRequest}
                    onDiagnosticsChange={setCanvasDiagnostics}
                    onDisplaySettingsChange={setActivityDisplaySettings}
                    onErrorChange={setCanvasError}
                    onExportSvgReady={setExportSvg}
                    onSourceChange={setSource}
                    resetRequest={resetRequest}
                    source={source}
                    text={text}
                    themeMode={theme}
                  />
                </ErrorBoundary>
              ) : adapter.engine === 'uml-usecase' ? (
                <UseCaseCanvas
                  displaySettings={useCaseDisplaySettings}
                  fitRequest={fitRequest}
                  onDiagnosticsChange={setCanvasDiagnostics}
                  onDisplaySettingsChange={setUseCaseDisplaySettings}
                  onErrorChange={setCanvasError}
                  onExportSvgReady={setExportSvg}
                  onSourceChange={setSource}
                  resetRequest={resetRequest}
                  source={source}
                  text={text}
                  themeMode={theme}
                />
              ) : adapter.engine === 'uml-component' || adapter.engine === 'uml-deployment' || adapter.engine === 'uml-package' ? (
                structureDisplaySettings ? (
                  <StructureCanvas
                    diagramKind={diagramType as 'component' | 'deployment' | 'package'}
                    displaySettings={structureDisplaySettings}
                    fitRequest={fitRequest}
                    onDiagnosticsChange={setCanvasDiagnostics}
                    onDisplaySettingsChange={(settings) =>
                      isStructureDiagramType(diagramType)
                        ? setStructureDisplaySettingsByType((value) => ({
                            ...value,
                            [diagramType]: settings,
                          }))
                        : undefined
                    }
                    onErrorChange={setCanvasError}
                    onExportSvgReady={setExportSvg}
                    onSourceChange={setSource}
                    resetRequest={resetRequest}
                    source={source}
                    text={text}
                    themeMode={theme}
                  />
                ) : null
              ) : adapter.engine === 'uml-class' || adapter.engine === 'uml-sequence' || adapter.engine === 'uml-state' ? (
                simpleDisplaySettings && isSimpleDiagramType(diagramType) ? (
                  <SimpleCanvas
                    diagramKind={diagramType}
                    displaySettings={simpleDisplaySettings}
                    fitRequest={fitRequest}
                    onDiagnosticsChange={setCanvasDiagnostics}
                    onDisplaySettingsChange={(settings) =>
                      setSimpleDisplaySettingsByType((value) => ({
                        ...value,
                        [diagramType]: settings,
                      }))
                    }
                    onErrorChange={setCanvasError}
                    onExportSvgReady={setExportSvg}
                    onSourceChange={setSource}
                    resetRequest={resetRequest}
                    source={source}
                    text={text}
                    themeMode={theme}
                  />
                ) : null
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
            <button className="secondary-button" onClick={() => void handleCopySource()} type="button">
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
