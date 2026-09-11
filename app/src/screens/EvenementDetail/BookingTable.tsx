import { Table } from "../../components/ui/Table";
import { productVerbruikPerEvenement, type ProductVerbruik } from "../../data/calculations";
import type { Mutatie, Product } from "../../data/types";
import { eenheidLabel, heeftVerpakking, omschrijfAantal, verpakkingLabel } from "../../data/verpakking";
import { formatNumber } from "../../utils/format";

export function BookingTable({
  mutaties,
  producten,
  onUitgifte,
  onRetour,
}: {
  mutaties: Mutatie[];
  producten: Product[];
  /** Snelknop per rij; weglaten verbergt de kolom. */
  onUitgifte?: (product: Product) => void;
  onRetour?: (product: Product) => void;
}) {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  const regels = productVerbruikPerEvenement(mutaties);
  const snelBoeken = onUitgifte && onRetour;

  /* Bij een product dat nooit los gaat zegt "20 kratten" meer dan "480". */
  function toon(productId: string, aantal: number): string {
    const product = productenById.get(productId);
    return product ? omschrijfAantal(product, aantal) : formatNumber(aantal);
  }

  const totalen = regels.reduce(
    (som, r) => ({
      uit: som.uit + r.aantalUitgegeven,
      retour: som.retour + r.aantalRetour,
      verbruik: som.verbruik + r.werkelijkVerbruik,
    }),
    { uit: 0, retour: 0, verbruik: 0 }
  );

  return (
    <Table<ProductVerbruik>
      rowKey={(r) => r.productId}
      rows={regels}
      emptyMessage="Nog geen boekingen voor dit evenement."
      totaal={[
        "Totaal",
        formatNumber(totalen.uit),
        formatNumber(totalen.retour),
        formatNumber(totalen.verbruik),
        ...(snelBoeken ? [null] : []),
      ]}
      columns={[
        {
          header: "Product",
          primair: true,
          render: (r) => {
            const product = productenById.get(r.productId);
            return (
              <>
                {product?.naam ?? r.productId}
                {product ? (
                  <span className="kaart-kop__sub">
                    per {product.alleenPerVerpakking && heeftVerpakking(product)
                      ? verpakkingLabel(product)
                      : eenheidLabel(product)}
                  </span>
                ) : null}
              </>
            );
          },
        },
        {
          header: "Uitgegeven",
          align: "right",
          render: (r) => toon(r.productId, r.aantalUitgegeven),
        },
        { header: "Retour", align: "right", render: (r) => toon(r.productId, r.aantalRetour) },
        {
          header: "Werkelijk verbruik",
          align: "right",
          render: (r) => <strong>{toon(r.productId, r.werkelijkVerbruik)}</strong>,
        },
        ...(snelBoeken
          ? [
              {
                header: "Snel boeken",
                align: "right" as const,
                render: (r: ProductVerbruik) => {
                  const product = productenById.get(r.productId);
                  if (!product) return null;
                  return (
                    <span className="snelknoppen">
                      <button
                        type="button"
                        className="snelknop snelknop--primair"
                        title={`${product.naam} uitgeven`}
                        onClick={() => onUitgifte(product)}
                      >
                        + uit
                      </button>
                      <button
                        type="button"
                        className="snelknop snelknop--zacht"
                        title={`${product.naam} retour boeken`}
                        onClick={() => onRetour(product)}
                      >
                        retour
                      </button>
                    </span>
                  );
                },
              },
            ]
          : []),
      ]}
    />
  );
}
