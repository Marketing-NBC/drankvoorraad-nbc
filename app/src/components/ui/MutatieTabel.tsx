import { Badge } from "../../design-system";
import { Table } from "./Table";
import { mutatieLabels, mutatieVariant } from "../../data/labels";
import type { Locatie, Mutatie, Product, Profiel } from "../../data/types";
import { formatDateTimeKort, formatNumber } from "../../utils/format";

/**
 * Het audit trail in tabelvorm: wie heeft wat wanneer geboekt, en van waar
 * naar waar. Mutaties worden nooit gewijzigd of verwijderd, dus deze lijst
 * is de volledige historie.
 *
 * Van en naar staan in eigen kolommen: zo lezen ze als een route die je van
 * boven naar beneden kunt scannen, in plaats van als één tekstregel per rij.
 */
export function MutatieTabel({
  mutaties,
  producten,
  locaties,
  profielen,
  toonEvenement = false,
  evenementNaam,
  legeMelding = "Nog geen mutaties.",
  compact = false,
}: {
  mutaties: Mutatie[];
  producten: Product[];
  locaties: Locatie[];
  profielen: Profiel[];
  toonEvenement?: boolean;
  evenementNaam?: (evenementId: string) => string;
  legeMelding?: string;
  /** Voor een smalle kolom: van en naar op één regel, geen notitiekolom. */
  compact?: boolean;
}) {
  const productNaam = new Map(producten.map((p) => [p.id, p.naam]));
  const locatieNaam = new Map(locaties.map((l) => [l.id, l.naam]));
  const gebruikerNaam = new Map(profielen.map((p) => [p.id, p.naam]));

  function locatie(id: string | undefined) {
    if (!id) return <span className="tekst-leeg">—</span>;
    return <span className="tekst-zwak">{locatieNaam.get(id) ?? "onbekend"}</span>;
  }

  function route(m: Mutatie): string {
    const van = m.vanLocatieId ? locatieNaam.get(m.vanLocatieId) : undefined;
    const naar = m.naarLocatieId ? locatieNaam.get(m.naarLocatieId) : undefined;
    if (van && naar) return `${van} → ${naar}`;
    if (van) return `${van} →`;
    if (naar) return `→ ${naar}`;
    return "—";
  }

  return (
    <Table<Mutatie>
      rowKey={(m) => m.id}
      rows={mutaties}
      emptyMessage={legeMelding}
      columns={[
        {
          header: "Datum en tijd",
          render: (m) => <span className="tekst-zwak">{formatDateTimeKort(m.datumTijd)}</span>,
        },
        {
          header: "Soort",
          render: (m) => <Badge variant={mutatieVariant[m.type]}>{mutatieLabels[m.type]}</Badge>,
        },
        {
          header: "Product",
          primair: true,
          render: (m) => productNaam.get(m.productId) ?? m.productId,
        },
        { header: "Aantal", align: "right", render: (m) => <strong>{formatNumber(m.aantal)}</strong> },
        ...(compact
          ? [
              {
                header: "Van en naar",
                verbergOpMobiel: true,
                render: (m: Mutatie) => <span className="tekst-zwak">{route(m)}</span>,
              },
            ]
          : [
              { header: "Van", verbergOpMobiel: true, render: (m: Mutatie) => locatie(m.vanLocatieId) },
              { header: "Naar", verbergOpMobiel: true, render: (m: Mutatie) => locatie(m.naarLocatieId) },
            ]),
        ...(toonEvenement
          ? [
              {
                header: "Evenement",
                verbergOpMobiel: true,
                render: (m: Mutatie) =>
                  m.evenementId ? (
                    <span style={{ color: "var(--nbc-blue-deep)" }}>
                      {evenementNaam?.(m.evenementId) ?? m.evenementId}
                    </span>
                  ) : (
                    <span className="tekst-leeg">—</span>
                  ),
              },
            ]
          : []),
        {
          header: "Door",
          render: (m) => (
            <span className="tekst-zwak">{gebruikerNaam.get(m.gebruikerId) ?? "onbekend"}</span>
          ),
        },
        ...(compact
          ? []
          : [
              {
                header: "Notitie",
                verbergOpMobiel: true,
                render: (m: Mutatie) =>
                  m.notitie ? <span className="tekst-zwak">{m.notitie}</span> : <span className="tekst-leeg">—</span>,
              },
            ]),
      ]}
    />
  );
}
