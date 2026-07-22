import { formatTravelTime } from "./timing/travel-time.js";

export function RoutesPanel({
  routes,
  selectedRouteId,
  hoveredRouteId,
  onSelectRoute,
  onHoverRoute,
  onAddRoute,
  onRemoveRoute,
  canAddRoute,
}) {
  return (
    <aside className="flex h-full flex-col rounded-[1.375rem] border border-white/10 bg-white/[0.06] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="m-0 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/50">
          Routes
        </h2>
        <button
          type="button"
          disabled={!canAddRoute}
          onClick={onAddRoute}
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[0.72rem] text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Route
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
        {routes.length === 0 ? (
          <p className="m-0 px-1 text-[0.8rem] text-white/45">
            Select an HQ, then click the map to set a destination.
          </p>
        ) : (
          routes.map((route, index) => {
            const selected = route.id === selectedRouteId;
            const hovered = route.id === hoveredRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectRoute(route.id)}
                onMouseEnter={() => onHoverRoute(route.id)}
                onMouseLeave={() => onHoverRoute(null)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  selected || hovered
                    ? "border-white/25 bg-white/[0.1]"
                    : "border-white/10 bg-white/[0.04] hover:border-white/18"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: route.color }}
                  />
                  <span className="text-[0.88rem] font-medium text-white">
                    {route.name || `Route ${index + 1}`}
                  </span>
                </div>
                <p className="m-0 mt-1 pl-5 text-[0.78rem] text-white/50">
                  {formatTravelTime(route.travelTimeSec)} · HQ {route.hqIndex + 1}
                </p>
                {selected && (
                  <button
                    type="button"
                    className="mt-2 text-[0.72rem] text-red-300/80 hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRoute(route.id);
                    }}
                  >
                    Remove route
                  </button>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
