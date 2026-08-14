import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Dutch, sentence-case, no emoji — per brand voice rules. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <p className="ui-empty-state__title">{title}</p>
      {body ? <p className="ui-empty-state__body">{body}</p> : null}
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </div>
  );
}
