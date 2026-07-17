import { useEffect, useState } from "react";

const completedTypewriters = new Set();

function isTypewriterDone(storageKey) {
  if (!storageKey) return false;
  if (completedTypewriters.has(storageKey)) return true;
  try {
    return sessionStorage.getItem(storageKey) === "done";
  } catch {
    return false;
  }
}

function markTypewriterDone(storageKey) {
  if (!storageKey) return;
  completedTypewriters.add(storageKey);
  try {
    sessionStorage.setItem(storageKey, "done");
  } catch {
    // ignore quota / private mode
  }
}

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
  const alreadyDone = enabled && isTypewriterDone(storageKey);
  const [displayText, setDisplayText] = useState(alreadyDone ? text : "");
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(alreadyDone);
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

    if (isTypewriterDone(storageKey)) {
      setDisplayText(text);
      setIsTyping(false);
      setIsDone(true);
      return undefined;
    }

    let index = 0;
    let timer = null;
    let startTimer = null;
    let cancelled = false;

    setDisplayText("");
    setIsTyping(true);
    setIsDone(false);

    function tick() {
      if (cancelled) return;
      if (index >= text.length) {
        setIsTyping(false);
        setIsDone(true);
        markTypewriterDone(storageKey);
        return;
      }
      setDisplayText(text.slice(0, index + 1));
      index += 1;
      timer = window.setTimeout(tick, speed);
    }

    startTimer = window.setTimeout(() => {
      if (!cancelled) tick();
    }, startDelay);

    return () => {
      cancelled = true;
      if (startTimer) window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
    };
  }, [text, speed, startDelay, enabled, storageKey]);

  return { text: displayText, isTyping, isDone, cursorVisible };
}
