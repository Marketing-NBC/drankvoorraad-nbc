import { useState } from "react";
import { Badge, Link } from "../../design-system";
import type { Product } from "../../data/types";
import { BarcodeInvoer, BarcodeScanner } from "./BarcodeScanner";
import { Select } from "./Select";

/**
 * Productkeuze met twee gelijkwaardige manieren: scannen (camera of fysieke
 * scanner) en handmatig kiezen uit de lijst. Handmatig blijft altijd
 * beschikbaar — fusten en losse producten hebben vaak geen streepjescode.
 */
export function ProductKiezer({
  producten,
  productId,
  onProductIdChange,
  onOnbekendeBarcode,
}: {
  producten: Product[];
  productId: string;
  onProductIdChange: (id: string) => void;
  /** Aangeroepen wanneer een gescande code bij geen enkel product hoort. */
  onOnbekendeBarcode?: (barcode: string) => void;
}) {
  const [modus, setModus] = useState<"handmatig" | "scannen">("handmatig");
  const [handmatigeCode, setHandmatigeCode] = useState("");
  const [melding, setMelding] = useState<string | null>(null);
  const [laatstGescand, setLaatstGescand] = useState<string | null>(null);
  /** Camera onbeschikbaar (geen camera, of toestemming geweigerd). We blijven
   *  wél in scanmodus: een losse USB/Bluetooth-scanner werkt via het invoerveld. */
  const [cameraFout, setCameraFout] = useState<string | null>(null);

  function verwerkCode(code: string) {
    const genormaliseerd = code.trim();
    if (!genormaliseerd) return;

    const gevonden = producten.find((p) => p.barcode && p.barcode === genormaliseerd);
    if (gevonden) {
      onProductIdChange(gevonden.id);
      setLaatstGescand(gevonden.naam);
      setMelding(null);
      setHandmatigeCode("");
      setModus("handmatig");
      return;
    }

    setLaatstGescand(null);
    setMelding(`Barcode ${genormaliseerd} hoort nog bij geen enkel product.`);
    onOnbekendeBarcode?.(genormaliseerd);
  }

  return (
    <div className="product-kiezer">
      <div className="product-kiezer__kop">
        <span className="field-group__label">Product</span>
        <Link
          icon={null}
          onClick={() => {
            setMelding(null);
            setCameraFout(null);
            setModus(modus === "scannen" ? "handmatig" : "scannen");
          }}
        >
          {modus === "scannen" ? "Handmatig kiezen" : "Barcode scannen"}
        </Link>
      </div>

      {modus === "scannen" ? (
        <>
          <BarcodeScanner
            actief={cameraFout === null}
            onGevonden={verwerkCode}
            onFout={setCameraFout}
          />
          {cameraFout ? <p className="scanner__melding">{cameraFout}</p> : null}
          <div className="field-group">
            <label className="field-group__label" htmlFor="barcode-handmatig">
              {cameraFout ? "Typ of scan de code" : "Of typ de code"}{" "}
              <span className="field-group__hint">werkt ook met een losse scanner</span>
            </label>
            <BarcodeInvoer
              waarde={handmatigeCode}
              onChange={setHandmatigeCode}
              onBevestig={verwerkCode}
            />
          </div>
        </>
      ) : (
        <Select
          aria-label="Product"
          value={productId}
          onChange={(e) => {
            onProductIdChange(e.target.value);
            setLaatstGescand(null);
          }}
          options={producten.map((p) => ({
            value: p.id,
            label: `${p.naam} (${p.eenheid})`,
          }))}
        />
      )}

      {laatstGescand ? (
        <p className="product-kiezer__bevestiging">
          <Badge variant="success" icon="check">gescand</Badge> {laatstGescand}
        </p>
      ) : null}
      {melding ? <p className="form-error">{melding}</p> : null}
    </div>
  );
}
