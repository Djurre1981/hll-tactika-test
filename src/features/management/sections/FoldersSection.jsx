import { useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import {
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useFoldersQuery,
  useUpdateFolderMutation,
} from "../hooks/useFoldersQuery.js";

function FolderIcon() {
  return (
    <svg className="mgmt-folder-pill__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6H10l1.5 1.8H17.5A2.5 2.5 0 0 1 20 10.3v5.2A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FoldersSection() {
  const [name, setName] = useState("");
  const foldersQuery = useFoldersQuery();
  const createFolder = useCreateFolderMutation();
  const updateFolder = useUpdateFolderMutation();
  const deleteFolder = useDeleteFolderMutation();
  const folders = foldersQuery.data?.folders || [];
  const pending =
    createFolder.isPending || updateFolder.isPending || deleteFolder.isPending;
  const error =
    foldersQuery.error?.message ||
    createFolder.error?.message ||
    updateFolder.error?.message ||
    deleteFolder.error?.message;

  function handleCreate(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createFolder.mutate(
      { name: trimmed },
      {
        onSuccess: () => setName(""),
      },
    );
  }

  function handleRename(folder) {
    const next = window.prompt("Rename folder", folder.name);
    if (!next || !next.trim() || next.trim() === folder.name) return;
    updateFolder.mutate({ id: folder.id, name: next.trim() });
  }

  function handleDelete(folder) {
    if (!window.confirm(`Delete folder “${folder.name}”? Strats inside become unfiled.`)) {
      return;
    }
    deleteFolder.mutate(folder.id);
  }

  return (
    <section className="mgmt-section">
      <header className="mgmt-section__header">
        <div>
          <h2 className="mgmt-section__title">Folders</h2>
          <p className="mgmt-section__sub">Organize strat libraries.</p>
        </div>
      </header>

      <form className="mgmt-form" onSubmit={handleCreate}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New folder name"
          maxLength={80}
          required
        />
        <button type="submit" className="hub-admin-action" disabled={pending}>
          Create
        </button>
      </form>

      {error ? <p className="hub-admin-status is-error">{error}</p> : null}

      {foldersQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : folders.length === 0 ? (
        <p className="mgmt-empty">No folders yet.</p>
      ) : (
        <div className="mgmt-folder-grid">
          {folders.map((folder) => (
            <div key={folder.id} className="mgmt-folder-pill">
              <FolderIcon />
              <span className="mgmt-folder-pill__name">{folder.name}</span>
              <div className="mgmt-folder-pill__actions">
                <button
                  type="button"
                  className="mgmt-icon-btn"
                  disabled={pending}
                  onClick={() => handleRename(folder)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="mgmt-icon-btn"
                  disabled={pending}
                  onClick={() => handleDelete(folder)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
