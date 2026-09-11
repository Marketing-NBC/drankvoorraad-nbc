import { useMemo, useState } from "react";
import { Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Product } from "../../data/types";
import { exporteerNaarExcel } from "../../utils/excel";
import { formatCurrency } from "../../utils/format";
import { heeftVerpakking, verpakkingLabel } from "../../data/verpakking";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { ProductFilters, type ProductFiltersValue } from "./ProductFilters";
import { ProductForm } from "./ProductForm";
import { ProductTable } from "./ProductTable";

export function Productbeheer() {
  const { state, laden, fout, herlaad, verwijderProduct } = useAppState();
  const { mag } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFiltersValue>({ zoek: "", categorie: "", leverancier: "" });

  const magBeheren = mag("beheerder", "magazijnmedewerker");
  const magVerwijderen = mag("beheerder");

  const voorraadPerProduct = useMemo(() => {
    const per = new Map<string, number>();
    for (const v of state.voorraad) per.set(v.productId, (per.get(v.productId) ?? 0) + v.aantal);
    return per;
  }, [state.voorraad]);

  const zichtbaar = useMemo(() => {
    const zoek = filters.zoek.trim().toLowerCase();
    return state.producten
      .filter((p) => (filters.categorie ? p.categorie === filters.categorie : true))
      .filter((p) => (filters.leverancier ? p.leverancier === filters.leverancier : true))
      .filter((p) =>
        zoek
          ? p.naam.toLowerCase().includes(zoek) ||
            p.categorie.toLowerCase().includes(zoek) ||
            (p.barcode ?? "").includes(zoek)
          : true
      );
  }, [state.producten, filters]);

  const totaleWaarde = zichtbaar.reduce(
    (som, p) => som + (p.voorraadloos ? 0 : (voorraadPerProduct.get(p.id) ?? 0) * p.inkoopprijs),
    0
  );

  async function handleExport() {
    await exporteerNaarExcel<Product>({
      bestandsnaam: `productenlijst-${new Date().toISOString().slice(0, 10)}`,
      titel: "Productenlijst",
      ondertitel: `${zichtbaar.length} producten · voorraad over alle locaties`,
      rijen: zichtbaar,
      kolommen: [
        { header: "Naam", value: (p) => p.naam },
        { header: "Categorie", value: (p) => p.categorie },
        { header: "Inhoud", value: (p) => p.inhoud ?? "" },
        { header: "Eenheid", value: (p) => p.eenheid },
        { header: "Verpakking", value: (p) => (heeftVerpakking(p) ? verpakkingLabel(p) : "") },
        { header: "Barcode", value: (p) => p.barcode ?? "" },
        { header: "Leverancier", value: (p) => p.leverancier ?? "" },
        {
          header: "Voorraad",
          opmaak: "getal",
          value: (p) => (p.voorraadloos ? 0 : voorraadPerProduct.get(p.id) ?? 0),
        },
        { header: "Inkoopprijs", opmaak: "bedrag", value: (p) => p.inkoopprijs },
        { header: "Statiegeld per stuk", opmaak: "bedrag", value: (p) => p.statiegeldPerStuk },
        { header: "Statiegeld per verpakking", opmaak: "bedrag", value: (p) => p.statiegeldPerVerpakking },
        {
          header: "Voorraadwaarde",
          opmaak: "bedrag",
          value: (p) => (voorraadPerProduct.get(p.id) ?? 0) * p.inkoopprijs,
        },
      ],
      totalen: { 0: "Totale voorraadwaarde", 11: totaleWaarde },
    });
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`"${product.naam}" verwijderen?`)) return;
    setActieFout(null);
    try {
      await verwijderProduct(product.id);
    } catch {
      setActieFout(
        `"${product.naam}" kan niet verwijderd worden omdat er al boekingen aan gekoppeld zijn. ` +
          "Dat is bewust: anders zou de historie niet meer kloppen."
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="drankvoorraad"
        title="Producten"
        toelichting="Barcode, eenheid en prijzen bepalen wat er bij tellen en marge gebeurt. Producten met boekingen kun je niet verwijderen."
        actions={
          <>
            {magBeheren ? (
              <Button
                icon="plus"
                iconPosition="leading"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Nieuw product
              </Button>
            ) : null}
            <ActieMenu
              label="Exporteren"
              items={[{ label: "Excel-bestand", onClick: () => void handleExport() }]}
            />
          </>
        }
      />

      <ProductFilters value={filters} onChange={setFilters} producten={state.producten} />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      {laden ? (
        <p className="app-laden">Bezig met laden…</p>
      ) : (
        <Card className="card--tabel">
          <KaartKop
            titel={`${zichtbaar.length} ${zichtbaar.length === 1 ? "product" : "producten"}`}
            sub="voorraad over alle locaties"
            rechts={
              <span className="kaart-kop__sub">
                totale voorraadwaarde <strong>{formatCurrency(totaleWaarde)}</strong>
              </span>
            }
          />
          <ProductTable
            producten={zichtbaar}
            voorraad={state.voorraad}
            magBeheren={magBeheren}
            magVerwijderen={magVerwijderen}
            onEdit={(product) => {
              setEditing(product);
              setFormOpen(true);
            }}
            onDelete={handleDelete}
          />
        </Card>
      )}

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
    </>
  );
}
