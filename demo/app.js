const templates = {
  er: {
    title: {
      en: "Customer Orders ER Map",
      zh: "客户订单 ER 图"
    },
    kind: {
      en: "Entity relationship",
      zh: "实体关系图"
    },
    default: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : appears_in
  CUSTOMER {
    string id PK
    string email
    datetime created_at
  }`,
    compact: `erDiagram
  USER ||--o{ SESSION : owns
  USER ||--o{ API_KEY : creates
  API_KEY {
    string token_hash
    datetime last_used_at
  }`,
    review: `erDiagram
  PROJECT ||--o{ DIAGRAM : stores
  DIAGRAM ||--o{ EXPORT : creates
  PROJECT {
    string name
    string owner_id
  }`
  },
  class: {
    title: {
      en: "Renderer Class Model",
      zh: "渲染器类模型"
    },
    kind: {
      en: "Class diagram",
      zh: "类图"
    },
    default: `classDiagram
  class DiagramRenderer {
    +render(source)
    +dispose()
  }
  class ExportService {
    +toSvg()
    +toMarkdown()
  }
  DiagramRenderer --> ExportService`,
    compact: `classDiagram
  class TemplateStore
  class DiagramDefinition
  TemplateStore --> DiagramDefinition`,
    review: `classDiagram
  class EditorState
  class RenderResult
  EditorState --> RenderResult`
  },
  sequence: {
    title: {
      en: "Export Sequence",
      zh: "导出时序流程"
    },
    kind: {
      en: "Sequence diagram",
      zh: "顺序图"
    },
    default: `sequenceDiagram
  participant User
  participant Editor
  participant Renderer
  participant Exporter
  User->>Editor: edit Mermaid
  Editor->>Renderer: debounce render
  Renderer->>Exporter: provide SVG`,
    compact: `sequenceDiagram
  User->>Template: choose sample
  Template->>Editor: insert source
  Editor->>Preview: refresh`,
    review: `sequenceDiagram
  Reviewer->>Diagram: inspect
  Diagram->>Exporter: create markdown
  Exporter-->>Reviewer: copied block`
  },
  state: {
    title: {
      en: "Draft State Flow",
      zh: "草稿状态流"
    },
    kind: {
      en: "State diagram",
      zh: "状态图"
    },
    default: `stateDiagram-v2
  [*] --> Draft
  Draft --> Rendering
  Rendering --> Ready
  Rendering --> Error
  Error --> Draft`,
    compact: `stateDiagram-v2
  Idle --> Editing
  Editing --> Saved
  Saved --> Editing`,
    review: `stateDiagram-v2
  Proposed --> Reviewed
  Reviewed --> Approved
  Reviewed --> Revised`
  },
  flowchart: {
    title: {
      en: "Diagram Generation Flow",
      zh: "图表生成流程"
    },
    kind: {
      en: "Flowchart",
      zh: "流程图"
    },
    default: `flowchart LR
  Input[Text input] --> Parser[Syntax pass]
  Parser --> Renderer[Mock renderer]
  Renderer --> Preview[Preview canvas]
  Preview --> Export[Export actions]`,
    compact: `flowchart TB
  Template --> Editor
  Editor --> Preview
  Preview --> Copy`,
    review: `flowchart LR
  Source --> Check
  Check --> Fix
  Check --> Publish`
  }
};

const i18n = {
  en: {
    "aria.appToolbar": "Application toolbar",
    "aria.diagramType": "Diagram type",
    "aria.switchLanguage": "Switch language",
    "aria.toggleTheme": "Toggle theme",
    "aria.templates": "Templates",
    "aria.zoomControls": "Zoom controls",
    "aria.zoomOut": "Zoom out",
    "aria.zoomIn": "Zoom in",
    "aria.exportActions": "Export actions",
    "aria.projectStatus": "Project status",
    "brand.eyebrow": "Local diagram workbench",
    "tabs.flow": "Flow",
    "actions.exportSvg": "Export SVG",
    "editor.eyebrow": "Mermaid source",
    "editor.title": "Edit diagram text",
    "editor.source": "Source",
    "editor.syntaxHint": "Syntax looks stable. Preview updates after a short debounce.",
    "templates.default": "Default",
    "templates.compact": "Compact",
    "templates.review": "Review",
    "preview.eyebrow": "Live preview",
    "export.notice": "Exports are simulated in this visual demo.",
    "export.queued": "{format} export queued for the production renderer.",
    "status.storage": "Storage",
    "status.browserDraft": "Browser draft",
    "status.renderer": "Renderer",
    "status.mockRenderer": "Mock Mermaid SVG",
    "status.errorSample": "Error sample",
    "status.ready": "Ready",
    "status.rendering": "Rendering",
    "status.saved": "Saved locally",
    "status.saving": "Saving draft",
    "status.noErrors": "No parser errors",
    "status.unexpectedToken": "Unexpected token near ???",
    "lineCount": "{count} lines",
    "language.next": "中文"
  },
  zh: {
    "aria.appToolbar": "应用工具栏",
    "aria.diagramType": "图表类型",
    "aria.switchLanguage": "切换语言",
    "aria.toggleTheme": "切换主题",
    "aria.templates": "模板",
    "aria.zoomControls": "缩放控制",
    "aria.zoomOut": "缩小",
    "aria.zoomIn": "放大",
    "aria.exportActions": "导出操作",
    "aria.projectStatus": "项目状态",
    "brand.eyebrow": "本地图表工作台",
    "tabs.flow": "流程",
    "actions.exportSvg": "导出 SVG",
    "editor.eyebrow": "Mermaid 源码",
    "editor.title": "编辑图表文本",
    "editor.source": "源码",
    "editor.syntaxHint": "语法状态稳定。预览会在短暂防抖后更新。",
    "templates.default": "默认",
    "templates.compact": "紧凑",
    "templates.review": "评审",
    "preview.eyebrow": "实时预览",
    "export.notice": "当前视觉 demo 中导出为模拟反馈。",
    "export.queued": "{format} 导出已加入生产渲染器队列。",
    "status.storage": "存储",
    "status.browserDraft": "浏览器草稿",
    "status.renderer": "渲染器",
    "status.mockRenderer": "模拟 Mermaid SVG",
    "status.errorSample": "错误示例",
    "status.ready": "就绪",
    "status.rendering": "渲染中",
    "status.saved": "已保存到本地",
    "status.saving": "正在保存草稿",
    "status.noErrors": "没有解析错误",
    "status.unexpectedToken": "在 ??? 附近发现异常标记",
    "lineCount": "{count} 行",
    "language.next": "EN"
  }
};

const editor = document.querySelector("#sourceEditor");
const tabs = Array.from(document.querySelectorAll(".tab"));
const templateButtons = Array.from(document.querySelectorAll(".template-button"));
const renderStatus = document.querySelector("#renderStatus");
const previewTitle = document.querySelector("#previewTitle");
const diagramKind = document.querySelector("#diagramKind");
const diagramStage = document.querySelector("#diagramStage");
const lineCount = document.querySelector("#lineCount");
const saveState = document.querySelector("#saveState");
const exportNotice = document.querySelector("#exportNotice");
const themeToggle = document.querySelector("#themeToggle");
const quickExport = document.querySelector("#quickExport");
const languageToggle = document.querySelector("#languageToggle");
const errorSample = document.querySelector("#errorSample");
const zoomValue = document.querySelector("#zoomValue");

let currentType = "er";
let currentTemplate = "default";
let currentLocale = "zh";
let zoom = 1;
let renderTimer;

function translate(key, replacements = {}) {
  const value = i18n[currentLocale][key] || i18n.en[key] || key;
  return Object.entries(replacements).reduce(
    (text, [name, replacement]) => text.replace(`{${name}}`, replacement),
    value
  );
}

function localizedValue(value) {
  if (typeof value === "string") {
    return value;
  }

  return value[currentLocale] || value.en;
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLocale === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translate(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    node.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attribute, key] = pair.split(":");
      node.setAttribute(attribute, translate(key));
    });
  });

  languageToggle.textContent = translate("language.next");
}

function setStatus(key, rendering = false) {
  renderStatus.classList.toggle("is-rendering", rendering);
  renderStatus.querySelector("span:last-child").textContent = translate(key);
}

function updateLineCount() {
  const lines = editor.value.split("\n").length;
  lineCount.textContent = translate("lineCount", { count: lines });
}

function diagramMarkup(type) {
  const scale = `style="transform: scale(${zoom});"`;

  if (type === "sequence") {
    return `<svg class="mock-diagram" ${scale} viewBox="0 0 760 420" role="img" aria-label="Sequence diagram preview">
      <rect class="diagram-lane" x="54" y="42" width="130" height="56" rx="8"></rect>
      <rect class="diagram-lane" x="236" y="42" width="130" height="56" rx="8"></rect>
      <rect class="diagram-lane is-accent" x="418" y="42" width="130" height="56" rx="8"></rect>
      <rect class="diagram-lane" x="600" y="42" width="110" height="56" rx="8"></rect>
      <path class="diagram-muted-line" d="M119 98V360M301 98V360M483 98V360M655 98V360"></path>
      <path class="diagram-line" d="M119 140H301M301 190H483M483 240H655M655 292H301"></path>
      <text class="diagram-text" x="86" y="76">User</text>
      <text class="diagram-text" x="270" y="76">Editor</text>
      <text class="diagram-text" x="448" y="76">Renderer</text>
      <text class="diagram-text" x="626" y="76">Export</text>
      <text class="diagram-small" x="150" y="132">edit source</text>
      <text class="diagram-small" x="335" y="182">debounce</text>
      <text class="diagram-small" x="522" y="232">SVG ready</text>
      <text class="diagram-small" x="420" y="284">download</text>
    </svg>`;
  }

  if (type === "state") {
    return `<svg class="mock-diagram" ${scale} viewBox="0 0 760 420" role="img" aria-label="State diagram preview">
      <circle class="diagram-state is-accent" cx="124" cy="210" r="46"></circle>
      <rect class="diagram-state" x="248" y="154" width="138" height="112" rx="18"></rect>
      <rect class="diagram-state is-accent" x="458" y="88" width="142" height="98" rx="18"></rect>
      <rect class="diagram-state" x="458" y="246" width="142" height="98" rx="18"></rect>
      <path class="diagram-line" d="M170 210H248M386 185L458 148M386 236L458 276M529 186V246"></path>
      <text class="diagram-text" x="98" y="215">Draft</text>
      <text class="diagram-text" x="278" y="215">Render</text>
      <text class="diagram-text" x="496" y="142">Ready</text>
      <text class="diagram-text" x="502" y="300">Error</text>
      <text class="diagram-small" x="199" y="198">input</text>
      <text class="diagram-small" x="404" y="152">valid</text>
      <text class="diagram-small" x="404" y="274">invalid</text>
    </svg>`;
  }

  if (type === "flowchart") {
    return `<svg class="mock-diagram" ${scale} viewBox="0 0 760 420" role="img" aria-label="Flowchart preview">
      <rect class="diagram-node" x="54" y="170" width="126" height="76" rx="12"></rect>
      <rect class="diagram-node is-accent" x="232" y="116" width="144" height="82" rx="12"></rect>
      <rect class="diagram-node" x="432" y="116" width="144" height="82" rx="12"></rect>
      <rect class="diagram-node" x="432" y="250" width="144" height="82" rx="12"></rect>
      <path class="diagram-line" d="M180 208H232M376 157H432M504 198V250"></path>
      <path class="diagram-muted-line" d="M304 198V290H432"></path>
      <text class="diagram-text" x="86" y="213">Input</text>
      <text class="diagram-text" x="267" y="161">Parse</text>
      <text class="diagram-text" x="461" y="161">Preview</text>
      <text class="diagram-text" x="467" y="296">Export</text>
      <text class="diagram-small" x="196" y="198">source</text>
      <text class="diagram-small" x="389" y="146">svg</text>
    </svg>`;
  }

  if (type === "class") {
    return `<svg class="mock-diagram" ${scale} viewBox="0 0 760 420" role="img" aria-label="Class diagram preview">
      <rect class="diagram-node is-accent" x="82" y="92" width="220" height="230" rx="10"></rect>
      <rect class="diagram-node" x="458" y="92" width="220" height="230" rx="10"></rect>
      <path class="diagram-muted-line" d="M82 148H302M82 232H302M458 148H678M458 232H678"></path>
      <path class="diagram-line" d="M302 206H458"></path>
      <text class="diagram-text" x="128" y="126">DiagramRenderer</text>
      <text class="diagram-small" x="112" y="178">source: string</text>
      <text class="diagram-small" x="112" y="204">status: RenderStatus</text>
      <text class="diagram-small" x="112" y="266">render()</text>
      <text class="diagram-small" x="112" y="292">dispose()</text>
      <text class="diagram-text" x="510" y="126">ExportService</text>
      <text class="diagram-small" x="488" y="178">svg: string</text>
      <text class="diagram-small" x="488" y="204">format: ExportType</text>
      <text class="diagram-small" x="488" y="266">toSvg()</text>
      <text class="diagram-small" x="488" y="292">toMarkdown()</text>
    </svg>`;
  }

  const erText = currentLocale === "zh"
    ? {
        customer: "客户",
        order: "订单",
        places: "下单",
        email: "邮箱",
        created: "创建时间",
        total: "总金额",
        status: "状态"
      }
    : {
        customer: "Customer",
        order: "Order",
        places: "Places",
        email: "Email",
        created: "Created At",
        total: "Total",
        status: "Status"
      };

  return `<svg class="mock-diagram" ${scale} viewBox="0 0 760 420" role="img" aria-label="ER diagram preview">
    <path class="diagram-muted-line" d="M190 210H294M466 210H570M150 174V116M150 246V304M106 210H54M610 174V116M610 246V304M654 210H706"></path>
    <path class="diagram-line" d="M310 210H450"></path>

    <rect class="diagram-node is-accent" x="78" y="176" width="144" height="68" rx="0"></rect>
    <rect class="diagram-node is-accent" x="538" y="176" width="144" height="68" rx="0"></rect>
    <path class="diagram-relationship" d="M380 142L450 210L380 278L310 210Z"></path>

    <ellipse class="diagram-attribute" cx="150" cy="86" rx="76" ry="34"></ellipse>
    <ellipse class="diagram-attribute" cx="150" cy="334" rx="82" ry="34"></ellipse>
    <ellipse class="diagram-attribute" cx="54" cy="210" rx="54" ry="31"></ellipse>
    <ellipse class="diagram-attribute" cx="610" cy="86" rx="76" ry="34"></ellipse>
    <ellipse class="diagram-attribute" cx="610" cy="334" rx="76" ry="34"></ellipse>
    <ellipse class="diagram-attribute" cx="706" cy="210" rx="54" ry="31"></ellipse>

    <circle class="diagram-attribute is-accent" cx="222" cy="210" r="4"></circle>
    <circle class="diagram-attribute is-accent" cx="538" cy="210" r="4"></circle>

    <text class="diagram-text" x="120" y="216">${erText.customer}</text>
    <text class="diagram-text" x="586" y="216">${erText.order}</text>
    <text class="diagram-text" x="358" y="216">${erText.places}</text>

    <text class="diagram-small" x="130" y="91">id PK</text>
    <text class="diagram-small" x="121" y="339">${erText.email}</text>
    <text class="diagram-small" x="30" y="215">${erText.created}</text>
    <text class="diagram-small" x="586" y="91">id PK</text>
    <text class="diagram-small" x="586" y="339">${erText.status}</text>
    <text class="diagram-small" x="684" y="215">${erText.total}</text>

    <text class="diagram-small" x="286" y="198">1</text>
    <text class="diagram-small" x="462" y="198">n</text>
  </svg>`;
}

function renderDiagram() {
  const config = templates[currentType];
  previewTitle.textContent = localizedValue(config.title);
  diagramKind.textContent = localizedValue(config.kind);
  diagramStage.classList.add("is-updating");
  setStatus("status.rendering", true);
  saveState.textContent = translate("status.saving");

  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    diagramStage.innerHTML = diagramMarkup(currentType);
    diagramStage.classList.remove("is-updating");
    setStatus("status.ready", false);
    saveState.textContent = translate("status.saved");
    errorSample.textContent = editor.value.includes("???") ? translate("status.unexpectedToken") : translate("status.noErrors");
    updateLineCount();
  }, 320);
}

function loadTemplate(type = currentType, template = currentTemplate) {
  currentType = type;
  currentTemplate = template;
  editor.value = templates[type][template];
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.type === type));
  templateButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.template === template));
  renderDiagram();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => loadTemplate(tab.dataset.type, "default"));
});

templateButtons.forEach((button) => {
  button.addEventListener("click", () => loadTemplate(currentType, button.dataset.template));
});

editor.addEventListener("input", () => {
  updateLineCount();
  renderDiagram();
});

document.querySelectorAll("[data-zoom]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.zoom;
    zoom = direction === "in" ? Math.min(1.3, zoom + 0.1) : Math.max(0.7, zoom - 0.1);
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    renderDiagram();
  });
});

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    exportNotice.textContent = translate("export.queued", { format: button.dataset.export });
  });
});

quickExport.addEventListener("click", () => {
  exportNotice.textContent = translate("export.queued", { format: "SVG" });
});

themeToggle.addEventListener("click", () => {
  const root = document.documentElement;
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
});

languageToggle.addEventListener("click", () => {
  currentLocale = currentLocale === "zh" ? "en" : "zh";
  applyStaticTranslations();
  renderDiagram();
});

applyStaticTranslations();
loadTemplate("er", "default");
