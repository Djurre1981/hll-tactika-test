import {
  PLAYER_DRAG_MIME,
  roleIcon,
  roleLabel,
} from "./lineup-utils.js";

function PresenceCheck({ checked, disabled, onChange }) {
  return (
    <input
      type="checkbox"
      title="Present in briefing"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
      className="h-3.5 w-3.5 accent-emerald-400"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function RoleBadge({ role }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black/35 text-[0.65rem] text-white/80"
      title={roleLabel(role)}
    >
      <i className={`fa-solid ${roleIcon(role)}`} aria-hidden="true" />
    </span>
  );
}

function PlayerChip({ name, role, onClear, disabled }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncated rounded bg-black/25 px-1.5 py-0.5 text-[0.78rem] text-white">
      {role ? <RoleBadge role={role} /> : null}
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

function DropSlot({
  label,
  role,
  playerName,
  present,
  disabled,
  dropDisabled,
  dropKey,
  onDropPlayer,
  onClear,
  onPresent,
}) {
  const noDrop = disabled || dropDisabled;

  function handleDragOver(e) {
    if (noDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e) {
    if (noDrop) return;
    e.preventDefault();
    const raw =
      e.dataTransfer.getData(PLAYER_DRAG_MIME) ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const player = JSON.parse(raw);
      if (player?.steamId) onDropPlayer?.(dropKey, player);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-dashed px-2 py-1.5 transition ${
        disabled
          ? "border-white/10 bg-black/20"
          : dropDisabled
            ? "border-white/10 bg-black/20 opacity-60"
            : "border-white/15 bg-black/20 hover:border-accent/40 hover:bg-accent/5"
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <PresenceCheck
        checked={present}
        disabled={disabled || !playerName}
        onChange={onPresent}
      />
      <RoleBadge role={role} />
      <span className="w-14 shrink-0 text-[0.62rem] uppercase tracking-wide text-white/45">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        {playerName ? (
          <PlayerChip name={playerName} onClear={onClear} disabled={disabled} />
        ) : (
          <span className="text-[0.75rem] text-white/35">Drop player</span>
        )}
      </div>
    </div>
  );
}

function SectorCard({
  sector,
  disabled,
  canAddSquad,
  dropDisabled,
  onDropPlayer,
  onClearSlot,
  onPresent,
  onAddSquad,
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 p-3"
      style={{
        background: `linear-gradient(160deg, ${sector.colorHex}33, rgba(0,0,0,0.35))`,
        boxShadow: `inset 3px 0 0 ${sector.colorHex}`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white">
          {sector.label}
        </h3>
        {!disabled && canAddSquad ? (
          <button
            type="button"
            title="Add squad"
            aria-label={`Add squad to ${sector.label}`}
            onClick={() => onAddSquad?.(sector.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-white/70 hover:border-white/30 hover:text-white"
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {(sector.squads || []).map((sq) => (
          <div key={sq.id}>
            <p className="m-0 mb-1 text-[0.68rem] text-white/55">
              {sq.label}{" "}
              <span className="text-white/30">({sq.type})</span>
            </p>
            <div className="flex flex-col gap-1">
              {(sq.slots || []).map((slot) => (
                <DropSlot
                  key={slot.id}
                  label={roleLabel(slot.role)}
                  role={slot.role}
                  playerName={slot.displayName || (slot.steamId ? slot.steamId : "")}
                  present={slot.present}
                  disabled={disabled}
                  dropDisabled={dropDisabled && !slot.steamId}
                  dropKey={`slot:${sq.id}:${slot.id}`}
                  onDropPlayer={onDropPlayer}
                  onClear={() => onClearSlot?.(sq.id, slot.id)}
                  onPresent={(v) => onPresent?.(sq.id, slot.id, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecialCard({
  title,
  colorHex,
  special,
  disabled,
  dropDisabled,
  onDropPlayer,
  onClear,
  onPresent,
}) {
  if (!special) return null;
  return (
    <section
      className="rounded-2xl border border-white/10 p-3"
      style={{
        background: `linear-gradient(160deg, ${colorHex}33, rgba(0,0,0,0.35))`,
        boxShadow: `inset 3px 0 0 ${colorHex}`,
      }}
    >
      <h3 className="m-0 mb-2 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white">
        {title}
      </h3>
      <DropSlot
        label={roleLabel(special.role)}
        role={special.role}
        playerName={special.displayName || (special.steamId ? special.steamId : "")}
        present={special.present}
        disabled={disabled}
        dropDisabled={dropDisabled && !special.steamId}
        dropKey={`special:${special.id}`}
        onDropPlayer={onDropPlayer}
        onClear={() => onClear?.(special.id)}
        onPresent={(v) => onPresent?.(special.id, v)}
      />
    </section>
  );
}

export { SpecialCard };

function sectorById(sectors, id) {
  return (sectors || []).find((s) => s.id === id) || null;
}

/** One window per squad (used for tanks row so each tank is its own card). */
function SquadWindow({
  sector,
  squad,
  showAdd,
  disabled,
  dropDisabled,
  onDropPlayer,
  onClearSlot,
  onPresent,
  onAddSquad,
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 p-3"
      style={{
        background: `linear-gradient(160deg, ${sector.colorHex}33, rgba(0,0,0,0.35))`,
        boxShadow: `inset 3px 0 0 ${sector.colorHex}`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white">
          {sector.label}
        </h3>
        {!disabled && showAdd ? (
          <button
            type="button"
            title="Add squad"
            aria-label={`Add squad to ${sector.label}`}
            onClick={() => onAddSquad?.(sector.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-white/70 hover:border-white/30 hover:text-white"
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="m-0 mb-1 text-[0.68rem] text-white/55">
        {squad.label}{" "}
        <span className="text-white/30">({squad.type})</span>
      </p>
      <div className="flex flex-col gap-1">
        {(squad.slots || []).map((slot) => (
          <DropSlot
            key={slot.id}
            label={roleLabel(slot.role)}
            role={slot.role}
            playerName={slot.displayName || (slot.steamId ? slot.steamId : "")}
            present={slot.present}
            disabled={disabled}
            dropDisabled={dropDisabled && !slot.steamId}
            dropKey={`slot:${squad.id}:${slot.id}`}
            onDropPlayer={onDropPlayer}
            onClear={() => onClearSlot?.(squad.id, slot.id)}
            onPresent={(v) => onPresent?.(squad.id, slot.id, v)}
          />
        ))}
      </div>
    </section>
  );
}

function TankPlaceholder({ sector, canAdd, disabled, onAddSquad }) {
  return (
    <section
      className="rounded-2xl border border-dashed border-white/15 p-3"
      style={{
        background: `linear-gradient(160deg, ${sector.colorHex}22, rgba(0,0,0,0.25))`,
        boxShadow: `inset 3px 0 0 ${sector.colorHex}`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.78rem] font-medium uppercase tracking-[0.14em] text-white/70">
          {sector.label}
        </h3>
        {!disabled && canAdd ? (
          <button
            type="button"
            title="Add tank squad"
            onClick={() => onAddSquad?.(sector.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/25 text-white/70 hover:border-white/30 hover:text-white"
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="m-0 text-[0.8rem] text-white/35">Empty tank slot</p>
    </section>
  );
}

function renderSectorRow(ids, props) {
  const cards = ids
    .map((id) => {
      const sector = sectorById(props.layout.sectors, id);
      if (!sector) return null;
      return (
        <SectorCard
          key={sector.id}
          sector={sector}
          disabled={props.disabled}
          canAddSquad={props.canAddSquad}
          dropDisabled={props.dropDisabled}
          onDropPlayer={props.onDropPlayer}
          onClearSlot={props.onClearSlot}
          onPresent={props.onPresentSlot}
          onAddSquad={props.onAddSquad}
        />
      );
    })
    .filter(Boolean);
  if (!cards.length) return null;
  return <div className="grid gap-3 grid-cols-1 md:grid-cols-3">{cards}</div>;
}

/** Always 3 tank windows (2B / 2C / 2D). */
function renderTankSquadRow(props) {
  const tanks = sectorById(props.layout.sectors, "tanks");
  if (!tanks) return null;
  const squads = tanks.squads || [];
  const cells = [];
  for (let i = 0; i < 3; i += 1) {
    const sq = squads[i];
    if (sq) {
      cells.push(
        <SquadWindow
          key={sq.id}
          sector={tanks}
          squad={sq}
          showAdd={props.canAddSquad && i === squads.length - 1 && squads.length < 3}
          disabled={props.disabled}
          dropDisabled={props.dropDisabled}
          onDropPlayer={props.onDropPlayer}
          onClearSlot={props.onClearSlot}
          onPresent={props.onPresentSlot}
          onAddSquad={props.onAddSquad}
        />
      );
    } else {
      cells.push(
        <TankPlaceholder
          key={`tank-placeholder-${i}`}
          sector={tanks}
          canAdd={props.canAddSquad}
          disabled={props.disabled}
          onAddSquad={props.onAddSquad}
        />
      );
    }
  }
  return <div className="grid gap-3 grid-cols-1 md:grid-cols-3">{cells}</div>;
}

export function LineUpBoard({
  layout,
  disabled,
  canAddSquad = true,
  dropDisabled = false,
  onDropPlayer,
  onClearSlot,
  onPresentSlot,
  onAddSquad,
}) {
  if (!layout) return null;

  const rowProps = {
    layout,
    disabled,
    canAddSquad,
    dropDisabled,
    onDropPlayer,
    onClearSlot,
    onPresentSlot,
    onAddSquad,
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 2B–2D: Tanks */}
      {renderTankSquadRow(rowProps)}

      {/* 3B–3D: North/West · Meat Grind · South/East */}
      {renderSectorRow(["north", "meat", "south"], rowProps)}

      {/* 4B–4D: Defence · Flex · Recon */}
      {renderSectorRow(["defence", "flex", "recon"], rowProps)}

      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-3">
        <h3 className="m-0 mb-1 text-[0.72rem] uppercase tracking-[0.14em] text-white/45">
          Nodes (task overlay)
        </h3>
        <p className="m-0 mb-3 text-[0.75rem] text-white/40">
          Support / Engineer on infantry auto-fill here. SL for nodes follows each assignee’s squad SL.
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
                <div className="flex flex-col gap-1.5">
                  {(block.slots || []).map((ns) => (
                    <div
                      key={ns.id}
                      className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[0.75rem]"
                    >
                      <div className="flex items-center gap-2 text-white/85">
                        <RoleBadge role={ns.role} />
                        <span className="text-white/45">{roleLabel(ns.role)}</span>
                        <span className="truncate">
                          {ns.displayName || ns.steamId || "—"}
                        </span>
                      </div>
                      <p className="m-0 mt-1 text-[0.68rem] text-white/40">
                        SL for nodes:{" "}
                        <span className="text-white/70">
                          {ns.slDisplayName || ns.slSteamId || "—"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}


