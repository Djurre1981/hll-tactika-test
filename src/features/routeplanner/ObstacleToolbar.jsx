import { Link } from "react-router-dom";
import { ToolBtn } from "../../shared/toolChrome.jsx";
import { PenAddToolIcon, PenSubtractToolIcon } from "./ObstaclePenToolIcons.jsx";
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
  { id: "select", icon: "fa-solid fa-arrow-pointer", title: "Select — move shapes and edit anchors" },
  {
    id: "pen-add",
    title: "Pen add — draw and merge with overlapping obstacles",
    iconNode: <PenAddToolIcon />,
  },
  {
    id: "pen-subtract",
    title: "Pen subtract — cut from overlapping obstacles",
    iconNode: <PenSubtractToolIcon />,
  },
];

export function ObstacleToolbar({
  backTo = "/home",
  compact = false,
  obstacleTool,
  onToolChange,
  obstacleCount = 0,
  selectedObstacleId,
  onDeleteSelected,
  onExit,
  status = "",
}) {
  if (compact) {
    return (
      <div
        className="pointer-events-auto flex max-w-[min(100vw-2rem,42rem)] flex-wrap items-center justify-center gap-1.5 rounded-[16px] border border-solid border-white/10 bg-[rgba(24,24,26,0.58)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[20px] backdrop-saturate-[180%]"
        role="toolbar"
        aria-label="Obstacle editing tools"
      >
        <div className="flex items-center gap-[0.45rem]" role="group" aria-label="Obstacle tools">
          {TOOL_ITEMS.map((item) => (
            <ToolBtn
              key={item.id}
              title={item.title}
              icon={item.icon}
              iconNode={item.iconNode}
              active={obstacleTool === item.id}
              onClick={() => onToolChange(item.id)}
            />
          ))}
        </div>

        <button
          type="button"
          title="Delete selected obstacle"
          aria-label="Delete selected obstacle"
          disabled={!selectedObstacleId}
          onClick={onDeleteSelected}
          className={cx(actionBtnWide, "w-auto shrink-0 px-3 py-1.5 disabled:opacity-35")}
        >
          <i className="fa-solid fa-trash-can" aria-hidden="true" />
        </button>

        {status ? (
          <span className="max-w-[12rem] truncate text-[0.68rem] text-amber-200/90" role="status">
            {status}
          </span>
        ) : (
          <span className="text-[0.68rem] text-white/40">
            {obstacleCount} region{obstacleCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    );
  }

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
            {obstacleCount} vector region{obstacleCount === 1 ? "" : "s"} — one editable layer of
            traced and drawn shapes.
          </p>

          <div className="grid grid-cols-3 gap-[0.45rem]" role="toolbar" aria-label="Obstacle tools">
            {TOOL_ITEMS.map((item) => (
              <ToolBtn
                key={item.id}
                title={item.title}
                icon={item.icon}
                iconNode={item.iconNode}
                active={obstacleTool === item.id}
                onClick={() => onToolChange(item.id)}
              />
            ))}
          </div>

          <p className="m-0 mt-2 text-[0.68rem] leading-snug text-white/40">
            {obstacleTool === "select" &&
              "Click shape to select · click edge to add anchor · click anchor to select · drag to move · right-click anchor to remove"}
            {obstacleTool === "pen-add" &&
              "Click or drag to draw · release or click first point to close · merges with overlapping shapes · right-click cancels"}
            {obstacleTool === "pen-subtract" &&
              "Draw a cut shape over obstacles · cuts overlapping areas in place · right-click cancels"}
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
