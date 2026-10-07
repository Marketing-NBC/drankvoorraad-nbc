import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Link } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { BarcodeScanner } from "../../components/ui/BarcodeScanner";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Product, ProductCategorie } from "../../data/types";
import { foutBericht } from "../../utils/fouten";

const categorieOptions: { value: ProductCategorie; label: string }[] = [
  { value: "bier", label: "Bier" },
  { value: "wijn", label: "Wijn" },
  { value: "fris", label: "Fris" },
  { value: "sterke drank", label: "Sterke drank" },
  { value: "koffie", label: "Koffie en thee" },
  { value: "water", label: "Water uit de tap" },
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
  /* Prijzen en statiegeld zijn alleen voor de beheerder. Een
     magazijnmedewerker die een gescand product aanmaakt laat ze leeg; de
     beheerder vult ze later aan. */
  const { zietBedragen } = useAuth();
  const [naam, setNaam] = useState("");
  const [categorie, setCategorie] = useState<ProductCategorie>("bier");
  const [inkoopprijs, setInkoopprijs] = useState("");
  const [eenheid, setEenheid] = useState("");
  const [inhoud, setInhoud] = useState("");
  const [verpakking, setVerpakking] = useState("");
  const [stuksPerVerpakking, setStuksPerVerpakking] = useState("1");
  const [alleenPerVerpakking, setAlleenPerVerpakking] = useState(false);
  const [statiegeldPerStuk, setStatiegeldPerStuk] = useState("0");
  const [statiegeldPerVerpakking, setStatiegeldPerVerpakking] = useState("0");
  const [voorraadloos, setVoorraadloos] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [barcodeVerpakking, setBarcodeVerpakking] = useState("");
  const [leverancier, setLeverancier] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  /** Welk barcodeveld de camera vult, of null als er niet gescand wordt. */
  const [scannen, setScannen] = useState<"stuk" | "verpakking" | null>(null);

  useEffect(() => {
    if (!open) return;
    setNaam(product?.naam ?? "");
    setCategorie(product?.categorie ?? "bier");
    setInkoopprijs(product ? String(product.inkoopprijs) : "");
    setEenheid(product?.eenheid ?? "");
    setInhoud(product?.inhoud ?? "");
    setVerpakking(product?.verpakking ?? "");
    setStuksPerVerpakking(String(product?.stuksPerVerpakking ?? 1));
    setAlleenPerVerpakking(product?.alleenPerVerpakking ?? false);
    setStatiegeldPerStuk(String(product?.statiegeldPerStuk ?? 0));
    setStatiegeldPerVerpakking(String(product?.statiegeldPerVerpakking ?? 0));
    setVoorraadloos(product?.voorraadloos ?? false);
    setBarcode(product?.barcode ?? barcodeVooraf ?? "");
    setBarcodeVerpakking(product?.barcodeVerpakking ?? "");
    setLeverancier(product?.leverancier ?? "");
    setFout(null);
    setScannen(null);
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
    const perStuk = Number(statiegeldPerStuk);
    const perVerpakking = Number(statiegeldPerVerpakking);
    const stuks = Number(stuksPerVerpakking);
    if ([inkoop, perStuk, perVerpakking].some((n) => Number.isNaN(n) || n < 0)) {
      setFout("Vul geldige bedragen in.");
      return;
    }
    if (!Number.isInteger(stuks) || stuks < 1) {
      setFout("Het aantal stuks per verpakking is een heel getal van 1 of hoger.");
      return;
    }
    if (alleenPerVerpakking && (!verpakking.trim() || stuks < 2)) {
      setFout("Alleen per verpakking boeken kan pas met een verpakkingsnaam en meer dan één stuk erin.");
      return;
    }

    if (barcode.trim() && barcode.trim() === barcodeVerpakking.trim()) {
      setFout("De barcode van het stuk en die van de verpakking kunnen niet dezelfde zijn.");
      return;
    }

    const velden = {
      naam: naam.trim(),
      categorie,
      inkoopprijs: inkoop,
      eenheid: eenheid.trim(),
      inhoud: inhoud.trim() || undefined,
      verpakking: verpakking.trim() || undefined,
      stuksPerVerpakking: stuks,
      alleenPerVerpakking,
      statiegeldPerStuk: perStuk,
      statiegeldPerVerpakking: perVerpakking,
      voorraadloos,
      barcode: barcode.trim() || undefined,
      barcodeVerpakking: barcodeVerpakking.trim() || undefined,
      leverancier: leverancier.trim() || undefined,
    };

    setBezig(true);
    try {
      if (product) {
        // Zonder bedragen in beeld ook geen bedragen meesturen.
        const { inkoopprijs: _i, statiegeldPerStuk: _s, statiegeldPerVerpakking: _v, ...basis } = velden;
        await wijzigProduct(product.id, zietBedragen ? velden : basis);
      }
      else await voegProductToe(velden);
      onClose();
    } catch (err) {
      const bericht = foutBericht(err);
      setFout(
        bericht.includes("duplicate") || bericht.includes("unique") || bericht.includes("ander product")
          ? "Deze naam of barcode is al aan een ander product gekoppeld."
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
            <Input id="product-eenheid" placeholder="fles, fust, kop…" value={eenheid} onChange={(e) => setEenheid(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor="product-inhoud">
              Inhoud <span className="field-group__hint">per stuk</span>
            </label>
            <Input id="product-inhoud" placeholder="0,2 L" value={inhoud} onChange={(e) => setInhoud(e.target.value)} />
          </div>
          {zietBedragen ? (
            <div className="field-group">
              <label className="field-group__label" htmlFor="product-inkoop">
                Inkoopprijs <span className="field-group__hint">ex btw, per stuk</span>
              </label>
              <Input id="product-inkoop" type="number" min={0} step="0.01" value={inkoopprijs} onChange={(e) => setInkoopprijs(e.target.value)} />
            </div>
          ) : null}
        </div>

        {/* Verpakking bepaalt niet wát er geteld wordt — dat blijven stuks —
            maar hoe er ingevoerd wordt. Zie src/data/verpakking.ts. */}
        <fieldset className="veldgroep-kader">
          <legend>Verpakking</legend>
          <div className="field-row">
            <div className="field-group">
              <label className="field-group__label" htmlFor="product-verpakking">
                Naam <span className="field-group__hint">leeg = gaat los</span>
              </label>
              <Input id="product-verpakking" placeholder="krat" value={verpakking} onChange={(e) => setVerpakking(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-group__label" htmlFor="product-stuks">Stuks per verpakking</label>
              <Input id="product-stuks" type="number" min={1} step={1} value={stuksPerVerpakking} onChange={(e) => setStuksPerVerpakking(e.target.value)} />
            </div>
          </div>
          <label className="keuzevakje">
            <input
              type="checkbox"
              checked={alleenPerVerpakking}
              onChange={(e) => setAlleenPerVerpakking(e.target.checked)}
            />
            <span>
              Nooit los boeken
              <span className="field-group__hint">
                het magazijn vult kratten in, de app rekent naar stuks — voor de flesjes van 0,2 L
              </span>
            </span>
          </label>
          {zietBedragen ? (
          <div className="field-row">
            <div className="field-group">
              <label className="field-group__label" htmlFor="product-statiegeld-stuk">Statiegeld per stuk</label>
              <Input id="product-statiegeld-stuk" type="number" min={0} step="0.01" value={statiegeldPerStuk} onChange={(e) => setStatiegeldPerStuk(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-group__label" htmlFor="product-statiegeld-verpakking">Statiegeld per verpakking</label>
              <Input id="product-statiegeld-verpakking" type="number" min={0} step="0.01" value={statiegeldPerVerpakking} onChange={(e) => setStatiegeldPerVerpakking(e.target.value)} />
            </div>
          </div>
          ) : null}
        </fieldset>

        <label className="keuzevakje">
          <input type="checkbox" checked={voorraadloos} onChange={(e) => setVoorraadloos(e.target.checked)} />
          <span>
            Geen voorraad bijhouden
            <span className="field-group__hint">
              koffie en water uit een machine: het verbruik komt van de teller, niet uit het magazijn
            </span>
          </span>
        </label>

        {/* Twee barcodes: die op het flesje en die op de krat. In het magazijn
            scan je meestal de krat; beide leiden naar dit product. */}
        <div className="field-group">
          <div className="product-kiezer__kop">
            <label className="field-group__label" htmlFor="product-barcode">
              Barcode stuk <span className="field-group__hint">op het flesje of fust</span>
            </label>
            <Link icon={null} onClick={() => setScannen("stuk")}>
              Scannen
            </Link>
          </div>
          <Input id="product-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
        <div className="field-group">
          <div className="product-kiezer__kop">
            <label className="field-group__label" htmlFor="product-barcode-verpakking">
              Barcode verpakking{" "}
              <span className="field-group__hint">op de {verpakking.trim() || "krat of doos"}</span>
            </label>
            <Link icon={null} onClick={() => setScannen("verpakking")}>
              Scannen
            </Link>
          </div>
          <Input
            id="product-barcode-verpakking"
            value={barcodeVerpakking}
            onChange={(e) => setBarcodeVerpakking(e.target.value)}
          />
        </div>
        <BarcodeScanner
          open={scannen !== null}
          titel={scannen === "verpakking" ? "Barcode verpakking" : "Barcode stuk"}
          context={naam.trim() || undefined}
          onGevonden={(code) => {
            if (scannen === "verpakking") setBarcodeVerpakking(code);
            else setBarcode(code);
          }}
          onSluit={() => setScannen(null)}
        />
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
