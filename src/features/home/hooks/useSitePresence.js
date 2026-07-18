import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { PRESENCE_ROOM_ID } from "../../lib/collab/provider.js";
import { useYjsRoom } from "../../lib/collab/useYjsRoom.js";

/**
 * Site-wide presence for hub/dashboard (awareness only, no Y.Doc persist).
 */
export function useSitePresence({ enabled = true } = {}) {
  const user = useAuth();
  const location = useLocation();

  return useYjsRoom({
    roomId: PRESENCE_ROOM_ID,
    enabled: enabled && Boolean(user?.steamId),
    user,
    awarenessState: {
      path: location.pathname,
      context: "hub",
    },
  });
}
