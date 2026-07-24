import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useEventQuery } from "../calendar/hooks/useEventsQuery.js";
import { useEventRsvpsQuery } from "../events/hooks/useRsvpsQuery.js";
import {
  useRosterMembersQuery,
  useRostersQuery,
} from "../management/hooks/useRostersQuery.js";
import { parseCompRoles } from "../management/rosterRoles.js";
import { apiClient } from "../../lib/api-client.js";
import { canManageTeam } from "../../lib/roles.js";
import { Spinner } from "../../shared/Spinner.jsx";
import { LineUpBoard, SpecialCard } from "./LineUpBoard.jsx";
import { useLineupCollab } from "./hooks/useLineupCollab.js";
import { useLineupMutation, useLineupQuery } from "./hooks/useLineupQuery.js";
import {
  PLAYER_DRAG_MIME,
  addSquadToSector,
  assignToReserve,
  assignToSlot,
  assignToSpecial,
  clearSlot,
  collectAssignedSteamIds,
  collectPlayingSteamIds,
  countFilledPlayingSlots,
  countFilledSquads,
  countSquadBudget,
  deepCloneLayout,
  isEmptyPlayingTarget,
  MAX_SQUADS,
  roleIcon,
  setPresent,
  setStreamers,
  syncReservesWhenFull,
} from "./lineup-utils.js";

/** RSVP pool role filters → roster comp role id + LineUp slot icon key. */
const POOL_ROLE_FILTERS = [
  { id: "infantry", rosterRole: "infantry", iconRole: "rifleman", label: "Infantry" },
  { id: "tanks", rosterRole: "tanker", iconRole: "tank_commander", label: "Tanks" },
  { id: "mg", rosterRole: "mg", iconRole: "mg", label: "MG" },
  { id: "squad_lead", rosterRole: "squad_lead", iconRole: "sl", label: "Squad lead" },
];

function playerLabel(rsvp) {
  const id = String(rsvp.steamId || "");
  return (
    rsvp.displayName ||
    rsvp.name ||
    rsvp.personaName ||
    rsvp.reasonNote ||
    (id ? `…${id.slice(-6)}` : "Unknown")
  );
}

function FairnessHint({ steamId, fairnessStats }) {
  const s = fairnessStats?.[steamId];
  if (!s) return null;
  return (
    <span
      className="shrink-0 text-[0.65rem] tabular-nums text-white/35"
      title={`Confirmed RSVPs: ${s.confirmedRsvpCount} · Times reserved: ${s.reserveCount} · Times played: ${s.playedCount}`}
    >
      {s.confirmedRsvpCount}r / {s.reserveCount}b
    </span>
  );
}

