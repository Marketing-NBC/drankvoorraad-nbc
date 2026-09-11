import { Link } from "../../design-system";
import { Table } from "../../components/ui/Table";
import type { Product, Voorraad } from "../../data/types";
import { formatCurrency } from "../../utils/format";
import { eenheidLabel, heeftVerpakking, omschrijfAantal, verpakkingLabel } from "../../data/verpakking";

export function ProductTable({
  producten,
  voorraad,
  magBeheren,
  magVerwijderen,
  onEdit,
  onDelete,
}: {
  producten: Product[];
  voorraad: Voorraad[];
  magBeheren: boolean;
  magVerwijderen: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const totaalPerProduct = new Map<string, number>();
  const minPerProduct = new Map<string, number>();
  for (const v of voorraad) {
    totaalPerProduct.set(v.productId, (totaalPerProduct.get(v.productId) ?? 0) + v.aantal);
    minPerProduct.set(v.productId, (minPerProduct.get(v.productId) ?? 0) + v.minVoorraad);
  }

  return (
    <Table<Product>
      rowKey={(p) => p.id}
      rows={producten}
      emptyMessage="Geen producten gevonden."
      columns={[
        {
          header: "Naam",
          primair: true,
          render: (p) => (
            <span className="product-naam">
              {p.naam}
              {p.alleenPerVerpakking ? (
                <span className="product-naam__hint">alleen per {p.verpakking}</span>
              ) : null}
            </span>
          ),
        },
        { header: "Categorie", verbergOpMobiel: true, render: (p) => p.categorie },
        {
          header: "Verpakking",
          verbergOpMobiel: true,
          render: (p) => (heeftVerpakking(p) ? verpakkingLabel(p) : eenheidLabel(p)),
        },
        {
          header: "Barcode",
          verbergOpMobiel: true,
          render: (p) =>
            p.barcode ? <code className="barcode-cel">{p.barcode}</code> : <span className="tekst-leeg">—</span>,
        },
        {
          header: "Voorraad",
          align: "right",
          render: (p) => {
            /* Koffie en water hebben geen voorraad; een 0 zou daar lezen als
               "op" in plaats van "niet van toepassing". */
            if (p.voorraadloos) return <span className="tekst-leeg">uit de machine</span>;
            const totaal = totaalPerProduct.get(p.id) ?? 0;
            const min = minPerProduct.get(p.id) ?? 0;
            const laag = min > 0 && totaal < min;
            return (
              <span className={laag ? "voorraad-laag" : undefined} title={laag ? "Onder de minimumvoorraad" : undefined}>
                {omschrijfAantal(p, totaal)}
              </span>
            );
          },
        },
        {
          header: "Inkoop",
          align: "right",
          render: (p) =>
            p.inkoopprijs > 0 ? (
              formatCurrency(p.inkoopprijs)
            ) : (
              <span className="tekst-leeg" title="Nog geen inkoopprijs ingevuld">nog invullen</span>
            ),
        },
        {
          header: "Statiegeld",
          align: "right",
          verbergOpMobiel: true,
          render: (p) => {
            if (p.statiegeldPerVerpakking > 0) {
              return `${formatCurrency(p.statiegeldPerVerpakking)} / ${p.verpakking}`;
            }
            if (p.statiegeldPerStuk > 0) return `${formatCurrency(p.statiegeldPerStuk)} / ${p.eenheid}`;
            return <span className="tekst-leeg">—</span>;
          },
        },
        ...(magBeheren
          ? [
              {
                header: "",
                align: "right" as const,
                render: (p: Product) => (
                  <span style={{ display: "inline-flex", gap: 14 }}>
                    <Link icon={null} onClick={() => onEdit(p)}>Wijzig</Link>
                    {magVerwijderen ? <Link icon={null} onClick={() => onDelete(p)}>Verwijder</Link> : null}
                  </span>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
