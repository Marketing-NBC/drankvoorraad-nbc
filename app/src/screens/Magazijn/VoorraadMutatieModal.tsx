import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { AantalStepper } from "../../components/ui/AantalStepper";
import { Modal } from "../../components/ui/Modal";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { MutatieType } from "../../data/types";
import { invoer, losOpLocatie, verpakkingLabel } from "../../data/verpakking";

export type MagazijnActie =
  | "inkoop"
  | "verplaatsen"
  /** Verplaatsen van het hoofdmagazijn naar de kantine of de kroeg. */
  | "aanvullen"
  | "beschadigd"
  | "correctie"
  | "personeelsverbruik";

const titels: Record<MagazijnActie, string> = {
  inkoop: "Voorraad inboeken",
  verplaatsen: "Voorraad verplaatsen",
  aanvullen: "Aanvullen vanuit het magazijn",
  beschadigd: "Afschrijven",
  correctie: "Voorraad corrigeren",
  personeelsverbruik: "Personeelsverbruik boeken",
};

const toelichting: Record<MagazijnActie, string> = {
  inkoop: "Nieuwe levering toevoegen aan een locatie.",
  verplaatsen: "Voorraad van de ene locatie naar de andere brengen.",
  aanvullen:
    "Drank uit het magazijn naar de kantine of de kroeg brengen. Vul losse flesjes in: 12 is 12, ook als het magazijn per krat telt.",
  beschadigd: "Beschadigde of weggegooide producten afboeken. Dit telt mee als derving.",
  correctie: "Handmatige correctie na een telling of vergissing. Gebruik een negatief aantal om af te boeken.",
  personeelsverbruik:
    "Wat het personeel in de kantine of de kroeg heeft opgemaakt. Telt nooit mee bij een evenement.",
};

