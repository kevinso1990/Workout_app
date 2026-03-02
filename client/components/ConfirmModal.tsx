import React from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6" onClick={onCancel}>
      <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {message ? <p className="text-sm text-[var(--color-text-muted)] mb-6">{message}</p> : null}
        <div className="flex gap-3">
          {cancelLabel ? <button onClick={onCancel} className="btn-ghost flex-1">{cancelLabel}</button> : null}
          <button
            onClick={onConfirm}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-95 min-h-12 px-6 ${destructive ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand text-white hover:bg-brand-dark"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
