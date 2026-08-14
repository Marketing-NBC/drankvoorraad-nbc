import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Link } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { BarcodeScanner } from "../../components/ui/BarcodeScanner";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { Product, ProductCategorie } from "../../data/types";
import { foutBericht } from "../../utils/fouten";

const categorieOptions: { value: ProductCategorie; label: string }[] = [
  { value: "bier", label: "Bier" },
  { value: "wijn", label: "Wijn" },
  { value: "fris", label: "Fris" },
  { value: "sterke drank", label: "Sterke drank" },
  { value: "overig", label: "Overig" },
];

export function ProductForm({
  open,
  onClose,
  product,
  barcodeVooraf,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  barcodeVooraf?: string;
}) {
  const { voegProductToe, wijzigProduct } = useAppState();
  const [naam, setNaam] = useState("");
  const [categorie, setCategorie] = useState<ProductCategorie>("bier");
  const [inkoopprijs, setInkoopprijs] = useState("");
  const [verkoopprijs, setVerkoopprijs] = useState("");
  const [eenheid, setEenheid] = useState("");
  const [barcode, setBarcode] = useState("");
  const [leverancier, setLeverancier] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [scannen, setScannen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNaam(product?.naam ?? "");
    setCategorie(product?.categorie ?? "bier");
    setInkoopprijs(product ? String(product.inkoopprijs) : "");
    setVerkoopprijs(product ? String(product.verkoopprijs) : "");
    setEenheid(product?.eenheid ?? "");
    setBarcode(product?.barcode ?? barcodeVooraf ?? "");
    setLeverancier(product?.leverancier ?? "");
    setFout(null);
    setScannen(false);
    // Bewust op product?.id en niet op product zelf: dat object krijgt bij elke
    // achtergrondverversing een nieuwe referentie, waardoor het formulier zich
    // midden in het typen zou resetten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id, barcodeVooraf]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!naam.trim() || !eenheid.trim()) {
      setFout("Vul naam en eenheid in.");
      return;
    }
    const inkoop = Number(inkoopprijs);
    const verkoop = Number(verkoopprijs);
    if (Number.isNaN(inkoop) || Number.isNaN(verkoop) || inkoop < 0 || verkoop < 0) {
      setFout("Vul geldige prijzen in.");
      return;
    }

    const velden = {
      naam: naam.trim(),
      categorie,
      inkoopprijs: inkoop,
      verkoopprijs: verkoop,
      eenheid: eenheid.trim(),
      barcode: barcode.trim() || undefined,
      leverancier: leverancier.trim() || undefined,
    };

    setBezig(true);
    try {
      if (product) await wijzigProduct(product.id, velden);
      else await voegProductToe(velden);
      onClose();
    } catch (err) {
      const bericht = foutBericht(err);
      setFout(
        bericht.includes("duplicate") || bericht.includes("unique")
          ? "Deze barcode is al aan een ander product gekoppeld."
          : "Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw."
      );
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Product wijzigen" : "Product toevoegen"}>
      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-group__label" htmlFor="product-naam">Naam</label>
          <Input id="product-naam" value={naam} onChange={(e) => setNaam(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field-group">
            <span className="field-group__label">Categorie</span>
            <Select
              aria-label="Categorie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as ProductCategorie)}
              options={categorieOptions}
            />
          </div>
          <div className="field-group">
            <label className="field-group__label" htmlFor="product-eenheid">Eenheid</label>
            <Input id="product-eenheid" placeholder="fles, blik, fust…" value={eenheid} onChange={(e) => setEenheid(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor="product-inkoop">Inkoopprijs</label>
            <Input id="product-inkoop" type="number" min={0} step="0.01" value={inkoopprijs} onChange={(e) => setInkoopprijs(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-group__label" htmlFor="product-verkoop">Verkoopprijs</label>
            <Input id="product-verkoop" type="number" min={0} step="0.01" value={verkoopprijs} onChange={(e) => setVerkoopprijs(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <div className="product-kiezer__kop">
            <label className="field-group__label" htmlFor="product-barcode">
              Barcode <span className="field-group__hint">leeg laten voor fusten en losse producten</span>
            </label>
            <Link icon={null} onClick={() => setScannen(!scannen)}>
              {scannen ? "Stop met scannen" : "Scannen"}
            </Link>
          </div>
          <Input id="product-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <BarcodeScanner
            actief={scannen}
            onGevonden={(code) => {
              setBarcode(code);
              setScannen(false);
            }}
            onFout={(melding) => {
              setFout(melding);
              setScannen(false);
            }}
          />
        </div>
        <div className="field-group">
          <label className="field-group__label" htmlFor="product-leverancier">Leverancier (optioneel)</label>
          <Input id="product-leverancier" value={leverancier} onChange={(e) => setLeverancier(e.target.value)} />
        </div>
        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig…" : product ? "Opslaan" : "Toevoegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
