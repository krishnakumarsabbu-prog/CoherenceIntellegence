import type { ComponentType } from "react";

export interface NavItem {
  label: string;
  to: string;
  icon: (props: { className?: string }) => JSX.Element;
  phase?: string;
}

// Lightweight inline SVG icons (avoid extra icon dependency for Phase 1)
function svg(path: string, viewBox = "0 0 24 24") {
  return function Icon({ className }: { className?: string }) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: path }}
      />
    );
  } as (props: { className?: string }) => JSX.Element;
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: svg(
      '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'
    ),
  },
  {
    label: "Pipeline Studio",
    to: "/pipeline-studio",
    icon: svg(
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.5L11 16M16 7.5L13 16M8 6h8"/>'
    ),
    phase: "Phase 2",
  },
  {
    label: "Algorithm Library",
    to: "/algorithm-library",
    icon: svg(
      '<path d="M4 4v16M4 4h16M4 12h12"/><circle cx="18" cy="6" r="1.5"/><circle cx="18" cy="18" r="1.5"/>'
    ),
    phase: "Phase 3",
  },
  {
    label: "Execution Console",
    to: "/execution-console",
    icon: svg(
      '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l3 3-3 3M13 15h3"/>'
    ),
    phase: "Phase 4",
  },
  {
    label: "Pipeline Comparison",
    to: "/pipeline-comparison",
    icon: svg(
      '<path d="M7 3v18M17 3v18"/><rect x="4" y="8" width="6" height="8" rx="1"/><rect x="14" y="5" width="6" height="11" rx="1"/>'
    ),
    phase: "Phase 5",
  },
  {
    label: "Reports",
    to: "/reports",
    icon: svg(
      '<path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'
    ),
    phase: "Phase 5",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
    ),
  },
];

export type NavIconType = ComponentType<{ className?: string }>;
