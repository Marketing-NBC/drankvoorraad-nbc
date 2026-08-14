import type { CSSProperties } from "react";

export type IconName =
  | "arrow-right" | "arrow-left" | "arrow-up-right" | "chevron-down" | "chevron-right"
  | "search" | "menu" | "x" | "user" | "calendar" | "clock" | "location" | "check"
  | "check-circle" | "sparkle" | "globe" | "phone" | "mail" | "star" | "plus" | "minus" | "building";

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * NBC icon set — Heroicons-flavoured inline SVGs (solid is the default
 * brand style). Render at 16/20/24/32/48/56px. Recolours via currentColor.
 */
export function Icon({ name, size = 20, className = "", style }: IconProps) {
  const paths: Partial<Record<IconName, JSX.Element>> = {
    "arrow-right": <path d="M5 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "arrow-left": <path d="M19 12H5m0 0 5 5m-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "arrow-up-right": <path d="M7 17 17 7m0 0H8m9 0v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "chevron-down": <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "chevron-right": <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "search": <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>,
    "menu": <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></g>,
    "x": <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>,
    "user": <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></g>,
    "calendar": <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></g>,
    "clock": <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></g>,
    "location": <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></g>,
    "check": <path d="M5 12.5 10 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    "check-circle": <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.1 7.3-6 6.2a1 1 0 0 1-1.45 0l-2.8-2.9a1 1 0 0 1 1.45-1.4l2.08 2.16 5.27-5.46a1 1 0 1 1 1.45 1.4Z"/>,
    "sparkle": <path d="M12 2 14 8l6 1-4.5 4 1.5 6-5-3-5 3 1.5-6L4 9l6-1z" fill="currentColor"/>,
    "globe": <g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.6 3 14.4 0 18M12 3c-3 3.6-3 14.4 0 18"/></g>,
    "phone": <path fill="currentColor" d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.3 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A18 18 0 0 1 3 3c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1.1z"/>,
    "mail": <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></g>,
    "star": <path fill="currentColor" d="M12 2 14.6 8.6 22 9.3l-5.6 4.8L18 22l-6-3.6L6 22l1.6-7.9L2 9.3l7.4-.7z"/>,
    "plus": <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>,
    "minus": <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>,
    "building": <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M9 7h2M9 11h2M9 15h2"/><path d="M17 21V9h2a1 1 0 0 1 1 1v11"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}
