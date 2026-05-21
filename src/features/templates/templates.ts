import type { DiagramTemplate, DiagramType } from '../diagrams/types';

export const diagramTemplates: DiagramTemplate[] = [
  {
    code: `CREATE TABLE users (
  id BIGINT PRIMARY KEY COMMENT '用户ID',
  email VARCHAR(120) NOT NULL COMMENT '邮箱',
  display_name VARCHAR(80) NOT NULL COMMENT '显示名',
  created_at DATETIME NOT NULL COMMENT '注册时间'
) COMMENT='用户';

CREATE TABLE products (
  id BIGINT PRIMARY KEY COMMENT '商品ID',
  sku VARCHAR(64) NOT NULL COMMENT '库存编码',
  name VARCHAR(120) NOT NULL COMMENT '商品名称',
  price DECIMAL(10,2) NOT NULL COMMENT '价格'
) COMMENT='商品';

CREATE TABLE orders (
  id BIGINT PRIMARY KEY COMMENT '订单ID',
  user_id BIGINT NOT NULL COMMENT '下单用户',
  status VARCHAR(32) NOT NULL COMMENT '订单状态',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  paid_at DATETIME COMMENT '支付时间',
  FOREIGN KEY (user_id) REFERENCES users(id)
) COMMENT='订单';

CREATE TABLE order_items (
  id BIGINT PRIMARY KEY COMMENT '明细ID',
  order_id BIGINT NOT NULL COMMENT '所属订单',
  product_id BIGINT NOT NULL COMMENT '购买商品',
  quantity INT NOT NULL COMMENT '购买数量',
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) COMMENT='订单明细';`,
    description: '从 CREATE TABLE、主键、外键和注释生成可编辑的数据库 ER 图。',
    erInputMode: 'sql',
    id: 'er-sql-commerce',
    name: '订单数据模型',
    type: 'er',
  },
  {
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : appears_in
  CUSTOMER {
    string id PK
    string email
    datetime created_at
  }
  ORDER {
    string id PK
    string customer_id FK
    decimal total_amount
    string status
  }
  PRODUCT {
    string id PK
    string sku
    string name
    decimal price
  }
  ORDER_ITEM {
    string order_id FK
    string product_id FK
    int quantity
  }`,
    description: 'Mermaid ER 语法示例。',
    erInputMode: 'mermaid',
    id: 'er-mermaid-commerce',
    name: 'Mermaid 订单 ER',
    type: 'er',
  },
  {
    code: `@startuml
title 充值流程活动图

partition 用户 {
  start
  :输入手机号码;
  :选择话费套餐;
}

partition 充值 APP {
  :生成、提交订单;
  :显示支付方式;
}

partition 管理后台 {
  :生成订单;
  if (支付结果?) then (成功)
    :更新支付状态;
    fork
      :发送充值请求;
    fork again
      :记录支付流水;
    end fork
  else (失败)
    :展示支付失败;
  endif
}

partition 手机运营商 {
  :接收充值请求;
  :执行充值;
  :通知充值结果;
}

note right of 更新支付状态
先主干，后分支
end note

:显示充值结果;
:获取充值结果;
stop
@enduml`,
    description: 'PlantUML 风格子集活动图模板。',
    id: 'activity-recharge-flow',
    name: '充值流程活动图',
    type: 'activity',
  },
  {
    code: `usecase 订单系统

actors
  顾客
  管理员
  支付平台 [external]
  VIP顾客

usecases
  浏览商品
  提交订单
  支付订单
  申请退款
  审核退款
  校验用户身份
  使用优惠券
  申请发票

associations
  顾客 -> 浏览商品
  顾客 -> 提交订单
  顾客 -> 支付订单
  顾客 -> 申请退款
  管理员 -> 审核退款
  支付平台 -> 支付订单

includes
  提交订单 -> 校验用户身份
  支付订单 -> 校验用户身份

extends
  使用优惠券 -> 提交订单
  申请发票 -> 提交订单

generalizations
  VIP顾客 -> 顾客`,
    description: '电商订单场景的 Use Case DSL 模板。',
    id: 'usecase-order-system',
    name: '订单系统用例图',
    type: 'usecase',
  },
  {
    code: `classDiagram
  class WorkspaceState {
    +DiagramType diagramType
    +string source
    +ThemeMode theme
    +updateSource(source)
    +switchDiagram(type)
  }
  class DiagramAdapter {
    +DiagramEngine engine
    +string sourceLanguage
    +render(source)
  }
  class MermaidRenderer {
    +parse(source)
    +renderSvg(source)
  }
  class ExportService {
    +copySource(source)
    +downloadSvg(svg)
    +downloadPng(svg, scale)
    +downloadMarkdown(source)
  }
  WorkspaceState --> DiagramAdapter
  DiagramAdapter --> MermaidRenderer
  MermaidRenderer --> ExportService`,
    description: '描述编辑器、渲染器、预览和导出服务之间的职责边界。',
    id: 'class-rendering-workbench',
    name: '渲染工作台',
    type: 'class',
  },
  {
    code: `classDiagram
  class DiagramDefinition {
    +DiagramType id
    +string label
    +string description
    +string defaultTemplateId
  }
  class DiagramTemplate {
    +string id
    +DiagramType type
    +string name
    +string code
  }
  class RenderResult {
    +RenderStatus status
    +string svg
    +string error
  }
  class LocalDraft {
    +string source
    +DiagramType type
    +string updatedAt
  }
  DiagramDefinition "1" --> "*" DiagramTemplate
  DiagramTemplate --> RenderResult
  LocalDraft --> DiagramDefinition`,
    description: '描述图表定义、模板和渲染结果之间的关系。',
    id: 'class-domain-model',
    name: '领域模型',
    type: 'class',
  },
  {
    code: `sequenceDiagram
  actor User as 用户
  participant Editor as 文本编辑器
  participant Renderer as Mermaid 渲染器
  participant Preview as 预览画布
  participant Exporter as 导出服务
  User->>Editor: 修改图表源码
  Editor->>Renderer: 防抖后提交源码
  Renderer--)Preview: 异步返回 SVG 或错误
  User->>Exporter: 选择 SVG / PNG / Markdown
  Exporter->>Preview: 读取当前导出图形
  Exporter--)User: 下载文件`,
    description: '从源码编辑到导出的调用链。',
    id: 'sequence-export-pipeline',
    name: '导出流水线',
    type: 'sequence',
  },
  {
    code: `sequenceDiagram
  actor Visitor as 访客
  participant Web as Web 客户端
  participant Api as API 服务
  participant Auth as 认证服务
  participant Db as 用户数据库
  Visitor->>Web: 输入账号和密码
  Web->>Api: POST /sessions
  Api->>Auth: 校验凭据
  Auth->>Db: 查询用户和权限
  Db-->>Auth: 返回用户记录
  Auth-->>Api: 签发访问令牌
  Api-->>Web: 返回登录结果
  Web-->>Visitor: 进入工作台`,
    description: '登录认证链路示例。',
    id: 'sequence-login-review',
    name: '登录认证链路',
    type: 'sequence',
  },
  {
    code: `stateDiagram-v2
  [*] --> Draft
  Draft --> InReview: submit
  InReview --> Draft: changes requested
  InReview --> Approved: approved
  Approved --> Published: publish
  Published --> Archived: retire
  Archived --> [*]
  Draft --> Archived: discard`,
    description: '文档生命周期状态图。',
    id: 'state-document-lifecycle',
    name: '文档生命周期',
    type: 'state',
  },
  {
    code: `stateDiagram-v2
  [*] --> Created
  Created --> PendingPayment: checkout
  PendingPayment --> Paid: payment confirmed
  PendingPayment --> Failed: payment failed
  Failed --> PendingPayment: retry
  Paid --> Fulfilled: ship order
  Paid --> Refunding: refund requested
  Refunding --> Refunded: refund completed
  Fulfilled --> Completed: received
  Completed --> [*]
  Refunded --> [*]`,
    description: '支付状态机。',
    id: 'state-payment-flow',
    name: '支付状态机',
    type: 'state',
  },
  {
    code: `flowchart TD
  Start([用户修改源码]) --> Detect{当前图表类型}
  Detect -->|SQL ER| ParseSql[解析 CREATE TABLE]
  Detect -->|Mermaid| ParseMermaid[解析 Mermaid 语法]
  ParseSql --> HasTables{找到数据表?}
  HasTables -->|是| BuildGraph[构建 ER 图模型]
  HasTables -->|否| SqlError[显示 SQL 提示]
  ParseMermaid --> MermaidOk{语法通过?}
  MermaidOk -->|是| RenderSvg[生成 SVG]
  MermaidOk -->|否| MermaidError[显示语法错误]
  BuildGraph --> Preview[更新预览画布]
  RenderSvg --> Preview
  SqlError --> EditAgain[返回编辑]
  MermaidError --> EditAgain`,
    description: '渲染决策流程图。',
    id: 'flowchart-rendering-decision',
    name: '渲染决策流程',
    type: 'flowchart',
  },
  {
    code: `flowchart LR
  Code[完成实现] --> Build[运行构建]
  Build --> BuildOk{构建通过?}
  BuildOk -->|否| FixBuild[修复类型或打包问题]
  FixBuild --> Build
  BuildOk -->|是| Browser[浏览器验收]
  Browser --> VisualOk{界面无重叠?}
  VisualOk -->|否| Polish[调整布局和样式]
  Polish --> Browser
  VisualOk -->|是| ExportCheck[验证导出]
  ExportCheck --> Ready([进入交付])`,
    description: '发布前验收流程。',
    id: 'flowchart-release-check',
    name: '发布验收流程',
    type: 'flowchart',
  },
  {
    code: `@startuml
