import { useEffect, useState } from "react";
import { Card } from "../../design-system";
import { KaartKop } from "../../components/ui/KaartKop";
import type { Product, TellingReden } from "../../data/types";

export interface Tekort {
  regelId: string;
  product: Product;
  /** Al omschreven in de eenheid van de telling: "2 kratten", "7 flessen". */
  omschrijving: string;
  reden?: TellingReden;
  toelichting?: string;
}

const redenen: { waarde: TellingReden; label: string }[] = [
  { waarde: "over_datum", label: "Over datum" },
  { waarde: "kapot", label: "Kapot" },
  { waarde: "anders", label: "Andere reden" },
];

export const redenLabel: Record<TellingReden, string> = {
  over_datum: "over datum",
  kapot: "kapot",
  anders: "andere reden",
};

/**
 * De tekorten van een telling in het magazijn, bovenaan en bij elkaar.
 *
 * Staat er minder dan verwacht, dan moet iemand uitzoeken wat er gebeurd is
 * voordat de telling dicht kan. Over datum en kapot worden derving; een
 * andere reden blijft een telverschil, met die reden erbij. Zonder reden
 * rondt de database de telling niet af (migratie 027).
 */
export function TekortKaart({
  tekorten,
  afgerond,
  onReden,
}: {
  tekorten: Tekort[];
  afgerond: boolean;
  onReden: (regelId: string, reden: TellingReden, toelichting: string | null) => void;
}) {
  if (tekorten.length === 0) return null;
  const open = tekorten.filter((t) => !t.reden || (t.reden === "anders" && !t.toelichting?.trim())).length;

  return (
    <div id="tekorten">
      <Card className={afgerond ? undefined : "card--goud"}>
        <KaartKop
          titel={afgerond ? "Tekorten" : "Wat is er gebeurd?"}
          sub={
            afgerond
              ? "zo zijn de tekorten geboekt"
              : open > 0
                ? `${open} van ${tekorten.length} ${tekorten.length === 1 ? "tekort" : "tekorten"} nog zonder reden`
                : "elk tekort heeft een reden"
          }
        />
        <div className="tekort-lijst">
          {tekorten.map((tekort) => (
            <TekortRegel key={tekort.regelId} tekort={tekort} afgerond={afgerond} onReden={onReden} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TekortRegel({
  tekort,
  afgerond,
  onReden,
}: {
  tekort: Tekort;
  afgerond: boolean;
  onReden: (regelId: string, reden: TellingReden, toelichting: string | null) => void;
}) {
  const [toelichting, setToelichting] = useState(tekort.toelichting ?? "");
  useEffect(() => setToelichting(tekort.toelichting ?? ""), [tekort.toelichting]);

  return (
    <div className="tekort-regel">
      <div className="tekort-regel__kop">
        <strong>{tekort.product.naam}</strong>
        <span className="tekort-regel__aantal">{tekort.omschrijving} minder</span>
      </div>

      {afgerond ? (
        <span className="kaart-kop__sub">
          {tekort.reden
            ? `${redenLabel[tekort.reden]}${tekort.reden === "anders" && tekort.toelichting ? `: ${tekort.toelichting}` : ""}`
            : "geen reden"}
        </span>
      ) : (
        <>
          <div className="tekort-regel__keuzes" role="radiogroup" aria-label={`Reden tekort ${tekort.product.naam}`}>
            {redenen.map((r) => (
              <button
                key={r.waarde}
                type="button"
                role="radio"
                aria-checked={tekort.reden === r.waarde}
                className={["rapport-tab", tekort.reden === r.waarde && "rapport-tab--actief"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onReden(tekort.regelId, r.waarde, r.waarde === "anders" ? toelichting || null : null)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {tekort.reden === "anders" ? (
            <input
              className="input tekort-regel__toelichting"
              aria-label={`Wat er gebeurd is met ${tekort.product.naam}`}
              placeholder="Wat is er gebeurd?"
              value={toelichting}
              onChange={(e) => setToelichting(e.target.value)}
              onBlur={() => onReden(tekort.regelId, "anders", toelichting.trim() || null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
