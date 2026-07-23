import { formatTravelTime } from "./timing/travel-time.js";
import { formatMatchTime } from "./timing/route-timing.js";
import { getRouteFactionId, getHqSpawnLabel } from "./constants.js";
import {
  getRouteVehicleIconSrc,
  getRouteVehicleLabel,
} from "./route-vehicles.js";
import { RoutePlanEventPicker } from "./RoutePlanEventPicker.jsx";
import {
  cx,
  glassIconBtn,
  glassInput,
  panelBody,
  panelDivider,
  panelGlassFill,
  panelShell,
  sectionTitle,
  slideItem,
  slideItemActive,
} from "../strats/editor/editorUi.js";
import { IconBtn } from "../strats/editor/sidePanelUtils.jsx";

export function RoutesPanel({
  planId,
  planTitle = "Route plan",
  eventId = null,
  dirty = false,
  saving = false,
  planFactionId = "us",
  routes,
  selectedRouteId,
  hoveredRouteId,
  onPlanTitleChange,
  onEventIdChange,
  onPatchPlan,
  onSelectRoute,
  onHoverRoute,
  onAddRoute,
  onRemoveRoute,
  canAddRoute,
  canEdit = true,
}) {
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
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={planTitle}
              disabled={!canEdit}
              onChange={(e) => onPlanTitleChange?.(e.target.value)}
              placeholder="Route plan title"
              className={cx(glassInput, "text-[0.82rem] font-normal text-white")}
              autoComplete="off"
              aria-label="Route plan title"
            />
            <p className="mt-[0.35rem] truncate text-[0.64rem] font-light uppercase tracking-[0.06em] text-white/45">
              {metaBits.join(" · ")}
            </p>
          </div>
          <IconBtn title="Add route" disabled={!canEdit || !canAddRoute} onClick={onAddRoute}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
          </IconBtn>
        </div>

        <div className={panelDivider} role="presentation" />

        <RoutePlanEventPicker
          planId={planId}
          eventId={eventId}
          canEditPlan={canEdit}
          onEventIdChange={onEventIdChange}
          onPatchPlan={onPatchPlan}
        />

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
                const routeFaction = getRouteFactionId(route, planFactionId);
                const vehicleIcon = getRouteVehicleIconSrc(route.vehicleId, routeFaction);
                return (
                  <div key={route.id} className="relative">
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
                          {route.name?.trim() || `Route ${index + 1}`}
                          {route.driver?.trim() ? (
                            <span className="font-light text-white/55"> · {route.driver.trim()}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.66rem] text-white/45">
                          {formatTravelTime(route.travelTimeSec)} drive
                          {route.matchArrivalSec > 0
                            ? ` · arrives ${formatMatchTime(route.matchArrivalSec)}`
                            : ""}
                          {" · "}
                          {getRouteVehicleLabel(route.vehicleId, routeFaction)} ·{" "}
                          {getHqSpawnLabel(route.hqIndex)}
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
