import type { DiagramTemplate, DiagramType } from '../diagrams/types';

export const diagramTemplates: DiagramTemplate[] = [
  {
    id: 'er-sql-orders',
    type: 'er',
    name: 'SQL 订单 ER',
    description: '用 CREATE TABLE、主键、外键和注释生成标准 Chen ER 图。',
    erInputMode: 'sql',
    code: `CREATE TABLE users (
  id BIGINT PRIMARY KEY COMMENT '用户ID',
  username VARCHAR(80) NOT NULL COMMENT '用户名',
  age INT COMMENT '年龄',
  created_at DATETIME COMMENT '注册时间'
) COMMENT='用户';

CREATE TABLE products (
  id BIGINT PRIMARY KEY COMMENT '商品ID',
  name VARCHAR(120) NOT NULL COMMENT '商品名称',
  price DECIMAL(10,2) NOT NULL COMMENT '价格'
) COMMENT='商品';

CREATE TABLE purchases (
  id BIGINT PRIMARY KEY COMMENT '购买记录ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  quantity INT NOT NULL COMMENT '数量',
  paid_at DATETIME COMMENT '支付时间',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) COMMENT='购买';`,
  },
  {
    id: 'er-mermaid-orders',
    type: 'er',
    name: 'Mermaid 订单 ER',
    description: 'Mermaid ER 语法示例，用于兼容已有 Mermaid 工作流。',
    erInputMode: 'mermaid',
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : appears_in
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
    string name
    decimal price
  }
  LINE_ITEM {
    string order_id FK
    string product_id FK
    int quantity
  }`,
  },
  {
    id: 'class-renderer',
    type: 'class',
    name: '渲染模块',
    description: '编辑器、渲染器和导出服务之间的依赖。',
    code: `classDiagram
  class EditorState {
    +string diagramCode
    +DiagramType diagramType
    +setCode(source)
  }
  class MermaidRenderer {
    +render(source) RenderResult
    +dispose()
  }
  class ExportService {
    +copySource()
    +downloadSvg()
    +downloadPng()
    +downloadMarkdown()
  }
  EditorState --> MermaidRenderer
  MermaidRenderer --> ExportService`,
  },
  {
    id: 'class-domain',
    type: 'class',
    name: '领域对象',
    description: '模板、图表定义和渲染结果的结构。',
    code: `classDiagram
  class DiagramDefinition {
    +DiagramType id
    +string label
    +string defaultTemplateId
  }
  class DiagramTemplate {
    +string id
    +DiagramType type
    +string code
  }
  class RenderResult {
    +RenderStatus status
    +string svg
    +string error
  }
  DiagramDefinition --> DiagramTemplate
  DiagramTemplate --> RenderResult`,
  },
  {
    id: 'sequence-export',
    type: 'sequence',
    name: '导出流程',
    description: '用户从编辑到导出的完整调用链。',
    code: `sequenceDiagram
  participant User as 用户
  participant Editor as 编辑器
  participant Renderer as Mermaid渲染器
  participant Exporter as 导出模块
  User->>Editor: 修改 Mermaid 源码
  Editor->>Renderer: 300ms 防抖渲染
  Renderer-->>Editor: 返回 SVG 或错误
  User->>Exporter: 选择导出格式
  Exporter-->>User: 下载文件或复制文本`,
  },
  {
    id: 'sequence-login',
    type: 'sequence',
    name: '登录接口',
    description: '常见前后端登录调用示例。',
    code: `sequenceDiagram
  participant Client as Web客户端
  participant Api as API服务
  participant Auth as 认证服务
  participant Db as 数据库
  Client->>Api: 提交账号与密码
  Api->>Auth: 校验凭据
  Auth->>Db: 查询用户与权限
  Db-->>Auth: 返回用户记录
  Auth-->>Api: 签发访问令牌
  Api-->>Client: 返回登录结果`,
  },
  {
    id: 'state-draft',
    type: 'state',
    name: '草稿状态',
    description: '图表从编辑到渲染完成的状态流。',
    code: `stateDiagram-v2
  [*] --> Draft
  Draft --> Rendering: source changed
  Rendering --> Ready: render success
  Rendering --> Error: render failed
  Error --> Draft: edit again
  Ready --> Draft: continue editing`,
  },
  {
    id: 'state-order',
    type: 'state',
    name: '订单状态',
    description: '订单生命周期状态机。',
    code: `stateDiagram-v2
  [*] --> Created
  Created --> Paid: payment confirmed
  Paid --> Fulfilled: shipped
  Paid --> Refunded: refund requested
  Fulfilled --> Completed: received
  Refunded --> [*]
  Completed --> [*]`,
  },
  {
    id: 'flowchart-generation',
    type: 'flowchart',
    name: '图表生成',
    description: 'PixelGraph 第一阶段核心闭环。',
    code: `flowchart LR
  Input[输入 Mermaid 文本] --> Debounce[防抖等待]
  Debounce --> Render[Mermaid 渲染]
  Render --> Preview[实时预览]
  Preview --> Export[导出 SVG PNG Markdown]
  Input --> Storage[本地保存草稿]
  Render --> Error[错误提示]`,
  },
  {
    id: 'flowchart-review',
    type: 'flowchart',
    name: '方案评审',
    description: '技术方案从提交到发布的流程。',
    code: `flowchart TB
  Draft[编写方案] --> Review[团队评审]
  Review --> Approved{是否通过}
  Approved -->|是| Publish[发布到文档库]
  Approved -->|否| Revise[修改方案]
  Revise --> Review`,
  },
];

export function getTemplatesByType(type: DiagramType): DiagramTemplate[] {
  return diagramTemplates.filter((template) => template.type === type);
}

export function getTemplateById(id: string): DiagramTemplate | undefined {
  return diagramTemplates.find((template) => template.id === id);
}
