import { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Link } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Koppeling, Machine, Meting } from "../../data/types";
import { formatCurrency, formatDateKort, formatDateTime, formatNumber } from "../../utils/format";
import { verbruikUitMetingen } from "../../data/calculations";
import { MachineForm } from "./MachineForm";
import { MetingForm } from "./MetingForm";

/**
 * Koffie en water.
 *
 * Eén scherm voor twee dingen die hetzelfde worden zodra de koppeling er is:
 * het dagverbruik dat nu met de hand wordt ingevoerd, en het dagverbruik dat
 * straks uit Franke en Aquablu komt. Beide belanden in dezelfde tabel, met
 * dezelfde controle op het evenement. Het enige verschil is de herkomst, en
 * die staat erbij zodat je altijd kunt zien wie of wat het getal zette.
 */
export function Koppelingen() {
  const { state, laden, fout, herlaad, wijzigKoppeling, verwijderMachine } = useAppState();
  const { mag, zietBedragen } = useAuth();
  const [machineForm, setMachineForm] = useState<{ koppeling: Koppeling; machine: Machine | null } | null>(null);
  const [metingOpen, setMetingOpen] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);

  const magBeheren = mag("beheerder", "magazijnmedewerker");
  const magKoppelingInstellen = mag("beheerder");

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p.naam])),
    [state.producten]
  );
  const zaalNaam = useMemo(() => new Map(state.zalen.map((z) => [z.id, z.naam])), [state.zalen]);
  const machineNaam = useMemo(
    () => new Map(state.machines.map((m) => [m.id, m.naam])),
    [state.machines]
  );
  const evenementNaam = useMemo(
    () => new Map(state.evenementen.map((e) => [e.id, e.naam])),
    [state.evenementen]
  );

  /* Koffie en water tellen mee in de marge. Staat de inkoopprijs nog op 0,
     dan komt die kostenpost op € 0,00 uit — dat is geen fout maar een
     ontbrekend getal, en dat hoort zichtbaar te zijn. */
  const zonderPrijs = zietBedragen
    ? state.producten.filter((p) => p.voorraadloos && p.inkoopprijs === 0)
    : [];

  const recenteMetingen = state.metingen.slice(0, 25);
  const verbruik = useMemo(
    () => verbruikUitMetingen(state.metingen, state.machines, state.producten),
    [state.metingen, state.machines, state.producten]
  );

  async function handleVerwijderMachine(machine: Machine) {
    if (!window.confirm(`"${machine.naam}" verwijderen? De ingevoerde metingen verdwijnen mee.`)) return;
    setActieFout(null);
    try {
      await verwijderMachine(machine.id);
    } catch {
      setActieFout(`"${machine.naam}" kan niet verwijderd worden.`);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="koffie en water"
        title="Koppelingen"
        toelichting="Franke en Aquablu leveren geen drank uit het magazijn: er staat een machine in een zaal en die telt wat er getapt is. Zolang de koppeling met hun systemen er niet is, voer je het dagverbruik hier zelf in — op dezelfde plek waar de koppeling het straks neerzet."
        actions={
          state.machines.length > 0 ? (
            <Button icon="plus" iconPosition="leading" onClick={() => setMetingOpen(true)}>
              Verbruik invoeren
            </Button>
          ) : null
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      {zonderPrijs.length > 0 ? (
        <p className="melding-waarschuwing">
          Nog geen inkoopprijs bij {zonderPrijs.map((p) => p.naam).join(", ")}. Het verbruik wordt
          wel geteld, maar telt voor € 0,00 mee in de marge tot die prijs ingevuld is.
        </p>
      ) : null}

      {state.koppelingen.length === 0 ? (
        <EmptyState
          title="Nog geen koppelingen"
          body="Draai migratie 013_koppelingen.sql om Franke en Aquablu aan te maken."
        />
      ) : (
        state.koppelingen.map((koppeling) => {
          const machines = state.machines.filter((m) => m.koppelingId === koppeling.id);
          return (
            <Card key={koppeling.id} className="card--tabel">
              <KaartKop
                titel={koppeling.naam}
                sub={
                  koppeling.actief
                    ? `Laatste import: ${koppeling.laatsteImport ? formatDateTime(koppeling.laatsteImport) : "nog geen"}`
                    : "Koppeling nog niet actief — invoer gaat met de hand"
                }
                rechts={
                  <Badge variant={koppeling.actief ? "success" : "neutral"}>
                    {koppeling.actief ? "gekoppeld" : "handmatig"}
                  </Badge>
                }
              />

              {koppeling.notitie ? <p className="kaart-tekst">{koppeling.notitie}</p> : null}
              {koppeling.laatsteFout ? (
                <p className="form-error">Laatste import meldde: {koppeling.laatsteFout}</p>
              ) : null}

              {magKoppelingInstellen ? (
                <div className="koppeling-instellingen">
                  <label className="keuzevakje">
                    <input
                      type="checkbox"
                      checked={koppeling.actief}
                      onChange={(e) => void wijzigKoppeling(koppeling.id, { actief: e.target.checked })}
                    />
                    <span>
                      Koppeling is actief
                      <span className="field-group__hint">
                        aanzetten zodra {koppeling.naam} gegevens levert — sleutels horen in de
                        omgeving van de importfunctie, niet hier
                      </span>
                    </span>
                  </label>
                  <div className="field-group">
                    <label className="field-group__label" htmlFor={`api-${koppeling.id}`}>
                      API-adres <span className="field-group__hint">optioneel, voor de importfunctie</span>
                    </label>
                    <Input
                      id={`api-${koppeling.id}`}
                      defaultValue={koppeling.apiBasisUrl ?? ""}
                      placeholder="https://…"
                      onBlur={(e) => {
                        const nieuw = e.target.value.trim();
                        if (nieuw !== (koppeling.apiBasisUrl ?? "")) {
                          void wijzigKoppeling(koppeling.id, { apiBasisUrl: nieuw || null });
                        }
                      }}
                    />
                  </div>
                </div>
              ) : null}

              <Table<Machine>
                rowKey={(m) => m.id}
                rows={machines}
                emptyMessage="Nog geen machines."
                columns={[
                  { header: "Machine", primair: true, render: (m) => m.naam },
                  {
                    header: "Zaal",
                    render: (m) =>
                      m.zaalId ? zaalNaam.get(m.zaalId) ?? "—" : <span className="tekst-leeg">geen vaste zaal</span>,
                  },
                  { header: "Levert", verbergOpMobiel: true, render: (m) => productNaam.get(m.productId) ?? "—" },
                  {
                    header: `Nummer bij ${koppeling.naam}`,
                    verbergOpMobiel: true,
                    render: (m) =>
                      m.externId ? <code className="barcode-cel">{m.externId}</code> : <span className="tekst-leeg">nog niet bekend</span>,
                  },
                  {
                    header: "",
                    align: "right",
                    render: (m) =>
                      magBeheren ? (
                        <span style={{ display: "inline-flex", gap: 14 }}>
                          <Link icon={null} onClick={() => setMachineForm({ koppeling, machine: m })}>Wijzig</Link>
                          <Link icon={null} onClick={() => void handleVerwijderMachine(m)}>Verwijder</Link>
                        </span>
                      ) : null,
                  },
                ]}
              />

              {magBeheren ? (
                <div className="kaart-actie">
                  <Link icon={null} onClick={() => setMachineForm({ koppeling, machine: null })}>
                    Machine toevoegen
                  </Link>
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      <Card className="card--tabel">
        <KaartKop
          titel="Verbruik tot nu toe"
          sub="alles wat er van de machines geteld is, opgeteld per product"
        />
        <Table<(typeof verbruik)[number]>
          rowKey={(r) => r.productId}
          rows={verbruik}
          emptyMessage="Nog geen verbruik ingevoerd."
          columns={[
            { header: "Product", primair: true, render: (r) => productNaam.get(r.productId) ?? "—" },
            { header: "Aantal", align: "right", render: (r) => formatNumber(r.aantal) },
            ...(zietBedragen
              ? [
                  {
                    header: "Inkoopwaarde",
                    align: "right" as const,
                    render: (r: (typeof verbruik)[number]) =>
                      r.waarde > 0 ? formatCurrency(r.waarde) : <span className="tekst-leeg">prijs ontbreekt</span>,
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Card className="card--tabel">
        <KaartKop titel="Laatst ingevoerd" sub="de vijfentwintig meest recente dagtotalen" />
        <Table<Meting>
          rowKey={(m) => m.id}
          rows={recenteMetingen}
          emptyMessage="Nog niets ingevoerd."
          columns={[
            { header: "Datum", primair: true, render: (m) => formatDateKort(m.datum) },
            { header: "Machine", render: (m) => machineNaam.get(m.machineId) ?? "—" },
            { header: "Aantal", align: "right", render: (m) => formatNumber(m.aantal) },
            {
              header: "Evenement",
              render: (m) =>
                m.evenementId ? (
                  evenementNaam.get(m.evenementId) ?? m.evenementId
                ) : (
                  <span className="tekst-leeg">geen</span>
                ),
            },
            {
              header: "Herkomst",
              verbergOpMobiel: true,
              render: (m) => (
                <Badge variant={m.bron === "koppeling" ? "tint" : "neutral"}>
                  {m.bron === "koppeling" ? "koppeling" : "handmatig"}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      {machineForm ? (
        <MachineForm
          open
          koppeling={machineForm.koppeling}
          machine={machineForm.machine}
          onClose={() => setMachineForm(null)}
        />
      ) : null}
      <MetingForm open={metingOpen} onClose={() => setMetingOpen(false)} />
    </>
  );
}
