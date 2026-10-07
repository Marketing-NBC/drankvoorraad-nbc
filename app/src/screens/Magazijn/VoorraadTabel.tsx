import { useEffect, useState } from "react";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import type { Product, Voorraad } from "../../data/types";
import { formatNumber } from "../../utils/format";
import {
  heeftVerpakking,
  invoer,
  invoerNaarStuks,
  meervoudVan,
  omschrijfAantal,
  stuksNaarInvoer,
  verpakkingLabel,
} from "../../data/verpakking";

export interface VoorraadRegel {
  product: Product;
  aantal: number;
  minVoorraad: number;
}

/**
 * Inline bewerkbaar minimumvoorraad-veld; slaat op bij verlaten van het veld.
 *
 * Het minimum staat in stuks, net als de voorraad. Bij een product dat per
 * krat gaat vult en leest het magazijn het in kratten — "48", niet "1152".
 * De omrekening zit in src/data/verpakking.ts.
 */
function MinVoorraadCel({
  locatieId,
  product,
  waarde,
  bewerkbaar,
  perStuk,
}: {
  locatieId: string;
  product: Product;
  /** In stuks. */
  waarde: number;
  bewerkbaar: boolean;
  perStuk: boolean;
}) {
  const { stelMinVoorraadIn } = useAppState();
  const opties = { los: perStuk };
  const inVeld = stuksNaarInvoer(product, waarde, opties);
  const [lokaal, setLokaal] = useState(String(inVeld));
  const perKrat = invoer(product, opties).factor > 1;

  useEffect(() => setLokaal(String(inVeld)), [inVeld]);

  if (!bewerkbaar) return <>{omschrijfAantal(product, waarde, opties)}</>;

  return (
    <span className="min-voorraad">
    <input
      className="min-voorraad-invoer"
      type="number"
      min={0}
      step={1}
      value={lokaal}
      aria-label={perKrat ? `Minimumvoorraad in ${product.verpakking}en` : "Minimumvoorraad"}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setLokaal(e.target.value)}
      onBlur={() => {
        const ingevoerd = Number(lokaal);
        if (lokaal.trim() === "" || Number.isNaN(ingevoerd) || ingevoerd < 0) {
          setLokaal(String(inVeld));
          return;
        }
        const nieuw = invoerNaarStuks(product, ingevoerd, opties);
        if (nieuw === waarde) return;
        void stelMinVoorraadIn(locatieId, product.id, nieuw);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
      {/* Bij een product dat per krat gaat staat de eenheid erbij; bij een
          product dat los mag, hoeveel kratten of dozen het minimum is. */}
      {perKrat ? (
        <span className="min-voorraad__eenheid">{meervoudVan(product.verpakking!, inVeld)}</span>
      ) : !perStuk && heeftVerpakking(product) && waarde > 0 && waarde % product.stuksPerVerpakking === 0 ? (
        <span className="min-voorraad__eenheid">
          = {waarde / product.stuksPerVerpakking}{" "}
          {meervoudVan(product.verpakking!, waarde / product.stuksPerVerpakking)}
        </span>
      ) : (
        <span className="min-voorraad__eenheid" aria-hidden="true" />
      )}
    </span>
  );
}

export function VoorraadTabel({
  locatieId,
  producten,
  voorraad,
  magBeheren,
  onInboeken,
  onVerplaatsen,
  perStuk = false,
}: {
  locatieId: string;
  producten: Product[];
  voorraad: Voorraad[];
  magBeheren: boolean;
  /** Snelknop per rij; weglaten verbergt de kolom. */
  onInboeken?: (product: Product) => void;
  onVerplaatsen?: (product: Product) => void;
  /** Kantine of kroeg: voorraad in losse flesjes tonen, niet in kratten. */
  perStuk?: boolean;
}) {
  const perProduct = new Map(voorraad.filter((v) => v.locatieId === locatieId).map((v) => [v.productId, v]));

  /* Koffie en water staan nergens op een plank; die horen niet in een
     voorraadtabel thuis. */
  const regels: VoorraadRegel[] = producten.filter((p) => !p.voorraadloos).map((product) => {
    const v = perProduct.get(product.id);
    return { product, aantal: v?.aantal ?? 0, minVoorraad: v?.minVoorraad ?? 0 };
  });

  const totaal = regels.reduce((som, r) => som + r.aantal, 0);
  const snelBoeken = magBeheren && onInboeken && onVerplaatsen;

  return (
    <Table<VoorraadRegel>
      rowKey={(r) => r.product.id}
      rows={regels}
      emptyMessage="Nog geen producten."
      totaal={["Totaal", null, formatNumber(totaal), null, ...(snelBoeken ? [null] : [])]}
      columns={[
        { header: "Product", primair: true, render: (r) => r.product.naam },
        {
          header: "Eenheid",
          verbergOpMobiel: true,
          render: (r) =>
            !perStuk && heeftVerpakking(r.product) ? verpakkingLabel(r.product) : r.product.eenheid,
        },
        {
          header: "Voorraad",
          align: "right",
          render: (r) => {
            const laag = r.minVoorraad > 0 && r.aantal < r.minVoorraad;
            return (
              <span className={laag ? "voorraad-laag" : undefined} title={laag ? "Onder de minimumvoorraad" : undefined}>
                {omschrijfAantal(r.product, r.aantal, { los: perStuk })}{" "}
                {laag ? <span className="voorraad-laag-label">te laag</span> : null}
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
              product={r.product}
              waarde={r.minVoorraad}
              bewerkbaar={magBeheren}
              perStuk={perStuk}
            />
          ),
        },
        ...(snelBoeken
          ? [
              {
                header: "Snel boeken",
                align: "right" as const,
                render: (r: VoorraadRegel) => (
                  <span className="snelknoppen">
                    <button
                      type="button"
                      className="snelknop snelknop--primair"
                      title={`${r.product.naam} ${perStuk ? "aanvullen vanuit het magazijn" : "inboeken"}`}
                      onClick={() => onInboeken(r.product)}
                    >
                      {perStuk ? "+ aanvullen" : "+ in"}
                    </button>
                    <button
                      type="button"
                      className="snelknop snelknop--zacht"
                      title={`${r.product.naam} verplaatsen`}
                      onClick={() => onVerplaatsen(r.product)}
                    >
                      verpl.
                    </button>
                  </span>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
