import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card } from "../../design-system";
import { MagazijnTabs } from "../../components/layout/MagazijnTabs";
import { PageHeader } from "../../components/layout/PageHeader";
import { AantalStepper } from "../../components/ui/AantalStepper";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Modal } from "../../components/ui/Modal";
import { Table } from "../../components/ui/Table";
import { TotaalBalk } from "../../components/ui/TotaalBalk";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import { emballageOverzicht, emballageTotaal, type EmballageRegel } from "../../data/emballage";
import { ROUTES } from "../../routes/routes";
import { foutBericht } from "../../utils/fouten";
import { formatCurrency, formatNumber } from "../../utils/format";

/**
 * Emballage — de tweede kop onder Magazijn.
 *
 * Hoeveel kratten, fusten en PET-flessen er in huis staan, vol of leeg, en
 * wat daar aan borg in zit. De stand loopt vanzelf mee: wat er met de inkoop
 * binnenkomt telt erbij, wat er met de retourbon teruggaat eraf. Alleen wat
 * de app niet kan zien — wat er al stond vóór de app, een rolcontainer die
 * los meekwam — zet een telling recht. Zie migratie 029.
 *
 * De retourbon zelf staat onder Leveringen. De borg is een bedrag en dus
 * alleen voor de beheerder zichtbaar.
 */
