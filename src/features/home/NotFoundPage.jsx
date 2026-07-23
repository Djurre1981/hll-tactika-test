import { Link } from "react-router-dom";

/** Hub-styled catch-all for unknown routes. */
export function NotFoundPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-start justify-center gap-4">
      <p className="m-0 text-[0.72rem] font-normal uppercase tracking-[0.16em] text-white/45">
        404
      </p>
      <h1 className="m-0 text-[clamp(1.55rem,2.2vw,2rem)] font-medium tracking-wide text-white">
        Page not found
      </h1>
      <p className="m-0 max-w-md text-[0.9rem] font-light leading-snug text-white/50">
        That route does not exist in Tactika. Head back to the hub or open Calendar, Strats, or
        Management from the nav.
      </p>
      <Link
        to="/home"
        className="mt-2 inline-flex rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-[0.82rem] text-white no-underline transition hover:border-white/25 hover:bg-white/[0.12]"
      >
        Back to dashboard
      </Link>
    </section>
  );
}
