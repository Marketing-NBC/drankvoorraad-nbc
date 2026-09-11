import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: "tint" | "outline" | "gold" | "success" | "neutral" | "alarm" | "merk-gv" | "op-donker";
  icon?: IconName;
  className?: string;
}

/** Pill badge / tag. Teal tint by default; outline, gold, success, neutral, alarm,
 *  merk-gv (Green Village) and op-donker (on a petrol/ink surface) variants. */
export function Badge({ children, variant = "tint", icon, className = "", ...rest }: BadgeProps) {
  const cls = ["badge", variant !== "tint" && `badge--${variant}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
