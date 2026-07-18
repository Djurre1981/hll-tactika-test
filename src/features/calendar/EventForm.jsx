import { useState } from "react";
import { Button } from "../../shared/Button.jsx";
import { EVENT_TYPES } from "./hooks/useEventsQuery.js";
import { localDateTimeValue } from "./calendar-utils.js";

export function EventForm({ initialEvent, selectedDay, onSubmit, onDelete, pending, error, canDelete }) {
  const baseDate = initialEvent ? new Date(initialEvent.startsAt) : selectedDay;
  const [title, setTitle] = useState(initialEvent?.title || "");
  const [eventType, setEventType] = useState(initialEvent?.eventType || "scrim");
  const [startsAt, setStartsAt] = useState(localDateTimeValue(baseDate));
  const [endsAt, setEndsAt] = useState(
    initialEvent?.endsAt ? localDateTimeValue(new Date(initialEvent.endsAt)) : ""
  );
  const [description, setDescription] = useState(initialEvent?.description || "");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      eventType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      description: description.trim(),
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
