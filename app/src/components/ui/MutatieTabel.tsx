import { Badge } from "../../design-system";
import { Table } from "./Table";
import { mutatieLabels, mutatieVariant } from "../../data/labels";
import type { Locatie, Mutatie, Product, Profiel } from "../../data/types";
import { losOpLocatie, omschrijfAantal } from "../../data/verpakking";
import { formatDateTimeKort, formatNumber } from "../../utils/format";

/**
 * Het audit trail in tabelvorm: wie heeft wat wanneer geboekt, en van waar
 * naar waar. Mutaties worden nooit gewijzigd of verwijderd, dus deze lijst
 * is de volledige historie.
 *
 * Van en naar staan in eigen kolommen: zo lezen ze als een route die je van
 * boven naar beneden kunt scannen, in plaats van als één tekstregel per rij.
 *
 * Op een telefoon is elke mutatie twee regels: product, soort en aantal
 * bovenaan, wanneer en door wie eronder.
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
  const productById = new Map(producten.map((p) => [p.id, p]));
  const locatieById = new Map(locaties.map((l) => [l.id, l]));
  const locatieNaam = new Map(locaties.map((l) => [l.id, l.naam]));

  /* In kratten waar het magazijn in kratten werkt ("2 kratten"), in losse
     flesjes zodra de kantine of de kroeg erbij betrokken is. De omrekening
     zelf zit in data/verpakking.ts. */
  function aantal(m: Mutatie): string {
    const product = productById.get(m.productId);
    if (!product) return formatNumber(m.aantal);
    const los = losOpLocatie(
      m.vanLocatieId ? locatieById.get(m.vanLocatieId) : undefined,
      m.naarLocatieId ? locatieById.get(m.naarLocatieId) : undefined
    );
    return omschrijfAantal(product, m.aantal, { los });
  }
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
      compact
      columns={[
        {
          header: "Datum en tijd",
          mobiel: "meta",
          render: (m) => <span className="tekst-zwak">{formatDateTimeKort(m.datumTijd)}</span>,
        },
        {
          header: "Soort",
          mobiel: "kop",
          render: (m) => <Badge variant={mutatieVariant[m.type]}>{mutatieLabels[m.type]}</Badge>,
        },
        {
          header: "Product",
          primair: true,
          render: (m) => productNaam.get(m.productId) ?? m.productId,
        },
        { header: "Aantal", align: "right", mobiel: "kop", render: (m) => <strong>{aantal(m)}</strong> },
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
          mobiel: "meta",
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
