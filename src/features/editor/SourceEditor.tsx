interface Props {
  error: string | null;
  formatLabel: string;
  lineCountLabel: string;
  onChange: (value: string) => void;
  onFormat: () => void;
  placeholder: string;
  source: string;
  textColor: string;
  title: string;
}

function getLineNumbers(source: string): number[] {
  const count = source.length === 0 ? 1 : source.split('\n').length;
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function SourceEditor({ error, formatLabel, lineCountLabel, onChange, onFormat, placeholder, source, textColor, title }: Props) {
  const lineNumbers = getLineNumbers(source);

  return (
    <div className="source-editor">
      <div className="source-editor-toolbar">
        <span>{title}</span>
        <button className="text-button" onClick={onFormat} type="button">
          {formatLabel}
        </button>
      </div>
      <div className={`source-editor-body ${error ? 'has-error' : ''}`}>
        <pre className="line-numbers" aria-hidden="true">
          {lineNumbers.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </pre>
        <textarea
          aria-label={title}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{ color: textColor }}
          value={source}
        />
      </div>
      <div className="source-editor-status">
        <span>{error ?? lineCountLabel}</span>
      </div>
    </div>
  );
}
