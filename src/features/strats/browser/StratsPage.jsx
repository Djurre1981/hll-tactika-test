import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthGate.jsx";
import { canEditStrats } from "../../../lib/roles.js";
import { Spinner } from "../../../shared/Spinner.jsx";
import { FolderTree } from "./FolderTree.jsx";
import { StratList } from "./StratList.jsx";
import {
  useDeleteStratMutation,
  useFoldersListQuery,
  useMoveStratMutation,
  useStratsMetaQuery,
} from "./hooks/useStratsBrowserQuery.js";

export function StratsPage({ hub = false }) {
  const user = useAuth();
  const navigate = useNavigate();
  const canEdit = canEditStrats(user.role);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [filter, setFilter] = useState("");
  const foldersQuery = useFoldersListQuery();
  const stratsQuery = useStratsMetaQuery();
  const moveStrat = useMoveStratMutation();
  const deleteStrat = useDeleteStratMutation();

  const folders = foldersQuery.data?.folders || [];
  const foldersById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const strats = useMemo(() => {
    const all = stratsQuery.data?.strats || [];
    if (selectedFolderId == null) return all;
    if (selectedFolderId === "none") return all.filter((strat) => !strat.folderId);
    return all.filter((strat) => strat.folderId === selectedFolderId);
  }, [stratsQuery.data?.strats, selectedFolderId]);

  function handleDropStrat(stratId, folderId) {
    if (!canEdit) return;
    moveStrat.mutate({ id: stratId, folderId });
  }

  function handleDeleteStrat(strat) {
    if (!canEdit) return;
    const label = strat.title || "Untitled Strat";
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    deleteStrat.mutate(strat.id);
  }

  const loading = foldersQuery.isLoading || stratsQuery.isLoading;
  const error =
    foldersQuery.error?.message ||
    stratsQuery.error?.message ||
    moveStrat.error?.message ||
    deleteStrat.error?.message;

  const content = (
    <section className={hub ? "flex h-full min-h-0 flex-col overflow-hidden" : ""}>
      <header className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[1.75rem] font-medium text-white">My Strats</h1>
          <p className="mt-1.5 text-[0.9rem] text-white/50">
            Browse folders and filterable strat list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              className="min-h-[2.4rem] rounded-full border border-accent/40 bg-accent/15 px-4 py-2 text-[0.82rem] font-medium text-accent transition hover:border-accent/55 hover:bg-accent/25"
              onClick={() => navigate("/tool/stratmaker")}
            >
              New strat
            </button>
          ) : null}
          <input
            className="min-h-[2.4rem] min-w-[min(240px,70vw)] rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-white/90"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter strats"
          />
        </div>
      </header>

      {error ? <p className="mb-3 shrink-0 min-h-[1.2rem] text-[0.82rem] text-[#f0a8a8]">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-5 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] ${
            hub ? "min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden" : ""
          }`}
        >
          <aside
            className={`rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5 ${
              hub ? "hub-scroll min-h-0 overflow-y-auto" : ""
            }`}
          >
            <h2 className="mb-3 text-[0.72rem] font-normal uppercase tracking-[0.12em] text-white/40">
              Folders
            </h2>
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onDropStrat={handleDropStrat}
              canDrop={canEdit}
            />
          </aside>
          <div className={hub ? "hub-scroll min-h-0 overflow-y-auto overscroll-contain pr-1" : ""}>
            <StratList
              strats={strats}
              foldersById={foldersById}
              canDrag={canEdit}
              canDelete={canEdit}
              filter={filter}
              onDelete={handleDeleteStrat}
              deletePending={deleteStrat.isPending}
            />
          </div>
        </div>
      )}
    </section>
  );

  if (hub) {
    return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{content}</div>;
  }

  return content;
}
