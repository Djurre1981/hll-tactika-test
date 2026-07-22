import { Link } from "react-router-dom";
import { ToolBtn, Segmented } from "../../shared/toolChrome.jsx";
import {
  actionBtnWide,
  cx,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
} from "../strats/editor/editorUi.js";

const TOOL_ITEMS = [
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select / move / reshape" },
  { id: "pen", icon: "fa-solid fa-pen", title: "Pen — draw paths or add/remove anchors on selection" },
];

export function ObstacleToolbar({
  backTo = "/home",
  obstacleTool,
  onToolChange,
  penEffect = "block",
  onPenEffectChange,
  obstacleCount = 0,
  selectedObstacleId,
  onDeleteSelected,
  onExit,
  status = "",
}) {
  return (
    <aside className={panelShell} aria-label="Obstacle editing tools">
      <div className={panelGlassFill} aria-hidden="true" />

      <div className={cx(panelBody, "overflow-y-auto")}>
        <div className="shrink-0">
          <Link
            to={backTo}
            aria-label="Back to dashboard"
            className="mb-5 block w-fit max-w-[14rem] opacity-[0.92] transition hover:opacity-80"
          >
            <img
              src="/assets/logos/tactika-full-logo.svg"
              alt="Hell Let Loose Tactika"
              className="h-12 w-auto max-w-full object-contain object-left"
            />
          </Link>
          <div className={panelDivider} role="presentation" />
        </div>

        <section className="pt-3">
          <h2 className={cx(sectionTitle, "mb-1")}>Obstacles</h2>
          <p className="m-0 mb-3 text-[0.72rem] leading-snug text-white/50">
            {obstacleCount} vector region{obstacleCount === 1 ? "" : "s"} — hover or click to
            select, then drag shapes or anchor points to reshape.
          </p>

          <div className="grid grid-cols-2 gap-[0.45rem]" role="toolbar" aria-label="Obstacle tools">
            {TOOL_ITEMS.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                active={obstacleTool === item.id}
                onClick={() => onToolChange(item.id)}
              />
            ))}
          </div>

          {obstacleTool === "pen" && (
            <div className="mt-3">
              <p className="m-0 mb-2 text-[0.68rem] uppercase tracking-[0.1em] text-white/40">
                Pen mode
              </p>
              <Segmented
                value={penEffect}
                onChange={onPenEffectChange}
                options={[
                  { value: "block", label: "Block" },
                  { value: "clear", label: "Clear" },
                ]}
              />
            </div>
          )}

          <p className="m-0 mt-3 text-[0.68rem] leading-snug text-white/40">
            {obstacleTool === "pen"
              ? "Select a shape, then hover edges (+) or anchors (−) to edit · Shift overrides to draw a new path · Click first point, double-click, or Enter to close · Esc cancels"
              : "Block adds collision · Clear opens a drivable path · Delete removes selected"}
          </p>
        </section>

        <div className={panelDivider} role="presentation" />

        <section className="space-y-2">
          <button
            type="button"
            className={actionBtnWide}
            disabled={!selectedObstacleId}
            onClick={onDeleteSelected}
          >
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
            Delete selected
          </button>
          <button type="button" className={actionBtnWide} onClick={onExit}>
            Done editing obstacles
          </button>
        </section>

        {status && (
          <p className="m-0 text-[0.72rem] text-amber-200/90" role="status">
            {status}
          </p>
        )}
      </div>
    </aside>
  );
}
