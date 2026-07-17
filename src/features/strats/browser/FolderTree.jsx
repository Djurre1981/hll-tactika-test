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

  return (
    <ul className="strat-folder-tree">
      <li>
        <button
          type="button"
          className={`strat-folder-tree__item${selectedFolderId == null ? " is-active" : ""}`}
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
          className={`strat-folder-tree__item${selectedFolderId === "none" ? " is-active" : ""}`}
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
            className={`strat-folder-tree__item${selectedFolderId === folder.id ? " is-active" : ""}`}
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
