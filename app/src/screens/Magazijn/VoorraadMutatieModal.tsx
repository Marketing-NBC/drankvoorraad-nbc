import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { MutatieType } from "../../data/types";

export type MagazijnActie = "inkoop" | "verplaatsen" | "beschadigd" | "correctie";

const titels: Record<MagazijnActie, string> = {
  inkoop: "Voorraad inboeken",
  verplaatsen: "Voorraad verplaatsen",
  beschadigd: "Afschrijven",
  correctie: "Voorraad corrigeren",
};

const toelichting: Record<MagazijnActie, string> = {
  inkoop: "Nieuwe levering toevoegen aan een locatie.",
  verplaatsen: "Voorraad van de ene locatie naar de andere brengen.",
  beschadigd: "Beschadigde of weggegooide producten afboeken. Dit telt mee als derving.",
  correctie: "Handmatige correctie na een telling of vergissing. Gebruik een negatief aantal om af te boeken.",
};

export function VoorraadMutatieModal({
  open,
  onClose,
  actie,
  standaardLocatieId,
  onNieuwProduct,
}: {
  open: boolean;
  onClose: () => void;
  actie: MagazijnActie;
  standaardLocatieId?: string;
  /** Onbekende barcode gescand — opent het productformulier met de code alvast ingevuld. */
  onNieuwProduct?: (barcode: string) => void;
}) {
  const { state, voegMutatieToe } = useAppState();
  const [productId, setProductId] = useState("");
  const [vanLocatieId, setVanLocatieId] = useState("");
  const [naarLocatieId, setNaarLocatieId] = useState("");
  const [aantal, setAantal] = useState("");
  const [notitie, setNotitie] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(state.producten[0]?.id ?? "");
    setVanLocatieId(standaardLocatieId ?? state.locaties[0]?.id ?? "");
    setNaarLocatieId(state.locaties.find((l) => l.id !== standaardLocatieId)?.id ?? "");
    setAantal("");
    setNotitie("");
    setFout(null);
  }, [open, actie, standaardLocatieId, state.producten, state.locaties]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const aantalGetal = Number(aantal);

    if (!productId) return setFout("Kies een product.");
    if (!aantalGetal || Number.isNaN(aantalGetal)) return setFout("Vul een aantal in.");
    if (actie !== "correctie" && aantalGetal <= 0) return setFout("Vul een aantal groter dan 0 in.");
    if (actie === "verplaatsen" && vanLocatieId === naarLocatieId) {
      return setFout("Kies twee verschillende locaties.");
    }

    // Een correctie met een negatief aantal is een afboeking: draai de richting om
    // en houd het aantal positief, zodat de voorraadtrigger correct rekent.
    const negatieveCorrectie = actie === "correctie" && aantalGetal < 0;
    const absAantal = Math.abs(aantalGetal);

    const velden: {
      type: MutatieType;
      vanLocatieId?: string;
      naarLocatieId?: string;
    } =
      actie === "inkoop"
        ? { type: "inkoop", naarLocatieId: vanLocatieId }
        : actie === "verplaatsen"
          ? { type: "magazijn-naar-magazijn", vanLocatieId, naarLocatieId }
          : actie === "beschadigd"
            ? { type: "beschadigd", vanLocatieId }
            : negatieveCorrectie
              ? { type: "correctie", vanLocatieId }
              : { type: "correctie", naarLocatieId: vanLocatieId };

    setBezig(true);
    try {
      await voegMutatieToe({
        productId,
        aantal: absAantal,
        notitie: notitie.trim() || undefined,
        ...velden,
      });
      onClose();
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  const locatieOpties = state.locaties.map((l) => ({ value: l.id, label: l.naam }));
  const eersteLocatieLabel =
    actie === "inkoop" ? "Naar locatie" : actie === "verplaatsen" ? "Vanuit locatie" : "Locatie";

  return (
    <Modal open={open} onClose={onClose} title={titels[actie]}>
      <form className="product-form" onSubmit={handleSubmit}>
        <p className="modal-toelichting">{toelichting[actie]}</p>

        <ProductKiezer
          producten={state.producten}
          productId={productId}
          onProductIdChange={setProductId}
          onOnbekendeBarcode={onNieuwProduct}
        />

        <div className="field-group">
          <label className="field-group__label" htmlFor="mutatie-locatie">{eersteLocatieLabel}</label>
          <Select
            id="mutatie-locatie"
            aria-label={eersteLocatieLabel}
            value={vanLocatieId}
            onChange={(e) => setVanLocatieId(e.target.value)}
            options={locatieOpties}
          />
        </div>

        {actie === "verplaatsen" ? (
          <div className="field-group">
            <label className="field-group__label" htmlFor="mutatie-naar">Naar locatie</label>
            <Select
              id="mutatie-naar"
              aria-label="Naar locatie"
              value={naarLocatieId}
              onChange={(e) => setNaarLocatieId(e.target.value)}
              options={locatieOpties}
            />
          </div>
        ) : null}

        <div className="field-group">
          <label className="field-group__label" htmlFor="mutatie-aantal">
            Aantal
            {actie === "correctie" ? (
              <span className="field-group__hint">negatief = afboeken</span>
            ) : null}
          </label>
          <Input
            id="mutatie-aantal"
            type="number"
            step={1}
            {...(actie !== "correctie" ? { min: 1 } : {})}
            value={aantal}
            onChange={(e) => setAantal(e.target.value)}
          />
        </div>

        {actie === "beschadigd" || actie === "correctie" ? (
          <div className="field-group">
            <label className="field-group__label" htmlFor="mutatie-notitie">Reden</label>
            <Input
              id="mutatie-notitie"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder={actie === "beschadigd" ? "bijv. gebroken bij transport" : "bijv. telverschil"}
            />
          </div>
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
