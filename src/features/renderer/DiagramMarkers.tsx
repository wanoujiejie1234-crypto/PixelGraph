interface Props {
  fillColor?: string;
  strokeColor?: string;
}

export function DiagramMarkers({ fillColor = '#ffffff', strokeColor = '#171817' }: Props) {
  return (
    <svg id="pg-system-defs" aria-hidden="true" focusable="false" height="0" width="0">
      <defs>
        <marker id="pg-arrow" markerHeight="16" markerUnits="strokeWidth" markerWidth="14" orient="auto-start-reverse" refX="12" refY="7" viewBox="0 0 14 14">
          <path d="M1 1 12 7 1 13" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </marker>
        <marker id="pg-open-arrow" markerHeight="16" markerUnits="strokeWidth" markerWidth="14" orient="auto-start-reverse" refX="12" refY="7" viewBox="0 0 14 14">
          <path d="M1 1 12 7 1 13" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </marker>
        <marker id="pg-hollow-triangle" markerHeight="18" markerUnits="strokeWidth" markerWidth="22" orient="auto-start-reverse" refX="18" refY="9" viewBox="0 0 22 18">
          <path d="M2 2 19 9 2 16Z" fill={fillColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1.8" />
        </marker>
        <marker id="pg-solid-diamond" markerHeight="18" markerUnits="strokeWidth" markerWidth="18" orient="auto" refX="15" refY="9" viewBox="0 0 18 18">
          <path d="M3 9 9 3 15 9 9 15Z" fill={strokeColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1" />
        </marker>
        <marker id="pg-hollow-diamond" markerHeight="18" markerUnits="strokeWidth" markerWidth="18" orient="auto" refX="15" refY="9" viewBox="0 0 18 18">
          <path d="M3 9 9 3 15 9 9 15Z" fill={fillColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1.8" />
        </marker>

        <marker id="pg-activity-arrow" markerHeight="10" markerUnits="strokeWidth" markerWidth="10" orient="auto-start-reverse" refX="9" refY="5" viewBox="0 0 10 10">
          <path d="M1 1 9 5 1 9" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </marker>
        <marker id="pg-activity-open-arrow" markerHeight="10" markerUnits="strokeWidth" markerWidth="10" orient="auto-start-reverse" refX="9" refY="5" viewBox="0 0 10 10">
          <path d="M1 1 9 5 1 9" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
        </marker>
        <marker id="pg-usecase-open-arrow" markerHeight="10" markerUnits="strokeWidth" markerWidth="10" orient="auto-start-reverse" refX="9" refY="5" viewBox="0 0 10 10">
          <path d="M1 1 9 5 1 9" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </marker>
        <marker id="pg-usecase-hollow-triangle" markerHeight="12" markerUnits="strokeWidth" markerWidth="14" orient="auto-start-reverse" refX="12" refY="6" viewBox="0 0 14 12">
          <path d="M1.5 1.5 12 6 1.5 10.5Z" fill={fillColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1.5" />
        </marker>
        <marker id="pg-structure-open-arrow" markerHeight="10" markerUnits="strokeWidth" markerWidth="10" orient="auto-start-reverse" refX="9" refY="5" viewBox="0 0 10 10">
          <path d="M1 1 9 5 1 9" fill="none" stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </marker>
        <marker id="pg-structure-solid-arrow" markerHeight="10" markerUnits="strokeWidth" markerWidth="10" orient="auto-start-reverse" refX="9" refY="5" viewBox="0 0 10 10">
          <path d="M1 1 9 5 1 9Z" fill={strokeColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1.2" />
        </marker>
        <marker id="pg-structure-hollow-triangle" markerHeight="12" markerUnits="strokeWidth" markerWidth="14" orient="auto-start-reverse" refX="12" refY="6" viewBox="0 0 14 12">
          <path d="M1.5 1.5 12 6 1.5 10.5Z" fill={fillColor} stroke={strokeColor} strokeLinejoin="round" strokeWidth="1.5" />
        </marker>
      </defs>
    </svg>
  );
}
