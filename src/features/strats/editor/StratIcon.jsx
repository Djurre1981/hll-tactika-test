import { resolveIconDef } from "@map-kernel/icons/resolve-icon.js";

/**
 * Toolbar glyph from the map-kernel pack.
 * StratSketch multi-layer icons: layer0 = currentColor, layer1+ = panel knockout.
 */
export function StratIcon({
  iconId,
  className = "h-[1.05rem] w-[1.05rem]",
  title,
  knockout = "var(--strat-icon-knockout, #1c1c1c)",
}) {
  const def = resolveIconDef({ iconId });
  if (!def?.layers?.length && !def?.path) return null;

  const w = def.width || 512;
  const h = def.height || 512;
  const layers = def.layers?.length ? def.layers : [def.path];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
    >
      {title ? <title>{title}</title> : null}
      {layers.map((d, index) => (
        <path key={index} d={d} fill={index === 0 ? "currentColor" : knockout} />
      ))}
    </svg>
  );
}
