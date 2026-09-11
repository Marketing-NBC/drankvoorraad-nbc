import type { ReactNode } from "react";
import { Eyebrow } from "../../design-system";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  /** Eén of twee zinnen onder de titel: wat dit scherm doet en waarom. */
  toelichting?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, toelichting, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <Eyebrow bare className="page-header__eyebrow">{eyebrow}</Eyebrow> : null}
        <h1 className="page-header__title">{title}</h1>
        {toelichting ? <p className="page-header__body">{toelichting}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}
