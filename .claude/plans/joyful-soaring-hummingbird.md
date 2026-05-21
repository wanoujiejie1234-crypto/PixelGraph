# 时序图专业级视觉改进计划

## 上下文

用户反馈时序图渲染效果不理想："全是矩形，竖着的线不能根据实际自适应"。虽然之前已修复 ELK 布局问题（生命线水平排列、消息按时间顺序垂直排列），但视觉效果仍显简陋。

对标 Astah UML 工具，当前缺失的关键特性：
- **激活框**（Activation Box）：生命线上表示参与者活跃状态的细长矩形，是时序图最具辨识度的视觉元素
- **同步/异步箭头区分**：同步消息用实心箭头，异步用开放箭头
- **自消息**（Self-message）：同一条生命线上给自己发消息的回路路径
- **Actor/参与者的视觉区分**：Actor 应有不同样式（如人头图标）
- **片段框自适应**：alt/opt/loop 等片段框应包裹对应的消息区域
- **SVG 导出不正确**：导出时未使用时序图的 Y 坐标计算

## 实现方案

### 架构决策

**保持 ReactFlow 框架**，通过节点数据传递、自定义边路径、CSS 样式增强来提升视觉效果。不重写为纯 SVG 方案，因为：
- ReactFlow 的拖拽、缩放、编辑标签等功能已正常工作
- 激活框等新元素可渲染为生命线节点的子元素
- 开发量 ~20 行 vs 纯 SVG 方案 ~500-800 行

### 改动项（按实现顺序排列）

---

#### 1. 提取 Y 定位常量为共享导出

**文件**: `src/features/renderer/simpleFlowEdges.tsx`
- 将 `SEQUENCE_MESSAGE_START_Y` 和 `SEQUENCE_MESSAGE_STEP` 从模块常量改为 `export const`

**文件**: `src/features/renderer/simpleCanvasModel.ts`
- 添加 `export const SEQUENCE_MESSAGE_START_Y = 174;`
- 添加 `export const SEQUENCE_MESSAGE_STEP = 52;`
- 从 `simpleFlowEdges.tsx` 移除常量定义并改为导入

**原因**: 激活框计算、生命线高度计算、SVG 导出都需要使用相同的 Y 定位常量，集中定义防止偏移不一致。

---

#### 2. 同步消息箭头区分

**文件**: `src/features/renderer/DiagramMarkers.tsx`
- 已有 `pg-structure-solid-arrow`（实心三角箭头），可重用
- 无需新增 marker

**文件**: `src/features/renderer/simpleFlowEdges.tsx`
- `markerForKind()` 中：
  - `kind === 'message'` 返回 `'pg-structure-solid-arrow'`（实心三角，即标准 UML 同步调用）
  - `kind === 'asyncMessage'` 返回 `'pg-open-arrow'`（V 形，异步调用）
  - `kind === 'reply'` 返回 `'pg-open-arrow'`（V 形，返回消息）

---

#### 3. 自适应生命线高度

**文件**: `src/features/renderer/SimpleCanvas.tsx`
- 当前公式：`max(280, 150 + edgeCount * 52)`
- 改为基于最后一条消息的实际 Y 位置计算：

```typescript
const LIFELINE_TOP_Y = 80;
const lastMessageY = edgeCount > 0
  ? SEQUENCE_MESSAGE_START_Y + (edgeCount - 1) * SEQUENCE_MESSAGE_STEP 
  : SEQUENCE_MESSAGE_START_Y;
const lifelineHeight = Math.max(280, (lastMessageY - LIFELINE_TOP_Y) + 60);
```

- 导入 `SEQUENCE_MESSAGE_START_Y` 和 `SEQUENCE_MESSAGE_STEP`

---

#### 4. 激活框（核心改动）

**文件**: `src/features/renderer/simpleCanvasModel.ts`
- 添加 `ActivationRange` 接口：

```typescript
export interface ActivationRange {
  participantId: string;
  startSequenceIndex: number;
  endSequenceIndex: number;
  depth: number;
}
```

- 添加 `computeActivations()` 函数：
  - 按 `sequenceIndex` 顺序遍历边
  - 遇到 `message`（同步）时：压栈 `{ participantId: edge.to, startSequenceIndex, depth }`
  - 遇到 `reply` 时：从栈顶向下查找匹配的 `participantId === edge.from`，记录 `ActivationRange` 并出栈
  - 栈中在匹配项之上的条目（嵌套调用）也一并弹出，标记 `endSequenceIndex` 为当前索引
  - 遍历结束后，栈中剩余项以最后索引作为结束

- 在 `SimpleGraphNodeData` 中添加 `activations?: ActivationRange[]`
- 在 `buildSimpleGraph()` 中：
  - 调用 `computeActivations(model.edges)`
  - 为每个 lifeline 节点过滤并赋值 `node.data.activations`

**文件**: `src/features/renderer/simpleFlowNodes.tsx`
- 在 `SimpleLifelineNode` 中 `<div className="simple-lifeline-line" />` 之后添加激活框渲染：

