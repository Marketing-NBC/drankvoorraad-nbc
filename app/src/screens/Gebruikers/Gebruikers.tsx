import { useState } from "react";
import { Badge, Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { GebruikerRol, Profiel } from "../../data/types";

const rolOpties: { value: GebruikerRol; label: string }[] = [
  { value: "beheerder", label: "Beheerder" },
  { value: "magazijnmedewerker", label: "Magazijnmedewerker" },
  { value: "evenementmanager", label: "Evenementmanager" },
];

const rolToelichting: Record<GebruikerRol, string> = {
  beheerder: "Mag alles, inclusief gebruikers en locaties beheren.",
  magazijnmedewerker: "Scant producten, boekt voorraad en doet tellingen.",
  evenementmanager: "Beheert evenementen en bekijkt kosten en marges.",
};

export function Gebruikers() {
  const { state, laden, fout, herlaad, wijzigGebruiker } = useAppState();
  const { profiel } = useAuth();
  const [actieFout, setActieFout] = useState<string | null>(null);

  async function handleRolWijziging(gebruiker: Profiel, rol: GebruikerRol) {
    setActieFout(null);
    try {
      await wijzigGebruiker(gebruiker.id, { rol });
    } catch {
      setActieFout("Rol aanpassen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader eyebrow="toegang" title="Gebruikers" />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      <p className="scherm-toelichting">
        Nieuwe accounts maak je aan in Supabase onder Authentication → Users. Ze krijgen automatisch
        de rol evenementmanager; hier zet je ze daarna op de juiste rol.
      </p>

      <Card>
        <Table<Profiel>
          rowKey={(g) => g.id}
          rows={state.profielen}
          emptyMessage="Nog geen gebruikers."
          columns={[
            {
              header: "Naam",
              primair: true,
              render: (g) => (
                <span className="gebruiker-naam">
                  {g.naam}
                  {g.id === profiel?.id ? <Badge variant="neutral">jij</Badge> : null}
                </span>
              ),
            },
            {
              header: "Rol",
              render: (g) =>
                g.id === profiel?.id ? (
                  <span className="tekst-zwak" title="Je kunt je eigen rol niet aanpassen">
                    {rolOpties.find((r) => r.value === g.rol)?.label}
                  </span>
                ) : (
                  <Select
                    aria-label={`Rol van ${g.naam}`}
                    value={g.rol}
                    onChange={(e) => void handleRolWijziging(g, e.target.value as GebruikerRol)}
                    options={rolOpties}
                  />
                ),
            },
            {
              header: "Mag",
              verbergOpMobiel: true,
              render: (g) => <span className="tekst-zwak">{rolToelichting[g.rol]}</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}
