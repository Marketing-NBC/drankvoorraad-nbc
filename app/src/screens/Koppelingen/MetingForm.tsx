import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { foutBericht } from "../../utils/fouten";

const AUTOMATISCH = "__automatisch__";

/**
 * Het dagverbruik van één machine invoeren.
 *
 * Dit is hetzelfde formulier dat straks overbodig wordt zodra de koppeling
 * met Franke en Aquablu draait — de gegevens komen dan uit hun systeem en
 * belanden op precies deze plek. Tot die tijd typt iemand het over van het
 * schermpje op de machine.
 */
export function MetingForm({
  open,
  onClose,
  machineIdVooraf,
}: {
  open: boolean;
  onClose: () => void;
  machineIdVooraf?: string;
}) {
  const { state, boekMeting } = useAppState();
  const [machineId, setMachineId] = useState("");
  const [datum, setDatum] = useState("");
  const [aantal, setAantal] = useState("");
  const [evenementKeuze, setEvenementKeuze] = useState(AUTOMATISCH);
  const [notitie, setNotitie] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const machines = state.machines.filter((m) => m.actief);
  const machine = machines.find((m) => m.id === machineId);

  /* Alleen evenementen op de gekozen dag: een langere lijst helpt niemand,
     en alles wat er niet in staat kan het toch niet zijn. */
  const evenementenOpDatum = useMemo(
    () => state.evenementen.filter((e) => e.datum === datum),
    [state.evenementen, datum]
  );

  const zaalNaam = machine?.zaalId
    ? state.zalen.find((z) => z.id === machine.zaalId)?.naam
    : undefined;

  /* Wat de database zou kiezen: precies één evenement in die zaal op die dag.
     Zijn het er twee, dan kiest zij niets en moet het hier gebeuren. */
  const automatischeKeuze = useMemo(() => {
    if (!machine?.zaalId || !datum) return null;
    const kandidaten = state.evenementZalen
      .filter((ez) => ez.zaalId === machine.zaalId)
      .map((ez) => state.evenementen.find((e) => e.id === ez.evenementId))
      .filter((e): e is NonNullable<typeof e> => Boolean(e) && e!.datum === datum);
    return kandidaten.length === 1 ? kandidaten[0] : null;
  }, [machine?.zaalId, datum, state.evenementZalen, state.evenementen]);

  useEffect(() => {
    if (!open) return;
    setMachineId(machineIdVooraf ?? machines[0]?.id ?? "");
    setDatum(new Date().toISOString().slice(0, 10));
    setAantal("");
    setEvenementKeuze(AUTOMATISCH);
    setNotitie("");
    setFout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, machineIdVooraf]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const aantalGetal = Number(aantal);
    if (!machineId) return setFout("Kies een machine.");
    if (!datum) return setFout("Kies een datum.");
    if (!Number.isInteger(aantalGetal) || aantalGetal < 0) {
      return setFout("Vul een heel aantal van 0 of hoger in.");
    }

    setBezig(true);
    try {
      await boekMeting({
        machineId,
        datum,
        aantal: aantalGetal,
        evenementId: evenementKeuze === AUTOMATISCH ? null : evenementKeuze,
        notitie: notitie.trim() || null,
      });
      onClose();
    } catch (err) {
      setFout(foutBericht(err) || "Opslaan is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Dagverbruik invoeren">
      <form className="product-form" onSubmit={handleSubmit}>
        <p className="modal-toelichting">
          Het totaal van één machine op één dag. Voer je een dag twee keer in, dan vervangt de
          nieuwe invoer de oude — een dagtotaal corrigeer je, je boekt het niet terug.
        </p>

        <div className="field-group">
          <span className="field-group__label">Machine</span>
          <Select
            aria-label="Machine"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            options={machines.map((m) => ({ value: m.id, label: m.naam }))}
          />
        </div>

        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor="meting-datum">Datum</label>
            <Input id="meting-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-group__label" htmlFor="meting-aantal">
              Aantal <span className="field-group__hint">van de teller</span>
            </label>
            <Input
              id="meting-aantal"
              type="number"
              min={0}
              step={1}
              value={aantal}
              onChange={(e) => setAantal(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group">
          <span className="field-group__label">
            Evenement{" "}
            <span className="field-group__hint">
              {zaalNaam ? `machine staat in ${zaalNaam}` : "machine heeft geen vaste zaal"}
            </span>
          </span>
          <Select
            aria-label="Evenement"
            value={evenementKeuze}
            onChange={(e) => setEvenementKeuze(e.target.value)}
            options={[
              {
                value: AUTOMATISCH,
                label: automatischeKeuze
                  ? `Automatisch — ${automatischeKeuze.naam}`
                  : "Automatisch — de app zoekt het evenement",
              },
              ...evenementenOpDatum.map((e) => ({ value: e.id, label: `${e.naam} (${e.id})` })),
            ]}
          />
          {!automatischeKeuze && evenementKeuze === AUTOMATISCH && datum ? (
            <p className="veld-toelichting">
              {evenementenOpDatum.length === 0
                ? "Er staat geen evenement op deze dag. Het verbruik wordt vastgelegd zonder evenement."
                : "Er zit meer dan één evenement in deze zaal op deze dag; kies zelf bij welke het hoort."}
            </p>
          ) : null}
        </div>

        <div className="field-group">
          <label className="field-group__label" htmlFor="meting-notitie">Toelichting (optioneel)</label>
          <Input id="meting-notitie" value={notitie} onChange={(e) => setNotitie(e.target.value)} />
        </div>

        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>{bezig ? "Bezig…" : "Opslaan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