title PixelGraph Rendering Workbench

package "Workspace Shell" as workspace {
  component "App Shell" as appShell [React]
  component "Source Editor" as sourceEditor [Code editing]
  component "Preview Stage" as previewStage [Viewport]
}

package "Diagram Engines" as engines {
  component "Mermaid Renderer" as mermaidRenderer [SVG]
  component "Activity Canvas" as activityCanvas [XYFlow]
  component "Use Case Canvas" as useCaseCanvas [XYFlow]
  component "Structure Canvas" as structureCanvas [XYFlow]
}

package "Core Services" as core {
  interface "Diagram Adapter" as diagramAdapter
  component "Export Service" as exportService [SVG / PNG / Markdown]
  component "Storage Service" as storageService [LocalStorage]
}

appShell ..> diagramAdapter : resolve type
sourceEditor ..> diagramAdapter : submit source
previewStage ..> mermaidRenderer : render Mermaid
previewStage ..> activityCanvas : render Activity
previewStage ..> useCaseCanvas : render Use Case
previewStage ..> structureCanvas : render Component / Deployment / Package
mermaidRenderer ..> exportService
activityCanvas ..> exportService
useCaseCanvas ..> exportService
structureCanvas ..> exportService
appShell ..> storageService : persist settings

diagramAdapter --> mermaidRenderer
diagramAdapter --> activityCanvas
diagramAdapter --> useCaseCanvas
diagramAdapter --> structureCanvas
@enduml`,
    description: 'PixelGraph component template.',
    id: 'component-pixelgraph-workbench',
    name: 'PixelGraph Rendering Workbench',
    type: 'component',
  },
  {
    code: `@startuml
