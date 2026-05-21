interface Props {
  diagramType: string;
  onLoadExample?: () => void;
}

export function CanvasEmptyState({ diagramType, onLoadExample }: Props) {
  return (
    <div className="er-flow-shell">
      <div className="er-empty-state">
        <div className="er-empty-icon" aria-hidden="true">
          <svg height="48" viewBox="0 0 48 48" width="48">
            <rect fill="none" height="40" rx="6" stroke="currentColor" strokeWidth="2" width="40" x="4" y="4" />
            <path d="M16 24h16M24 16v16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </div>
        <h3>开始绘制</h3>
        <p>在左侧编辑器中输入 {diagramType} 源码，画布将自动生成可拖拽编辑的图形。</p>
        {onLoadExample ? (
          <button className="primary-button" onClick={onLoadExample} type="button">
            加载示例
          </button>
        ) : null}
      </div>
    </div>
  );
}
