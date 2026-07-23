import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useHelpWiki } from "./HelpWikiContext.jsx";
import { getWikiPage, wikiNav, wikiPages } from "./wikiCatalog.js";
import { renderWikiMarkdown } from "./renderWikiMarkdown.js";

function pageTitle(id) {
  return String(id || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HelpWikiOverlay() {
  const { open, pageId, setPageId, closeWiki } = useHelpWiki();
  const articleRef = useRef(null);
  const navRef = useRef(null);

  const page = useMemo(() => getWikiPage(pageId) || getWikiPage("Home"), [pageId]);
  const html = useMemo(
    () => renderWikiMarkdown(page?.markdown || "_Page not found._"),
    [page]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeWiki();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeWiki]);

  useEffect(() => {
    if (!open || !articleRef.current) return;
    articleRef.current.scrollTop = 0;
  }, [open, pageId]);

  useEffect(() => {
    if (!open || !navRef.current) return;
    const active = navRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [open, pageId]);

  if (!open || typeof document === "undefined") return null;

  const onArticleClick = (e) => {
    const a = e.target.closest("a[data-wiki-page]");
    if (!a) return;
    e.preventDefault();
    const id = a.getAttribute("data-wiki-page");
    if (id && (wikiPages[id] || getWikiPage(id))) setPageId(id);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeWiki();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tactika help manual"
        className="glass-panel relative flex h-full w-full max-w-6xl flex-col overflow-hidden sm:h-[min(90vh,920px)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="m-0 text-[0.65rem] font-light uppercase tracking-[0.16em] text-white/45">
              Manual
            </p>
            <h2 className="m-0 truncate text-lg font-semibold tracking-tight text-white/95">
              {pageTitle(page?.id || "Help")}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={closeWiki}
              className="rounded-full border border-white/12 px-3 py-1.5 text-[0.72rem] font-light uppercase tracking-[0.08em] text-white/80 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close help"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            ref={navRef}
            className="glass-scroll flex max-h-[38%] shrink-0 flex-row gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 md:max-h-none md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-4 lg:w-64"
            aria-label="Manual sections"
          >
            {wikiNav.map((section) => (
              <div key={section.title} className="flex shrink-0 flex-row gap-1 md:mb-4 md:flex-col md:gap-0.5">
                <p className="hidden px-2 pb-1 text-[0.62rem] font-light uppercase tracking-[0.14em] text-white/40 md:block">
                  {section.title}
                </p>
                {section.pages.map((p) => {
                  const active = (page?.id || pageId) === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-active={active ? "true" : "false"}
                      onClick={() => setPageId(p.id)}
                      className={`whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-left text-[0.78rem] font-light tracking-[0.02em] transition md:w-full ${
                        active
                          ? "bg-white/12 text-white"
                          : "text-white/65 hover:bg-white/[0.06] hover:text-white/90"
                      }`}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <article
            ref={articleRef}
            className="wiki-prose glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
            onClick={onArticleClick}
            // Trusted content: authored markdown from docs/wiki only.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
