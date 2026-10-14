import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../design-system";

export interface ActieMenuItem {
  label: string;
  onClick: () => void;
}

/**
 * Knop met een uitklapmenu voor secundaire acties. Houdt de paginakop
 * compact: één duidelijke hoofdactie ernaast, de rest hierin. Sluit met
 * Escape of door ernaast te klikken.
 *
 * Op een telefoon schuift het menu als bodemblad van onderen in beeld, net
 * als een modal: dan valt het nooit buiten het scherm, waar de knop ook
 * staat. Vanaf tablet is het een uitklapper die opent naar de kant waar
 * ruimte is.
 */
export function ActieMenu({ label = "Meer", items }: { label?: string; items: ActieMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [naarRechts, setNaarRechts] = useState(false);
  const knopRef = useRef<HTMLButtonElement>(null);
  const lijstRef = useRef<HTMLDivElement>(null);

  /* Standaard lijnt het menu rechts uit met de knop. Staat de knop links op
     de pagina, dan past dat niet en opent het naar rechts. */
  useLayoutEffect(() => {
    if (!open || !knopRef.current || !lijstRef.current) return;
    const knop = knopRef.current.getBoundingClientRect();
    setNaarRechts(knop.right - lijstRef.current.offsetWidth < 8);
  }, [open]);

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
          <div
            ref={lijstRef}
            className={["actie-menu__lijst", naarRechts && "actie-menu__lijst--rechts"].filter(Boolean).join(" ")}
            role="menu"
          >
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
