import { Link } from "react-router-dom";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { FACTIONS, ROUTE_COLORS, HQ_SPAWN_LABELS } from "./constants.js";
import {
  getRouteVehicleLabel,
  getRouteVehicleOptions,
  getRouteVehicleSpeedKmh,
  normalizeRouteVehicleId,
} from "./route-vehicles.js";
import {
  cx,
  fieldLabel,
  getHllToolbarPreviewSrc,
  glassInput,
  glassSelect,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  segmentedBtn,
  segmentedBtnActive,
  toolBtn,
  toolBtnActive,
} from "../strats/editor/editorUi.js";

function RouteColorPicker({ color, onChange }) {
  const isPreset = ROUTE_COLORS.some((c) => c.toLowerCase() === String(color).toLowerCase());

  return (
    <div
      className="flex items-center gap-[0.45rem] rounded-[10px] border border-solid border-white/10 bg-black/[0.22] px-[0.55rem] py-[0.45rem]"
      role="group"
      aria-label="Route color"
    >
      <label
        className={cx(
          "relative block h-[1.65rem] w-[1.65rem] shrink-0 cursor-pointer overflow-hidden rounded-full",
          !isPreset && "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
        )}
        title="Pick any color"
      >
        <span className="sr-only">Pick any color</span>
        <span
          className="block h-full w-full rounded-full border-2 border-white/[0.22] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
          style={{ background: color }}
        />
        <input
          type="color"
          value={color}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-wrap gap-[0.3rem]">
        {ROUTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={cx(
              "h-[1.15rem] w-[1.15rem] rounded-full border border-white/[0.16] transition hover:scale-105",
              String(color).toLowerCase() === c.toLowerCase() &&
                "shadow-[0_0_0_2px_rgba(255,255,255,0.38)]"
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function RouteVehiclePicker({ vehicleId, factionId, onChange }) {
  const options = getRouteVehicleOptions(factionId);
  const selectedId = normalizeRouteVehicleId(vehicleId, factionId);

  return (
    <div
      className="mt-1.5 grid grid-cols-4 gap-1 rounded-[10px] border border-solid border-white/10 bg-black/[0.22] p-1"
      role="radiogroup"
      aria-label="Vehicle"
    >
      {options.map((opt) => {
        const selected = selectedId === opt.id;
        const previewSrc = getHllToolbarPreviewSrc(opt.hllId);
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={selected}
            onClick={() => onChange(opt.id)}
            className={cx(toolBtn, "p-1", selected && toolBtnActive)}
          >
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}

function HqSpawnPicker({ hqIndex, hqSpawns, onChange }) {
  return (
    <div
      className="mt-1.5 flex gap-1"
      role="group"
      aria-label="Start point"
    >
      {HQ_SPAWN_LABELS.map((label, index) => (
        <button
          key={label}
          type="button"
          disabled={!hqSpawns[index]}
          aria-pressed={hqIndex === index}
          onClick={() => onChange(index)}
          className={cx(
            segmentedBtn,
            "min-w-0 flex-1 px-1.5 py-[0.45rem] text-center text-[0.64rem] leading-tight",
            hqIndex === index && segmentedBtnActive
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RouteplannerSettingsPanel({
  backTo = "/home",
  mapId,
  onMapChange,
  factionId,
  onFactionChange,
  hqIndex = 0,
  onHqChange,
  hqSpawns = [],
  selectedRoute = null,
  selectedRouteIndex = -1,
  routeHqSpawns = [],
  onRouteColorChange,
  onRouteNameChange,
  onRouteDriverChange,
  onRouteFactionChange,
  onRouteHqChange,
  onRouteVehicleChange,
  obstacleCount = 0,
  routeHint = null,
  status = "",
}) {
  const routeFactionId = selectedRoute?.factionId || factionId;
  const routeSpawns = selectedRoute ? routeHqSpawns : hqSpawns;

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

          {!selectedRoute && (
            <>
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
                <p className={fieldLabel}>Start point</p>
                <HqSpawnPicker hqIndex={hqIndex} hqSpawns={hqSpawns} onChange={onHqChange} />
              </div>
            </>
          )}

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

        {selectedRoute && (
          <>
            <div className={panelDivider} role="presentation" />
            <section className="pt-1">
              <h2 className={cx(sectionTitle, "mb-3")}>Route settings</h2>

              <label className="mb-3 block">
                <span className={fieldLabel}>Name</span>
                <input
                  type="text"
                  value={selectedRoute.name ?? ""}
                  placeholder={`Route ${selectedRouteIndex + 1}`}
                  onChange={(e) => onRouteNameChange?.(selectedRoute.id, e.target.value)}
                  className={cx(glassInput, "mt-1.5")}
                  autoComplete="off"
                />
              </label>

              <label className="mb-3 block">
                <span className={fieldLabel}>Driver</span>
                <input
                  type="text"
                  value={selectedRoute.driver ?? ""}
                  placeholder="Player name"
                  onChange={(e) => onRouteDriverChange?.(selectedRoute.id, e.target.value)}
                  className={cx(glassInput, "mt-1.5")}
                  autoComplete="off"
                />
                <p className="m-0 mt-1.5 text-[0.64rem] leading-snug text-white/35">
                  Roster picker for scheduled matches coming later.
                </p>
              </label>

              <div className="mb-3">
                <p className={fieldLabel}>Color</p>
                <div className="mt-1.5">
                  <RouteColorPicker
                    color={selectedRoute.color}
                    onChange={(next) => onRouteColorChange?.(selectedRoute.id, next)}
                  />
                </div>
              </div>

              <label className="mb-3 block">
                <span className={fieldLabel}>Faction</span>
                <select
                  value={routeFactionId}
                  onChange={(e) => onRouteFactionChange?.(selectedRoute.id, e.target.value)}
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
                <p className={fieldLabel}>Start point</p>
                <HqSpawnPicker
                  hqIndex={selectedRoute.hqIndex ?? 0}
                  hqSpawns={routeSpawns}
                  onChange={(index) => onRouteHqChange?.(selectedRoute.id, index)}
                />
              </div>

              <div className="mb-3">
                <p className={fieldLabel}>Vehicle</p>
                <RouteVehiclePicker
                  vehicleId={selectedRoute.vehicleId}
                  factionId={routeFactionId}
                  onChange={(next) => onRouteVehicleChange?.(selectedRoute.id, next)}
                />
              </div>

              <p className="m-0 text-[0.66rem] leading-snug text-white/40">
                {getRouteVehicleLabel(selectedRoute.vehicleId, routeFactionId)} ·{" "}
                {getRouteVehicleSpeedKmh(selectedRoute.vehicleId, routeFactionId).toFixed(1)} km/h
              </p>
            </section>
          </>
        )}

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
