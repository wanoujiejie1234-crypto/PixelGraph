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

建议使用 Node.js 20 或更高版本，并确认 npm 可以正常使用。

在终端中执行：

```bash
node -v
npm -v
```

如果提示找不到 `node` 或 `npm`，请先安装 Node.js。建议安装 Node.js LTS 版本，安装后重新打开终端再执行上面的检查命令。

> Windows PowerShell 用户注意：如果执行 `npm` 时看到 “因为在此系统上禁止运行脚本” 之类的报错，可以把命令里的 `npm` 改成 `npm.cmd`。例如使用 `npm.cmd install`、`npm.cmd run dev`。

### 安装依赖

首次运行项目需要先安装依赖。推荐使用锁文件安装，确保依赖版本和仓库一致：

```bash
npm ci
```

如果你只是本地开发，也可以使用：

```bash
npm install
```

安装成功后，项目根目录会生成 `node_modules/` 目录。这是本地依赖目录，不需要提交到 Git。

### 启动开发服务

```bash
npm run dev
```

如果你使用 Windows PowerShell 且 `npm run dev` 被脚本策略拦截，请改用：

```bash
npm.cmd run dev
```

启动成功后，终端通常会显示类似内容：

```text
VITE ready in xxx ms
Local: http://localhost:5173/
```

在浏览器中打开终端提示的本地地址即可使用。常见地址是：

```text
http://localhost:5173/
```

如果 5173 端口被占用，Vite 可能会自动换到 `5174`、`5175` 等端口。请以终端实际输出的 `Local` 地址为准。

### 验证是否启动成功

启动后可以通过以下现象确认项目已经正常运行：

- 浏览器页面标题或界面中能看到 `PixelGraph`。
- 修改左侧文本后，右侧图表预览会随之变化。
- 终端没有持续打印红色错误堆栈。

也可以在另一个终端中执行：

```bash
curl http://localhost:5173/
```

如果能返回 HTML 内容，说明开发服务已经响应。

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 预览生产构建

需要先执行一次 `npm run build`，再运行：

```bash
npm run preview
```

预览服务启动后，同样打开终端提示的本地地址。

### 运行测试

```bash
npm test
```

如果需要在改代码时持续运行测试：

```bash
npm run test:watch
```

### 常见启动问题

#### PowerShell 禁止运行 npm

报错示例：

```text
无法加载文件 C:\Program Files\nodejs\npm.ps1，因为在此系统上禁止运行脚本
```

解决方式之一是使用 `npm.cmd`：

```bash
npm.cmd ci
npm.cmd run dev
```

也可以改用 CMD、Git Bash、Windows Terminal 中的其他 shell。

#### 端口被占用

如果 `5173` 端口被占用，可以指定一个新端口：

```bash
npm run dev -- --port 5174
```

Windows PowerShell 中可使用：

```bash
npm.cmd run dev -- --port 5174
```

#### 依赖安装失败

可以按下面顺序排查：

1. 确认 Node.js 版本为 20 或更高：`node -v`。
2. 删除本地依赖后重新安装：删除 `node_modules/`，再执行 `npm ci`。
3. 如果网络较慢或 npm registry 无法访问，换一个网络环境后重试。

#### 页面空白或图表不刷新

可以尝试：

1. 刷新浏览器页面。
2. 停止开发服务后重新执行 `npm run dev`。
3. 打开浏览器开发者工具，查看 Console 是否有红色错误。
4. 执行 `npm test` 和 `npm run build`，确认代码和类型检查是否通过。

### 清理本地运行产物

如果只是试运行项目，结束后可以删除这些本地生成内容：

```text
node_modules/
dist/
```

其中 `node_modules/` 是依赖目录，删除后下次运行前需要重新执行 `npm ci` 或 `npm install`；`dist/` 是生产构建产物，可以随时通过 `npm run build` 重新生成。

如果你手动把开发服务输出重定向到了日志文件，例如 `vite-dev.out.log` 或 `vite-dev.err.log`，这些日志也可以删除。

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
