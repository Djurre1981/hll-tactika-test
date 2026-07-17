import { useEffect, useState } from "react";
import {
  getTypewriterProgress,
  setTypewriterProgress,
} from "./oneShot.js";

export const WELCOME_INTRO_TEXT =
  "Tactika is a tailored strategy and planning platform for Hell Let Loose. " +
  "The project is developed by The Circle community and kept strictly exclusive to our competitive team. " +
  "If you want to reach out to us or become a member, please join us on discord.";

export const BYE_INTRO_TEXT =
  "Your credentials are non-compliant. But you've seen the room we kept locked from everyone. " +
  "That either makes you an asset or a liability. The choice is binary...";

export function useTypewriter(
  text,
  { speed = 16, startDelay = 400, enabled = true, storageKey } = {},
) {
  const saved = getTypewriterProgress(storageKey);
  const [displayText, setDisplayText] = useState(() =>
    saved.done ? text : text.slice(0, saved.index),
  );
  const [isTyping, setIsTyping] = useState(() => enabled && !saved.done && saved.index > 0);
  const [isDone, setIsDone] = useState(() => Boolean(saved.done));
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!enabled || (!isTyping && !isDone)) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCursorVisible((visible) => !visible);
    }, 425);

    return () => window.clearInterval(timer);
  }, [enabled, isTyping, isDone]);

  useEffect(() => {
    if (!enabled) {
      setDisplayText("");
      setIsTyping(false);
      setIsDone(false);
      return undefined;
    }

    const progress = getTypewriterProgress(storageKey);
    if (progress.done || progress.index >= text.length) {
      setTypewriterProgress(storageKey, text.length, true);
      setDisplayText(text);
      setIsTyping(false);
      setIsDone(true);
      return undefined;
    }

    let index = progress.index;
    let timer = null;
    let startTimer = null;
    let cancelled = false;

    setDisplayText(text.slice(0, index));
    setIsTyping(true);
    setIsDone(false);

    function tick() {
      if (cancelled) return;
      if (index >= text.length) {
        setTypewriterProgress(storageKey, text.length, true);
        setIsTyping(false);
        setIsDone(true);
        return;
      }
      index += 1;
      setTypewriterProgress(storageKey, index, false);
      setDisplayText(text.slice(0, index));
      timer = window.setTimeout(tick, speed);
    }

    // Resume immediately if we already started before a remount / tab switch.
    const delay = index > 0 ? 0 : startDelay;
    startTimer = window.setTimeout(() => {
      if (!cancelled) tick();
    }, delay);

    return () => {
      cancelled = true;
      if (startTimer) window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
      // Keep current index so the next mount continues instead of restarting.
      setTypewriterProgress(storageKey, index, index >= text.length);
    };
  }, [text, speed, startDelay, enabled, storageKey]);

  return { text: displayText, isTyping, isDone, cursorVisible };
}
