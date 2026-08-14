import type { HTMLAttributes, ReactNode } from "react";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: "dark" | "light";
  bare?: boolean;
  className?: string;
}

/**
 * Overline / eyebrow label — lowercase, tracked, with a leading rule.
 * Sits above section headings. Use tone="light" over dark/photo.
 */
export function Eyebrow({ children, tone = "dark", bare = false, className = "", ...rest }: EyebrowProps) {
  const cls = ["eyebrow", tone === "light" && "eyebrow--light", bare && "eyebrow--bare", className]
    .filter(Boolean).join(" ");
  return <span className={cls} {...rest}>{children}</span>;
}
