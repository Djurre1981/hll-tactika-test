import { Link } from "react-router-dom";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { FACTIONS } from "./constants.js";
import {
  cx,
  fieldLabel,
  glassSelect,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  segmentedBtn,
  segmentedBtnActive,
} from "../strats/editor/editorUi.js";

export function RouteplannerSettingsPanel({
  backTo = "/home",
  mapId,
  onMapChange,
  factionId,
  onFactionChange,
  hqIndex,
  onHqChange,
  hqSpawns,
  obstacleCount = 0,
  routeHint = null,
  status = "",
}) {
  return (
    <aside className={panelShell} aria-label="Route planner settings">
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
          <h2 className={cx(sectionTitle, "mb-3")}>Plan settings</h2>

          <label className="mb-3 block">
            <span className={fieldLabel}>Map</span>
            <select
              value={mapId}
              onChange={(e) => onMapChange(e.target.value)}
              className={cx(glassSelect, "mt-1.5")}
            >
              {STRAT_MAP_IDS.map((id) => (
                <option key={id} value={id} className="bg-[#121214]">
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-3 block">
            <span className={fieldLabel}>Faction</span>
            <select
              value={factionId}
              onChange={(e) => onFactionChange(e.target.value)}
              className={cx(glassSelect, "mt-1.5")}
            >
              {FACTIONS.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#121214]">
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-3">
            <p className={fieldLabel}>HQ spawn</p>
            <div
              className="mt-1.5 flex gap-1 rounded-[10px] border border-solid border-white/10 bg-black/[0.22] p-[0.18rem]"
              role="group"
              aria-label="HQ spawn"
            >
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  disabled={!hqSpawns[index]}
                  aria-pressed={hqIndex === index}
                  onClick={() => onHqChange(index)}
                  className={cx(
                    segmentedBtn,
                    "min-w-0 flex-1 px-2",
                    hqIndex === index && segmentedBtnActive
                  )}
                >
                  HQ {index + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="m-0 text-[0.72rem] font-light leading-snug text-white/45">
            Travel time uses each route&apos;s selected vehicle speed.
          </p>

          {obstacleCount > 0 && (
            <p className="m-0 mt-2 text-[0.68rem] leading-snug text-white/40">
              {obstacleCount} vector obstacle{obstacleCount === 1 ? "" : "s"} affect routing · Open
              Obstacles to edit
            </p>
          )}
        </section>

        {routeHint && (
          <>
            <div className={panelDivider} role="presentation" />
            <p className="m-0 text-[0.68rem] leading-snug text-white/40">{routeHint}</p>
          </>
        )}

        {status && (
          <p className="m-0 text-[0.72rem] text-amber-200/90" role="status">
            {status}
          </p>
        )}
      </div>
    </aside>
  );
}
