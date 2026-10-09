import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../design-system";
import { AantalStepper } from "../../components/ui/AantalStepper";
import { Modal } from "../../components/ui/Modal";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { productVerbruikPerEvenement } from "../../data/calculations";
import type { Product } from "../../data/types";
import { invoer, omschrijfAantal, verpakkingLabel } from "../../data/verpakking";
import { foutBericht } from "../../utils/fouten";
import { formatNumber } from "../../utils/format";

export type BoekingRichting = "uitgifte" | "retour";

export function BookingModal({
  open,
  onClose,
  evenementId,
  richting,
  producten,
  standaardProductId,
}: {
  open: boolean;
  onClose: () => void;
  evenementId: string;
  richting: BoekingRichting;
  producten: Product[];
  /** Vooraf gekozen product — gezet door de snelknoppen in de boekingstabel. */
  standaardProductId?: string;
}) {
  const { voegMutatieToe, uitgiftelocatie, state, mutatiesPerEvenement } = useAppState();
  const [productId, setProductId] = useState("");
  const [locatieId, setLocatieId] = useState("");
  const [aantal, setAantal] = useState(0);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  /* Koffie en water hebben geen voorraad om uit te geven, en de kantine en de
     kroeg mogen niet aan een evenement hangen — dat weigert de database ook. */
  const boekbareProducten = producten.filter((p) => !p.voorraadloos);
  const magazijnen = state.locaties.filter(
    (l) => (l.type === "magazijn" || l.type === "koelcel") && !l.voorPersoneel
  );

  const product = boekbareProducten.find((p) => p.id === productId) ?? null;
  const invoerVorm = product ? invoer(product) : { label: "Aantal", eenheid: "", factor: 1 };

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
    const aantalGetal = aantal;
    if (!aantalGetal || aantalGetal <= 0) return null;

    const regels = productVerbruikPerEvenement(mutatiesPerEvenement.get(evenementId) ?? []);
    const regel = regels.find((r) => r.productId === productId);
    const nogOpenstaand = (regel?.aantalUitgegeven ?? 0) - (regel?.aantalRetour ?? 0);
    const gebooktInStuks = aantalGetal * (product ? invoer(product).factor : 1);
    if (gebooktInStuks <= nogOpenstaand) return null;

    return { nogOpenstaand, product };
  })();

  useEffect(() => {
    if (!open) return;
    setProductId(standaardProductId ?? producten[0]?.id ?? "");
    /* Uitgifte komt altijd uit Koelcel NBC (Robin: "nooit wat anders"), ook
       bij Green Village. Retour gaat daar ook standaard heen, maar mag naar
       een andere koelcel of het hoofdmagazijn. */
    setLocatieId(uitgiftelocatie?.id ?? magazijnen[0]?.id ?? "");
    setAantal(0);
    setFout(null);
    // Alleen op `open` en het vooraf gekozen product: `producten` en
    // `uitgiftelocatie` komen uit de gedeelde state en krijgen bij elke
    // achtergrondverversing een nieuwe referentie. In de dependencies zouden
    // ze het formulier tijdens het invullen wissen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, standaardProductId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const aantalGetal = aantal;
    if (!productId) {
      setFout("Kies een product.");
      return;
    }
    if (!aantalGetal || aantalGetal <= 0) {
      setFout("Vul een aantal groter dan 0 in.");
      return;
    }
    if (!Number.isInteger(aantalGetal)) {
      setFout("Vul een heel aantal in.");
      return;
    }
    const locatie = richting === "uitgifte" ? uitgiftelocatie?.id : locatieId;
    if (!locatie) {
      setFout(
        richting === "uitgifte"
          ? "Koelcel NBC is niet gevonden. Vraag de beheerder om de locaties na te kijken."
          : "Kies een magazijnlocatie."
      );
      return;
    }

    setBezig(true);
    try {
      await voegMutatieToe({
        productId,
        /* Kratten in, stuks opgeslagen — zie src/data/verpakking.ts. */
        aantal: aantalGetal * invoerVorm.factor,
        evenementId,
        ...(richting === "uitgifte"
          ? { type: "magazijn-naar-evenement", vanLocatieId: locatie }
          : { type: "evenement-naar-magazijn", naarLocatieId: locatie }),
      });
      onClose();
    } catch (err) {
      /* Een weigering van de database (afgerond evenement) zegt zelf wat er
         mis is; een haperende verbinding komt hier niet, die gaat de wachtrij in. */
      setFout(foutBericht(err) || "Boeken is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={richting === "uitgifte" ? "Product boeken" : "Retour boeken"}>
      <form className="product-form" onSubmit={handleSubmit}>
        <ProductKiezer
          producten={boekbareProducten}
          productId={productId}
          onProductIdChange={setProductId}
          onOnbekendeBarcode={() =>
            setFout("Onbekende barcode. Koppel de code eerst aan een product via Producten.")
          }
        />
        {richting === "uitgifte" ? (
          <p className="veld-toelichting">
            Uit {uitgiftelocatie?.naam ?? "Koelcel NBC"} — daar komt alles voor een evenement vandaan.
          </p>
        ) : (
          <div className="field-group">
            <label className="field-group__label" htmlFor="boeking-locatie">Terug naar locatie</label>
            <Select
              id="boeking-locatie"
              aria-label="Locatie"
              value={locatieId}
              onChange={(e) => setLocatieId(e.target.value)}
              options={magazijnen.map((l) => ({ value: l.id, label: l.naam }))}
            />
          </div>
        )}
        <div className="field-group">
          <label className="field-group__label" htmlFor="boeking-aantal">
            {invoerVorm.label}
            {product && invoerVorm.factor > 1 ? (
              <span className="field-group__hint">1 {product.verpakking} = {verpakkingLabel(product)}</span>
            ) : null}
          </label>
          <AantalStepper
            id="boeking-aantal"
            ariaLabel={invoerVorm.label}
            waarde={aantal}
            onChange={setAantal}
          />
        </div>
        {teveelRetour ? (
          <p className="melding-waarschuwing">
            Er staat nog{" "}
            <strong>
              {teveelRetour.product
                ? omschrijfAantal(teveelRetour.product, teveelRetour.nogOpenstaand)
                : formatNumber(teveelRetour.nogOpenstaand)}{" "}
              {teveelRetour.product?.eenheid ?? ""}
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
