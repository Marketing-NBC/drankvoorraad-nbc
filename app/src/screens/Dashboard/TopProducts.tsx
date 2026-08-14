import { Table } from "../../components/ui/Table";
import type { TopProduct } from "../../data/calculations";
import { formatNumber } from "../../utils/format";

export function TopProducts({ producten }: { producten: TopProduct[] }) {
  return (
    <Table<TopProduct>
      rowKey={(r) => r.product.id}
      rows={producten}
      emptyMessage="Nog geen verbruik geregistreerd."
      columns={[
        { header: "Product", primair: true, render: (r) => r.product.naam },
        { header: "Categorie", verbergOpMobiel: true, render: (r) => r.product.categorie },
        { header: "Totaal verbruik", align: "right", render: (r) => formatNumber(r.totaalVerbruik) },
      ]}
    />
  );
}
