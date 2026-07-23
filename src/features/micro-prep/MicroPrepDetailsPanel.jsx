import { cx, glassBtn, sectionTitle } from "../strats/editor/editorUi.js";
import { WhiteboardEventLinker } from "./WhiteboardEventLinker.jsx";

export function MicroPrepDetailsPanel({ whiteboardId, canEdit, onBack }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.55rem] overflow-hidden">
      <header className="flex shrink-0 flex-col gap-[0.45rem] border-b border-white/[0.08] pb-[0.55rem]">
        <button type="button" onClick={onBack} className={cx(glassBtn, "self-start")}>
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          <span>Back to slides</span>
        </button>
        <h2 className={sectionTitle}>Board options</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[0.45rem] overflow-y-auto pr-0.5">
        <WhiteboardEventLinker whiteboardId={whiteboardId} canEditBoard={canEdit} />
      </div>
    </div>
  );
}
