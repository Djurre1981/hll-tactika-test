import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client.js";
import { queryKeys } from "../../lib/query-keys.js";
import { Button } from "../../shared/Button.jsx";
import { GlassSelect } from "../../shared/GlassSelect.jsx";
import { Modal } from "../../shared/Modal.jsx";
import { isEventEffectivelyLocked } from "./event-lock.js";
import {
  RSVP_REASON_OPTIONS,
  RSVP_REASON_LABELS,
} from "../../../functions/lib/rsvp-reasons.js";

function formatMatchOption(event) {
  const when = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
  const opponent = event.match?.opponent ? ` vs ${event.match.opponent}` : "";
  return `${when} — ${event.title}${opponent}`;
}

function useRaincheckEligibleEvents() {
  const range = useMemo(() => {
    const now = new Date();
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + 60);
    return { from: now.toISOString(), to: toDate.toISOString() };
  }, []);

  return useQuery({
    queryKey: queryKeys.events.upcoming(range.from.slice(0, 10), range.to.slice(0, 10)),
    queryFn: () => {
      const search = new URLSearchParams({ from: range.from, to: range.to });
      return apiClient(`/events?${search.toString()}`);
    },
    select: (data) =>
      (data.events || []).filter((event) => !isEventEffectivelyLocked(event)),
    staleTime: 30_000,
  });
}

export function useRaincheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, reasonCode, reasonNote, status = "declined" }) => {
      if (status === "declined") {
        return apiClient("/rsvps/raincheck", {
          method: "POST",
          body: JSON.stringify({ eventId, reasonCode, reasonNote }),
        });
      }
      return apiClient(`/events/${eventId}/rsvps`, {
        method: "PUT",
        body: JSON.stringify({ status, reasonCode, reasonNote }),
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.byEvent(vars.eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rsvps.root });
      queryClient.invalidateQueries({ queryKey: ["events", "upcoming"] });
    },
  });
}

/**
 * Shared absence flow: pick match + reason.
 * @param {{ open: boolean, onClose: function, initialEventId?: string|null, status?: 'declined'|'unavailable', onCompleted?: function }} props
 */
export function RaincheckFlow({
  open,
  onClose,
  initialEventId = null,
  status = "declined",
  onCompleted,
}) {
  const eventsQuery = useRaincheckEligibleEvents();
  const raincheck = useRaincheckMutation();
  const events = eventsQuery.data || [];

  const [eventId, setEventId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEventId(initialEventId || "");
    setReasonCode("");
    setReasonNote("");
    setLocalError("");
    raincheck.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / initial changes
  }, [open, initialEventId]);

  const matchOptions = useMemo(
    () =>
      events.map((event) => ({
        value: event.id,
        label: formatMatchOption(event),
      })),
    [events]
  );

  const effectiveEventId =
    eventId ||
    (initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : "") ||
    matchOptions[0]?.value ||
    "";

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    const selected = effectiveEventId;
    if (!selected) {
      setLocalError("Select a match to raincheck.");
      return;
    }
    if (!reasonCode) {
      setLocalError("Select a reason for absence.");
      return;
    }
    if (reasonCode === "other" && !reasonNote.trim()) {
      setLocalError("Please add a short note for Other.");
      return;
    }

    try {
      const result = await raincheck.mutateAsync({
        eventId: selected,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
        status,
      });
      onCompleted?.(result);
      onClose?.();
    } catch (err) {
      setLocalError(err?.message || "Could not save absence.");
    }
  }

  const isUnavailable = status === "unavailable";
  const title = isUnavailable ? "Mark unavailable" : "Raincheck";

  return (
    <Modal open={open} onClose={onClose} title={title} size="default">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="m-0 text-[0.85rem] text-white/55">
          {isUnavailable
            ? "Mark yourself unavailable for a match and share a reason."
            : "Mark yourself out for a match. This frees your seat and may promote someone from the waitlist."}
        </p>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Match</span>
          {eventsQuery.isLoading ? (
            <p className="m-0 text-[0.82rem] text-white/40">Loading upcoming matches…</p>
          ) : matchOptions.length === 0 ? (
            <p className="m-0 text-[0.82rem] text-white/45">No upcoming unlocked matches.</p>
          ) : (
            <GlassSelect
              value={effectiveEventId}
              onChange={setEventId}
              options={matchOptions}
              placeholder="Select match"
            />
          )}
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm text-muted">Reason for absence</legend>
          <div className="flex flex-col gap-1.5">
            {RSVP_REASON_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[0.85rem] transition ${
                  reasonCode === opt.value
                    ? "border-white/25 bg-white/[0.1] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/18"
                }`}
              >
                <input
                  type="radio"
                  name="raincheck-reason"
                  value={opt.value}
                  checked={reasonCode === opt.value}
                  onChange={() => setReasonCode(opt.value)}
                  className="accent-amber-300"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        {reasonCode ? (
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              {reasonCode === "other" ? "Note (required)" : "Note (optional)"}
            </span>
            <textarea
              className="glass-input min-h-20 w-full"
              value={reasonNote}
              maxLength={280}
              placeholder={
                reasonCode === "prefer_not"
                  ? "Optional"
                  : `Details for ${RSVP_REASON_LABELS[reasonCode] || "absence"}`
              }
              onChange={(ev) => setReasonNote(ev.target.value)}
            />
          </label>
        ) : null}

        {localError || raincheck.error ? (
          <p className="m-0 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8rem] text-red-100">
            {localError || raincheck.error?.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={raincheck.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={raincheck.isPending || matchOptions.length === 0}>
            {raincheck.isPending ? "Saving…" : isUnavailable ? "Mark unavailable" : "Submit raincheck"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
