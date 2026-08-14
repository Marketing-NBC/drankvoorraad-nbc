import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface LinkProps {
  children: ReactNode;
  icon?: IconName | null;
  iconPosition?: "leading" | "trailing";
  href?: string;
  onClick?: () => void;
  className?: string;
}

/** Underlined text link with an optional leading/trailing icon. */
export function Link({
  children,
  icon = "arrow-right",
  iconPosition = "trailing",
  href,
  onClick,
  className = "",
  ...rest
}: LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement> & ButtonHTMLAttributes<HTMLButtonElement>, keyof LinkProps>) {
  const glyph = icon ? <Icon name={icon} size={16} /> : null;
  const inner = (
    <>
      {icon && iconPosition === "leading" ? glyph : null}
      {children}
      {icon && iconPosition === "trailing" ? glyph : null}
    </>
  );
  const cls = ["link", className].filter(Boolean).join(" ");
  if (href) return <a href={href} className={cls} onClick={onClick} {...rest}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick} {...rest}>{inner}</button>;
}
