import type { CSSProperties, ReactNode } from "react";

export interface StatProps {
  value: ReactNode;
  label?: ReactNode;
  body?: ReactNode;
  rule?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Big-number stat block — Pockota display numeral over a label and an
 * optional caption, with a top rule.
 */
export function Stat({ value, label, body, rule = true, className = "", style }: StatProps) {
  return (
    <div
      className={["nbc-stat", className].filter(Boolean).join(" ")}
      style={{ borderTop: rule ? "1px solid var(--nbc-stone-300)" : "none", ...style }}
    >
      <div className="nbc-stat__value">{value}</div>
      {label ? <h3 className="nbc-stat__label">{label}</h3> : null}
      {body ? <p className="nbc-stat__body">{body}</p> : null}
      <style>{`
        .nbc-stat { display: flex; flex-direction: column; gap: 12px; padding-top: 40px; }
        .nbc-stat__value { font: 300 clamp(72px,7vw,120px)/0.95 var(--font-display);
          letter-spacing: -.02em; color: var(--nbc-stone-900); margin-bottom: 4px;
          font-feature-settings: var(--feat-swash); }
        .nbc-stat__label { font: var(--t-subhead); margin: 0; }
        .nbc-stat__body { font: 400 17px/1.55 var(--font-body); color: var(--fg-secondary); margin: 0; max-width: 34ch; }
      `}</style>
    </div>
  );
}
