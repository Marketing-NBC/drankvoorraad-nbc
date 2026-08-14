import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>, "type"> {
  children: ReactNode;
  variant?: "primary" | "ghost-dark" | "ghost-light";
  size?: "sm" | "md" | "lg";
  icon?: IconName | null;
  iconPosition?: "leading" | "trailing";
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
}

/**
 * NBC button. Primary is solid ink with white text; ghost variants are
 * outline-only (dark on light, light on dark). Always a pill. Optional
 * trailing/leading arrow. Hover lightens, press scales to 0.98.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon = "arrow-right",
  iconPosition = "trailing",
  href,
  onClick,
  disabled = false,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  const cls = ["btn", `btn--${variant}`, size !== "md" && `btn--${size}`, className]
    .filter(Boolean).join(" ");
  const glyph = icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} className="arrow" /> : null;
  const content = (
    <>
      {icon && iconPosition === "leading" ? glyph : null}
      {children}
      {icon && iconPosition === "trailing" ? glyph : null}
    </>
  );
  if (href && !disabled) {
    return (
      <a href={href} className={cls} onClick={onClick as never} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick as never} disabled={disabled} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
