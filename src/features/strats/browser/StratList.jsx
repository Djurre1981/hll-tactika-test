import { Link } from "react-router-dom";

export function StratList({
  strats,
  foldersById,
  canDrag = false,
  canDelete = false,
  filter = "",
  onDelete,
  deletePending = false,
}) {
  const needle = filter.trim().toLowerCase();
  const filtered = needle
    ? strats.filter((strat) => {
        const folderName = strat.folderId ? foldersById.get(strat.folderId)?.name || "" : "";
        const haystack = [strat.title, strat.tags?.team, strat.tags?.type, folderName, strat.match?.mapId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
    : strats;

  if (filtered.length === 0) {
    return <p className="my-8 text-[0.92rem] text-white/45">No strats match this filter.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {filtered.map((strat) => {
        const folderName = strat.folderId ? foldersById.get(strat.folderId)?.name : null;
        return (
          <li key={strat.id}>
            <div
              className="flex cursor-grab items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 active:cursor-grabbing"
              draggable={canDrag}
              onDragStart={(event) => {
                if (!canDrag) return;
                event.dataTransfer.setData("text/strat-id", strat.id);
                event.dataTransfer.effectAllowed = "move";
              }}
            >
              <div className="min-w-0 flex-1">
                <Link
                  className="text-base text-white no-underline transition hover:text-accent"
                  to={`/strats/${strat.id}`}
                >
                  {strat.title || "Untitled Strat"}
                </Link>
                <p className="mt-1 text-[0.8rem] text-white/40">
                  {[strat.tags?.team, strat.tags?.type, folderName || "Unfiled"]
                    .filter(Boolean)
                    .join(" · ")}
                  {strat.slideCount != null ? ` · ${strat.slideCount} slides` : ""}
                </p>
              </div>
              {canDelete ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[0.75rem] tracking-wide text-white/55 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={deletePending}
                  aria-label={`Delete ${strat.title || "strat"}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete?.(strat);
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
