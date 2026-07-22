import { formatTravelTime } from "./timing/travel-time.js";
import {
  getRouteVehicleIconSrc,
  getRouteVehicleLabel,
  getRouteVehicleOptions,
  getRouteVehicleSpeedKmh,
  normalizeRouteVehicleId,
} from "./route-vehicles.js";
import {
  cx,
  fieldLabel,
  glassIconBtn,
  glassSelect,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  slideItem,
  slideItemActive,
  stratPickerTrigger,
} from "../strats/editor/editorUi.js";
import { IconBtn } from "../strats/editor/sidePanelUtils.jsx";

export function RoutesPanel({
  planTitle = "Route plan",
  dirty = false,
  saving = false,
  factionId = "us",
  routes,
  selectedRouteId,
  hoveredRouteId,
  onSelectRoute,
  onHoverRoute,
  onAddRoute,
  onRemoveRoute,
  onVehicleChange,
  canAddRoute,
}) {
  const vehicleOptions = getRouteVehicleOptions(factionId);
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  const metaBits = [
    `${routes.length} route${routes.length === 1 ? "" : "s"}`,
    dirty ? "Unsaved" : saving ? "Saving…" : "Saved",
  ].filter(Boolean);

  return (
    <aside className={panelShell} aria-label="Routes panel">
      <div className={panelGlassFill} aria-hidden="true" />

      <div className={panelBody}>
        <div className="flex items-stretch gap-[0.45rem]">
          <div className={stratPickerTrigger}>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[0.82rem] font-normal text-white">{planTitle}</p>
              <p className="mt-[0.1rem] truncate text-[0.64rem] font-light uppercase tracking-[0.06em] text-white/45">
                {metaBits.join(" · ")}
              </p>
            </div>
          </div>
          <IconBtn title="Add route" disabled={!canAddRoute} onClick={onAddRoute}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
          </IconBtn>
        </div>

        <div className={panelDivider} role="presentation" />

        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <h2 className={cx(sectionTitle, "shrink-0")}>Routes</h2>

          <div className="flex min-h-0 flex-1 flex-col gap-[0.35rem] overflow-auto pr-0.5">
            {routes.length === 0 ? (
              <p className="m-0 px-1 text-[0.78rem] font-light leading-snug text-white/45">
                Select an HQ, then click the map to set a destination.
              </p>
            ) : (
              routes.map((route, index) => {
                const selected = route.id === selectedRouteId;
                const hovered = route.id === hoveredRouteId;
                const vehicleIcon = getRouteVehicleIconSrc(route.vehicleId, factionId);
                return (
                  <div key={route.id} className="flex flex-col gap-1.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => onSelectRoute(route.id)}
                        onMouseEnter={() => onHoverRoute(route.id)}
                        onMouseLeave={() => onHoverRoute(null)}
                        className={cx(slideItem, (selected || hovered) && slideItemActive, "pr-9")}
                      >
                        {vehicleIcon ? (
                          <img
                            src={vehicleIcon}
                            alt=""
                            className="h-[1.35rem] w-[1.35rem] shrink-0 object-contain"
                            draggable={false}
                          />
                        ) : (
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
                            style={{ backgroundColor: route.color }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-left">
                          <span className="block truncate text-[0.78rem] text-white/90">
                            {route.name || `Route ${index + 1}`}
                          </span>
                          <span className="mt-0.5 block truncate text-[0.66rem] text-white/45">
                            {formatTravelTime(route.travelTimeSec)} · HQ {route.hqIndex + 1}
                          </span>
                        </span>
                      </button>
                      {selected && (
                        <button
                          type="button"
                          title="Remove route"
                          aria-label="Remove route"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveRoute(route.id);
                          }}
                          className={cx(
                            glassIconBtn,
                            "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-[0.72rem] text-red-300/90 hover:text-red-200"
                          )}
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {selected && (
                      <div className="rounded-[10px] border border-solid border-white/10 bg-black/[0.22] px-3 py-2.5">
                        <label className="block">
                          <span className={fieldLabel}>Start vehicle</span>
                          <select
                            value={normalizeRouteVehicleId(route.vehicleId, factionId)}
                            onChange={(e) => onVehicleChange?.(route.id, e.target.value)}
                            className={cx(glassSelect, "mt-1.5")}
                          >
                            {vehicleOptions.map((opt) => (
                              <option key={opt.id} value={opt.id} className="bg-[#121214]">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="m-0 mt-2 text-[0.66rem] leading-snug text-white/40">
                          {getRouteVehicleLabel(route.vehicleId, factionId)} ·{" "}
                          {getRouteVehicleSpeedKmh(route.vehicleId, factionId).toFixed(1)} km/h · HQ{" "}
                          {route.hqIndex + 1} start
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {selectedRoute && (
          <>
            <div className={panelDivider} role="presentation" />
            <p className="m-0 text-[0.66rem] leading-snug text-white/40">
              Vehicle icon at route start follows the first segment direction.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
