export function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onDropStrat,
  canDrop = false,
}) {
  function handleDragOver(event) {
    if (!canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event, folderId) {
    if (!canDrop) return;
    event.preventDefault();
    const stratId = event.dataTransfer.getData("text/strat-id");
    if (!stratId) return;
    onDropStrat?.(stratId, folderId);
  }

  function itemClass(active) {
    return [
      "w-full rounded-xl border-0 bg-transparent px-2.5 py-2 text-left text-white/70 transition hover:bg-white/[0.06] hover:text-white",
      active ? "bg-accent/15 text-[#f0d9a0]" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      <li>
        <button
          type="button"
          className={itemClass(selectedFolderId == null)}
          onClick={() => onSelect(null)}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, null)}
        >
          All strats
        </button>
      </li>
      <li>
        <button
          type="button"
          className={itemClass(selectedFolderId === "none")}
          onClick={() => onSelect("none")}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, null)}
        >
          Unfiled
        </button>
      </li>
      {folders.map((folder) => (
        <li key={folder.id}>
          <button
            type="button"
            className={itemClass(selectedFolderId === folder.id)}
            onClick={() => onSelect(folder.id)}
            onDragOver={handleDragOver}
            onDrop={(event) => handleDrop(event, folder.id)}
          >
            {folder.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
