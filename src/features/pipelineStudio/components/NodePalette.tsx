import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  DETECTION_SUBTYPE_LABELS,
  NODE_CATALOG,
} from "../catalog";
import type { NodeCategory, PaletteNodeDef } from "../types";

interface PaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  onDragStart: (defType: string) => void;
}

export default function NodePalette({
  collapsed,
  onToggle,
  onDragStart,
}: PaletteProps) {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    input: true,
    preprocessing: true,
    feature: true,
    detection: true,
    output: true,
  });

  const toggleCat = (id: string) =>
    setOpenCats((s) => ({ ...s, [id]: !s[id] }));

  return (
    <motion.aside
      animate={{ width: collapsed ? 0 : 264 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="shrink-0 h-full bg-white border-r border-canvas-200 overflow-hidden flex flex-col"
    >
      <div className="w-[264px] h-full flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-canvas-100 shrink-0">
          <span className="text-sm font-semibold text-canvas-800">
            Node Palette
          </span>
          <button
            onClick={onToggle}
            className="btn-ghost !p-1.5"
            title="Collapse palette"
            aria-label="Collapse palette"
          >
            <ChevronIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {CATEGORY_ORDER.map((catId) => {
            const meta = CATEGORY_META[catId];
            const items = NODE_CATALOG.filter((n) => n.category === catId);
            const open = openCats[catId];
            return (
              <div key={catId} className="mb-1">
                <button
                  onClick={() => toggleCat(catId)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-canvas-50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <span className="text-xs font-semibold text-canvas-700 flex-1 text-left uppercase tracking-wide">
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-canvas-400">
                    {items.length}
                  </span>
                  <ChevronIcon
                    className={`w-3.5 h-3.5 text-canvas-400 transition-transform ${
                      open ? "rotate-90" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      {catId === "detection" ? (
                        <DetectionGroups
                          items={items}
                          onDragStart={onDragStart}
                        />
                      ) : (
                        <div className="pt-1 pb-1.5 space-y-1">
                          {items.map((def) => (
                            <PaletteItem
                              key={def.type}
                              def={def}
                              onDragStart={onDragStart}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.aside>
  );
}

function DetectionGroups({
  items,
  onDragStart,
}: {
  items: PaletteNodeDef[];
  onDragStart: (defType: string) => void;
}) {
  const groups: Array<{ key: string; label: string; items: PaletteNodeDef[] }> =
    ["clustering", "anomaly", "classification"].map((key) => ({
      key,
      label: DETECTION_SUBTYPE_LABELS[key],
      items: items.filter((n) => n.detectionSubType === key),
    }));

  return (
    <div className="pt-1 pb-1.5">
      {groups.map((g) => (
        <div key={g.key} className="mb-1.5">
          <p className="px-2.5 py-1 text-[10px] font-medium text-canvas-400 uppercase tracking-wide">
            {g.label}
          </p>
          <div className="space-y-1">
            {g.items.map((def) => (
              <PaletteItem
                key={def.type}
                def={def}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaletteItem({
  def,
  onDragStart,
}: {
  def: PaletteNodeDef;
  onDragStart: (defType: string) => void;
}) {
  const meta = CATEGORY_META[def.category];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-pipeline-node", def.type);
        onDragStart(def.type);
      }}
      className="group flex items-start gap-2.5 px-2.5 py-2 rounded-md border border-transparent hover:border-canvas-200 hover:bg-canvas-50 cursor-grab active:cursor-grabbing transition-colors"
      title={def.hint}
    >
      <span
        className="mt-0.5 w-1 h-8 rounded-full shrink-0"
        style={{ backgroundColor: meta.accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-canvas-800 leading-tight truncate">
          {def.label}
        </p>
        {def.hint && (
          <p className="text-[11px] text-canvas-400 mt-0.5 truncate">
            {def.hint}
          </p>
        )}
      </div>
      <DragDotsIcon className="w-3.5 h-3.5 text-canvas-300 group-hover:text-canvas-400 mt-1 shrink-0" />
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function DragDotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export type { NodeCategory };
