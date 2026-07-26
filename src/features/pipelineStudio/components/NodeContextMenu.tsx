import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePipelineStore } from "../pipelineStore";

export interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

interface Props {
  menu: ContextMenuState | null;
  onClose: () => void;
}

export default function NodeContextMenu({ menu, onClose }: Props) {
  const renameNode = usePipelineStore((s) => s.renameNode);
  const duplicateNode = usePipelineStore((s) => s.duplicateNode);
  const deleteNode = usePipelineStore((s) => s.deleteNode);
  const selectNode = usePipelineStore((s) => s.selectNode);

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (!menu) setRenaming(false);
  }, [menu]);

  if (!menu) return null;

  const commitRename = () => {
    if (draft.trim()) renameNode(menu.nodeId, draft);
    setRenaming(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        className="fixed z-50 w-44 glass-card shadow-card-hover overflow-hidden py-1"
        style={{ left: menu.x, top: menu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {renaming ? (
          <div className="px-2 py-1.5">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  onClose();
                }
              }}
              className="input text-xs py-1"
              placeholder="New name"
            />
          </div>
        ) : (
          <>
            <MenuItem
              icon={<DuplicateIcon className="w-3.5 h-3.5" />}
              label="Duplicate"
              onClick={() => {
                selectNode(menu.nodeId);
                duplicateNode(menu.nodeId);
                onClose();
              }}
            />
            <MenuItem
              icon={<EditIcon className="w-3.5 h-3.5" />}
              label="Rename"
              onClick={() => {
                selectNode(menu.nodeId);
                setDraft("");
                setRenaming(true);
              }}
            />
            <div className="my-1 h-px bg-canvas-100" />
            <MenuItem
              icon={<TrashIcon className="w-3.5 h-3.5" />}
              label="Delete"
              danger
              onClick={() => {
                deleteNode(menu.nodeId);
                onClose();
              }}
            />
          </>
        )}
      </motion.div>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-canvas-700 hover:bg-canvas-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V4a1 1 0 011-1h11" />
    </svg>
  );
}
function EditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </svg>
  );
}