export function EmballageVoorraad() {
  const { state, laden, fout, herlaad } = useAppState();
  const { mag, zietBedragen } = useAuth();
  const navigate = useNavigate();
  const magBoeken = mag("beheerder", "medewerker");
  const [tellen, setTellen] = useState(false);

  const regels = emballageOverzicht(state.emballage, state.emballageStand);
  const totaal = emballageTotaal(regels);
  const nooitGeteld = regels.every((r) => r.geteld === 0);
  const teTellen = regels.some((r) => r.inHuis < 0);

  /** Welke producten deze soort meebrengen, voor wie wil zien waar "binnen" vandaan komt. */
  const productenVan = (emballageId: string) =>
    state.producten.filter((p) => p.emballageId === emballageId).map((p) => p.naam);

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="magazijn"
        title="Emballage"
        toelichting="Kratten, fusten en PET-flessen die in huis staan, vol of leeg. Wat er met een levering binnenkomt telt er vanzelf bij; wat er met de retourbon teruggaat gaat eraf."
        actions={
          magBoeken ? (
            <>
              <Button icon={null} onClick={() => setTellen(true)}>
                Emballage tellen
              </Button>
              <Button variant="ghost-dark" icon={null} onClick={() => navigate(ROUTES.emballageRetour)}>
                Retourbon invullen
              </Button>
            </>
          ) : null
        }
      />
      <MagazijnTabs />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}

      {regels.length === 0 ? (
        <EmptyState
          title="Nog geen soorten emballage"
          body="Draai migratie 021_emballage_retour.sql; die zet de kratten, fusten en PET-flessen klaar."
        />
      ) : (
        <>
          <TotaalBalk
            titel="Emballage in huis"
            sub="vol en leeg samen, tot de leverancier het ophaalt"
            cijfers={[
              { waarde: formatNumber(totaal.stuks), label: "stuks" },
              ...(zietBedragen ? [{ waarde: formatCurrency(totaal.waarde), label: "borgwaarde" }] : []),
            ]}
          />

          {magBoeken && (nooitGeteld || teTellen) ? (
            <p className="melding-waarschuwing">
              {nooitGeteld
                ? "Er is nog nooit emballage geteld. De stand begint bij wat er sinds de app binnenkwam; tel één keer alles wat er staat, vol en leeg, dan loopt hij daarna vanzelf mee."
                : "Bij een soort ging er meer retour dan er binnenkwam. Tel die soort, dan klopt de stand weer."}
            </p>
          ) : null}

          <Card className="card--tabel">
            <KaartKop titel="Per soort" sub="in de volgorde van de retourbon" />
            <Table<EmballageRegel>
              rowKey={(r) => r.soort.id}
              rows={regels}
              compact
              columns={[
                {
                  header: "Soort",
                  primair: true,
                  render: (r) => {
                    const producten = productenVan(r.soort.id);
                    return (
                      <span>
                        {r.soort.naam}
                        {producten.length > 0 ? (
                          <span className="field-group__hint" title={producten.join(", ")}>
                            {" "}· met {producten.length} {producten.length === 1 ? "product" : "producten"}
                          </span>
                        ) : null}
                      </span>
                    );
                  },
                },
                { header: "Art.nr.", verbergOpMobiel: true, render: (r) => r.soort.artikelnummer ?? "—" },
                {
                  header: "Binnen",
                  align: "right",
                  verbergOpMobiel: true,
                  render: (r) => formatNumber(r.binnen),
                },
                {
                  header: "Retour",
                  align: "right",
                  verbergOpMobiel: true,
                  render: (r) => (r.retour > 0 ? `−${formatNumber(r.retour)}` : "0"),
                },
                {
                  header: "Telling",
                  align: "right",
                  verbergOpMobiel: true,
                  render: (r) =>
                    r.geteld > 0 ? `+${formatNumber(r.geteld)}` : r.geteld < 0 ? `−${formatNumber(-r.geteld)}` : "—",
                },
                {
                  header: "In huis",
                  align: "right",
                  mobiel: "kop",
                  render: (r) =>
                    r.inHuis < 0 ? (
                      <span className="kaart-kop__cijfers">
                        <strong className="verschil-tekort">{formatNumber(r.inHuis)}</strong>
                        <Badge variant="gold">tellen</Badge>
                      </span>
                    ) : (
                      <strong>{formatNumber(r.inHuis)}</strong>
                    ),
                },
                ...(zietBedragen
                  ? [
                      {
                        header: "Borg per stuk",
                        labelMobiel: "Borg",
                        align: "right" as const,
                        verbergOpMobiel: true,
                        render: (r: EmballageRegel) => formatCurrency(r.soort.borg),
                      },
                      {
                        header: "Waarde",
                        align: "right" as const,
                        render: (r: EmballageRegel) => formatCurrency(r.waarde),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </>
      )}

      <EmballageTellen open={tellen} regels={regels} onClose={() => setTellen(false)} />
    </>
  );
}

/**
 * Tellen wat er staat, vol en leeg. Elk veld begint bij de stand van nu;
 * alleen wat iemand aanpast gaat mee. Zo boekt een levering die binnenkomt
 * terwijl het venster open staat niet ongemerkt als telverschil.
 */
function EmballageTellen({
  open,
  regels,
  onClose,
}: {
  open: boolean;
  regels: EmballageRegel[];
  onClose: () => void;
}) {
  const { telEmballage } = useAppState();
  const [geteld, setGeteld] = useState<Record<string, number>>({});
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  function sluit() {
    setGeteld({});
    setMelding(null);
    onClose();
  }

  async function vastleggen() {
    const ingevuld = Object.entries(geteld).map(([emballageId, aantal]) => ({ emballageId, geteld: aantal }));
    if (ingevuld.length === 0) {
      setMelding("Pas bij minstens één soort het aantal aan.");
      return;
    }
    setBezig(true);
    setMelding(null);
    try {
      await telEmballage(ingevuld);
      sluit();
    } catch (err) {
      setMelding(foutBericht(err) || "Vastleggen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={sluit} title="Emballage tellen">
      <div className="product-form">
        <p className="kaart-kop__sub">
          Tel vol en leeg samen: de kratten in de koelcel tellen net zo goed mee als de lege achter de bar.
          Pas alleen aan wat je geteld hebt.
        </p>
        {regels.map((r) => (
          <div className="field-group" key={r.soort.id}>
            <label className="field-group__label" htmlFor={`tel-${r.soort.id}`}>
              {r.soort.naam}{" "}
              <span className="field-group__hint">nu {formatNumber(r.inHuis)}</span>
            </label>
            <AantalStepper
              id={`tel-${r.soort.id}`}
              ariaLabel={`Geteld ${r.soort.naam}`}
              waarde={geteld[r.soort.id] ?? Math.max(r.inHuis, 0)}
              onChange={(n) => setGeteld((huidig) => ({ ...huidig, [r.soort.id]: n }))}
            />
          </div>
        ))}
        {melding ? <p className="form-error">{melding}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="ghost-dark" icon={null} onClick={sluit}>Annuleren</Button>
          <Button icon={null} disabled={bezig} onClick={() => void vastleggen()}>
            {bezig ? "Bezig…" : "Vastleggen"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
