import { Badge } from "../../design-system";
import { Table } from "./Table";
import { mutatieLabels, mutatieVariant } from "../../data/labels";
import type { Locatie, Mutatie, Product, Profiel } from "../../data/types";
import { formatDateTime, formatNumber } from "../../utils/format";

/**
 * Het audit trail in tabelvorm: wie heeft wat wanneer geboekt, en van waar
 * naar waar. Mutaties worden nooit gewijzigd of verwijderd, dus deze lijst
 * is de volledige historie.
 */
export function MutatieTabel({
  mutaties,
  producten,
  locaties,
  profielen,
  toonEvenement = false,
  evenementNaam,
  legeMelding = "Nog geen mutaties.",
}: {
  mutaties: Mutatie[];
  producten: Product[];
  locaties: Locatie[];
  profielen: Profiel[];
  toonEvenement?: boolean;
  evenementNaam?: (evenementId: string) => string;
  legeMelding?: string;
}) {
  const productNaam = new Map(producten.map((p) => [p.id, p.naam]));
  const locatieNaam = new Map(locaties.map((l) => [l.id, l.naam]));
  const gebruikerNaam = new Map(profielen.map((p) => [p.id, p.naam]));

  function herkomstBestemming(m: Mutatie): string {
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
          header: "Product",
          primair: true,
          render: (m) => productNaam.get(m.productId) ?? m.productId,
        },
        {
          header: "Wat",
          render: (m) => <Badge variant={mutatieVariant[m.type]}>{mutatieLabels[m.type]}</Badge>,
        },
        { header: "Aantal", align: "right", render: (m) => formatNumber(m.aantal) },
        {
          header: "Locatie",
          verbergOpMobiel: true,
          render: (m) => <span className="tekst-zwak">{herkomstBestemming(m)}</span>,
        },
        ...(toonEvenement
          ? [
              {
                header: "Evenement",
                verbergOpMobiel: true,
                render: (m: Mutatie) => (
                  <span className="tekst-zwak">
                    {m.evenementId ? (evenementNaam?.(m.evenementId) ?? m.evenementId) : "—"}
                  </span>
                ),
              },
            ]
          : []),
        {
          header: "Wanneer",
          render: (m) => <span className="tekst-zwak">{formatDateTime(m.datumTijd)}</span>,
        },
        {
          header: "Door",
          render: (m) => (
            <span className="tekst-zwak">{gebruikerNaam.get(m.gebruikerId) ?? "onbekend"}</span>
          ),
        },
        {
          header: "Notitie",
          verbergOpMobiel: true,
          render: (m) => <span className="tekst-zwak">{m.notitie ?? "—"}</span>,
        },
      ]}
    />
  );
}
