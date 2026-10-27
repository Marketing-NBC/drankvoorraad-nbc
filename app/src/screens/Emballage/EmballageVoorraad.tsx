import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Input, Link } from "../../design-system";
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
 * wat daar aan borg in zit. De stand loopt vanzelf mee: de beginstand is de
 * emballage van de drankvoorraad, wat er met de inkoop binnenkomt telt
 * erbij, wat er met de retourbon teruggaat eraf. Wat de app niet kan zien —
 * lege kratten die er al stonden, een rolcontainer die los meekwam — voer je
 * met de hand in, of je telt het. Zie migratie 030.
 *
 * De retourbon zelf staat onder Leveringen. De borg is een bedrag en dus
 * alleen voor de beheerder zichtbaar.
 */
export function EmballageVoorraad() {
  const { state, laden, fout, herlaad } = useAppState();
  const { mag, zietBedragen } = useAuth();
  const navigate = useNavigate();
  const magBoeken = mag("beheerder", "medewerker");
  const [invoeren, setInvoeren] = useState(false);

  const regels = emballageOverzicht(state.emballage, state.emballageStand);
  const totaal = emballageTotaal(regels);
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
        toelichting="Kratten, fusten en PET-flessen die in huis staan, vol of leeg. Wat er met de drankvoorraad binnenkomt telt er vanzelf bij; wat er met de retourbon teruggaat gaat eraf. Lege emballage en rolcontainers voer je met de hand in."
        actions={
          magBoeken ? (
            <>
              <Button icon="plus" iconPosition="leading" onClick={() => setInvoeren(true)}>
                Emballage invoeren
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

          {magBoeken && teTellen ? (
            <p className="melding-waarschuwing">
              Bij een soort ging er meer retour dan er in huis stond. Tel die soort, dan klopt de stand weer.
            </p>
          ) : null}

          <Card className="card--tabel">
            <KaartKop
              titel="Per soort"
              sub="binnen met de drankvoorraad, met de hand (beginstand, telling, invoer), min retour"
              rechts={
                <Link icon={null} onClick={() => navigate(ROUTES.historieEmballage)}>
                  Bekijk mutaties
                </Link>
              }
            />
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
                  /* Beginstand, tellingen en losse invoer samen. */
                  header: "Handmatig",
                  align: "right",
                  verbergOpMobiel: true,
                  render: (r) =>
                    r.handmatig > 0
                      ? `+${formatNumber(r.handmatig)}`
                      : r.handmatig < 0
                        ? `−${formatNumber(-r.handmatig)}`
                        : "—",
                },
                {
                  header: "Retour",
                  align: "right",
                  verbergOpMobiel: true,
                  render: (r) => (r.retour > 0 ? `−${formatNumber(r.retour)}` : "0"),
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

      <EmballageInvoeren open={invoeren} regels={regels} onClose={() => setInvoeren(false)} />
    </>
  );
}

type Manier = "erbij" | "eraf" | "tellen";

const MANIEREN: { id: Manier; label: string }[] = [
  { id: "erbij", label: "Erbij" },
  { id: "eraf", label: "Eraf" },
  { id: "tellen", label: "Tellen" },
];

/**
 * Emballage met de hand invoeren, op drie manieren:
 *
 *   * erbij — lege kratten die er al stonden, rolcontainers die met de
 *     vrachtwagen meekwamen;
 *   * eraf — kapot, kwijt, meegegeven buiten de retourbon om;
 *   * tellen — zet in wat er staat; de database boekt het verschil.
 *
 * Erbij en eraf vragen een reden. Bij tellen begint elk veld bij de stand
 * van nu en gaat alleen mee wat iemand aanpast; zo boekt een levering die
 * binnenkomt terwijl het venster open staat niet ongemerkt als telverschil.
 */
function EmballageInvoeren({
  open,
  regels,
  onClose,
}: {
  open: boolean;
  regels: EmballageRegel[];
  onClose: () => void;
}) {
  const { telEmballage, boekEmballageHandmatig } = useAppState();
  const [manier, setManier] = useState<Manier>("erbij");
  const [aantallen, setAantallen] = useState<Record<string, number>>({});
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  function kies(nieuw: Manier) {
    setManier(nieuw);
    setAantallen({});
    setMelding(null);
  }

  function sluit() {
    setManier("erbij");
    setAantallen({});
    setReden("");
    setMelding(null);
    onClose();
  }

  async function vastleggen() {
    const ingevuld = Object.entries(aantallen).filter(([, aantal]) => manier === "tellen" || aantal > 0);
    if (ingevuld.length === 0) {
      setMelding(manier === "tellen" ? "Pas bij minstens één soort het aantal aan." : "Vul bij minstens één soort een aantal in.");
      return;
    }
    if (manier !== "tellen" && !reden.trim()) {
      setMelding("Vul in waarom de emballage erbij komt of eraf gaat.");
      return;
    }
    setBezig(true);
    setMelding(null);
    try {
      if (manier === "tellen") {
        await telEmballage(ingevuld.map(([emballageId, geteld]) => ({ emballageId, geteld })));
      } else {
        const teken = manier === "erbij" ? 1 : -1;
        await boekEmballageHandmatig(
          ingevuld.map(([emballageId, aantal]) => ({ emballageId, aantal: teken * aantal })),
          reden.trim()
        );
      }
      sluit();
    } catch (err) {
      setMelding(foutBericht(err) || "Vastleggen is niet gelukt. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <Modal open={open} onClose={sluit} title="Emballage invoeren">
      <div className="product-form">
        <nav className="rapport-kiezer" aria-label="Manier van invoeren">
          {MANIEREN.map((m) => (
            <button
              key={m.id}
              type="button"
              className={["rapport-tab", manier === m.id && "rapport-tab--actief"].filter(Boolean).join(" ")}
              aria-pressed={manier === m.id}
              onClick={() => kies(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <p className="kaart-kop__sub">
          {manier === "erbij"
            ? "Wat er bij komt zonder dat het met de drank binnenkwam: lege kratten die er al stonden, rolcontainers, koolzuur."
            : manier === "eraf"
              ? "Wat er af gaat buiten de retourbon om: kapot, kwijt, ergens anders meegegeven."
              : "Tel vol en leeg samen: de kratten in de koelcel tellen net zo goed mee als de lege achter de bar. Pas alleen aan wat je geteld hebt."}
        </p>
        {regels.map((r) => (
          <div className="field-group" key={r.soort.id}>
            <label className="field-group__label" htmlFor={`invoer-${r.soort.id}`}>
              {r.soort.naam}{" "}
              <span className="field-group__hint">nu {formatNumber(r.inHuis)}</span>
            </label>
            <AantalStepper
              id={`invoer-${r.soort.id}`}
              ariaLabel={`${manier === "tellen" ? "Geteld" : manier === "erbij" ? "Erbij" : "Eraf"} ${r.soort.naam}`}
              waarde={aantallen[r.soort.id] ?? (manier === "tellen" ? Math.max(r.inHuis, 0) : 0)}
              onChange={(n) => setAantallen((huidig) => ({ ...huidig, [r.soort.id]: n }))}
            />
          </div>
        ))}
        {manier !== "tellen" ? (
          <div className="field-group">
            <label className="field-group__label" htmlFor="emballage-reden">Reden</label>
            <Input
              id="emballage-reden"
              value={reden}
              placeholder={manier === "erbij" ? "bijv. lege kratten achter in het magazijn" : "bijv. 3 kratten kapot"}
              onChange={(e) => setReden(e.target.value)}
            />
          </div>
        ) : null}
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
