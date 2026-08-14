import type { SelectHTMLAttributes } from "react";
import { Icon } from "../../design-system";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

/** Native select styled to match Input (same radius/border/focus ring), with a trailing chevron. */
export function Select({ options, placeholder, className = "", ...rest }: SelectProps) {
  return (
    <div className={["ui-select", className].filter(Boolean).join(" ")}>
      <select className="ui-select__control" {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={18} className="ui-select__chevron" />
    </div>
  );
}
