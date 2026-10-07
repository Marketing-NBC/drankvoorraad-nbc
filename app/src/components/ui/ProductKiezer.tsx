import { useState } from "react";
import { Badge, Link } from "../../design-system";
import { zoekOpBarcode } from "../../data/barcode";
import type { Product } from "../../data/types";
import { eenheidLabel, heeftVerpakking, verpakkingLabel } from "../../data/verpakking";
import { BarcodeScanner, type ScanUitkomst } from "./BarcodeScanner";
import { Select } from "./Select";

/**
 * Productkeuze met twee gelijkwaardige manieren: scannen (camera of fysieke
 * scanner, in het scanscherm) en handmatig kiezen uit de lijst. De lijst
 * blijft altijd staan — fusten en losse producten hebben vaak geen
 * streepjescode.
 */
export function ProductKiezer({
  producten,
  productId,
  onProductIdChange,
  onOnbekendeBarcode,
  perStuk = false,
}: {
  producten: Product[];
  productId: string;
  onProductIdChange: (id: string) => void;
  /** Aangeroepen wanneer een gescande code bij geen enkel product hoort. */
  onOnbekendeBarcode?: (barcode: string) => void;
  /** Kantine of kroeg: er wordt per flesje ingevuld, dus geen krat in de naam. */
  perStuk?: boolean;
}) {
  const [scannen, setScannen] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [laatstGescand, setLaatstGescand] = useState<string | null>(null);

  function verwerkCode(code: string): ScanUitkomst {
    const gevonden = zoekOpBarcode(producten, code);
    if (gevonden) {
      onProductIdChange(gevonden.id);
      setLaatstGescand(gevonden.naam);
      setMelding(null);
      return;
    }

    const tekst = `Barcode ${code} hoort nog bij geen enkel product.`;
    setLaatstGescand(null);
    setMelding(tekst);
    onOnbekendeBarcode?.(code);
    return tekst;
  }

  return (
    <div className="product-kiezer">
      <div className="product-kiezer__kop">
        <span className="field-group__label">Product</span>
        <Link
          icon={null}
          onClick={() => {
            setMelding(null);
            setScannen(true);
          }}
        >
          Barcode scannen
        </Link>
      </div>

      <BarcodeScanner open={scannen} onGevonden={verwerkCode} onSluit={() => setScannen(false)} />

      <Select
        aria-label="Product"
        value={productId}
        onChange={(e) => {
          onProductIdChange(e.target.value);
          setLaatstGescand(null);
        }}
        /* Bij een product dat nooit los gaat hoort de verpakking in de naam:
           wie "Swinckels 0,3 L (fles)" leest, vult flesjes in. */
        options={producten.map((p) => ({
          value: p.id,
          label: `${p.naam} (${
            !perStuk && p.alleenPerVerpakking && heeftVerpakking(p) ? verpakkingLabel(p) : eenheidLabel(p)
          })`,
        }))}
      />

      {laatstGescand ? (
        <p className="product-kiezer__bevestiging">
          <Badge variant="success" icon="check">gescand</Badge> {laatstGescand}
        </p>
      ) : null}
      {melding ? <p className="form-error">{melding}</p> : null}
    </div>
  );
}
