import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthGate.jsx";
import { Spinner } from "../../../shared/Spinner.jsx";
import { FolderTree } from "./FolderTree.jsx";
import { StratList } from "./StratList.jsx";
import {
  useFoldersListQuery,
  useMoveStratMutation,
  useStratsMetaQuery,
} from "./hooks/useStratsBrowserQuery.js";
import "./strats-browser.css";

function canEditStrats(role) {
  return role === "editor" || role === "assist" || role === "admin" || role === "owner";
}

export function StratsPage({ hub = false }) {
  const user = useAuth();
  const canEdit = canEditStrats(user.role);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [filter, setFilter] = useState("");
  const foldersQuery = useFoldersListQuery();
  const stratsQuery = useStratsMetaQuery();
  const moveStrat = useMoveStratMutation();

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

  const loading = foldersQuery.isLoading || stratsQuery.isLoading;
  const error = foldersQuery.error?.message || stratsQuery.error?.message || moveStrat.error?.message;

  const content = (
    <section className="strats-browser">
      <header className="strats-browser__header">
        <div>
          <h1 className="strats-browser__title">My Strats</h1>
          <p className="strats-browser__sub">Browse folders and filterable strat list.</p>
        </div>
        <input
          className="strats-browser__search"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter strats"
        />
      </header>

      {error ? <p className="hub-admin-status is-error">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="strats-browser__grid">
          <aside className="strats-browser__aside">
            <h2 className="strats-browser__aside-title">Folders</h2>
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onDropStrat={handleDropStrat}
              canDrop={canEdit}
            />
          </aside>
          <div className="strats-browser__main">
            <StratList
              strats={strats}
              foldersById={foldersById}
              canDrag={canEdit}
              filter={filter}
            />
          </div>
        </div>
      )}
    </section>
  );

  if (hub) {
    return <div className="hub-admin-shell">{content}</div>;
  }

  return content;
}
