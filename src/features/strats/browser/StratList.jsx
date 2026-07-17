import { Link } from "react-router-dom";

export function StratList({ strats, foldersById, canDrag = false, filter = "" }) {
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
    return <p className="mgmt-empty">No strats match this filter.</p>;
  }

  return (
    <ul className="strat-list">
      {filtered.map((strat) => {
        const folderName = strat.folderId ? foldersById.get(strat.folderId)?.name : null;
        return (
          <li key={strat.id}>
            <div
              className="strat-list__row"
              draggable={canDrag}
              onDragStart={(event) => {
                if (!canDrag) return;
                event.dataTransfer.setData("text/strat-id", strat.id);
                event.dataTransfer.effectAllowed = "move";
              }}
            >
              <div className="strat-list__main">
                <Link className="strat-list__title" to={`/strats/${strat.id}`}>
                  {strat.title || "Untitled Strat"}
                </Link>
                <p className="strat-list__meta">
                  {[strat.tags?.team, strat.tags?.type, folderName || "Unfiled"]
                    .filter(Boolean)
                    .join(" · ")}
                  {strat.slideCount != null ? ` · ${strat.slideCount} slides` : ""}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
