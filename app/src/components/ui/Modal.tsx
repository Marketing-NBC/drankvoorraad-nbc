import { useEffect, type ReactNode } from "react";
import { IconButton } from "../../design-system";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Centered dialog surface over a scrim. ESC and backdrop-click both close. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal-scrim" onClick={onClose}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__header">
          <h3 className="ui-modal__title">{title}</h3>
          <IconButton icon="x" size="sm" aria-label="Sluiten" onClick={onClose} />
        </div>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}
