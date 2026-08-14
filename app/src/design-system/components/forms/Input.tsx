import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  pill?: boolean;
  className?: string;
}

/** Text input. Rectangular (8px radius) by default, or pill. */
export function Input({ pill = false, className = "", ...rest }: InputProps) {
  const cls = ["input", pill && "input--pill", className].filter(Boolean).join(" ");
  return <input className={cls} {...rest} />;
}
