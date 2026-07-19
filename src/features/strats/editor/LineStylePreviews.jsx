/**
 * Visual previews for line cap / dash pulldowns (StratSketch-style icons).
 * Pure SVG — no map-kernel import needed beyond option values.
 */

const STROKE = "currentColor";

function CapSvg({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 48 20"
      className={className}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Horizontal shaft used by most end-cap previews. */
function Shaft({ x2 = 34 }) {
  return (
    <line x1="6" y1="10" x2={x2} y2="10" stroke={STROKE} strokeWidth="2.2" strokeLinecap="butt" />
  );
}

/** Cap preview. `side` flips the marker for start vs end. */
export function CapPreview({ value, side = "end", className = "" }) {
  const flip = side === "start";
  const content = (() => {
    switch (value) {
      case "arrow":
        return (
          <>
            <Shaft x2="30" />
            <polygon points="42,10 28,3.5 28,16.5" fill={STROKE} />
          </>
        );
      case "arrowMd":
        return (
          <>
            <Shaft x2="31" />
            <polygon points="40,10 29,4.5 29,15.5" fill={STROKE} />
          </>
        );
      case "arrowSm":
        return (
          <>
            <Shaft x2="32" />
            <polygon points="38,10 30,5.5 30,14.5" fill={STROKE} />
          </>
        );
      case "chevron":
        return (
          <>
            <Shaft x2="30" />
            <polyline
              points="30,4 40,10 30,16"
              fill="none"
              stroke={STROKE}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      case "butt":
        return (
          <>
            <Shaft x2="32" />
            <rect x="32" y="5.5" width="8" height="9" fill={STROKE} />
          </>
        );
      case "round":
        return (
          <>
            <Shaft x2="32" />
            <path d="M32 5.5 A6 6 0 0 1 32 14.5 Z" fill={STROKE} />
          </>
        );
      case "circle":
        return (
          <>
            <Shaft x2="32" />
            <circle cx="38" cy="10" r="5" fill={STROKE} />
          </>
        );
      case "square":
        return (
          <>
            <Shaft x2="31" />
            <rect x="33" y="5" width="10" height="10" fill={STROKE} />
          </>
        );
      case "diamond":
        return (
          <>
            <Shaft x2="30" />
            <polygon points="38,3.5 45,10 38,16.5 31,10" fill={STROKE} />
          </>
        );
      case "tee":
        return (
          <>
            <Shaft x2="38" />
            <line x1="38" y1="3.5" x2="38" y2="16.5" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );
      case "none":
      default:
        return <Shaft x2="42" />;
    }
  })();

  return (
    <CapSvg className={className}>
      <g transform={flip ? "translate(48,0) scale(-1,1)" : undefined}>{content}</g>
    </CapSvg>
  );
}

export function DashPreview({ value, className = "" }) {
  const common = {
    y1: 10,
    y2: 10,
    stroke: STROKE,
    strokeWidth: 2.4,
    strokeLinecap: "butt",
  };
  let dasharray = null;
  switch (value) {
    case "dashed":
      dasharray = "8 5";
      break;
    case "dotted":
      dasharray = "2.2 4";
      break;
    case "dashDot":
      dasharray = "9 4 2.2 4";
      break;
    case "dashDotDot":
      dasharray = "9 4 2.2 4 2.2 4";
      break;
    default:
      dasharray = null;
  }
  return (
    <CapSvg className={className}>
      <line x1="4" x2="44" {...common} strokeDasharray={dasharray || undefined} />
    </CapSvg>
  );
}
