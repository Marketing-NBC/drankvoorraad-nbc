import { useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { Evenement, EvenementStatus, Merk } from "../../data/types";

export function NewEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { state, voegEvenementToe } = useAppState();
  const [id, setId] = useState("");
  const [naam, setNaam] = useState("");
  const [datum, setDatum] = useState("");
  const [merk, setMerk] = useState<Merk>("NBC");
  const [opdrachtgever, setOpdrachtgever] = useState("");
  const [status, setStatus] = useState<EvenementStatus>("Gepland");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  function reset() {
    setId(""); setNaam(""); setDatum(""); setMerk("NBC"); setOpdrachtgever(""); setStatus("Gepland"); setFout(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id.trim() || !naam.trim() || !datum) {
      setFout("Vul minimaal ID, naam en datum in.");
      return;
    }
    if (state.evenementen.some((ev) => ev.id === id.trim())) {
      setFout("Dit evenement-ID bestaat al, kies een uniek ID.");
      return;
    }

    const evenement: Evenement = {
      id: id.trim(),
      naam: naam.trim(),
      datum,
      merk,
      opdrachtgever: opdrachtgever.trim() || undefined,
      status,
      omzet: 0,
    };

    setBezig(true);
    try {
      await voegEvenementToe(evenement);
      onCreated(evenement.id);
      reset();
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nieuw evenement">
      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-group__label" htmlFor="event-id">Evenement-ID</label>
          <Input id="event-id" placeholder="bijv. EVT-2026-042" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-group__label" htmlFor="event-naam">Naam</label>
          <Input id="event-naam" value={naam} onChange={(e) => setNaam(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor="event-datum">Datum</label>
            <Input id="event-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
          <div className="field-group">
            <span className="field-group__label">Merk</span>
            <Select
              aria-label="Merk"
              value={merk}
              onChange={(e) => setMerk(e.target.value as Merk)}
              options={[
                { value: "NBC", label: "NBC" },
                { value: "Green Village", label: "Green Village" },
              ]}
            />
          </div>
        </div>
        <div className="field-group">
          <label className="field-group__label" htmlFor="event-opdrachtgever">Opdrachtgever (optioneel)</label>
          <Input id="event-opdrachtgever" value={opdrachtgever} onChange={(e) => setOpdrachtgever(e.target.value)} />
        </div>
        <div className="field-group">
          <span className="field-group__label">Status</span>
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EvenementStatus)}
            options={[
              { value: "Gepland", label: "Gepland" },
              { value: "Actief", label: "Actief" },
              { value: "Afgerond", label: "Afgerond" },
            ]}
          />
        </div>
        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={handleClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig…" : "Evenement aanmaken"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
