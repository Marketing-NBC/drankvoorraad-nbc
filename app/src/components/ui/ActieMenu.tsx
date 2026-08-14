import { useEffect, useRef, useState } from "react";
import { Icon } from "../../design-system";

export interface ActieMenuItem {
  label: string;
  onClick: () => void;
}

/**
 * Knop met een uitklapmenu voor secundaire acties. Houdt de paginakop
 * compact: één duidelijke hoofdactie ernaast, de rest hierin. Sluit met
 * Escape of door ernaast te klikken.
 */
export function ActieMenu({ label = "Meer", items }: { label?: string; items: ActieMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const knopRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        knopRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="actie-menu">
      <button
        ref={knopRef}
        type="button"
        className="btn btn--ghost-dark actie-menu__knop"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        {label}
        <Icon name="chevron-down" size={18} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="actie-menu__overlay"
            aria-label="Menu sluiten"
            onClick={() => setOpen(false)}
          />
          <div className="actie-menu__lijst" role="menu">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="actie-menu__item"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
