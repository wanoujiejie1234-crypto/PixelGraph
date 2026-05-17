import type { DiagramTemplate, DiagramType } from '../diagrams/types';

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'er-sql-commerce',
    type: 'er',
    name: '订单数据模型',
    description: '从 CREATE TABLE、主键、外键和注释生成可编辑的数据库 ER 图。',
    erInputMode: 'sql',
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
  },
  {
    id: 'er-mermaid-commerce',
    type: 'er',
    name: 'Mermaid 订单 ER',
    description: '兼容 Mermaid ER 语法的客户、订单、商品和明细关系示例。',
    erInputMode: 'mermaid',
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
  },
  {
    id: 'class-rendering-workbench',
    type: 'class',
    name: '渲染工作台',
    description: '描述编辑器、渲染器、预览画布和导出服务之间的职责边界。',
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
  },
  {
    id: 'class-domain-model',
    type: 'class',
    name: '领域模型',
    description: '描述图表定义、模板、渲染结果和本地草稿之间的结构关系。',
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
  },
  {
    id: 'sequence-export-pipeline',
    type: 'sequence',
    name: '导出流水线',
    description: '从编辑源码到生成 SVG、PNG 和 Markdown 的完整调用链。',
    code: `sequenceDiagram
  actor User as 用户
  participant Editor as 文本编辑器
  participant Renderer as Mermaid 渲染器
  participant Preview as 预览画布
  participant Exporter as 导出服务
  User->>Editor: 修改图表源码
  Editor->>Renderer: 防抖后提交源码
  Renderer--)Preview: 异步返回 SVG 或错误信息
  User->>Exporter: 选择 SVG / PNG / Markdown
  Exporter->>Preview: 读取当前可导出图形
  Exporter--)User: 异步下载文件或显示失败原因`,
  },
  {
    id: 'sequence-login-review',
    type: 'sequence',
    name: '登录认证链路',
    description: '前端、API、认证服务和数据库之间的登录调用示例。',
    code: `sequenceDiagram
  actor Visitor as 访问者
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
  },
  {
    id: 'state-document-lifecycle',
    type: 'state',
    name: '文档生命周期',
    description: '技术文档从草稿、评审、发布到归档的状态流转。',
    code: `stateDiagram-v2
  [*] --> Draft
  Draft --> InReview: submit
  InReview --> Draft: changes requested
  InReview --> Approved: approved
  Approved --> Published: publish
  Published --> Archived: retire
  Archived --> [*]
  Draft --> Archived: discard`,
  },
  {
    id: 'state-payment-flow',
    type: 'state',
    name: '支付状态机',
    description: '订单支付从创建到成功、失败、退款的状态变化。',
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
  },
  {
    id: 'flowchart-rendering-decision',
    type: 'flowchart',
    name: '渲染决策流程',
    description: '根据图表类型选择 SQL ER 或 Mermaid 渲染路径。',
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
  },
  {
    id: 'flowchart-release-check',
    type: 'flowchart',
    name: '发布验收流程',
    description: '从功能完成到浏览器验收和构建检查的发布前流程。',
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
  },
];

export function getTemplatesByType(type: DiagramType): DiagramTemplate[] {
  return diagramTemplates.filter((template) => template.type === type);
}

export function getTemplateById(id: string): DiagramTemplate | undefined {
  return diagramTemplates.find((template) => template.id === id);
}
