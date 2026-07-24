import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useEventQuery } from "../calendar/hooks/useEventsQuery.js";
import { useEventRsvpsQuery } from "../events/hooks/useRsvpsQuery.js";
import { apiClient } from "../../lib/api-client.js";
import { canManageTeam } from "../../lib/roles.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { LineUpBoard } from "./LineUpBoard.jsx";
import { useLineupCollab } from "./hooks/useLineupCollab.js";
import { useLineupMutation, useLineupQuery } from "./hooks/useLineupQuery.js";
import {
  assignNodeSlot,
  assignToReserve,
  assignToSlot,
  assignToSpecial,
  clearSlot,
  collectAssignedSteamIds,
  countFilledPlayingSlots,
  deepCloneLayout,
  setNodesSl,
  setPresent,
} from "./lineup-utils.js";

function playerLabel(rsvp) {
  const id = String(rsvp.steamId || "");
  return rsvp.displayName || rsvp.name || rsvp.personaName || (id ? `…${id.slice(-6)}` : "Unknown");
}

export function LineUpPage() {
  const { id: lineupId } = useParams();
  const user = useAuth();
  const canEdit = canManageTeam(user?.role);
  const lineupQuery = useLineupQuery(lineupId);
  const saveMutation = useLineupMutation(lineupId);

  const eventId = lineupQuery.data?.eventId;
  const eventQuery = useEventQuery(eventId);
  const rsvpsQuery = useEventRsvpsQuery(eventId);

  const [layout, setLayout] = useState(null);
  const [selectedSteamId, setSelectedSteamId] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (lineupQuery.data?.layout) {
      setLayout(deepCloneLayout(lineupQuery.data.layout));
      setDirty(false);
    }
  }, [lineupQuery.data?.updatedAt, lineupQuery.data?.id]);

  const collab = useLineupCollab({
    lineupId,
    enabled: Boolean(lineupQuery.data),
    user,
    canWrite: canEdit && !lineupQuery.data?.effectivelyLocked,
    onRemoteLayout: (remote) => {
      setLayout(remote);
      setDirty(false);
    },
  });

  useEffect(() => {
    if (layout && canEdit) collab.seedIfEmpty(layout);
  }, [layout, canEdit, collab.seedIfEmpty]);

  const locked = Boolean(lineupQuery.data?.effectivelyLocked);
  const readOnly = !canEdit || locked;

  const confirmed = useMemo(() => {
    const list = rsvpsQuery.data?.rsvps || rsvpsQuery.data || [];
    const arr = Array.isArray(list) ? list : [];
    return arr
      .filter((r) => r.status === "confirmed")
      .map((r) => ({
        steamId: String(r.steamId),
        displayName: playerLabel(r),
      }));
  }, [rsvpsQuery.data]);

  const assigned = useMemo(() => collectAssignedSteamIds(layout), [layout]);
  const pool = useMemo(
    () => confirmed.filter((p) => !assigned.has(p.steamId)),
    [confirmed, assigned]
  );

  const selectedPlayer = useMemo(
    () => confirmed.find((p) => p.steamId === selectedSteamId) || null,
    [confirmed, selectedSteamId]
  );

  const infantryPlayers = useMemo(() => {
    const out = [];
    for (const sec of layout?.sectors || []) {
      for (const sq of sec.squads || []) {
        if (sq.type !== "infantry") continue;
        for (const slot of sq.slots || []) {
          if (slot.steamId) {
            out.push({
              steamId: String(slot.steamId),
              displayName: slot.displayName || slot.steamId,
            });
          }
        }
      }
    }
    return out;
  }, [layout]);

  const applyLayout = useCallback(
    (next, { persist = true } = {}) => {
      setLayout(next);
      setDirty(true);
      collab.publishLayout(next);
      if (persist && canEdit && !locked) {
        setError("");
        saveMutation.mutate(
          { layout: next },
          {
            onSuccess: () => setDirty(false),
            onError: (err) => setError(err?.message || "Save failed"),
          }
        );
      }
    },
    [canEdit, locked, collab, saveMutation]
  );

  const assignSelected = useCallback(
    (targetKey) => {
      if (readOnly || !selectedPlayer || !layout) return;
      let result;
      if (targetKey === "reserve") {
        result = assignToReserve(layout, selectedPlayer);
      } else if (targetKey.startsWith("special:")) {
        result = assignToSpecial(layout, targetKey.slice(8), selectedPlayer);
      } else if (targetKey.startsWith("slot:")) {
        const [, squadId, slotId] = targetKey.split(":");
        result = assignToSlot(layout, squadId, slotId, selectedPlayer);
      } else {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      applyLayout(result.layout);
      setSelectedSteamId(null);
    },
    [readOnly, selectedPlayer, layout, applyLayout]
  );

  async function forceRsvp() {
    const steamId = window.prompt("Steam64 ID to force-RSVP as confirmed:");
    if (!steamId || !eventId) return;
    setError("");
    try {
      await apiClient(`/events/${eventId}/rsvps`, {
        method: "PUT",
        body: JSON.stringify({
          steamId: steamId.trim(),
          status: "confirmed",
          forceConfirm: true,
        }),
      });
      await rsvpsQuery.refetch();
    } catch (err) {
      setError(err?.message || "Force RSVP failed");
    }
  }

  if (lineupQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center gap-3 text-white/55">
        <Spinner />
        <span>Loading LineUp…</span>
      </div>
    );
  }

  if (lineupQuery.error || !lineupQuery.data) {
    return (
      <section className="space-y-3 p-4">
        <Link to="/calendar" className="text-white/50 no-underline hover:text-white/80">
          ← Calendar
        </Link>
        <p className="text-red-200">{lineupQuery.error?.message || "LineUp not found"}</p>
      </section>
    );
  }

  const lineup = lineupQuery.data;
  const event = eventQuery.data;
  const filled = countFilledPlayingSlots(layout);

  return (
    <div className="glass-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1 sm:p-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={eventId ? `/events/${eventId}` : "/calendar"}
            className="text-[0.82rem] text-white/50 no-underline hover:text-white/80"
          >
            ← Match Brief
          </Link>
          <h1 className="m-0 mt-1 text-[clamp(1.3rem,2vw,1.75rem)] font-medium text-white">
            LineUp · {lineup.rosterSize}
          </h1>
          <p className="m-0 mt-1 text-[0.85rem] text-white/50">
            {event?.title || eventId} · {filled}/{lineup.rosterSize} filled
            {locked ? " · Locked" : ""} · Collab: {collab.status}
            {dirty ? " · Saving…" : ""}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveMutation.isPending || locked}
              onClick={() => forceRsvp()}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[0.78rem] text-white/80"
            >
              Force RSVP
            </button>
            {locked ? (
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate(
                    { unlock: true },
                    { onError: (e) => setError(e?.message || "Unlock failed") }
                  )
                }
                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[0.78rem] text-amber-100"
              >
                Unlock
              </button>
            ) : (
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate(
                    { lock: true },
                    { onError: (e) => setError(e?.message || "Lock failed") }
                  )
                }
                className="rounded-full border border-white/15 px-3 py-1.5 text-[0.78rem] text-white/80"
              >
                Lock LineUp
              </button>
            )}
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="m-0 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[0.85rem] text-red-100">
          {error}
        </p>
      ) : null}

      {locked ? (
        <p className="m-0 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[0.85rem] text-amber-50/90">
          LineUp is locked (manual or after match end). View only.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
            RSVP pool
          </h2>
          <p className="m-0 mb-2 text-[0.72rem] text-white/40">
            Confirmed only. Select a player, then tap an empty slot.
          </p>
          <ul className="m-0 flex max-h-[50vh] list-none flex-col gap-1 overflow-auto p-0">
            {pool.length === 0 ? (
              <li className="text-[0.8rem] text-white/40">No unassigned confirmed players</li>
            ) : (
              pool.map((p) => (
                <li key={p.steamId}>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setSelectedSteamId(p.steamId)}
                    className={`w-full truncate rounded-lg border px-2 py-1.5 text-left text-[0.8rem] ${
                      selectedSteamId === p.steamId
                        ? "border-accent/40 bg-accent/15 text-white"
                        : "border-white/10 bg-black/20 text-white/80 hover:border-white/25"
                    }`}
                  >
                    {p.displayName}
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        {layout ? (
          <LineUpBoard
            layout={layout}
            disabled={readOnly}
            selectedPlayer={selectedPlayer}
            selectedTarget={selectedTarget}
            onSelectTarget={setSelectedTarget}
            onAssignSelected={assignSelected}
            onClearSpecial={(specialId) =>
              applyLayout(clearSlot(layout, "special", { specialId }))
            }
            onClearSlot={(squadId, slotId) =>
              applyLayout(clearSlot(layout, "slot", { squadId, slotId }))
            }
            onClearReserve={(steamId) =>
              applyLayout(clearSlot(layout, "reserve", { steamId }))
            }
            onPresentSpecial={(specialId, present) =>
              applyLayout(setPresent(layout, "special", { specialId }, present))
            }
            onPresentSlot={(squadId, slotId, present) =>
              applyLayout(setPresent(layout, "slot", { squadId, slotId }, present))
            }
            onPresentReserve={(steamId, present) =>
              applyLayout(setPresent(layout, "reserve", { steamId }, present))
            }
            onSelectReserveTarget={() => setSelectedTarget("reserve")}
            onNodeAssign={(blockKey, nodeSlotId) => {
              if (!selectedPlayer) return;
              const result = assignNodeSlot(layout, blockKey, nodeSlotId, selectedPlayer);
              if (result.error) {
                setError(result.error);
                return;
              }
              applyLayout(result.layout);
            }}
            onNodesSlChange={(blockKey, squadId) => {
              const result = setNodesSl(layout, blockKey, squadId);
              if (result.error) {
                setError(result.error);
                return;
              }
              applyLayout(result.layout);
            }}
            infantryPlayers={infantryPlayers}
          />
        ) : null}
      </div>
    </div>
  );
}
