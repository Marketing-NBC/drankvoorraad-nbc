import { Table } from "../../components/ui/Table";
import { totaleVoorraadPerProduct, type TotaleVoorraadRegel } from "../../data/calculations";
import type { Locatie, Product, Voorraad } from "../../data/types";
import { losOpLocatie, omschrijfAantal } from "../../data/verpakking";
import { formatCurrency, formatNumber } from "../../utils/format";

/**
 * Alle voorraad bij elkaar: per product het totaal, en waar het ligt.
 * Alleen om te lezen — boeken en het minimum zetten gebeurt per locatie,
 * want daar hoort elk getal bij één plank.
 *
 * Bewust geen kolom per locatie: met zes locaties en hun lange namen past
 * dat op geen scherm. "Waar" noemt alleen de locaties waar iets ligt. De
 * Excel-export heeft wel een kolom per locatie.
 */
export function TotaalTabel({
  locaties,
  producten,
  voorraad,
  zietBedragen,
}: {
  /** In de volgorde waarin ze als kolom moeten staan. */
  locaties: Locatie[];
  producten: Product[];
  voorraad: Voorraad[];
  zietBedragen: boolean;
}) {
  const regels = totaleVoorraadPerProduct(voorraad, producten);
  const totaal = regels.reduce((som, r) => som + r.totaal, 0);
  const waarde = regels.reduce((som, r) => som + r.waarde, 0);

  return (
    <Table<TotaleVoorraadRegel>
      rowKey={(r) => r.product.id}
      rows={regels}
      compact
      emptyMessage="Nog geen producten."
      totaal={[
        "Totaal",
        formatNumber(totaal),
        null,
        ...(zietBedragen ? [formatCurrency(waarde)] : []),
      ]}
      columns={[
        { header: "Product", primair: true, render: (r) => r.product.naam },
        {
          header: "Totaal",
          align: "right",
          mobiel: "kop",
          render: (r) => <strong>{omschrijfAantal(r.product, r.totaal)}</strong>,
        },
        {
          header: "Waar",
          mobiel: "meta",
          render: (r) => {
            const waar = locaties.filter((l) => (r.perLocatie.get(l.id) ?? 0) !== 0);
            if (waar.length === 0) return <span className="tekst-leeg">nergens</span>;
            return (
              <span className="totaal-waar">
                {waar.map((l) => (
                  <span key={l.id}>
                    {l.naam}{" "}
                    <strong>{omschrijfAantal(r.product, r.perLocatie.get(l.id)!, { los: losOpLocatie(l) })}</strong>
                  </span>
                ))}
              </span>
            );
          },
        },
        ...(zietBedragen
          ? [
              {
                header: "Waarde",
                align: "right" as const,
                render: (r: TotaleVoorraadRegel) => formatCurrency(r.waarde),
              },
            ]
          : []),
      ]}
    />
  );
}
