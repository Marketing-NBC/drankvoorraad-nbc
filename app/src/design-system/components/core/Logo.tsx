import type { CSSProperties } from "react";
import logoColor from "../../assets/nbc-logo-color.png";
import logoColorNoPayoff from "../../assets/nbc-logo-color-no-payoff.png";
import logoMark from "../../assets/nbc-mark.svg";

export interface LogoProps {
  variant?: "color" | "mark-color" | "mono";
  tone?: "dark" | "light";
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * NBC wordmark. The brand mark is organic capitals N-B-C with the
 * "Ruimte voor magie" pay-off. Full-colour version is a teal→gold
 * gradient; the mono version recolours to white (on dark) or ink.
 */
export function Logo({ variant = "color", tone = "dark", height = 40, className = "", style }: LogoProps) {
  const src = variant === "mark-color" ? logoColorNoPayoff : variant === "mono" ? logoMark : logoColor;
  const monoFilter = tone === "light"
    ? "brightness(0) invert(1)"
    : "brightness(0) saturate(100%)";
  return (
    <img
      src={src}
      alt="NBC — Ruimte voor magie"
      className={className}
      style={{
        height, width: "auto", display: "block",
        filter: variant === "mono" ? monoFilter : undefined,
        ...style,
      }}
    />
  );
}
