import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../design-system";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import type { Gebruiker, GebruikerRol } from "../../data/types";
import { foutBericht } from "../../utils/fouten";
import { rolOpties } from "./rollen";

/**
 * Een account aanmaken of een nieuw wachtwoord zetten.
 *
 * Er gaat geen e-mail de deur uit. Je bedenkt het wachtwoord hier en geeft
 * het door; wie het kwijt is krijgt een nieuw van jou. Dat scheelt
 * uitnodigingslinks die in een spamfilter blijven hangen, en het betekent dat
 * niemand een account kan hebben dat jullie niet zelf hebben gemaakt.
 */
export function GebruikerForm({
  open,
  onClose,
  gebruiker,
}: {
  open: boolean;
  onClose: () => void;
  /** Gevuld = wachtwoord opnieuw zetten; leeg = nieuw account. */
  gebruiker: Gebruiker | null;
}) {
  const { maakGebruiker, zetWachtwoord } = useAppState();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [rol, setRol] = useState<GebruikerRol>("evenementmanager");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [gelukt, setGelukt] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNaam(gebruiker?.naam ?? "");
    setEmail(gebruiker?.email ?? "");
    setWachtwoord("");
    setRol(gebruiker?.rol ?? "evenementmanager");
    setFout(null);
    setGelukt(false);
  }, [open, gebruiker]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (wachtwoord.length < 8) {
      setFout("Een wachtwoord is minstens 8 tekens.");
      return;
    }
    if (!gebruiker) {
      if (!naam.trim()) return setFout("Vul een naam in.");
      if (!email.includes("@")) return setFout("Vul een geldig e-mailadres in.");
    }

    setBezig(true);
    setFout(null);
    try {
      if (gebruiker) await zetWachtwoord(gebruiker.id, wachtwoord);
      else await maakGebruiker({ naam: naam.trim(), email: email.trim(), wachtwoord, rol });
      setGelukt(true);
    } catch (err) {
      const bericht = foutBericht(err);
      setFout(
        bericht.includes("Failed to send") || bericht.includes("Function not found")
          ? "De functie 'gebruikers' staat nog niet op Supabase. Zie supabase/functions/README.md."
          : bericht || "Opslaan is niet gelukt. Probeer het opnieuw."
      );
    } finally {
      setBezig(false);
    }
  }

  if (gelukt) {
    return (
      <Modal open={open} onClose={onClose} title={gebruiker ? "Nieuw wachtwoord" : "Account aangemaakt"}>
        <div className="product-form">
          <p className="melding-goed">
            {gebruiker
              ? `Het wachtwoord van ${gebruiker.naam} is gewijzigd.`
              : `${naam.trim()} kan nu inloggen met ${email.trim()}.`}
          </p>
          <div className="wachtwoord-doorgeven">
            <span className="field-group__label">Geef dit door</span>
            <code>{wachtwoord}</code>
            <span className="field-group__hint">
              Na sluiten is het hier niet meer op te vragen — het staat versleuteld in Supabase.
            </span>
          </div>
          <div className="modal-actions">
            <Button type="button" icon={null} onClick={onClose}>Klaar</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={gebruiker ? `Wachtwoord van ${gebruiker.naam}` : "Nieuwe gebruiker"}
    >
      <form className="product-form" onSubmit={handleSubmit}>
        {gebruiker ? null : (
          <>
            <div className="field-group">
              <label className="field-group__label" htmlFor="gebruiker-naam">Naam</label>
              <Input id="gebruiker-naam" value={naam} onChange={(e) => setNaam(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-group__label" htmlFor="gebruiker-email">
                E-mailadres{" "}
                <span className="field-group__hint">
                  alleen als inlognaam — er wordt niets naartoe gestuurd
                </span>
              </label>
              <Input
                id="gebruiker-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field-group">
              <span className="field-group__label">Rol</span>
              <Select
                aria-label="Rol"
                value={rol}
                onChange={(e) => setRol(e.target.value as GebruikerRol)}
                options={rolOpties}
              />
            </div>
          </>
        )}

        <div className="field-group">
          <label className="field-group__label" htmlFor="gebruiker-wachtwoord">
            Wachtwoord <span className="field-group__hint">minstens 8 tekens, jij geeft het door</span>
          </label>
          <Input
            id="gebruiker-wachtwoord"
            type="text"
            autoComplete="new-password"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
          />
        </div>

        {fout ? <p className="form-error">{fout}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={onClose}>Annuleren</Button>
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig…" : gebruiker ? "Wachtwoord zetten" : "Aanmaken"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
