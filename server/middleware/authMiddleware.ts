// Backwards-compatibility shim: the canonical implementation now lives in ./auth.
// Existing imports (`from "../middleware/authMiddleware"`) keep working.
export { requireAuth, optionalAuth } from "./auth";
