import { Table } from "../../components/ui/Table";
import { productVerbruikPerEvenement, type ProductVerbruik } from "../../data/calculations";
import type { Mutatie, Product } from "../../data/types";
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
                {product ? <span className="kaart-kop__sub">per {product.eenheid}</span> : null}
              </>
            );
          },
        },
        { header: "Uitgegeven", align: "right", render: (r) => formatNumber(r.aantalUitgegeven) },
        { header: "Retour", align: "right", render: (r) => formatNumber(r.aantalRetour) },
        {
          header: "Werkelijk verbruik",
          align: "right",
          render: (r) => <strong>{formatNumber(r.werkelijkVerbruik)}</strong>,
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
