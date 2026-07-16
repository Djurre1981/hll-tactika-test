import { useParams } from "react-router-dom";

export function StratEditorPage() {
  const { id } = useParams();
  return (
    <section>
      <h1 className="text-2xl font-semibold">Strat editor</h1>
      <p className="mt-2 text-muted">Phase 1 placeholder — strat id: {id}</p>
    </section>
  );
}
