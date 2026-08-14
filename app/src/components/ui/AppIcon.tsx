import type { CSSProperties } from "react";
import { Icon, type IconName } from "../../design-system";

/**
 * App-specifieke iconen die de NBC-set niet heeft (producten, dashboard,
 * gebruikers). Zelfde Heroicons-stijl en -maatvoering als de design-system
 * Icon, zodat ze naast elkaar niet uit de toon vallen. Bewust hier en niet in
 * design-system/, zodat die map een schone kopie blijft.
 */
export type AppIconName = IconName | "doos" | "grafiek" | "gebruikers" | "scan";

const eigenPaden: Record<string, JSX.Element> = {
  doos: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v8a2 2 0 0 1-1.1 1.8l-7 3.5a2 2 0 0 1-1.8 0l-7-3.5A2 2 0 0 1 3 16V8" />
      <path d="m3 8 8.1-4a2 2 0 0 1 1.8 0L21 8l-8.1 4a2 2 0 0 1-1.8 0L3 8Z" />
      <path d="M12 12v9.5" />
    </g>
  ),
  grafiek: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M6 21V11M11 21V4M16 21v-6M21 21v-9" />
    </g>
  ),
  gebruikers: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </g>
  ),
  scan: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <path d="M7 12h10" />
    </g>
  ),
};

export function AppIcon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: AppIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const eigen = eigenPaden[name];
  if (!eigen) return <Icon name={name as IconName} size={size} className={className} style={style} />;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {eigen}
    </svg>
  );
}
