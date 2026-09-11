import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../design-system";
import { useAppState } from "../../context/AppStateContext";
import { ROUTES } from "../../routes/routes";

interface Treffer {
  key: string;
  label: string;
  soort: string;
  pad: string;
}

const MAX_TREFFERS = 8;

/** Mac toont ⌘, de rest Ctrl — anders staat er een toets die niet bestaat. */
const sneltoets =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? "\u2318F"
    : "Ctrl F";

/**
 * Zoeken vanuit de topbalk over de gegevens die toch al geladen zijn:
 * evenementen, producten en pakbonnummers. Puur navigatie — er wordt niets
 * gefilterd op het scherm eronder; daar zit per scherm een eigen zoekveld.
 *
 * De sneltoets is ⌘F / Ctrl+F, zoals op het toetsenbord naast het veld staat.
 * Dat overschrijft het zoeken van de browser; op een voorraadscherm is de
 * lijst zelden compleet in beeld, dus zoeken in de gegevens is bruikbaarder
 * dan zoeken in de pixels.
 */
export function Zoekbalk() {
  const { state } = useAppState();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const veldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        veldRef.current?.focus();
        veldRef.current?.select();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const treffers = useMemo<Treffer[]>(() => {
    const zoek = term.trim().toLowerCase();
    if (zoek.length < 2) return [];

    const uit: Treffer[] = [
      ...state.evenementen
        .filter((e) => e.naam.toLowerCase().includes(zoek) || e.id.toLowerCase().includes(zoek))
        .map((e) => ({ key: `e-${e.id}`, label: e.naam, soort: "evenement", pad: ROUTES.evenementDetail(e.id) })),
      ...state.producten
        .filter((p) => p.naam.toLowerCase().includes(zoek) || (p.barcode ?? "").includes(zoek))
        .map((p) => ({ key: `p-${p.id}`, label: p.naam, soort: "product", pad: ROUTES.producten })),
      ...state.pakbonnen
        .filter((p) => p.id.slice(0, 8).toLowerCase().includes(zoek))
        .map((p) => ({
          key: `b-${p.id}`,
          label: p.id.slice(0, 8).toUpperCase(),
          soort: "pakbon",
          pad: ROUTES.pakbon(p.id),
        })),
    ];
    return uit.slice(0, MAX_TREFFERS);
  }, [term, state.evenementen, state.producten, state.pakbonnen]);

  function ga(treffer: Treffer) {
    setTerm("");
    setOpen(false);
    navigate(treffer.pad);
  }

  return (
    <div className="zoekbalk">
      <Icon name="search" size={16} className="zoekbalk__icoon" />
      <input
        ref={veldRef}
        className="zoekbalk__veld"
        type="search"
        aria-label="Zoek product, evenement of pakbon"
        placeholder="Zoek product, evenement of pakbon"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        /* Zonder vertraging sluit het paneel vóór de klik op een treffer. */
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      <span className="zoekbalk__toets" aria-hidden="true">{sneltoets}</span>

      {open && term.trim().length >= 2 ? (
        <div className="zoekbalk__uitslag" role="listbox" aria-label="Zoekresultaten">
          {treffers.length === 0 ? (
            <p className="zoekbalk__leeg">Niets gevonden voor “{term.trim()}”.</p>
          ) : (
            treffers.map((treffer) => (
              <button
                key={treffer.key}
                type="button"
                role="option"
                aria-selected={false}
                className="zoekbalk__treffer"
                onClick={() => ga(treffer)}
              >
                {treffer.label}
                <span className="zoekbalk__soort">{treffer.soort}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
