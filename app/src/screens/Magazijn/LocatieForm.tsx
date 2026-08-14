import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { Locatie, LocatieType, Merk } from "../../data/types";

const typeOpties: { value: LocatieType; label: string }[] = [
  { value: "magazijn", label: "Magazijn" },
  { value: "koelcel", label: "Koelcel" },
  { value: "bar", label: "Bar" },
];

const GEDEELD = "__gedeeld__";

export function LocatieForm({
  open,
  onClose,
  locatie,
}: {
  open: boolean;
  onClose: () => void;
  locatie: Locatie | null;
}) {
  const { voegLocatieToe, wijzigLocatie } = useAppState();
  const [naam, setNaam] = useState("");
  const [type, setType] = useState<LocatieType>("magazijn");
  const [merkKeuze, setMerkKeuze] = useState<string>(GEDEELD);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNaam(locatie?.naam ?? "");
    setType(locatie?.type ?? "magazijn");
    setMerkKeuze(locatie ? (locatie.merk ?? GEDEELD) : GEDEELD);
    setFout(null);
  }, [open, locatie]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!naam.trim()) {
      setFout("Vul een naam in.");
      return;
    }
    const merk: Merk | null = merkKeuze === GEDEELD ? null : (merkKeuze as Merk);

    setBezig(true);
    try {
      if (locatie) await wijzigLocatie(locatie.id, { naam: naam.trim(), type, merk });
      else await voegLocatieToe({ naam: naam.trim(), type, merk });
      onClose();
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={locatie ? "Locatie wijzigen" : "Nieuwe locatie"}>
      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-group__label" htmlFor="locatie-naam">Naam</label>
          <Input
            id="locatie-naam"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bijv. Koelcel NBC"
          />
        </div>
        <div className="field-group">
          <span className="field-group__label">Type</span>
          <Select
            aria-label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as LocatieType)}
            options={typeOpties}
          />
        </div>
        <div className="field-group">
          <span className="field-group__label">
            Merk <span className="field-group__hint">gedeeld = beschikbaar voor beide merken</span>
          </span>
          <Select
            aria-label="Merk"
            value={merkKeuze}
            onChange={(e) => setMerkKeuze(e.target.value)}
            options={[
              { value: GEDEELD, label: "Gedeeld (NBC en Green Village)" },
              { value: "NBC", label: "NBC" },
              { value: "Green Village", label: "Green Village" },
            ]}
          />
        </div>
        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig…" : locatie ? "Opslaan" : "Toevoegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