```tsx
{props.data.activations?.map((act, idx) => {
  const nodeY = props.position?.y ?? 0;
  const top = SEQUENCE_MESSAGE_START_Y + act.startSequenceIndex * SEQUENCE_MESSAGE_STEP - nodeY + 2;
  const bottom = SEQUENCE_MESSAGE_START_Y + act.endSequenceIndex * SEQUENCE_MESSAGE_STEP - nodeY - 2;
  const width = 10 + act.depth * 4;
  return (
    <div key={idx} className="simple-activation-box"
      style={{ top: `${top}px`, height: `${Math.max(4, bottom - top)}px`, width: `${width}px` }}
    />
  );
})}
```

- 导入 `SEQUENCE_MESSAGE_START_Y`, `SEQUENCE_MESSAGE_STEP`

**文件**: `src/styles.css`
- 添加：

```css
.simple-activation-box {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--er-stroke, var(--ink));
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
}
```

---

#### 5. 自消息回路

**文件**: `src/features/renderer/simpleFlowEdges.tsx`
- 在 `getPath()` 的 sequence message 分支中检测自消息：

```typescript
if (isSequenceMessage && Math.abs(props.sourceX - props.targetX) < 1) {
  const w = 36, h = 28;
  const path = `M ${props.sourceX} ${messageY} L ${props.sourceX + w} ${messageY} L ${props.sourceX + w} ${messageY + h} L ${props.sourceX} ${messageY + h}`;
  return [path, props.sourceX + w + 16, messageY + h / 2] as const;
}
```

- 自消息的 label 位置在回路右侧

---

#### 6. Actor 视觉区分

**文件**: `src/features/renderer/simpleFlowNodes.tsx`
- 当 `stereotype === 'actor'` 时：
  - 添加 `.is-actor` CSS class 到根容器
  - 在头部渲染 SVG 小人图标替代 `«actor»` 文字
  - 头部添加 flexbox 布局：图标 + 名字

**文件**: `src/styles.css`
- 添加 `.simple-lifeline-node.is-actor` 相关样式
- 添加 `.simple-actor-icon`（18x18 SVG 人头轮廓）

---

#### 7. 片段框解析增强和自适应定位

**文件**: `src/features/renderer/simpleCanvasModel.ts`
- 在 `parseSequenceModel()` 中：
  - 检测 `end` 关键字（闭合片段）
  - 维护 `activeFragmentStack` 跟踪开启的片段
  - 为每个片段节点计算 `fragmentMessageRange: { startIndex: number; endIndex: number }`
  - 在 `SimpleNodeDefinition` 中添加可选 `fragmentMessageRange` 字段

**文件**: `src/features/renderer/SimpleCanvas.tsx`
- 在 sequence 分支中，计算片段位置：
  - X: 从第一个生命线的 X 偏移 10px
  - Y: 从覆盖的第一条消息的 Y 开始
  - Width: 跨越所有生命线宽度
  - Height: 从第一条到最后一条消息的 Y 范围
  - 确保片段 `pointer-events: none` 不干扰生命线操作

**文件**: `src/features/renderer/simpleCanvasModel.ts` - `SimpleGraphNodeData` 中添加 `fragmentMessageRange`

---

#### 8. SVG 导出修正

**文件**: `src/features/renderer/simpleSvgExport.ts`
- 边渲染：检测 `edge.data?.sequenceIndex`，使用时序 Y 坐标替代 `source.y + source.height / 2`

```typescript
const seqIndex = edge.data?.sequenceIndex;
const sy = seqIndex !== undefined ? SEQUENCE_MESSAGE_START_Y + seqIndex * SEQUENCE_MESSAGE_STEP : source.y + source.height / 2;
const ty = seqIndex !== undefined ? sy : target.y + target.height / 2;
```

- 自消息：在 SVG 中绘制回路路径
- `marker()` 函数：添加 `'message'` 类型返回实心三角箭头 marker
- 在 SVG `<defs>` 中添加 `syncArrow` 实心三角 marker
- viewBox 计算：包含边 Y 坐标到范围计算中

---

## 修改文件列表

| 文件 | 改动内容 |
|------|----------|
| `src/features/renderer/simpleFlowEdges.tsx` | 导出 Y 常量，自消息回路，箭头类型区分 |
| `src/features/renderer/simpleCanvasModel.ts` | `ActivationRange`、`computeActivations()`、`fragmentMessageRange`、导出 Y 常量、片段解析增强 |
| `src/features/renderer/SimpleCanvas.tsx` | 激活框数据注入、片段定位、生命线高度公式更新 |
| `src/features/renderer/simpleFlowNodes.tsx` | 激活框渲染、Actor 图标 |
| `src/features/renderer/DiagramMarkers.tsx` | 无需改动（重用 `pg-structure-solid-arrow`） |
| `src/features/renderer/simpleSvgExport.ts` | 时序图 Y 坐标、自消息回路、实心箭头 marker |
| `src/styles.css` | `.simple-activation-box`、Actor 样式 |

## 验证方法

1. `npm run build` — TypeScript 编译 + Vite 打包通过
2. `npm test` — 全部 147 个测试通过（解析器改动向后兼容）
3. 手动验证：加载"导出流水线"和"登录认证链路"模板，检查：
   - 激活框在目标生命线上正确显示
   - 同步消息(->>)为实心箭头，异步(-\))为开放箭头
   - Actor（用户）与 Participant 视觉不同
   - 生命线高度刚好覆盖最后一条消息
   - SVG 导出内容与画布显示一致
4. 添加 `computeActivations` 单元测试（可选）
