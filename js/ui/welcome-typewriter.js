const INTRO_TEXT =
  "Tactika is a tailored strategy and planning platform for Hell Let Loose. " +
  "The project is developed by The Circle community and kept strictly exclusive to our competitive team. " +
  "If you want to reach out to us or become a member, please join us on discord.";

export function initWelcomeTypewriter(el, { speed = 16, startDelay = 400 } = {}) {
  if (!el) return { destroy() {} };

  const fullText = el.dataset.typewriterText || INTRO_TEXT;
  let index = 0;
  let timer = null;
  let startTimer = null;
  let destroyed = false;

  el.textContent = "";
  el.classList.add("is-typing");

  function tick() {
    if (destroyed || index >= fullText.length) {
      el.classList.remove("is-typing");
      el.classList.add("is-done");
      timer = null;
      return;
    }
    el.textContent += fullText[index];
    index += 1;
    timer = window.setTimeout(tick, speed);
  }

  startTimer = window.setTimeout(() => {
    startTimer = null;
    tick();
  }, startDelay);

  return {
    destroy() {
      destroyed = true;
      if (startTimer) window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
      el.classList.remove("is-typing", "is-done");
    },
  };
}
