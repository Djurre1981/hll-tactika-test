import { useEffect, useState } from "react";
import { GlassSelect } from "../../../shared/GlassSelect.jsx";
import { STRAT_MAP_IDS } from "./mapIds.js";
import {
  accLabel,
  accShell,
  accSummary,
  accValue,
  cx,
  glassBtn,
  glassInput,
  sectionTitle,
  tagBar,
  tagBarBtn,
  tagBarBtnActive,
} from "./editorUi.js";

function TagToggle({ value, options, disabled, onChange }) {
  const idx = options.findIndex((o) => o.value === value);
  const hasValue = idx >= 0;
  return (
    <div className={tagBar} data-current-value={value || ""}>
      {hasValue ? (
        <span
          className="pointer-events-none absolute top-[0.18rem] left-[0.18rem] h-[calc(100%-0.36rem)] w-[calc(50%-0.18rem)] rounded-full bg-white/12 transition-transform duration-300"
          style={{ transform: `translateX(${idx * 100}%)` }}
          aria-hidden="true"
        />
      ) : null}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          className={cx(tagBarBtn, value === opt.value && tagBarBtnActive)}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Accordion({ label, value, defaultOpen = false, children }) {
  return (
    <details className={cx(accShell, "group")} defaultOpen={defaultOpen}>
      <summary className={accSummary}>
        <span className={accLabel}>{label}</span>
        <span className={accValue}>{value}</span>
        <i
          className="fa-solid fa-chevron-down text-[0.55rem] text-white/35 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-[0.55rem] px-[0.65rem] pb-[0.65rem]">{children}</div>
    </details>
  );
}

export function StratDetailsPanel({
  strat,
  activeSlide,
  canEdit,
  onBack,
  onPatchStrat,
  onDuplicateStrat,
  onDeleteStrat,
}) {
  const [titleDraft, setTitleDraft] = useState(strat?.title || "");
  const [notesDraft, setNotesDraft] = useState(strat?.notes || "");
  const [opponentDraft, setOpponentDraft] = useState(strat?.match?.opponent || "");

  useEffect(() => {
    setTitleDraft(strat?.title || "");
  }, [strat?.id, strat?.title]);

  useEffect(() => {
    setNotesDraft(strat?.notes || "");
  }, [strat?.id, strat?.notes]);

  useEffect(() => {
    setOpponentDraft(strat?.match?.opponent || "");
  }, [strat?.id, strat?.match?.opponent]);

  const team = strat?.tags?.team || "jr";
  const type = strat?.tags?.type || "friendly";
  const match = strat?.match || {};
  const tagsSummary = `${(team || "").toUpperCase()} · ${
    type ? type.charAt(0).toUpperCase() + type.slice(1) : "—"
  }`;
  const matchSummary =
    [match.date, match.mapId, match.opponent].filter(Boolean).join(" · ") || "None";
  const notesSummary = (strat?.notes || "").trim() ? "Has notes" : "None";

  const patchTags = (partial) => {
    onPatchStrat?.({
      tags: { team, type, ...partial },
    });
  };

  const patchMatch = (partial) => {
    onPatchStrat?.({
      match: { ...match, ...partial },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.55rem] overflow-hidden">
      <header className="flex shrink-0 flex-col gap-[0.45rem] border-b border-white/[0.08] pb-[0.55rem]">
        <button type="button" onClick={onBack} className={cx(glassBtn, "self-start")}>
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
          <span>Back to slides</span>
        </button>
        <h2 className={sectionTitle}>Strat details</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[0.45rem] overflow-y-auto pr-0.5">
        <Accordion label="Title" value={titleDraft || "Untitled Strat"} defaultOpen>
          <input
            type="text"
            maxLength={80}
            disabled={!canEdit}
            value={titleDraft}
            placeholder="Untitled Strat"
            className={glassInput}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft.trim() && titleDraft !== strat?.title) {
                onPatchStrat?.({ title: titleDraft.trim() });
              }
            }}
          />
        </Accordion>

        <Accordion label="Team & type" value={tagsSummary}>
          <div className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Team</span>
            <TagToggle
              disabled={!canEdit}
              value={team}
              onChange={(v) => patchTags({ team: v })}
              options={[
                { value: "jr", label: "JR" },
                { value: "sr", label: "SR" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Type</span>
            <TagToggle
              disabled={!canEdit}
              value={type}
              onChange={(v) => patchTags({ type: v })}
              options={[
                { value: "friendly", label: "Friendly" },
                { value: "tournament", label: "Tournament" },
              ]}
            />
          </div>
        </Accordion>

        <Accordion label="Match details" value={matchSummary}>
          <label className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Match date</span>
            <input
              type="date"
              disabled={!canEdit}
              value={match.date || ""}
              className={glassInput}
              onChange={(e) => patchMatch({ date: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Faction</span>
            <TagToggle
              disabled={!canEdit}
              value={match.faction || ""}
              onChange={(v) => patchMatch({ faction: v === match.faction ? "" : v })}
              options={[
                { value: "axis", label: "Axis" },
                { value: "allies", label: "Allies" },
              ]}
            />
          </div>
          <label className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Map</span>
            <GlassSelect
              disabled={!canEdit}
              value={match.mapId || ""}
              onChange={(value) => patchMatch({ mapId: value })}
              placeholder="Select map…"
              options={STRAT_MAP_IDS.map((id) => ({ value: id, label: id }))}
            />
          </label>
          <label className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Opponent</span>
            <input
              type="text"
              maxLength={80}
              disabled={!canEdit}
              value={opponentDraft}
              placeholder="Opponent team name"
              className={glassInput}
              onChange={(e) => setOpponentDraft(e.target.value)}
              onBlur={() => {
                if (opponentDraft !== (match.opponent || "")) {
                  patchMatch({ opponent: opponentDraft });
                }
              }}
            />
          </label>
          <div className="flex flex-col gap-[0.35rem]">
            <span className={accLabel}>Result</span>
            <TagToggle
              disabled={!canEdit}
              value={match.result || ""}
              onChange={(v) => patchMatch({ result: v === match.result ? "" : v })}
              options={[
                { value: "win", label: "Win" },
                { value: "loss", label: "Loss" },
              ]}
            />
          </div>
        </Accordion>

        <Accordion label="Notes" value={notesSummary}>
          <textarea
            rows={3}
            disabled={!canEdit}
            value={notesDraft}
            placeholder="Optional match notes"
            className={cx(glassInput, "min-h-[3.5rem] resize-y rounded-[10px]")}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              if (notesDraft !== (strat?.notes || "")) {
                onPatchStrat?.({ notes: notesDraft });
              }
            }}
          />
        </Accordion>

        <div className="flex flex-wrap gap-[0.4rem] pt-1">
          <button
            type="button"
            disabled={!canEdit}
            className={glassBtn}
            onClick={onDuplicateStrat}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={!canEdit}
            className={cx(glassBtn, "border-red-400/25 text-red-200 hover:border-red-400/40 hover:bg-red-500/10")}
            onClick={onDeleteStrat}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
