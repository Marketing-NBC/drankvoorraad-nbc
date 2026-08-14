import { useEffect, useState } from "react";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import type { Product, Voorraad } from "../../data/types";
import { formatNumber } from "../../utils/format";

export interface VoorraadRegel {
  product: Product;
  aantal: number;
  minVoorraad: number;
}

/** Inline bewerkbaar minimumvoorraad-veld; slaat op bij verlaten van het veld. */
function MinVoorraadCel({
  locatieId,
  productId,
  waarde,
  bewerkbaar,
}: {
  locatieId: string;
  productId: string;
  waarde: number;
  bewerkbaar: boolean;
}) {
  const { stelMinVoorraadIn } = useAppState();
  const [lokaal, setLokaal] = useState(String(waarde));

  useEffect(() => setLokaal(String(waarde)), [waarde]);

  if (!bewerkbaar) return <>{formatNumber(waarde)}</>;

  return (
    <input
      className="min-voorraad-invoer"
      type="number"
      min={0}
      step={1}
      value={lokaal}
      aria-label="Minimumvoorraad"
      onFocus={(e) => e.target.select()}
      onChange={(e) => setLokaal(e.target.value)}
      onBlur={() => {
        const nieuw = Number(lokaal);
        if (Number.isNaN(nieuw) || nieuw === waarde || nieuw < 0) {
          setLokaal(String(waarde));
          return;
        }
        void stelMinVoorraadIn(locatieId, productId, nieuw);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function VoorraadTabel({
  locatieId,
  producten,
  voorraad,
  magBeheren,
}: {
  locatieId: string;
  producten: Product[];
  voorraad: Voorraad[];
  magBeheren: boolean;
}) {
  const perProduct = new Map(voorraad.filter((v) => v.locatieId === locatieId).map((v) => [v.productId, v]));

  const regels: VoorraadRegel[] = producten.map((product) => {
    const v = perProduct.get(product.id);
    return { product, aantal: v?.aantal ?? 0, minVoorraad: v?.minVoorraad ?? 0 };
  });

  return (
    <Table<VoorraadRegel>
      rowKey={(r) => r.product.id}
      rows={regels}
      emptyMessage="Nog geen producten."
      columns={[
        { header: "Product", primair: true, render: (r) => r.product.naam },
        { header: "Eenheid", verbergOpMobiel: true, render: (r) => r.product.eenheid },
        {
          header: "Voorraad",
          align: "right",
          render: (r) => {
            const laag = r.minVoorraad > 0 && r.aantal < r.minVoorraad;
            return (
              <span className={laag ? "voorraad-laag" : undefined} title={laag ? "Onder de minimumvoorraad" : undefined}>
                {formatNumber(r.aantal)} {laag ? <span className="voorraad-laag-label">te laag</span> : null}
              </span>
            );
          },
        },
        {
          header: "Minimum",
          align: "right",
          render: (r) => (
            <MinVoorraadCel
              locatieId={locatieId}
              productId={r.product.id}
              waarde={r.minVoorraad}
              bewerkbaar={magBeheren}
            />
          ),
        },
      ]}
    />
  );
}
