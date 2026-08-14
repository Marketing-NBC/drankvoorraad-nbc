import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: "tint" | "outline" | "gold" | "success" | "neutral";
  icon?: IconName;
  className?: string;
}

/** Pill badge / tag. Teal tint by default; outline, gold, success, neutral variants. */
export function Badge({ children, variant = "tint", icon, className = "", ...rest }: BadgeProps) {
  const cls = ["badge", variant !== "tint" && `badge--${variant}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
