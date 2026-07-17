import { useParams } from "react-router-dom";
import { WhiteboardEditor } from "./WhiteboardEditor.jsx";

export function MicroPrepPage() {
  const { id } = useParams();
  return <WhiteboardEditor boardId={id} backTo="/home" />;
}
