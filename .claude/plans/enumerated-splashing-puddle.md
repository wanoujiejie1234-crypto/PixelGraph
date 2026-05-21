# AI Agent 数据流修复 + 解析器校验

## 问题

1. **AI 写代码到编辑器不生效**：`AIPanel.tsx` 的 `buildContext()` 创建 context 对象时，`source` 被闭包捕获为快照值。`DiagramAgent` 只创建一次，永久持有这个旧 context。`writeSource` 调用 `context.setSource(code)` 虽能更新 React state，但 agent 的 `context.source` 仍是旧值，导致 `readSource` 返回空、诊断不准。

2. **生成的 DSL 语法错误无反馈**：`writeSource` 直接把代码写入编辑器，没有经过解析器校验。代码有语法错误也不会通知 LLM 修正。

## 方案

### 1. AIPanel.tsx — 用 ref + getter 解决 stale context

当前 `buildContext` 返回普通对象，属性被闭包捕获：

```
() => ({ source })  // source 是创建时的值
```

改为用 ref 存储可变值，getter 实时读取：

```typescript
const sourceRef = useRef(source);
sourceRef.current = source; // 每次渲染更新

const buildContext = useCallback(() => ({
  get source() { return sourceRef.current; },
  get diagramType() { return diagramTypeRef.current; },
  get erInputMode() { return erInputModeRef.current; },
  setSource,
  setDiagramType,
  setErInputMode,
  onStatusChange: (s) => setStatus(s),
  onMessage: (content) => setMessages(prev => [...prev, { ... }]),
}), [setSource, setDiagramType, setErInputMode]); // 只依赖稳定函数
```

效果：`readSource` 永远返回最新源码，`writeSource`/`switchDiagram` 写入后后续工具调用能读到新值。

### 2. tools.ts — writeSource 加入解析器校验

引入项目已有的 4 个校验函数：

| 图类型 | 校验函数 | 文件 |
|--------|----------|------|
| ER SQL | `validateSqlErSource(sql)` | `sqlErModel.ts` |
| Activity | `validateActivitySource(source)` | `activityModel.ts` |
| UseCase | `validateUseCaseSource(source)` | `useCaseModel.ts` |
| 结构图 | `validateStructureSource(source, kind)` | `structureModel.ts` |

在 `writeSource` 的 `execute` 中：
1. 根据 `context.diagramType` 和 `context.erInputMode` 选校验器
2. 调用校验函数
3. 如果没有致命错误 (`!hasFatalError`)，写入并返回成功
4. 如果有致命错误，**不写入**，返回错误信息 `"语法错误: ..."`
5. LLM 看到错误后会在下一轮 self-correct

对于 Mermaid 类型（class/sequence/state/flowchart）和 ER Mermaid 模式，跳过校验。

### 3. agent.ts — 跟踪当前图类型

`switchDiagram` 执行时更新 React state 是异步的，但 agent 在同一个 LLM turn 中可能马上调用 `writeSource`。需要 agent 自己跟踪：

```typescript
private pendingDiagramType?: DiagramType;
private pendingErInputMode?: ErInputMode;
```

工具执行循环中判断：
```typescript
if (call.name === 'switchDiagram') {
  this.pendingDiagramType = call.args.type as DiagramType;
  this.pendingErInputMode = call.args.erInputMode as ErInputMode | undefined;
}
```

将 pending 值传给 `createTools` 作为备选图类型，确保 `writeSource` 校验时用正确的解析器。

### 4. types.ts — 扩展 AgentContext

添加可选的 pending 字段，让 `tools.ts` 能读到 agent 跟踪的值：

```typescript
export interface AgentContext {
  // ... 现有字段
  /** agent 内部跟踪的下一个图类型（switchDiagram 设置，writeSource 使用） */
  _pendingDiagramType?: DiagramType;
  _pendingErInputMode?: ErInputMode;
}
```

### 5. 测试更新

- `tools.test.ts`（新建或追加到 ai.test.ts）：测试 writeSource 校验行为
  - writeSource 拒绝无效的 Activity 代码
  - writeSource 接收有效的 Activity 代码
  - Mermaid 类型跳过校验

## 修改的文件

| 文件 | 修改 |
|------|------|
| `src/features/ai/AIPanel.tsx` | ref + getter 替代闭包捕获 |
| `src/features/ai/tools.ts` | writeSource 加入解析器校验 |
| `src/features/ai/agent.ts` | 跟踪 pendingDiagramType |
| `src/features/ai/types.ts` | 添加 `_pendingDiagramType` 等字段 |
| `src/features/ai/ai.test.ts` | 新增 writeSource 校验测试 |

## 验证

1. `npx vitest run src/features/ai/` — 全部测试通过
2. 手动测试：在 AI 面板发送"画一个活动图"，确认生成代码写入编辑器
3. 手动测试：输入有语法错误的 DSL，观察 AI 返回错误信息并重试
