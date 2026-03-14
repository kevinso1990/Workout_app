/** Lightweight singleton toast bus — import `toast` and call toast.success() / toast.error() anywhere. */

export type ToastType = "success" | "error" | "info" | "offline";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (toasts: ToastItem[]) => void;

let _toasts: ToastItem[] = [];
const _listeners = new Set<Listener>();

function _notify() {
  _listeners.forEach(l => l([..._toasts]));
}

export const toast = {
  show(message: string, type: ToastType = "info", durationMs = 3500): string {
    const id = typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`;
    _toasts = [..._toasts, { id, message, type }];
    _notify();
    if (durationMs > 0) setTimeout(() => toast.dismiss(id), durationMs);
    return id;
  },
  success(msg: string) { return toast.show(msg, "success"); },
  error(msg: string) { return toast.show(msg, "error", 5000); },
  info(msg: string) { return toast.show(msg, "info"); },
  offline(msg: string) { return toast.show(msg, "offline", 0); },
  dismiss(id: string) {
    _toasts = _toasts.filter(t => t.id !== id);
    _notify();
  },
  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    listener([..._toasts]);
    return () => _listeners.delete(listener);
  },
};