title PixelGraph Local Deployment

cloud "User Workstation" as workstation {
  node "Browser" as browser [React 19]
  node "Vite Dev Server" as viteServer [localhost:5173]
}

node "Local Runtime" as runtime {
  execution "Main UI Thread" as uiThread in runtime [DOM + Canvas]
  execution "ELK Layout Worker" as elkRuntime in runtime [elkjs]
}

database "Local Storage" as localStorage [drafts / settings]
artifact "pixelgraph-app.bundle.js" as appBundle [frontend bundle]
artifact "diagram-export.svg" as exportSvg [generated]

browser -- viteServer : HTTP / HMR
browser -- runtime : user interaction
uiThread -- localStorage : Web Storage API
uiThread -- elkRuntime : layout jobs
uiThread -- exportSvg : generate export
appBundle ..> uiThread : loaded into
@enduml`,
    description: 'PixelGraph deployment template.',
    id: 'deployment-pixelgraph-local',
    name: 'PixelGraph Local Deployment',
    type: 'deployment',
  },
  {
    code: `@startuml
title PixelGraph Layered Modules

package "app" as appPkg {
  frame "shell" as shellPkg {
    folder "entry" as entryPkg
    folder "workspace" as workspacePkg
  }
}

package "features" as featuresPkg {
  package "diagrams" as diagramsPkg
  package "renderer" as rendererPkg
  package "editor" as editorPkg
  package "export" as exportPkg
  package "storage" as storagePkg
  package "templates" as templatesPkg
  package "i18n" as i18nPkg
}

package "shared" as sharedPkg {
  folder "types" as typesPkg
  folder "utils" as utilsPkg
}

appPkg ..> featuresPkg
entryPkg ..> diagramsPkg
workspacePkg ..> rendererPkg
workspacePkg ..> editorPkg
workspacePkg ..> exportPkg
workspacePkg ..> storagePkg
rendererPkg ..> sharedPkg
editorPkg ..> sharedPkg
templatesPkg ..> diagramsPkg
storagePkg ..> diagramsPkg
featuresPkg ..> sharedPkg <<import>>
rendererPkg ..> sharedPkg <<merge>>
@enduml`,
    description: 'PixelGraph package template.',
    id: 'package-pixelgraph-layered',
    name: 'PixelGraph Layered Modules',
    type: 'package',
  },
];

export function getTemplatesByType(type: DiagramType): DiagramTemplate[] {
  return diagramTemplates.filter((template) => template.type === type);
}

export function getTemplateById(id: string): DiagramTemplate | undefined {
  return diagramTemplates.find((template) => template.id === id);
}
