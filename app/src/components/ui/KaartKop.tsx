import type { ReactNode } from "react";

export interface KaartKopProps {
  titel: ReactNode;
  /** Kleine regel onder de titel: waar de cijfers over gaan. */
  sub?: ReactNode;
  /** Pillen, een knop of een los cijfer aan de rechterkant. */
  rechts?: ReactNode;
}

/**
 * De kop van een kaart: titel, subregel en ruimte voor een actie rechts.
 * Komt op vrijwel elk scherm terug, dus één component in plaats van
 * dezelfde drie divs tien keer.
 */
export function KaartKop({ titel, sub, rechts }: KaartKopProps) {
  return (
    <div className="kaart-kop">
      <div>
        <h3 className="kaart-kop__titel">{titel}</h3>
        {sub ? <span className="kaart-kop__sub">{sub}</span> : null}
      </div>
      {rechts ? <span className="kaart-kop__rechts">{rechts}</span> : null}
    </div>
  );
}
