import { useCallback, useEffect, useRef } from "react";
import { FRONTIER_WALL_DROP_SEC } from "./timing/frontier-wall.js";
import { formatMatchTime } from "./timing/route-timing.js";
import { cx, glassIconBtn } from "../strats/editor/editorUi.js";

export function MatchTimeline({
  matchTimeSec = 0,
  maxMatchSec = 0,
  playing = false,
  onMatchTimeChange,
  onPlayingChange,
  disabled = false,
}) {
  const rafRef = useRef(null);
  const lastTickRef = useRef(null);
  const matchRef = useRef(matchTimeSec);

  useEffect(() => {
    matchRef.current = matchTimeSec;
  }, [matchTimeSec]);

  const range = Math.max(maxMatchSec, 1);
  const pct = Math.min(100, (matchTimeSec / range) * 100);
  const wallPct = Math.min(100, (FRONTIER_WALL_DROP_SEC / range) * 100);

  const stopPlayback = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  useEffect(() => {
    if (!playing || disabled) {
      stopPlayback();
      return undefined;
    }

    const tick = (now) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const next = matchRef.current + dt;
      if (next >= range) {
        matchRef.current = range;
        onMatchTimeChange?.(range);
        stopPlayback();
      } else {
        matchRef.current = next;
        onMatchTimeChange?.(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
  }, [playing, disabled, range, onMatchTimeChange, stopPlayback]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space" || disabled) return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      if (playing) stopPlayback();
      else onPlayingChange?.(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, disabled, onPlayingChange, stopPlayback]);

  if (disabled || maxMatchSec <= 0) return null;

  return (
    <div
      className="pointer-events-auto flex min-w-[min(42rem,calc(100vw-24rem))] flex-col gap-1.5 rounded-[1rem] border border-white/12 bg-black/55 px-4 py-3 backdrop-blur-md"
      role="group"
      aria-label="Match timeline"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.68rem] font-light uppercase tracking-[0.08em] text-white/45">
          Match timeline
        </span>
        <span className="font-mono text-[0.82rem] tabular-nums text-white/90">
          {formatMatchTime(matchTimeSec)}
          <span className="text-white/35"> / {formatMatchTime(range)}</span>
        </span>
      </div>

      <div className="relative flex items-center gap-2">
        <button
          type="button"
          className={cx(glassIconBtn, "h-8 w-8 shrink-0 text-[0.75rem]")}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => (playing ? stopPlayback() : onPlayingChange?.(true))}
        >
          <i className={`fa-solid ${playing ? "fa-pause" : "fa-play"}`} aria-hidden="true" />
        </button>

        <div className="relative min-w-0 flex-1">
          {wallPct > 0 && wallPct < 100 && (
            <div
              className="pointer-events-none absolute top-1/2 z-[1] h-3 w-px -translate-y-1/2 bg-amber-400/70"
              style={{ left: `${wallPct}%` }}
              title="Wall drops at 2:00"
              aria-hidden="true"
            />
          )}
          <input
            type="range"
            min={0}
            max={range}
            step={0.05}
            value={matchTimeSec}
            onChange={(e) => {
              stopPlayback();
              onMatchTimeChange?.(Number(e.target.value));
            }}
            className="relative z-[2] h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-400"
            aria-valuetext={formatMatchTime(matchTimeSec)}
          />
        </div>

        <button
          type="button"
          className={cx(glassIconBtn, "h-8 w-8 shrink-0 text-[0.72rem]")}
          title="Reset to match start"
          aria-label="Reset timeline"
          onClick={() => {
            stopPlayback();
            onMatchTimeChange?.(0);
          }}
        >
          <i className="fa-solid fa-backward-step" aria-hidden="true" />
        </button>
      </div>

      <p className="m-0 text-[0.62rem] text-white/35">
        Space to play/pause · amber tick = wall drop at 2:00
      </p>
    </div>
  );
}
