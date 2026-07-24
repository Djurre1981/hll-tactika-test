import { roleLabel, listInfantrySquadOptions } from "./lineup-utils.js";

function PresenceCheck({ checked, disabled, onChange }) {
  return (
    <input
      type="checkbox"
      title="Present in briefing"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
      className="h-3.5 w-3.5 accent-emerald-400"
    />
  );
}

function PlayerChip({ name, onClear, disabled }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncated rounded bg-black/25 px-1.5 py-0.5 text-[0.78rem] text-white">
      <span className="truncate">{name || "—"}</span>
      {!disabled && onClear ? (
          <button
          type="button"
          className="shrink-0 text-white/45 hover:text-red-200"
          onClick={(e) => {
            e.stopPropagation();
            onClear?.();
          }}
          aria-label="Clear"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function SlotRow({
  label,
  playerName,
  present,
  selected,
  disabled,
  onSelect,
  onClear,
  onPresent,
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
        selected
          ? "border-accent/50 bg-accent/10"
          : "border-white/10 bg-black/20"
      } ${!disabled ? "cursor-pointer hover:border-white/25" : ""}`}
      onClick={() => {
        if (!disabled) onSelect?.();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect?.();
        }
      }}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
    >
      <PresenceCheck
        checked={present}
        disabled={disabled || !playerName}
        onChange={onPresent}
      />
      <span className="w-16 shrink-0 text-[0.65rem] uppercase tracking-wide text-white/45">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        {playerName ? (
          <PlayerChip
            name={playerName}
            disabled={disabled}
            onClear={(e) => {
              e?.stopPropagation?.();
              onClear?.();
            }}
          />
        ) : (
          <span className="text-[0.78rem] text-white/35">Empty — select player, then tap</span>
        )}
      </div>
    </div>
  );
}

function SectorCard({ sector, disabled, selectedTarget, onSelectSlot, onClearSlot, onPresent }) {
  return (
    <section
      className="rounded-2xl border border-white/10 p-3"
      style={{
        background: `linear-gradient(160deg, ${sector.colorHex}33, rgba(0,0,0,0.35))`,
        boxShadow: `inset 3px 0 0 ${sector.colorHex}`,
      }}
    >
      <h3 className="m-0 mb-2 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white">
        {sector.label}
      </h3>
      <div className="flex flex-col gap-3">
        {(sector.squads || []).map((sq) => (
          <div key={sq.id}>
            <p className="m-0 mb-1 text-[0.68rem] text-white/55">
              {sq.label}{" "}
              <span className="text-white/30">({sq.type})</span>
            </p>
            <div className="flex flex-col gap-1">
              {(sq.slots || []).map((slot) => {
                const targetKey = `slot:${sq.id}:${slot.id}`;
                return (
                  <SlotRow
                    key={slot.id}
                    label={roleLabel(slot.role)}
                    playerName={slot.displayName || (slot.steamId ? slot.steamId : "")}
                    present={slot.present}
                    selected={selectedTarget === targetKey}
                    disabled={disabled}
                    onSelect={() => onSelectSlot?.(sq.id, slot.id)}
                    onClear={() => onClearSlot?.(sq.id, slot.id)}
                    onPresent={(v) => onPresent?.(sq.id, slot.id, v)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LineUpBoard({
  layout,
  disabled,
  selectedPlayer,
  selectedTarget,
  onSelectTarget,
  onAssignSelected,
  onClearSpecial,
  onClearSlot,
  onClearReserve,
  onPresentSpecial,
  onPresentSlot,
  onPresentReserve,
  onSelectReserveTarget,
  onNodeAssign,
  onNodesSlChange,
  infantryPlayers,
}) {
  const squadOptions = listInfantrySquadOptions(layout);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <h3 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
          Command
        </h3>
        <div className="grid gap-1 sm:grid-cols-3">
          {(layout.specials || []).map((sp) => {
            const targetKey = `special:${sp.id}`;
            return (
              <SlotRow
                key={sp.id}
                label={roleLabel(sp.role)}
                playerName={sp.displayName || (sp.steamId ? sp.steamId : "")}
                present={sp.present}
                selected={selectedTarget === targetKey}
                disabled={disabled}
                onSelect={() => {
                  onSelectTarget?.(targetKey);
                  if (selectedPlayer) onAssignSelected?.(targetKey);
                }}
                onClear={() => onClearSpecial?.(sp.id)}
                onPresent={(v) => onPresentSpecial?.(sp.id, v)}
              />
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {(layout.sectors || []).map((sector) => (
          <SectorCard
            key={sector.id}
            sector={sector}
            disabled={disabled}
            selectedTarget={selectedTarget}
            onSelectSlot={(squadId, slotId) => {
              const key = `slot:${squadId}:${slotId}`;
              onSelectTarget?.(key);
              if (selectedPlayer) onAssignSelected?.(key);
            }}
            onClearSlot={onClearSlot}
            onPresent={onPresentSlot}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <h3 className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
          Reserves
        </h3>
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || !selectedPlayer}
            onClick={() => onAssignSelected?.("reserve")}
            className="rounded-full border border-white/15 px-3 py-1 text-[0.75rem] text-white/80 disabled:opacity-40"
          >
            Add selected to reserves
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectReserveTarget?.()}
            className={`rounded-full border px-3 py-1 text-[0.75rem] ${
              selectedTarget === "reserve"
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-white/15 text-white/70"
            }`}
          >
            Target: reserves
          </button>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {(layout.reserves || []).length === 0 ? (
            <li className="text-[0.8rem] text-white/40">No reserves</li>
          ) : (
            (layout.reserves || []).map((r) => (
              <li key={r.steamId} className="flex items-center gap-2">
                <PresenceCheck
                  checked={r.present}
                  disabled={disabled}
                  onChange={(v) => onPresentReserve?.(r.steamId, v)}
                />
                <span className="text-[0.85rem] text-white">
                  {r.displayName || r.steamId}
                </span>
                {!disabled ? (
                  <button
                    type="button"
                    className="text-[0.75rem] text-white/40 hover:text-red-200"
                    onClick={() => onClearReserve?.(r.steamId)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-3">
        <h3 className="m-0 mb-1 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
          Nodes (task overlay — does not add roster slots)
        </h3>
        <p className="m-0 mb-3 text-[0.75rem] text-white/40">
          Assignees must already be on an infantry squad. Pick SL for nodes per HQ.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {["north", "middle", "south"].map((key) => {
            const block = layout.nodes?.[key];
            if (!block) return null;
            return (
              <div key={key} className="rounded-xl border border-white/10 p-2.5">
                <p className="m-0 mb-2 text-[0.78rem] font-medium capitalize text-white">
                  Nodes {key}
                </p>
                <label className="mb-2 block text-[0.7rem] text-white/45">
                  SL for nodes
                  <select
                    className="glass-input mt-1 w-full text-[0.8rem]"
                    disabled={disabled}
                    value={block.slSquadId || ""}
                    onChange={(e) => onNodesSlChange?.(key, e.target.value || null)}
                  >
                    <option value="">—</option>
                    {squadOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1">
                  {(block.slots || []).map((ns) => (
                    <button
                      key={ns.id}
                      type="button"
                      disabled={disabled || !selectedPlayer}
                      onClick={() => onNodeAssign?.(key, ns.id)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-left text-[0.78rem] text-white/85 disabled:opacity-50"
                    >
                      <span className="text-white/45">{roleLabel(ns.role)}</span>
                      <span className="truncate">
                        {ns.displayName || ns.steamId || "Tap to assign"}
                      </span>
                    </button>
                  ))}
                </div>
                {!infantryPlayers?.length ? (
                  <p className="m-0 mt-2 text-[0.7rem] text-amber-200/70">
                    Assign infantry first
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
