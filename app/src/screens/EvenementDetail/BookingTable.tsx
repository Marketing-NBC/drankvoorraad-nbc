import { Table } from "../../components/ui/Table";
import { productVerbruikPerEvenement, type ProductVerbruik } from "../../data/calculations";
import type { Mutatie, Product } from "../../data/types";
import { formatNumber } from "../../utils/format";

export function BookingTable({ mutaties, producten }: { mutaties: Mutatie[]; producten: Product[] }) {
  const productenById = new Map(producten.map((p) => [p.id, p]));
  const regels = productVerbruikPerEvenement(mutaties);

  return (
    <Table<ProductVerbruik>
      rowKey={(r) => r.productId}
      rows={regels}
      emptyMessage="Nog geen boekingen voor dit evenement."
      columns={[
        { header: "Product", primair: true, render: (r) => productenById.get(r.productId)?.naam ?? r.productId },
        { header: "Uitgegeven", align: "right", render: (r) => formatNumber(r.aantalUitgegeven) },
        { header: "Retour", align: "right", render: (r) => formatNumber(r.aantalRetour) },
        { header: "Werkelijk verbruik", align: "right", render: (r) => formatNumber(r.werkelijkVerbruik) },
      ]}
    />
  );
}
