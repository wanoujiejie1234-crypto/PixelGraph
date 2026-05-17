import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { App } from './app/App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary
      fallback={(error) => (
        <div className="app-fatal-state">
          <strong>PixelGraph 遇到运行时错误</strong>
          <p>页面没有丢失数据。请刷新页面，或先清空本地草稿后重新打开。</p>
          <pre>{error.message}</pre>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
