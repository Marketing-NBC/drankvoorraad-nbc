import { useState } from "react";
import { Button, Card } from "../../design-system";
import { KaartKop } from "../../components/ui/KaartKop";
import { Select } from "../../components/ui/Select";
import { standaardStuksPerEenheid, type Bonvoorstel } from "../../data/bon";
import type { Product } from "../../data/types";

/**
 * Regels van de bon waarvan het artikelnummer nog bij geen product hoort.
 *
 * Kies het product en hoeveel stuks er in één eenheid van de bon zit (een
 * krat van 24, een tray van 6). Met "onthouden" weet de app het de volgende
 * keer zelf; dat wordt opgeslagen in `leverancier_artikelen`.
 */
export function OnbekendeArtikelen({
  regels,
  producten,
  kanOnthouden,
  onKoppel,
  onOverslaan,
}: {
  regels: Bonvoorstel[];
  producten: Product[];
  /** Zonder leverancier is er niets om het artikelnummer aan te hangen. */
  kanOnthouden: boolean;
  onKoppel: (regel: Bonvoorstel, productId: string, stuksPerEenheid: number, onthouden: boolean) => Promise<void>;
  onOverslaan: (regel: Bonvoorstel) => void;
}) {
  if (regels.length === 0) return null;
  return (
    <Card>
      <KaartKop
        titel="Nog koppelen"
        sub={`${regels.length} ${regels.length === 1 ? "regel" : "regels"} van de bon zonder bekend product`}
      />
      <div className="tekort-lijst">
        {regels.map((regel, i) => (
          <OnbekendeRegel
            key={`${regel.regel.artikelnummer ?? "geen"}-${i}`}
            regel={regel}
            producten={producten}
            kanOnthouden={kanOnthouden}
            onKoppel={onKoppel}
            onOverslaan={onOverslaan}
          />
        ))}
      </div>
    </Card>
  );
}

function OnbekendeRegel({
  regel,
  producten,
  kanOnthouden,
  onKoppel,
  onOverslaan,
}: {
  regel: Bonvoorstel;
  producten: Product[];
  kanOnthouden: boolean;
  onKoppel: (regel: Bonvoorstel, productId: string, stuksPerEenheid: number, onthouden: boolean) => Promise<void>;
  onOverslaan: (regel: Bonvoorstel) => void;
}) {
  const [productId, setProductId] = useState("");
  const [stuks, setStuks] = useState("");
  const [onthouden, setOnthouden] = useState(kanOnthouden && Boolean(regel.regel.artikelnummer));
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const product = producten.find((p) => p.id === productId);
  const stuksGetal = Number(stuks || standaardStuksPerEenheid(product));

  async function koppel() {
    if (!productId) return setFout("Kies een product.");
    if (!Number.isInteger(stuksGetal) || stuksGetal <= 0) return setFout("Vul een heel aantal stuks in.");
    setBezig(true);
    setFout(null);
    try {
      await onKoppel(regel, productId, stuksGetal, onthouden);
    } catch {
      setFout("Koppelen is niet gelukt. Probeer het opnieuw.");
      setBezig(false);
    }
  }

  return (
    <div className="tekort-regel">
      <div className="tekort-regel__kop">
        <strong>{regel.regel.omschrijving}</strong>
        <span className="tekort-regel__aantal">
          {regel.eenheden} op de bon
          {regel.regel.artikelnummer ? ` · art. ${regel.regel.artikelnummer}` : ""}
        </span>
      </div>
      <Select
        aria-label={`Product voor ${regel.regel.omschrijving}`}
        value={productId}
        onChange={(e) => {
          setProductId(e.target.value);
          setStuks("");
        }}
        options={[
          { value: "", label: "Kies het product…" },
          ...producten.map((p) => ({ value: p.id, label: p.naam })),
        ]}
      />
      {product ? (
        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor={`stuks-${regel.regel.artikelnummer ?? regel.regel.omschrijving}`}>
              Stuks per eenheid <span className="field-group__hint">krat van 24, tray van 6…</span>
            </label>
            <input
              id={`stuks-${regel.regel.artikelnummer ?? regel.regel.omschrijving}`}
              className="input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={stuks || String(standaardStuksPerEenheid(product))}
              onChange={(e) => setStuks(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      {kanOnthouden && regel.regel.artikelnummer ? (
        <label className="keuzevakje">
          <input type="checkbox" checked={onthouden} onChange={(e) => setOnthouden(e.target.checked)} />
          <span>Onthouden voor de volgende bon</span>
        </label>
      ) : null}
      {fout ? <p className="form-error">{fout}</p> : null}
      <div className="button-row">
        <Button icon={null} size="sm" disabled={bezig} onClick={() => void koppel()}>
          {bezig ? "Bezig…" : "Toevoegen"}
        </Button>
        <Button variant="ghost-dark" size="sm" icon={null} onClick={() => onOverslaan(regel)}>
          Overslaan
        </Button>
      </div>
    </div>
  );
}
