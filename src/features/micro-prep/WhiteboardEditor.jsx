import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { apiClient } from "../../lib/api-client.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas.jsx";
import { WhiteboardToolsPanel } from "./WhiteboardToolsPanel.jsx";
import { useMutateWhiteboard } from "./hooks/useMutateWhiteboard.js";
import { useWhiteboardAutosave } from "./hooks/useWhiteboardAutosave.js";
import { useWhiteboardQuery } from "./hooks/useWhiteboardQuery.js";

const PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";

export function WhiteboardEditor({ boardId, backTo = "/home" }) {
  const user = useAuth();
  const [api, setApi] = useState(null);
  const apiRef = useRef(null);
  const [title, setTitle] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(undefined);
  const [uploading, setUploading] = useState(false);
  const [activeTool, setActiveTool] = useState("selection");
  const [theme, setTheme] = useState("dark");
  const themeHydrated = useRef(false);

  const query = useWhiteboardQuery(boardId);
  const mutation = useMutateWhiteboard(boardId);
  const board = query.data;

  useEffect(() => {
    if (!board || themeHydrated.current) return;
    themeHydrated.current = true;
    const saved = board.scene?.appState?.theme;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, [board]);

  const displayTitle = title ?? board?.title ?? "";
  const displayBg =
    backgroundUrl !== undefined ? backgroundUrl : board?.backgroundUrl ?? null;

  const canEdit =
    Boolean(board) &&
    ["owner", "admin", "editor", "assist"].includes(user.role) &&
    (["owner", "admin", "assist"].includes(user.role) ||
      board.createdBy === user.steamId);

  const getScene = useCallback(() => {
    const api = apiRef.current;
    if (!api) return null;
    return {
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles(),
    };
  }, []);

  const { markDirty } = useWhiteboardAutosave({
    enabled: canEdit,
    getScene,
    backgroundUrl: displayBg,
    title: displayTitle,
    mutateAsync: mutation.mutateAsync,
  });

  const onApiReady = useCallback((nextApi) => {
    apiRef.current = nextApi;
    setApi(nextApi);
  }, []);

  const onChange = useCallback(() => {
    markDirty();
  }, [markDirty]);

  const onTitleChange = (value) => {
    setTitle(value);
    markDirty();
  };

  const onBackgroundUpload = async (file) => {
    if (!canEdit) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiClient("/uploads/image", {
        method: "POST",
        body: form,
      });
      setBackgroundUrl(result.url);
      markDirty();
    } catch (error) {
      console.error("Background upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const onClearBackground = () => {
    setBackgroundUrl(null);
    markDirty();
  };

  const onThemeChange = (next) => {
    setTheme(next);
    markDirty();
  };

  const shellBg = theme === "light" ? "bg-white" : "bg-[#0f0f0f]";
  const mutedText = theme === "light" ? "text-black/50" : "text-white/50";

  if (query.isLoading) {
    return (
      <div className={`flex h-full items-center justify-center gap-2 ${shellBg} ${mutedText}`}>
        <Spinner /> Loading board…
      </div>
    );
  }

  if (query.isError || !board) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-3 ${shellBg} p-6`}>
        <p className={theme === "light" ? "text-black/60" : "text-white/60"}>
          {query.error?.message || "Board not found"}
        </p>
        <Link to={backTo} className="text-amber-300/90 hover:underline">
          Back to hub
        </Link>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${shellBg}`}>
      {displayBg ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${displayBg})` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="absolute inset-0 z-[1]">
        <ExcalidrawCanvas
          scene={board.scene}
          hasBackground={Boolean(displayBg)}
          theme={theme}
          viewModeEnabled={!canEdit}
          onApiReady={onApiReady}
          onChange={onChange}
        />
      </div>

      <div
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <WhiteboardToolsPanel
            disabled={!canEdit}
            title={displayTitle}
            onTitleChange={onTitleChange}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            api={api}
            theme={theme}
            onThemeChange={onThemeChange}
            onBackgroundUpload={onBackgroundUpload}
            uploading={uploading}
            hasBackground={Boolean(displayBg)}
            onClearBackground={onClearBackground}
          />
        </div>
      </div>
    </div>
  );
}
