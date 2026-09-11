import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { Koppeling, Machine } from "../../data/types";

const GEEN_ZAAL = "__geen__";

/**
 * Eén koffiemachine of watertappunt.
 *
 * Het externe nummer is het haakje waar de import straks op matcht: zo weet
 * de koppeling welke regel uit het systeem van Franke bij welke machine hier
 * hoort. Zolang die koppeling er niet is mag het veld leeg blijven.
 */
export function MachineForm({
  open,
  onClose,
  machine,
  koppeling,
}: {
  open: boolean;
  onClose: () => void;
  machine: Machine | null;
  koppeling: Koppeling;
}) {
  const { state, voegMachineToe, wijzigMachine } = useAppState();
  const [naam, setNaam] = useState("");
  const [externId, setExternId] = useState("");
  const [productId, setProductId] = useState("");
  const [zaalKeuze, setZaalKeuze] = useState(GEEN_ZAAL);
  const [actief, setActief] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  /* Alleen voorraadloze producten: een machine levert koffie of water, geen
     kratten die uit het magazijn komen. */
  const machineProducten = state.producten.filter((p) => p.voorraadloos);

  useEffect(() => {
    if (!open) return;
    setNaam(machine?.naam ?? "");
    setExternId(machine?.externId ?? "");
    setProductId(machine?.productId ?? machineProducten[0]?.id ?? "");
    setZaalKeuze(machine?.zaalId ?? GEEN_ZAAL);
    setActief(machine?.actief ?? true);
    setFout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, machine?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!naam.trim()) return setFout("Vul een naam in.");
    if (!productId) return setFout("Kies wat deze machine levert.");

    const velden = {
      koppelingId: koppeling.id,
      naam: naam.trim(),
      externId: externId.trim() || undefined,
      productId,
      zaalId: zaalKeuze === GEEN_ZAAL ? undefined : zaalKeuze,
      actief,
    };

    setBezig(true);
    try {
      if (machine) await wijzigMachine(machine.id, velden);
      else await voegMachineToe(velden);
      onClose();
    } catch {
      setFout("Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={machine ? "Machine wijzigen" : `Machine bij ${koppeling.naam}`}>
      <form className="product-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-group__label" htmlFor="machine-naam">Naam</label>
          <Input
            id="machine-naam"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bijv. Koffiemachine Lounge"
          />
        </div>
        <div className="field-row">
          <div className="field-group">
            <span className="field-group__label">Levert</span>
            <Select
              aria-label="Product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={machineProducten.map((p) => ({ value: p.id, label: p.naam }))}
            />
          </div>
          <div className="field-group">
            <span className="field-group__label">
              Zaal <span className="field-group__hint">bepaalt bij welk evenement het verbruik hoort</span>
            </span>
            <Select
              aria-label="Zaal"
              value={zaalKeuze}
              onChange={(e) => setZaalKeuze(e.target.value)}
              options={[
                { value: GEEN_ZAAL, label: "Geen vaste zaal" },
                ...state.zalen.map((z) => ({ value: z.id, label: z.naam })),
              ]}
            />
          </div>
        </div>
        <div className="field-group">
          <label className="field-group__label" htmlFor="machine-extern">
            Nummer bij {koppeling.naam}{" "}
            <span className="field-group__hint">leeg laten tot de koppeling er is</span>
          </label>
          <Input id="machine-extern" value={externId} onChange={(e) => setExternId(e.target.value)} />
        </div>
        <label className="keuzevakje">
          <input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} />
          <span>In gebruik</span>
        </label>
        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig…" : machine ? "Opslaan" : "Toevoegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
