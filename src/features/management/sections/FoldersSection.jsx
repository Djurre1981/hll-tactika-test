import { useState } from "react";
import { Spinner } from "../../../shared/Spinner.jsx";
import {
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useFoldersQuery,
  useUpdateFolderMutation,
} from "../hooks/useFoldersQuery.js";

const fieldClass =
  "min-h-[2.4rem] min-w-[10rem] rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-white/90";

function FolderIcon() {
  return (
    <svg
      className="h-[1.15rem] w-[1.15rem] shrink-0 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <section>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-[1.65rem] font-medium tracking-wide text-white">Folders</h2>
          <p className="mt-1.5 text-[0.9rem] text-white/50">Organize strat libraries.</p>
        </div>
      </header>

      <form className="mb-4 flex flex-wrap gap-2.5" onSubmit={handleCreate}>
        <input
          className={fieldClass}
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
        <p className="my-8 text-[0.92rem] text-white/45">No folders yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex min-h-[3.1rem] items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2.5"
            >
              <FolderIcon />
              <span className="min-w-0 flex-1 truncate text-[0.92rem] text-white/90">
                {folder.name}
              </span>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className="border-0 bg-transparent px-2 py-1.5 text-[0.78rem] tracking-wider text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={pending}
                  onClick={() => handleRename(folder)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="border-0 bg-transparent px-2 py-1.5 text-[0.78rem] tracking-wider text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
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
