import { useState } from "react";
import { Button } from "../../shared/Button.jsx";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { HQ_SPAWN_LABELS } from "../routeplanner/constants.js";
import { EVENT_TYPES } from "./hooks/useEventsQuery.js";
import { isMatchEventType, localDateTimeValue } from "./calendar-utils.js";

const FACTION_OPTIONS = [
  { value: "axis", label: "Axis" },
  { value: "allies", label: "Allies" },
];

const RESULT_OPTIONS = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
];

const STARTING_POINT_OPTIONS = HQ_SPAWN_LABELS.map((label, index) => ({
  value: String(index).padStart(2, "0"),
  label,
}));

function TagToggle({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`rounded-full border px-3 py-1 text-[0.78rem] transition ${
            value === opt.value
              ? "border-white/25 bg-white/15 text-white"
              : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20"
          }`}
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function emptyMatchState() {
  return {
    date: "",
    faction: "",
    mapId: "",
    startingPoint: "",
    opponent: "",
    result: "",
  };
}

export function EventForm({ initialEvent, selectedDay, onSubmit, onDelete, pending, error, canDelete }) {
  const baseDate = initialEvent ? new Date(initialEvent.startsAt) : selectedDay;
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [eventType, setEventType] = useState(initialEvent?.eventType || "scrim");
  const [startsAt, setStartsAt] = useState(localDateTimeValue(baseDate));
  const [endsAt, setEndsAt] = useState(
    initialEvent?.endsAt ? localDateTimeValue(new Date(initialEvent.endsAt)) : ""
  );
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [match, setMatch] = useState(initialEvent?.match || emptyMatchState());

  const showMatchFields = isMatchEventType(eventType);

  function patchMatch(partial) {
    setMatch((current) => ({ ...current, ...partial }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      eventType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      description: description.trim(),
      match: showMatchFields ? match : emptyMatchState(),
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Title</span>
        <input
          className="glass-input w-full"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Type</span>
          <select
            className="glass-input w-full"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Starts</span>
          <input
            className="glass-input w-full"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Ends</span>
        <input
          className="glass-input w-full"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />
      </label>

      {showMatchFields ? (
        <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <legend className="px-1 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
            Match details
          </legend>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Opponent</span>
            <input
              className="glass-input w-full"
              maxLength={80}
              placeholder="Opponent team name"
              value={match.opponent || ""}
              onChange={(event) => patchMatch({ opponent: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Map</span>
            <select
              className="glass-input w-full"
              value={match.mapId || ""}
              onChange={(event) => patchMatch({ mapId: event.target.value })}
            >
              <option value="">Select map…</option>
              {STRAT_MAP_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Faction</span>
            <TagToggle
              value={match.faction || ""}
              options={FACTION_OPTIONS}
              onChange={(value) => patchMatch({ faction: value })}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Starting point (optional)</span>
            <select
              className="glass-input w-full"
              value={match.startingPoint || ""}
              onChange={(event) => patchMatch({ startingPoint: event.target.value })}
            >
              <option value="">Not set</option>
              {STARTING_POINT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <span className="mb-1 block text-muted">Result (optional)</span>
            <TagToggle
              value={match.result || ""}
              options={RESULT_OPTIONS}
              onChange={(value) => patchMatch({ result: value })}
            />
          </div>
        </fieldset>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Notes</span>
        <textarea
          className="glass-input min-h-24 w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap justify-between gap-3">
        {canDelete ? (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!title.trim() || pending}>
          {pending ? "Saving..." : "Save event"}
        </Button>
      </div>
    </form>
  );
}
