import { useParams } from "react-router-dom";
import { StratEditor } from "./StratEditor.jsx";

export function StratEditorPage() {
  const { id } = useParams();
  return <StratEditor stratId={id} />;
}
