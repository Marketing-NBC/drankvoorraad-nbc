import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Link } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Gebruiker, GebruikerRol } from "../../data/types";
import { foutBericht } from "../../utils/fouten";
import { formatDateKort } from "../../utils/format";
import { GebruikerForm } from "./GebruikerForm";
import { rolOpties, rolToelichting } from "./rollen";

/**
 * Accounts beheren zonder het Supabase-dashboard.
 *
 * De lijst komt uit `gebruikers_overzicht()` en niet uit de gewone
 * profielen-query, omdat het e-mailadres alleen voor een beheerder zichtbaar
 * is. Aanmaken, wachtwoord zetten en toegang intrekken gaat via een Edge
 * Function: dat kan alleen met de servicesleutel, en die hoort niet in een
 * browser.
 */
export function Gebruikers() {
  const { wijzigGebruiker, haalGebruikers, zetToegang } = useAppState();
  const { profiel } = useAuth();
  const [gebruikers, setGebruikers] = useState<Gebruiker[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; gebruiker: Gebruiker | null }>({
    open: false,
    gebruiker: null,
  });

  const laad = useCallback(async () => {
    setFout(null);
    try {
      setGebruikers(await haalGebruikers());
    } catch (err) {
      setFout(foutBericht(err) || "De gebruikerslijst kon niet opgehaald worden.");
    } finally {
      setLaden(false);
    }
  }, [haalGebruikers]);

  useEffect(() => {
    void laad();
  }, [laad]);

  async function handleRolWijziging(gebruiker: Gebruiker, rol: GebruikerRol) {
    setActieFout(null);
    try {
      await wijzigGebruiker(gebruiker.id, { rol });
      await laad();
    } catch {
      setActieFout("Rol aanpassen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    }
  }

  async function handleToegang(gebruiker: Gebruiker) {
    const intrekken = gebruiker.actief;
    const vraag = intrekken
      ? `Toegang van ${gebruiker.naam} intrekken? Diegene kan dan niet meer inloggen. Alle boekingen blijven staan.`
      : `${gebruiker.naam} weer toegang geven?`;
    if (!window.confirm(vraag)) return;

    setActieFout(null);
    try {
      await zetToegang(gebruiker.id, !gebruiker.actief);
      await laad();
    } catch (err) {
      const bericht = foutBericht(err);
      setActieFout(
        bericht.includes("Function not found") || bericht.includes("Failed to send")
          ? "De functie 'gebruikers' staat nog niet op Supabase. Zie supabase/functions/README.md."
          : bericht || "Aanpassen is niet gelukt."
      );
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="toegang"
        title="Gebruikers"
        toelichting="Jij maakt de accounts aan, met een wachtwoord dat je zelf doorgeeft. Er komt geen e-mail aan te pas, dus ook geen uitnodigingslink die in een spamfilter blijft hangen. Wie hier niet staat, kan niet inloggen."
        actions={
          <Button icon="plus" iconPosition="leading" onClick={() => setForm({ open: true, gebruiker: null })}>
            Nieuwe gebruiker
          </Button>
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void laad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      <Card className="card--tabel">
        <KaartKop
          titel={`${gebruikers.length} ${gebruikers.length === 1 ? "gebruiker" : "gebruikers"}`}
          sub="rol bepaalt wat iemand ziet en mag boeken"
        />
        <Table<Gebruiker>
          rowKey={(g) => g.id}
          rows={gebruikers}
          emptyMessage="Nog geen gebruikers."
          columns={[
            {
              header: "Naam",
              primair: true,
              render: (g) => (
                <span className="gebruiker-naam">
                  {g.naam}
                  {g.id === profiel?.id ? <Badge variant="neutral">jij</Badge> : null}
                  {!g.actief ? <Badge variant="gold">geen toegang</Badge> : null}
                </span>
              ),
            },
            {
              header: "Inlognaam",
              verbergOpMobiel: true,
              render: (g) => g.email ?? <span className="tekst-leeg">onbekend</span>,
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
            {
              header: "Sinds",
              verbergOpMobiel: true,
              render: (g) => formatDateKort(g.aangemaaktOp),
            },
            {
              header: "",
              align: "right",
              render: (g) => (
                <span style={{ display: "inline-flex", gap: 14 }}>
                  <Link icon={null} onClick={() => setForm({ open: true, gebruiker: g })}>
                    Wachtwoord
                  </Link>
                  {g.id === profiel?.id ? null : (
                    <Link icon={null} onClick={() => void handleToegang(g)}>
                      {g.actief ? "Intrekken" : "Toelaten"}
                    </Link>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <GebruikerForm
        open={form.open}
        gebruiker={form.gebruiker}
        onClose={() => {
          setForm({ open: false, gebruiker: null });
          void laad();
        }}
      />
    </>
  );
}
