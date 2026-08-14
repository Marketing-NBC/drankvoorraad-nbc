import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  icon?: IconName;
  variant?: "outline" | "filled";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  "aria-label": string;
  className?: string;
}

/**
 * Circular icon button. Outline by default (inherits currentColor),
 * or filled ink. Used for carousel arrows (lg), inline actions (md),
 * compact controls (sm).
 */
export function IconButton({
  icon = "arrow-right",
  variant = "outline",
  size = "md",
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
  ...rest
}: IconButtonProps) {
  const cls = ["icon-btn", variant === "filled" && "icon-btn--filled", size !== "md" && `icon-btn--${size}`, className]
    .filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
