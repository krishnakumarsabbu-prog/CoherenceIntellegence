import { AnimatePresence, motion } from "framer-motion";
import { usePipelineStore } from "../pipelineStore";
import type { ToastKind } from "../types";

export default function ToastStack() {
  const toasts = usePipelineStore((s) => s.toasts);
  const dismiss = usePipelineStore((s) => s.dismissToast);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex items-start gap-2.5 max-w-sm px-3.5 py-2.5 rounded-lg shadow-card-hover border bg-white ${borderFor(t.kind)}`}
          >
            <span className={`mt-0.5 shrink-0 ${textFor(t.kind)}`}>
              {iconFor(t.kind)}
            </span>
            <p className="text-sm text-canvas-700 leading-snug flex-1">
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-canvas-400 hover:text-canvas-600 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function borderFor(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "border-emerald-200";
    case "error":
      return "border-red-200";
    case "warning":
      return "border-amber-200";
    default:
      return "border-canvas-200";
  }
}

function textFor(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "text-emerald-600";
    case "error":
      return "text-red-600";
    case "warning":
      return "text-amber-600";
    default:
      return "text-accent-600";
  }
}

function iconFor(kind: ToastKind) {
  const cls = "w-4 h-4";
  if (kind === "success") {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }
  if (kind === "warning") {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
