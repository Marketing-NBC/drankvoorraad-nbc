import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: "compact" | "feature";
  className?: string;
  style?: CSSProperties;
}

/**
 * Surface card — white, 16px radius, soft elevation, light border.
 * Pass `hover` for the lift-on-hover interaction.
 */
export function Card({ children, hover = false, padding = "compact", className = "", style, ...rest }: CardProps) {
  const cls = ["card", hover && "card--hover", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} {...rest}>
      <div className={padding === "feature" ? "card__body card__body--feature" : "card__body"}>
        {children}
      </div>
    </div>
  );
}