function StreamersPulldown({ streamers, disabled, onChange }) {
  const axis = streamers?.axis || { name: "", url: "" };
  const allies = streamers?.allies || { name: "", url: "" };
  const filled = [axis.name, allies.name].filter(Boolean).length;

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-[0.78rem] text-white/80 marker:content-none [&::-webkit-details-marker]:hidden">
        Streamers{filled ? ` (${filled})` : ""}
        <i className="fa-solid fa-chevron-down ml-1.5 text-[0.6rem] text-white/45" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#12141a] p-3 shadow-xl">
        <p className="m-0 mb-2 text-[0.7rem] text-white/40">
          External commentators — not roster slots.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {["axis", "allies"].map((side) => (
            <div key={side}>
              <p className="m-0 mb-1.5 text-[0.72rem] font-medium capitalize text-white/80">
                {side}
              </p>
              <label className="mb-1.5 block text-[0.65rem] text-white/45">
                Name
                <input
                  className="glass-input mt-1 w-full text-[0.8rem]"
                  disabled={disabled}
                  value={streamers?.[side]?.name || ""}
                  placeholder="Commentator"
                  onChange={(e) =>
                    onChange?.({
                      ...streamers,
                      [side]: { ...streamers?.[side], name: e.target.value },
                    })
                  }
                />
              </label>
              <label className="block text-[0.65rem] text-white/45">
                Stream URL
                <input
                  className="glass-input mt-1 w-full text-[0.8rem]"
                  disabled={disabled}
                  value={streamers?.[side]?.url || ""}
                  placeholder="https://…"
                  onChange={(e) =>
                    onChange?.({
                      ...streamers,
                      [side]: { ...streamers?.[side], url: e.target.value },
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function LineUpPage() {
  const { id: lineupId } = useParams();
  const user = useAuth();
  const canEdit = canManageTeam(user?.role);
  const lineupQuery = useLineupQuery(lineupId);
  const saveMutation = useLineupMutation(lineupId);

  const lineupData = lineupQuery.data?.lineup;
  const fairnessStats = lineupQuery.data?.fairnessStats || {};
  const eventId = lineupData?.eventId;
  const eventQuery = useEventQuery(eventId);
  const rsvpsQuery = useEventRsvpsQuery(eventId);
  const rostersQuery = useRostersQuery();

  const linkedRosterId = eventQuery.data?.components?.rosterId || null;
  const fallbackRosterId = useMemo(() => {
    const list = rostersQuery.data?.rosters || rostersQuery.data || [];
    const arr = Array.isArray(list) ? list : [];
    const preferred =
      arr.find((r) => r.isDefault || r.default) ||
      arr.find((r) => /circle/i.test(String(r.name || ""))) ||
      arr[0];
    return preferred?.id || null;
  }, [rostersQuery.data]);
  const rosterId = linkedRosterId || fallbackRosterId;
  const membersQuery = useRosterMembersQuery(rosterId);

  const rosterBySteamId = useMemo(() => {
    const members = membersQuery.data?.members || membersQuery.data || [];
    const arr = Array.isArray(members) ? members : [];
    const map = new Map();
    for (const m of arr) {
      const id = String(m.steamId || "");
      if (!id) continue;
      map.set(id, {
        displayName: m.displayName || "",
        roles: parseCompRoles(m.rosterRoles?.length ? m.rosterRoles : m.rosterRole),
      });
    }
    return map;
  }, [membersQuery.data]);

  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [roleFilter, setRoleFilter] = useState(null);

  const collab = useLineupCollab({
    lineupId,
    enabled: Boolean(lineupData),
    user,
    canWrite: canEdit && !lineupData?.effectivelyLocked,
    onRemoteLayout: (remote, meta) => {
      const remoteAt = meta?.updatedAt ? Date.parse(meta.updatedAt) : NaN;
      const serverAt = lineupData?.updatedAt ? Date.parse(lineupData.updatedAt) : NaN;
      // Prefer server when collab doc is missing/older (e.g. after Reset layout)
      if (
        Number.isFinite(serverAt) &&
        (!Number.isFinite(remoteAt) || remoteAt < serverAt)
      ) {
        return;
      }
      setLayout(remote);
      setDirty(false);
    },
  });

  useEffect(() => {
    if (!lineupData?.layout) return;
    const next = deepCloneLayout(lineupData.layout);
    if (!next.streamers) {
      next.streamers = {
        axis: { name: "", url: "" },
        allies: { name: "", url: "" },
      };
    }
    setLayout(next);
    setDirty(false);
    if (canEdit && !lineupData.effectivelyLocked) {
      collab.forcePublishLayout(next, lineupData.updatedAt);
    }
  }, [lineupData?.updatedAt, lineupData?.id]);

  useEffect(() => {
    if (layout && canEdit) collab.seedIfEmpty(layout, lineupData?.updatedAt);
  }, [layout, canEdit, collab.seedIfEmpty, lineupData?.updatedAt]);

  const locked = Boolean(lineupData?.effectivelyLocked);
  const readOnly = !canEdit || locked;

  const confirmed = useMemo(() => {
    const list = rsvpsQuery.data?.rsvps || rsvpsQuery.data || [];
    const arr = Array.isArray(list) ? list : [];
    return arr
      .filter((r) => r.status === "confirmed")
      .map((r) => {
        const id = String(r.steamId);
        const roster = rosterBySteamId.get(id);
        return {
          steamId: id,
          displayName: roster?.displayName || playerLabel(r),
          rosterRoles: roster?.roles || [],
        };
      });
  }, [rsvpsQuery.data, rosterBySteamId]);

  const assignOpts = useMemo(
    () => ({
      confirmedPlayers: confirmed,
      rosterSize: lineupData?.rosterSize,
    }),
    [confirmed, lineupData?.rosterSize]
  );

  const assigned = useMemo(() => collectAssignedSteamIds(layout), [layout]);
  const pool = useMemo(() => {
    const unassigned = confirmed.filter((p) => !assigned.has(p.steamId));
    if (!roleFilter) return unassigned;
    const filter = POOL_ROLE_FILTERS.find((f) => f.id === roleFilter);
    if (!filter) return unassigned;
    return unassigned.filter((p) => p.rosterRoles.includes(filter.rosterRole));
  }, [confirmed, assigned, roleFilter]);

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

  const handleDropPlayer = useCallback(
    (targetKey, player) => {
      if (readOnly || !player?.steamId || !layout) return;
      const rosterMax = Number(assignOpts.rosterSize) || 0;
      const playersFilled = countFilledPlayingSlots(layout);
      const playersFull = rosterMax > 0 && playersFilled >= rosterMax;
      if (playersFull && targetKey !== "reserve") {
        const alreadyPlaying = collectPlayingSteamIds(layout).has(
          String(player.steamId)
        );
        if (!alreadyPlaying && isEmptyPlayingTarget(layout, targetKey)) {
          setError("Player slots are full");
          return;
        }
      }
      let result;
      if (targetKey === "reserve") {
        result = assignToReserve(layout, player, assignOpts);
      } else if (targetKey.startsWith("special:")) {
        result = assignToSpecial(layout, targetKey.slice(8), player, assignOpts);
      } else if (targetKey.startsWith("slot:")) {
        const parts = targetKey.split(":");
        const squadId = parts[1];
        const slotId = parts.slice(2).join(":");
        result = assignToSlot(layout, squadId, slotId, player, assignOpts);
      } else {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      applyLayout(result.layout);
    },
    [readOnly, layout, applyLayout, assignOpts]
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

  if (lineupQuery.error || !lineupData) {
    return (
      <section className="space-y-3 p-4">
        <Link to="/calendar" className="text-white/50 no-underline hover:text-white/80">
          ← Calendar
        </Link>
        <p className="text-red-200">{lineupQuery.error?.message || "LineUp not found"}</p>
      </section>
    );
  }

  const lineup = lineupData;
  const event = eventQuery.data;
  const rosterMax = Number(lineup.rosterSize) || 0;
  const playersFilled = layout ? countFilledPlayingSlots(layout) : 0;
  const squadsFilled = layout ? countFilledSquads(layout) : 0;
  const squadBudget = layout ? countSquadBudget(layout) : 0;
  const playersFull = rosterMax > 0 && playersFilled >= rosterMax;
  const squadsCounterFull = squadsFilled >= MAX_SQUADS;
  const cannotAddSquad = squadBudget >= MAX_SQUADS || squadsCounterFull;
  const bothFull = playersFull && squadsCounterFull;
  const poolDragDisabled = readOnly || playersFull;

  function fillReserves() {
    if (!layout) return;
    const next = deepCloneLayout(layout);
    syncReservesWhenFull(next, confirmed, rosterMax);
    applyLayout(next);
  }

  const commander = layout?.specials?.find((sp) => sp.role === "commander");
  const artillery = layout?.specials?.find((sp) => sp.role === "artillery");

  function handleAddSquad(sectorId) {
    if (cannotAddSquad) {
      setError(`Squad cap reached (${MAX_SQUADS})`);
      return;
    }
    const result = addSquadToSector(layout, sectorId, lineup.rosterSize);
    if (result.error) {
      setError(result.error);
      return;
    }
    applyLayout(result.layout);
  }

  return (
    <div className="glass-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1 sm:p-2">
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

      {/*
        Grid A–D / 1–4:
        1A–1B title · 1C Command · 1D Artillery
        2A–4A sidebar · 2B–2D tanks · 3B–3D infantry · 4B–4D defence/flex/recon
      */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:items-start">
        {/* 1A–1B: title + counters + actions */}
        <div className="lg:col-span-2">
          <Link
            to={eventId ? `/events/${eventId}` : "/calendar"}
            className="text-[0.82rem] text-white/50 no-underline hover:text-white/80"
          >
            ← Match Brief
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-[clamp(1.3rem,2vw,1.75rem)] font-medium text-white">
              LineUp · {lineup.rosterSize}
            </h1>
            <span
              className={`text-[0.85rem] tabular-nums ${
                playersFull ? "font-medium text-red-300" : "text-white/55"
              }`}
              title="Assigned players / LineUp size"
            >
              players {playersFilled}/{rosterMax}
            </span>
            <span
              className={`text-[0.85rem] tabular-nums ${
                squadsCounterFull ? "font-medium text-red-300" : "text-white/55"
              }`}
              title="Squads with at least one player / max 20"
            >
              squads {squadsFilled}/{MAX_SQUADS}
            </span>
            {layout ? (
              <StreamersPulldown
                streamers={layout.streamers}
                disabled={readOnly}
                onChange={(streamers) => applyLayout(setStreamers(layout, streamers))}
              />
            ) : null}
            {bothFull && canEdit && !locked ? (
              <button
                type="button"
                onClick={() => fillReserves()}
                className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[0.75rem] text-emerald-100 hover:bg-emerald-500/15"
              >
                Fill reserves
              </button>
            ) : null}
          </div>
          <p className="m-0 mt-1 text-[0.85rem] text-white/50">
            {event?.title || eventId}
            {locked ? " · Locked" : ""} · Collab: {collab.status}
            {dirty ? " · Saving…" : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canEdit ? (
              <>
                <button
                  type="button"
                  disabled={saveMutation.isPending || locked}
                  onClick={() => forceRsvp()}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.78rem] text-white/80"
                >
                  Force RSVP
                </button>
                <button
                  type="button"
                  disabled={saveMutation.isPending || locked || !eventId}
                  title="Replace board with default layout"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Reset LineUp to default? Assignments will be cleared."
                      )
                    ) {
                      return;
                    }
                    setError("");
                    try {
                      const data = await apiClient("/lineups", {
                        method: "POST",
                        body: JSON.stringify({ eventId, reset: true }),
                      });
                      const next = deepCloneLayout(data.lineup?.layout);
                      if (next) {
                        if (!next.streamers) {
                          next.streamers = {
                            axis: { name: "", url: "" },
                            allies: { name: "", url: "" },
                          };
                        }
                        setLayout(next);
                        collab.forcePublishLayout(next, data.lineup?.updatedAt);
                      }
                      await lineupQuery.refetch();
                    } catch (err) {
                      setError(err?.message || "Reset failed");
                    }
                  }}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[0.78rem] text-white/80"
                >
                  Reset layout
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
              </>
            ) : null}
          </div>
        </div>

        {/* 1C: Command */}
        {layout ? (
          <SpecialCard
            title="Command"
            colorHex="#ecf0f1"
            special={commander}
            disabled={readOnly}
            dropDisabled={poolDragDisabled}
            onDropPlayer={handleDropPlayer}
            onClear={(specialId) =>
              applyLayout(clearSlot(layout, "special", { specialId }, assignOpts))
            }
            onPresent={(specialId, present) =>
              applyLayout(setPresent(layout, "special", { specialId }, present))
            }
          />
        ) : (
          <div />
        )}

        {/* 1D: Artillery */}
        {layout ? (
          <SpecialCard
            title="Artillery"
            colorHex="#bdc3c7"
            special={artillery}
            disabled={readOnly}
            dropDisabled={poolDragDisabled}
            onDropPlayer={handleDropPlayer}
            onClear={(specialId) =>
              applyLayout(clearSlot(layout, "special", { specialId }, assignOpts))
            }
            onPresent={(specialId, present) =>
              applyLayout(setPresent(layout, "special", { specialId }, present))
            }
          />
        ) : (
          <div />
        )}

        {/* 2A–4A: RSVP + Reserves */}
        <aside className="flex flex-col gap-3 lg:row-span-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
                RSVP pool
              </h2>
              <div className="flex items-center gap-0.5" role="group" aria-label="Filter by role">
                {POOL_ROLE_FILTERS.map((f) => {
                  const active = roleFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      title={
                        active
                          ? `${f.label} (click to clear)`
                          : `Show ${f.label} only`
                      }
                      aria-pressed={active}
                      onClick={() =>
                        setRoleFilter((prev) => (prev === f.id ? null : f.id))
                      }
                      className={`inline-flex h-6 w-6 items-center justify-center rounded text-[0.7rem] transition ${
                        active
                          ? "bg-accent/25 text-accent"
                          : "text-white/40 hover:bg-white/10 hover:text-white/80"
                      }`}
                    >
                      <i
                        className={`fa-solid ${roleIcon(f.iconRole)}`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="m-0 mb-2 text-[0.72rem] text-white/40">
              {poolDragDisabled && playersFull
                ? "Player slots full — clear a slot before assigning more."
                : roleFilter
                  ? `Showing ${POOL_ROLE_FILTERS.find((f) => f.id === roleFilter)?.label || "filtered"} only.`
                  : "Drag a confirmed player onto a role slot."}
            </p>
            <ul className="m-0 flex max-h-[40vh] list-none flex-col gap-1 overflow-auto p-0">
              {pool.length === 0 ? (
                <li className="text-[0.8rem] text-white/40">
                  {roleFilter
                    ? "No unassigned players for this role"
                    : "No unassigned confirmed players"}
                </li>
              ) : (
                pool.map((p) => (
                  <li key={p.steamId}>
                    <button
                      type="button"
                      draggable={!poolDragDisabled}
                      disabled={poolDragDisabled}
                      onDragStart={(e) => {
                        if (poolDragDisabled) {
                          e.preventDefault();
                          return;
                        }
                        const payload = JSON.stringify(p);
                        e.dataTransfer.setData(PLAYER_DRAG_MIME, payload);
                        e.dataTransfer.setData("text/plain", payload);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="flex w-full cursor-grab items-center gap-2 truncated rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[0.8rem] text-white/80 active:cursor-grabbing hover:border-white/25 disabled:cursor-default disabled:opacity-50"
                    >
                      <i
                        className={`fa-solid ${roleIcon("rifleman")} shrink-0 text-[0.7rem] text-white/40`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                      <FairnessHint steamId={p.steamId} fairnessStats={fairnessStats} />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h2 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
              Reserves
            </h2>
            <div
              className={`mb-2 min-h-[2.5rem] rounded-lg border border-dashed px-3 py-2 text-[0.75rem] ${
                readOnly
                  ? "border-white/10 text-white/30"
                  : "border-white/20 text-white/45 hover:border-accent/40"
              }`}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (readOnly) return;
                e.preventDefault();
                const raw =
                  e.dataTransfer.getData(PLAYER_DRAG_MIME) ||
                  e.dataTransfer.getData("text/plain");
                if (!raw) return;
                try {
                  const player = JSON.parse(raw);
                  if (player?.steamId) handleDropPlayer("reserve", player);
                } catch {
                  /* ignore */
                }
              }}
            >
              Drop player here
            </div>
            <ul className="m-0 flex max-h-[30vh] list-none flex-col gap-1 overflow-auto p-0">
              {!layout?.reserves?.length ? (
                <li className="text-[0.8rem] text-white/40">No reserves</li>
              ) : (
                layout.reserves.map((r) => (
                  <li key={r.steamId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      title="Present in briefing"
                      checked={Boolean(r.present)}
                      disabled={readOnly}
                      onChange={(e) =>
                        applyLayout(
                          setPresent(layout, "reserve", { steamId: r.steamId }, e.target.checked)
                        )
                      }
                      className="h-3.5 w-3.5 accent-emerald-400"
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] text-white">
                      {r.displayName || r.steamId}
                    </span>
                    <FairnessHint steamId={r.steamId} fairnessStats={fairnessStats} />
                    {!readOnly ? (
                      <button
                        type="button"
                        className="text-[0.75rem] text-white/40 hover:text-red-200"
                        onClick={() =>
                          applyLayout(
                            clearSlot(layout, "reserve", { steamId: r.steamId }, assignOpts)
                          )
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

        {/* 2B–4D: tanks + sectors + nodes */}
        {layout ? (
          <div className="lg:col-span-3">
            <LineUpBoard
              layout={layout}
              disabled={readOnly}
              canAddSquad={!readOnly && !cannotAddSquad}
              dropDisabled={poolDragDisabled}
              onDropPlayer={handleDropPlayer}
              onClearSlot={(squadId, slotId) =>
                applyLayout(clearSlot(layout, "slot", { squadId, slotId }, assignOpts))
              }
              onPresentSlot={(squadId, slotId, present) =>
                applyLayout(setPresent(layout, "slot", { squadId, slotId }, present))
              }
              onAddSquad={handleAddSquad}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
