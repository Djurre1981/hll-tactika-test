import { useAuth } from "../auth/AuthGate.jsx";
import { canEditEvents } from "../calendar/calendar-utils.js";
import { EventPrepChecklist } from "./EventPrepChecklist.jsx";

export function PrepTasksPanel({ eventId, canEdit = false, eventLocked = false, eventType = "scrim" }) {
  const user = useAuth();
  const isEditor = (canEdit || canEditEvents(user?.role)) && !eventLocked;

  return (
    <EventPrepChecklist
      eventId={eventId}
      eventType={eventType}
      canEdit={isEditor}
      eventLocked={eventLocked}
      userSteamId={user?.steamId}
      isEditor={isEditor}
    />
  );
}
