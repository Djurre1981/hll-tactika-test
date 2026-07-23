import { useState } from "react";
import { Button } from "../../shared/Button.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { getMidpointsForMap, isValidStartingPoint } from "../../shared/mapMidpoints.js";
import { EventLockBadge, EventLockIcon } from "../events/EventLockBadge.jsx";
import { eventLockLabel } from "../events/event-lock.js";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { EVENT_TYPES } from "./hooks/useEventsQuery.js";
import {
  endDateTimeFromStart,
  isMatchEventType,
  localDateTimeValue,
} from "./calendar-utils.js";

const FACTION_OPTIONS = [
  { value: "axis", label: "Axis" },
  { value: "allies", label: "Allies" },
];

const RESULT_OPTIONS = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
];

function TagToggle({ value, options, onChange, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          className={`rounded-full border px-3 py-1 text-[0.78rem] transition ${
            value === opt.value
              ? "border-white/25 bg-white/15 text-white"
              : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          onClick={() => !disabled && onChange(value === opt.value ? "" : opt.value)}
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

export function EventForm({
  initialEvent,
  selectedDay,
  onSubmit,
  onDelete,
  onLock,
  onUnlock,
  pending,
  lockPending,
  error,
  canDelete,
  readOnly = false,
  effectiveLocked = false,
  lockReason = null,
  canLock = false,
  canUnlock = false,
}) {
  const baseDate = initialEvent ? new Date(initialEvent.startsAt) : selectedDay;
  const initialStartsAt = localDateTimeValue(baseDate);
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [eventType, setEventType] = useState(initialEvent?.eventType || "scrim");
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(
    initialEvent?.endsAt
      ? localDateTimeValue(new Date(initialEvent.endsAt))
      : endDateTimeFromStart(initialStartsAt)
  );
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [match, setMatch] = useState(initialEvent?.match || emptyMatchState());

  const showMatchFields = isMatchEventType(eventType);
  const startingPointOptions = match.mapId ? getMidpointsForMap(match.mapId) : [];
  const eventTypeOptions = EVENT_TYPES.map((type) => ({ value: type, label: type }));
  const mapOptions = STRAT_MAP_IDS.map((id) => ({ value: id, label: id }));
  const strongpointSelectOptions = startingPointOptions.map((opt) => ({
    value: opt.id,
    label: opt.label,
  }));

  function patchMatch(partial) {
    setMatch((current) => {
      const next = { ...current, ...partial };
      if (partial.mapId !== undefined && partial.mapId !== current.mapId) {
        if (!isValidStartingPoint(partial.mapId, current.startingPoint)) {
          next.startingPoint = "";
        }
      }
      return next;
    });
  }

  function handleStartsAtChange(value) {
    setStartsAt(value);
    setEndsAt(endDateTimeFromStart(value));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (readOnly) return;
    onSubmit({
      title: title.trim(),
      eventType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      description: description.trim(),
      match: showMatchFields ? match : emptyMatchState(),
    });
  }

  const lockLabel = eventLockLabel(lockReason);
  const inputDisabled = readOnly || pending;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {initialEvent ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <EventLockBadge event={initialEvent} />
            <span className="text-[0.78rem] text-white/50">{lockLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canLock ? (
              <Button
                type="button"
                variant="ghost"
                disabled={lockPending || pending}
                onClick={onLock}
              >
                <EventLockIcon locked className="mr-1.5 text-[0.75rem]" />
                Lock event
              </Button>
            ) : null}
            {canUnlock ? (
              <Button
                type="button"
                variant="ghost"
                disabled={lockPending || pending}
                onClick={onUnlock}
              >
                <EventLockIcon locked={false} className="mr-1.5 text-[0.75rem]" />
                Unlock event
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {readOnly ? (
        <p className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-50/90">
          This event is locked. Properties cannot be changed.
          {canUnlock ? " Use Unlock above if you need to edit it." : " Contact an administrator to unlock."}
        </p>
      ) : null}
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
          disabled={inputDisabled}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <div className={`grid gap-5 ${showMatchFields ? "lg:grid-cols-2" : ""}`}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Type</span>
              <GlassSelect
                value={eventType}
                onChange={setEventType}
                options={eventTypeOptions}
                placeholder=""
                disabled={inputDisabled}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Starts</span>
              <input
                className="glass-input w-full"
                type="datetime-local"
                value={startsAt}
                disabled={inputDisabled}
                onChange={(event) => handleStartsAtChange(event.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Ends</span>
            <input
              className="glass-input w-full"
              type="datetime-local"
              value={endsAt}
              disabled={inputDisabled}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Notes</span>
            <textarea
              className="glass-input min-h-24 w-full lg:min-h-[11.5rem]"
              value={description}
              disabled={inputDisabled}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>

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
                disabled={inputDisabled}
                onChange={(event) => patchMatch({ opponent: event.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Map</span>
              <GlassSelect
                value={match.mapId || ""}
                onChange={(mapId) => patchMatch({ mapId })}
                options={mapOptions}
                placeholder="Select map…"
                disabled={inputDisabled}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="block text-sm">
                <span className="mb-1 block text-muted">Faction</span>
                <TagToggle
                  value={match.faction || ""}
                  options={FACTION_OPTIONS}
                  disabled={inputDisabled}
                  onChange={(value) => patchMatch({ faction: value })}
                />
              </div>
              <div className="block text-sm">
                <span className="mb-1 block text-muted">Result (optional)</span>
                <TagToggle
                  value={match.result || ""}
                  options={RESULT_OPTIONS}
                  disabled={inputDisabled}
                  onChange={(value) => patchMatch({ result: value })}
                />
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Starting strongpoint (optional)</span>
              <GlassSelect
                value={match.startingPoint || ""}
                onChange={(startingPoint) => patchMatch({ startingPoint })}
                options={strongpointSelectOptions}
                placeholder={match.mapId ? "Select strongpoint…" : "Select a map first"}
                disabled={inputDisabled || !match.mapId}
              />
            </label>
          </fieldset>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        {canDelete && !readOnly ? (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        {!readOnly ? (
          <Button type="submit" disabled={!title.trim() || pending}>
            {pending ? "Saving..." : "Save event"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
