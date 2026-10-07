import { useMemo, useState } from "react";
import { Badge, Button, Card, Input } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { AantalStepper } from "../../components/ui/AantalStepper";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { EmballageRetour as Retour } from "../../data/types";
import { nieuwKenmerk } from "../../lib/wachtrij";
import { foutBericht } from "../../utils/fouten";
import { formatCurrency, formatDateTimeKort, formatNumber } from "../../utils/format";

/**
 * Lege emballage mee terug naar de leverancier.
 *
 * Kratten, fusten en PET-flessen gaan leeg terug, en op elk ervan zit borg.
 * Wat er de deur uit ging leg je hier vast, per ophaling één bon. Zo is te
 * controleren of de creditnota van de leverancier klopt.
 *
 * Dit verandert niets aan de drankvoorraad: lege emballage is geen drank.
 * De borg is een bedrag en dus alleen voor de beheerder zichtbaar.
 */
export function EmballageRetour() {
  const { state, laden, fout, herlaad, boekEmballageRetour } = useAppState();
  const { mag, zietBedragen } = useAuth();
  const magBoeken = mag("beheerder", "magazijnmedewerker");

  const actieveSoorten = state.emballage.filter((e) => e.actief);
  const leveranciers = Array.from(
    new Set(actieveSoorten.map((e) => e.leverancier).filter((l): l is string => Boolean(l)))
  ).sort();

  const [leverancier, setLeverancier] = useState("");
  const [bonnummer, setBonnummer] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [aantallen, setAantallen] = useState<Record<string, number>>({});
  /* Eén kenmerk per ingevuld formulier. Lukt vastleggen niet en probeert
     iemand het opnieuw, dan landt het toch maar één keer. */
  const [kenmerk, setKenmerk] = useState(() => nieuwKenmerk());
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ soort: "fout" | "gelukt"; tekst: string } | null>(null);

  const gekozen = leverancier || leveranciers[0] || "";
  const soortenVanLeverancier = actieveSoorten.filter((e) => e.leverancier === gekozen);

  const soortById = useMemo(() => new Map(state.emballage.map((e) => [e.id, e])), [state.emballage]);
  const gebruikerNaam = useMemo(
    () => new Map(state.profielen.map((p) => [p.id, p.naam])),
    [state.profielen]
  );

  const borgVanBon = soortenVanLeverancier.reduce(
    (som, e) => som + (aantallen[e.id] ?? 0) * e.borg,
    0
  );

  async function vastleggen() {
    const regels = soortenVanLeverancier
      .map((e) => ({ emballageId: e.id, aantal: aantallen[e.id] ?? 0 }))
      .filter((r) => r.aantal > 0);
    if (regels.length === 0) {
      setMelding({ soort: "fout", tekst: "Vul bij minstens één soort in hoeveel er meegaat." });
      return;
    }

    setBezig(true);
    setMelding(null);
    try {
      await boekEmballageRetour({
        leverancier: gekozen,
        bonnummer: bonnummer.trim() || undefined,
        opmerking: opmerking.trim() || undefined,
        regels,
        kenmerk,
      });
      setAantallen({});
      setBonnummer("");
      setOpmerking("");
      setKenmerk(nieuwKenmerk());
      setMelding({ soort: "gelukt", tekst: `Retour naar ${gekozen} vastgelegd.` });
    } catch (err) {
      setMelding({
        soort: "fout",
        tekst: foutBericht(err) || "Vastleggen is niet gelukt. Controleer je verbinding en probeer opnieuw.",
      });
    } finally {
      setBezig(false);
    }
  }

  function regelsVan(retour: Retour) {
    return state.emballageRetourregels.filter((r) => r.retourId === retour.id);
  }

  function borgVan(retour: Retour): number {
    return regelsVan(retour).reduce((som, r) => som + r.aantal * (soortById.get(r.emballageId)?.borg ?? 0), 0);
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="binnenkomst"
        title="Emballage retour"
        toelichting="Lege kratten, fusten en flessen die mee teruggaan naar de leverancier. Per ophaling één bon, zodat je de creditnota kunt controleren. De drankvoorraad verandert hier niet door."
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}

      {magBoeken ? (
        actieveSoorten.length === 0 ? (
          <EmptyState
            title="Nog geen soorten emballage"
            body="Draai migratie 021_emballage_retour.sql; die zet de kratten, fusten en PET-flessen klaar."
          />
        ) : (
          <Card>
            <KaartKop titel="Nieuwe retour" sub="wat er nu mee teruggaat" />
            <div className="product-form">
              <div className="field-row">
                <div className="field-group">
                  <span className="field-group__label">Leverancier</span>
                  <Select
                    aria-label="Leverancier"
                    value={gekozen}
                    onChange={(e) => {
                      setLeverancier(e.target.value);
                      setAantallen({});
                    }}
                    options={leveranciers.map((l) => ({ value: l, label: l }))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-group__label" htmlFor="emballage-bon">
                    Bonnummer <span className="field-group__hint">van de chauffeur, als die er is</span>
                  </label>
                  <Input id="emballage-bon" value={bonnummer} onChange={(e) => setBonnummer(e.target.value)} />
                </div>
              </div>

              {soortenVanLeverancier.map((soort) => (
                <div className="field-group" key={soort.id}>
                  <label className="field-group__label" htmlFor={`emballage-${soort.id}`}>
                    {soort.naam}{" "}
                    {zietBedragen ? (
                      <span className="field-group__hint">{formatCurrency(soort.borg)} borg per stuk</span>
                    ) : null}
                  </label>
                  <AantalStepper
                    id={`emballage-${soort.id}`}
                    ariaLabel={`Aantal ${soort.naam}`}
                    waarde={aantallen[soort.id] ?? 0}
                    onChange={(n) => setAantallen((huidig) => ({ ...huidig, [soort.id]: n }))}
                  />
                </div>
              ))}

              <div className="field-group">
                <label className="field-group__label" htmlFor="emballage-opmerking">Opmerking</label>
                <Input
                  id="emballage-opmerking"
                  value={opmerking}
                  placeholder="bijv. 2 kratten kapot meegegeven"
                  onChange={(e) => setOpmerking(e.target.value)}
                />
              </div>

              {melding ? (
                <p className={melding.soort === "fout" ? "form-error" : "melding-goed"}>{melding.tekst}</p>
              ) : null}

              <div className="modal-actions">
                {zietBedragen && borgVanBon > 0 ? (
                  <span className="kaart-kop__sub">
                    borg terug <strong>{formatCurrency(borgVanBon)}</strong>
                  </span>
                ) : null}
                <Button icon={null} disabled={bezig} onClick={() => void vastleggen()}>
                  {bezig ? "Bezig…" : "Vastleggen"}
                </Button>
              </div>
            </div>
          </Card>
        )
      ) : null}

      {state.emballageRetouren.length === 0 ? (
        <EmptyState
          title="Nog niets retour gegeven"
          body="Leg hier vast wat er mee teruggaat zodra de leverancier lege emballage ophaalt."
        />
      ) : (
        <Card className="card--tabel">
          <KaartKop titel="Eerder retour gegeven" sub="nieuwste eerst" />
          <Table<Retour>
            rowKey={(r) => r.id}
            rows={state.emballageRetouren.slice(0, 50)}
            columns={[
              { header: "Wanneer", primair: true, render: (r) => formatDateTimeKort(r.aangemaaktOp) },
              { header: "Leverancier", render: (r) => r.leverancier },
              { header: "Bon", verbergOpMobiel: true, render: (r) => r.bonnummer ?? "—" },
              {
                header: "Wat",
                render: (r) => (
                  <span className="kaart-kop__cijfers">
                    {regelsVan(r).map((regel) => (
                      <Badge key={regel.id} variant="neutral">
                        {formatNumber(regel.aantal)} × {soortById.get(regel.emballageId)?.naam ?? "onbekend"}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              {
                header: "Door",
                verbergOpMobiel: true,
                render: (r) => gebruikerNaam.get(r.gebruikerId) ?? "onbekend",
              },
              ...(zietBedragen
                ? [
                    {
                      header: "Borg",
                      align: "right" as const,
                      render: (r: Retour) => formatCurrency(borgVan(r)),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}
    </>
  );
}
