import { motion } from "framer-motion";

export default function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description?: string;
}) {
  return (
    <div className="grid place-items-center min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="mx-auto mb-6 grid place-items-center w-16 h-16 rounded-xl bg-accent-50 border border-accent-100 text-accent-500">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <span className="badge bg-accent-50 text-accent-700 mb-3">
          {phase}
        </span>
        <h1 className="text-xl font-semibold text-canvas-900 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-canvas-500 mt-2 leading-relaxed">
          {description ??
            "This module is part of the upcoming roadmap and will be built in a later phase of CoherenceIQ."}
        </p>
      </motion.div>
    </div>
  );
}
