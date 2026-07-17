import { Button } from "../../shared/Button.jsx";
import { Modal } from "../../shared/Modal.jsx";

const DEFAULT_TITLE = "CIRCLE COMP LOGIN";
const DEFAULT_MESSAGE =
  "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.";

export function AuthDialog({ open, onClose, title = DEFAULT_TITLE, message = DEFAULT_MESSAGE, showLogin = true }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-6 text-muted">{message}</p>
      {showLogin ? (
        <Button className="mt-4 w-full" onClick={() => window.location.assign("/api/auth/steam")}>
          Sign in with Steam
        </Button>
      ) : null}
    </Modal>
  );
}
