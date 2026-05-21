# PixelGraph

PixelGraph 是一个本地优先的图表生成工作台，用文本快速生成软件工程常用图表。它适合写技术方案、README、接口文档、课程作业、系统设计说明，以及需要把结构化想法快速变成图的开发场景。

项目基于 React、TypeScript 和 Vite 构建，支持实时预览、本地草稿保存、图形样式调整，以及 SVG、PNG、Markdown 导出。

## 功能特性

- 支持多种图表类型：ER 图、活动图、用例图、组件图、部署图、包图、类图、时序图、状态图、流程图。
- SQL 建表语句生成 ER 图，支持主键、外键、字段类型和注释解析。
- Mermaid 图表实时渲染，覆盖常见的 classDiagram、sequenceDiagram、stateDiagram、flowchart、erDiagram。
- PlantUML 风格子集渲染，支持活动图、组件图、部署图、包图等结构图。
- 自定义 Use Case DSL，用更轻量的文本描述用例、参与者和 UML 关系。
- 实时预览、缩放、适配视图、全屏查看。
- 图形节点可视化编辑，部分图表支持从画布反向同步源码。
- 支持浅色 / 深色主题，以及节点颜色、线条、字体、间距等显示设置。
- 自动保存最近编辑内容和显示设置到浏览器 LocalStorage。
- 支持复制源码，导出 SVG、PNG 和 Markdown。
- 内置 AI 面板，可通过配置模型接口辅助生成或修改图表源码。

## 技术栈

- React 19
- TypeScript
- Vite
- Mermaid
- XYFlow
- ELK.js
- Vitest

## 快速开始

### 环境要求

建议使用 Node.js 20 或更高版本。

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

启动后在浏览器中打开终端提示的本地地址，通常是：

```text
http://localhost:5173
```

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

### 运行测试

```bash
npm test
```

## 使用方式

1. 在顶部选择图表类型。
2. 在左侧编辑器输入 SQL、Mermaid、PlantUML 风格 DSL 或项目内置 DSL。
3. 右侧会自动生成图表预览。
4. 根据需要调整主题、颜色、线条、间距、显示字段等设置。
5. 点击复制源码，或导出 SVG、PNG、Markdown。

## 支持的图表输入

| 图表类型 | 输入格式 |
| --- | --- |
| ER 图 | SQL `CREATE TABLE` 或 Mermaid `erDiagram` |
| 活动图 | PlantUML 风格 Activity DSL |
| 用例图 | PixelGraph Use Case DSL |
| 组件图 | PlantUML 风格 Component DSL |
| 部署图 | PlantUML 风格 Deployment DSL |
| 包图 | PlantUML 风格 Package DSL |
| 类图 | Mermaid `classDiagram` |
| 时序图 | Mermaid `sequenceDiagram` |
| 状态图 | Mermaid `stateDiagram-v2` |
| 流程图 | Mermaid `flowchart` |

## AI 配置

AI 面板是可选能力。默认配置文件位于：

```text
src/features/ai/config.ts
```

你可以在这里修改模型服务地址、API Key 和模型名称：

```ts
export const AI_CONFIG = {
  endpoint: 'https://api.deepseek.com/v1',
  apiKey: 'your-api-key',
  model: 'deepseek-chat',
};
```

如果不需要 AI 功能，核心图表编辑、预览和导出能力仍然可以正常使用。

> 注意：不要把真实 API Key 提交到公开仓库。建议后续改为环境变量或运行时配置。

## 项目结构

```text
PixelGraph
├── demo/                  # 静态演示版本
├── docs/                  # 需求、架构和缺陷分析文档
├── src/
│   ├── app/               # 应用入口和主界面
│   ├── features/
│   │   ├── ai/            # AI 面板、提示词和工具调用
│   │   ├── diagrams/      # 图表类型、适配器和定义
│   │   ├── editor/        # 源码编辑器
│   │   ├── export/        # SVG、PNG、Markdown 导出
│   │   ├── i18n/          # 中英文界面文案
│   │   ├── renderer/      # 各类图表渲染器和模型
│   │   ├── storage/       # LocalStorage 持久化
│   │   └── templates/     # 内置图表模板
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
└── vite.config.ts
```

## 开发脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run build` | TypeScript 检查并构建生产版本 |
| `npm run preview` | 本地预览生产构建 |
| `npm test` | 运行 Vitest 测试 |
| `npm run test:watch` | 以监听模式运行测试 |

## 本地优先说明

PixelGraph 的核心编辑内容和界面设置默认保存在浏览器 LocalStorage 中。图表源码不会因为普通编辑和预览流程上传到服务器。只有在主动使用 AI 面板时，相关输入才可能发送到你配置的模型服务。

## 适用场景

- 数据库表结构和关系梳理
- 系统设计与架构说明
- 接口调用链和业务流程说明
- 状态机、审批流、订单流转描述
- README、Wiki、技术方案和教学材料配图

## 许可证

当前仓库尚未声明许可证。如需开源发布，建议补充 `LICENSE` 文件并在本节明确授权方式。
