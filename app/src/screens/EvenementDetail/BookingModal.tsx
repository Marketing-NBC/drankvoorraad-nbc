import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { productVerbruikPerEvenement } from "../../data/calculations";
import type { Product } from "../../data/types";
import { formatNumber } from "../../utils/format";

export type BoekingRichting = "uitgifte" | "retour";

export function BookingModal({
  open,
  onClose,
  evenementId,
  richting,
  producten,
}: {
  open: boolean;
  onClose: () => void;
  evenementId: string;
  richting: BoekingRichting;
  producten: Product[];
}) {
  const { voegMutatieToe, hoofdmagazijn, state, mutatiesPerEvenement } = useAppState();
  const [productId, setProductId] = useState("");
  const [locatieId, setLocatieId] = useState("");
  const [aantal, setAantal] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const magazijnen = state.locaties.filter((l) => l.type === "magazijn" || l.type === "koelcel");

  /**
   * Waarschuwing bij een retour die groter is dan wat er ooit naar dit
   * evenement ging.
   *
   * Bewust een melding en geen blokkade: bij een gedeelde bar kan er drank
   * terugkomen die onder een ander evenement is uitgegeven, en dan moet je
   * gewoon door kunnen. Maar omdat mutaties append-only zijn, is een foutieve
   * retour later alleen recht te zetten met een tegenboeking — dus het is de
   * moeite waard om er hier één zin aan te wijden.
   */
  const teveelRetour = (() => {
    if (richting !== "retour" || !productId) return null;
    const aantalGetal = Number(aantal);
    if (!aantalGetal || aantalGetal <= 0) return null;

    const regels = productVerbruikPerEvenement(mutatiesPerEvenement.get(evenementId) ?? []);
    const regel = regels.find((r) => r.productId === productId);
    const nogOpenstaand = (regel?.aantalUitgegeven ?? 0) - (regel?.aantalRetour ?? 0);
    if (aantalGetal <= nogOpenstaand) return null;

    return {
      nogOpenstaand,
      product: producten.find((p) => p.id === productId),
    };
  })();

  useEffect(() => {
    if (!open) return;
    setProductId(producten[0]?.id ?? "");
    setLocatieId(hoofdmagazijn?.id ?? magazijnen[0]?.id ?? "");
    setAantal("");
    setFout(null);
    // Alleen op `open`: `producten` en `hoofdmagazijn` komen uit de gedeelde
    // state en krijgen bij elke achtergrondverversing een nieuwe referentie.
    // In de dependencies zouden ze het formulier tijdens het invullen wissen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const aantalGetal = Number(aantal);
    if (!productId) {
      setFout("Kies een product.");
      return;
    }
    if (!aantalGetal || aantalGetal <= 0) {
      setFout("Vul een aantal groter dan 0 in.");
      return;
    }
    if (!locatieId) {
      setFout("Kies een magazijnlocatie.");
      return;
    }

    setBezig(true);
    try {
      await voegMutatieToe({
        productId,
        aantal: aantalGetal,
        evenementId,
        ...(richting === "uitgifte"
          ? { type: "magazijn-naar-evenement", vanLocatieId: locatieId }
          : { type: "evenement-naar-magazijn", naarLocatieId: locatieId }),
      });
      onClose();
    } catch {
      setFout("Boeken is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={richting === "uitgifte" ? "Product boeken" : "Retour boeken"}>
      <form className="product-form" onSubmit={handleSubmit}>
        <ProductKiezer
          producten={producten}
          productId={productId}
          onProductIdChange={setProductId}
          onOnbekendeBarcode={() =>
            setFout("Onbekende barcode. Koppel de code eerst aan een product via Producten.")
          }
        />
        <div className="field-group">
          <label className="field-group__label" htmlFor="boeking-locatie">
            {richting === "uitgifte" ? "Vanuit locatie" : "Terug naar locatie"}
          </label>
          <Select
            id="boeking-locatie"
            aria-label="Locatie"
            value={locatieId}
            onChange={(e) => setLocatieId(e.target.value)}
            options={magazijnen.map((l) => ({ value: l.id, label: l.naam }))}
          />
        </div>
        <div className="field-group">
          <label className="field-group__label" htmlFor="boeking-aantal">Aantal</label>
          <Input
            id="boeking-aantal"
            type="number"
            min={1}
            step={1}
            value={aantal}
            onChange={(e) => setAantal(e.target.value)}
          />
        </div>
        {teveelRetour ? (
          <p className="melding-waarschuwing">
            Er staat nog{" "}
            <strong>
              {formatNumber(teveelRetour.nogOpenstaand)} {teveelRetour.product?.eenheid ?? ""}
            </strong>{" "}
            open bij dit evenement, en je boekt er meer terug. Klopt het aantal, of hoort deze
            retour bij een ander evenement? Je kunt gewoon doorgaan — dit is alleen een seintje.
          </p>
        ) : null}
        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>{bezig ? "Bezig…" : "Bevestigen"}</Button>
        </div>
      </form>
    </Modal>
  );
}
