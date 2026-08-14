import { Link } from "../../design-system";
import { Table } from "../../components/ui/Table";
import type { Product, Voorraad } from "../../data/types";
import { formatCurrency, formatNumber } from "../../utils/format";

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
      emptyMessage="Nog geen producten toegevoegd."
      columns={[
        { header: "Naam", primair: true, render: (p) => p.naam },
        { header: "Categorie", verbergOpMobiel: true, render: (p) => p.categorie },
        { header: "Eenheid", verbergOpMobiel: true, render: (p) => p.eenheid },
        {
          header: "Barcode",
          verbergOpMobiel: true,
          render: (p) =>
            p.barcode ? <code className="barcode-cel">{p.barcode}</code> : <span className="tekst-zwak">—</span>,
        },
        {
          header: "Voorraad",
          align: "right",
          render: (p) => {
            const totaal = totaalPerProduct.get(p.id) ?? 0;
            const min = minPerProduct.get(p.id) ?? 0;
            const laag = min > 0 && totaal < min;
            return (
              <span className={laag ? "voorraad-laag" : undefined} title={laag ? "Onder de minimumvoorraad" : undefined}>
                {formatNumber(totaal)}
              </span>
            );
          },
        },
        { header: "Inkoopprijs", align: "right", render: (p) => formatCurrency(p.inkoopprijs) },
        { header: "Verkoopprijs", align: "right", verbergOpMobiel: true, render: (p) => formatCurrency(p.verkoopprijs) },
        ...(magBeheren
          ? [
              {
                header: "",
                align: "right" as const,
                render: (p: Product) => (
                  <span style={{ display: "inline-flex", gap: 16 }}>
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
