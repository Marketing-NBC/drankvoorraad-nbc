import { useState } from "react";
import { Button, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Product } from "../../data/types";
import { exporteerNaarExcel } from "../../utils/excel";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { ProductForm } from "./ProductForm";
import { ProductTable } from "./ProductTable";

export function Productbeheer() {
  const { state, laden, fout, herlaad, verwijderProduct } = useAppState();
  const { mag } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);

  const magBeheren = mag("beheerder", "magazijnmedewerker");
  const magVerwijderen = mag("beheerder");

  async function handleExport() {
    const voorraadPerProduct = new Map<string, number>();
    for (const v of state.voorraad) {
      voorraadPerProduct.set(v.productId, (voorraadPerProduct.get(v.productId) ?? 0) + v.aantal);
    }
    await exporteerNaarExcel<Product>({
      bestandsnaam: `productenlijst-${new Date().toISOString().slice(0, 10)}`,
      titel: "Productenlijst",
      ondertitel: `${state.producten.length} producten · voorraad over alle locaties`,
      rijen: state.producten,
      kolommen: [
        { header: "Naam", value: (p) => p.naam },
        { header: "Categorie", value: (p) => p.categorie },
        { header: "Eenheid", value: (p) => p.eenheid },
        { header: "Barcode", value: (p) => p.barcode ?? "" },
        { header: "Leverancier", value: (p) => p.leverancier ?? "" },
        { header: "Voorraad", opmaak: "getal", value: (p) => voorraadPerProduct.get(p.id) ?? 0 },
        { header: "Inkoopprijs", opmaak: "bedrag", value: (p) => p.inkoopprijs },
        { header: "Verkoopprijs", opmaak: "bedrag", value: (p) => p.verkoopprijs },
        {
          header: "Voorraadwaarde",
          opmaak: "bedrag",
          value: (p) => (voorraadPerProduct.get(p.id) ?? 0) * p.inkoopprijs,
        },
      ],
      totalen: {
        0: "Totale voorraadwaarde",
        8: state.producten.reduce((som, p) => som + (voorraadPerProduct.get(p.id) ?? 0) * p.inkoopprijs, 0),
      },
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

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      {laden ? (
        <p className="app-laden">Bezig met laden…</p>
      ) : (
        <Card>
          <ProductTable
            producten={state.producten}
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
