/** Legacy SPA entry — MPA pages load js/entries/* instead. */
import { go, ROUTES } from "./ui/router.js";

go(ROUTES.HOME, { replace: true });
