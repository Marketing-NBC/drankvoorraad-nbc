import { Link } from "../../design-system";

/** Foutmelding met een directe herstelmogelijkheid, zodat de gebruiker niet hoeft te verversen. */
export function FoutMelding({ melding, onOpnieuw }: { melding: string; onOpnieuw?: () => void }) {
  return (
    <p className="form-error form-error--met-actie">
      <span>{melding}</span>
      {onOpnieuw ? <Link icon={null} onClick={onOpnieuw}>Probeer opnieuw</Link> : null}
    </p>
  );
}