export function VoorraadMutatieModal({
  open,
  onClose,
  actie,
  standaardLocatieId,
  standaardNaarLocatieId,
  standaardProductId,
  onNieuwProduct,
}: {
  open: boolean;
  onClose: () => void;
  actie: MagazijnActie;
  standaardLocatieId?: string;
  /** Bij verplaatsen en aanvullen: waar het heen gaat. */
  standaardNaarLocatieId?: string;
  /** Vooraf gekozen product — gezet door de snelknoppen in de voorraadtabel. */
  standaardProductId?: string;
  /** Onbekende barcode gescand — opent het productformulier met de code alvast ingevuld. */
  onNieuwProduct?: (barcode: string) => void;
}) {
  const { state, voegMutatieToe, hoofdmagazijn } = useAppState();
  const [productId, setProductId] = useState("");
  const [vanLocatieId, setVanLocatieId] = useState("");
  const [naarLocatieId, setNaarLocatieId] = useState("");
  const [aantal, setAantal] = useState("");
  const [notitie, setNotitie] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  /* Koffie en water hebben geen voorraad om te verplaatsen of af te boeken. */
  const boekbareProducten = state.producten.filter((p) => !p.voorraadloos);

  /* Personeelsverbruik kan alleen áf van een kantine of kroeg — dat dwingt de
     database ook af, maar een keuzelijst met onmogelijke opties is een val. */
  const kiesbareLocaties =
    actie === "personeelsverbruik"
      ? state.locaties.filter((l) => l.voorPersoneel)
      : state.locaties;
  /* Aanvullen gaat altijd naar een kantine of kroeg. */
  const naarOpties = actie === "aanvullen" ? state.locaties.filter((l) => l.voorPersoneel) : state.locaties;
  const verplaatst = actie === "verplaatsen" || actie === "aanvullen";

  const product = boekbareProducten.find((p) => p.id === productId) ?? null;
  /* Raakt de boeking de kantine of de kroeg, dan per flesje in plaats van
     per krat. Zie losOpLocatie in src/data/verpakking.ts. */
  const perStuk = losOpLocatie(
    state.locaties.find((l) => l.id === vanLocatieId),
    verplaatst ? state.locaties.find((l) => l.id === naarLocatieId) : undefined
  );
  const invoerVorm = product ? invoer(product, { los: perStuk }) : { label: "Aantal", eenheid: "", factor: 1 };

  useEffect(() => {
    if (!open) return;
    setProductId(standaardProductId ?? boekbareProducten[0]?.id ?? "");
    setVanLocatieId(
      actie === "personeelsverbruik"
        ? kiesbareLocaties.find((l) => l.id === standaardLocatieId)?.id ?? kiesbareLocaties[0]?.id ?? ""
        : actie === "aanvullen"
          ? standaardLocatieId ?? hoofdmagazijn?.id ?? state.locaties[0]?.id ?? ""
          : standaardLocatieId ?? state.locaties[0]?.id ?? ""
    );
    setNaarLocatieId(
      naarOpties.find((l) => l.id === standaardNaarLocatieId)?.id ??
        naarOpties.find((l) => l.id !== standaardLocatieId)?.id ??
        ""
    );
    setAantal("");
    setNotitie("");
    setFout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actie, standaardLocatieId, standaardNaarLocatieId, standaardProductId, state.producten, state.locaties]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const aantalGetal = Number(aantal);

    if (!productId) return setFout("Kies een product.");
    if (!aantalGetal || Number.isNaN(aantalGetal)) return setFout("Vul een aantal in.");
    if (actie !== "correctie" && aantalGetal <= 0) return setFout("Vul een aantal groter dan 0 in.");
    if (verplaatst && !naarLocatieId) {
      return setFout("Er is nog geen kantine of kroeg om aan te vullen.");
    }
    if (verplaatst && vanLocatieId === naarLocatieId) {
      return setFout("Kies twee verschillende locaties.");
    }
    if (actie === "personeelsverbruik" && !vanLocatieId) {
      return setFout("Er is nog geen locatie voor personeel. Maak eerst de kantine of de kroeg aan.");
    }
    if (!Number.isInteger(aantalGetal)) {
      return setFout("Vul een heel aantal in.");
    }

    // Een correctie met een negatief aantal is een afboeking: draai de richting om
    // en houd het aantal positief, zodat de voorraadtrigger correct rekent.
    const negatieveCorrectie = actie === "correctie" && aantalGetal < 0;
    /* Bij een product dat nooit los gaat vult het magazijn kratten in; de
       voorraad blijft in stuks staan. Zie src/data/verpakking.ts. */
    const absAantal = Math.abs(aantalGetal) * invoerVorm.factor;

    const velden: {
      type: MutatieType;
      vanLocatieId?: string;
      naarLocatieId?: string;
    } =
      actie === "inkoop"
        ? { type: "inkoop", naarLocatieId: vanLocatieId }
        : verplaatst
          ? { type: "magazijn-naar-magazijn", vanLocatieId, naarLocatieId }
          : actie === "beschadigd"
            ? { type: "beschadigd", vanLocatieId }
            : actie === "personeelsverbruik"
              ? { type: "personeelsverbruik", vanLocatieId }
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
    } catch (err) {
      /* De database weigert bijvoorbeeld personeelsverbruik vanaf het
         magazijn. Die melding is duidelijker dan "er ging iets mis", dus die
         laten we staan. */
      const bericht = err instanceof Error ? err.message : "";
      setFout(
        bericht && !bericht.toLowerCase().includes("fetch")
          ? bericht
          : "Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw."
      );
    } finally {
      setBezig(false);
    }
  }

  const locatieOpties = kiesbareLocaties.map((l) => ({ value: l.id, label: l.naam }));
  const naarLocatieOpties = naarOpties.map((l) => ({ value: l.id, label: l.naam }));
  const eersteLocatieLabel =
    actie === "inkoop"
      ? "Naar locatie"
      : verplaatst || actie === "personeelsverbruik"
        ? "Vanuit locatie"
        : "Locatie";

  return (
    <Modal open={open} onClose={onClose} title={titels[actie]}>
      <form className="product-form" onSubmit={handleSubmit}>
        <p className="modal-toelichting">{toelichting[actie]}</p>

        <ProductKiezer
          producten={boekbareProducten}
          productId={productId}
          onProductIdChange={setProductId}
          onOnbekendeBarcode={onNieuwProduct}
          perStuk={perStuk}
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

        {verplaatst ? (
          <div className="field-group">
            <label className="field-group__label" htmlFor="mutatie-naar">Naar locatie</label>
            <Select
              id="mutatie-naar"
              aria-label="Naar locatie"
              value={naarLocatieId}
              onChange={(e) => setNaarLocatieId(e.target.value)}
              options={naarLocatieOpties}
            />
          </div>
        ) : null}

        <div className="field-group">
          <label className="field-group__label" htmlFor="mutatie-aantal">
            {invoerVorm.label}
            {actie === "correctie" ? (
              <span className="field-group__hint">negatief = afboeken</span>
            ) : product && invoerVorm.factor > 1 ? (
              <span className="field-group__hint">1 {product.verpakking} = {verpakkingLabel(product)}</span>
            ) : product && perStuk && product.alleenPerVerpakking ? (
              <span className="field-group__hint">
                per {product.eenheid} · 1 {product.verpakking} = {product.stuksPerVerpakking}
              </span>
            ) : null}
          </label>
          {/* Een correctie mag negatief zijn (afboeken); de rest niet. Daar
              is een stepper met een ondergrens de snelste weg. */}
          {actie === "correctie" ? (
            <Input
              id="mutatie-aantal"
              type="number"
              step={1}
              value={aantal}
              onChange={(e) => setAantal(e.target.value)}
            />
          ) : (
            <AantalStepper
              id="mutatie-aantal"
              ariaLabel={invoerVorm.label}
              waarde={Number(aantal) || 0}
              onChange={(n) => setAantal(String(n))}
            />
          )}
        </div>

        {actie === "beschadigd" || actie === "correctie" || actie === "personeelsverbruik" ? (
          <div className="field-group">
            <label className="field-group__label" htmlFor="mutatie-notitie">
              {actie === "personeelsverbruik" ? "Toelichting" : "Reden"}
            </label>
            <Input
              id="mutatie-notitie"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              placeholder={
                actie === "beschadigd"
                  ? "bijv. gebroken bij transport"
                  : actie === "personeelsverbruik"
                    ? "bijv. week 37"
                    : "bijv. telverschil"
              }
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
