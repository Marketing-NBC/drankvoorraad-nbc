import type { ReactNode } from "react";
import { Eyebrow } from "../../design-system";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <Eyebrow bare className="page-header__eyebrow">{eyebrow}</Eyebrow> : null}
        <h1 className="page-header__title">{title}</h1>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}
