import { useState } from "react";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Evenement, EvenementStatus } from "../../data/types";

const opties: { value: EvenementStatus; label: string }[] = [
  { value: "Gepland", label: "Gepland" },
  { value: "Actief", label: "Actief" },
  { value: "Afgerond", label: "Afgerond" },
];

/**
 * De status van een evenement bijwerken.
 *
 * Dit is geen cosmetisch veld: het dashboard telt alleen actieve en afgeronde
 * evenementen mee in de brutowinst. Blijft een evenement op "Gepland" staan,
 * dan blijft de opbrengst onzichtbaar. Vandaar dat de kiezer direct naast de
 * status staat in plaats van weggestopt in een bewerkscherm.
 */
export function StatusKiezer({ evenement }: { evenement: Evenement }) {
  const { wijzigEvenement } = useAppState();
  const { mag } = useAuth();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(false);

  if (!mag("beheerder", "evenementmanager")) {
    return <StatusBadge status={evenement.status} />;
  }

  async function wijzig(status: EvenementStatus) {
    setBezig(true);
    setFout(false);
    try {
      await wijzigEvenement(evenement.id, { status });
    } catch {
      setFout(true);
    } finally {
      setBezig(false);
    }
  }

  return (
    <span className="status-kiezer">
      <label className="visueel-verborgen" htmlFor="evenement-status">Status</label>
      <Select
        id="evenement-status"
        className="status-kiezer__select"
        value={evenement.status}
        disabled={bezig}
        onChange={(e) => void wijzig(e.target.value as EvenementStatus)}
        options={opties}
      />
      {fout ? <span className="status-kiezer__fout">niet opgeslagen</span> : null}
    </span>
  );
}
