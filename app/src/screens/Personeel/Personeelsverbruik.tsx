import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Input } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import {
  laatsteTelling,
  personeelsverbruik,
  type PersoneelsverbruikPerLocatie,
} from "../../data/calculations";
import { omschrijfAantal } from "../../data/verpakking";
import { exporteerNaarExcel } from "../../utils/excel";
import { foutBericht } from "../../utils/fouten";
import { formatCurrency, formatDate } from "../../utils/format";
import { ROUTES } from "../../routes/routes";
import { VoorraadMutatieModal } from "../Magazijn/VoorraadMutatieModal";

/** Eerste dag van de maand waarin `datum` valt, als ISO-datum. */
function eersteVanDeMaand(datum: Date): string {
  return new Date(datum.getFullYear(), datum.getMonth(), 1).toISOString().slice(0, 10);
}

interface Regel {
  productId: string;
  naam: string;
  aangevuld: number;
  verbruikt: number;
  waardeVerbruikt: number;
  /** Wat er nu nog staat, over alle personeelslocaties van deze kaart. */
  voorraad: number;
}

/**
 * Wat het personeel opmaakt in de kantine en de kroeg.
 *
 * Dit is bewust een eigen scherm en geen filter op het magazijn: het is een
 * andere vraag. Bij een evenement wil je weten wat het gekost heeft ten
 * opzichte van de omzet; hier wil je weten wat er intern doorheen gaat. De
 * database houdt de twee uit elkaar — een boeking die een personeelslocatie
 * aan een evenement koppelt wordt geweigerd.
 */
export function Personeelsverbruik() {
  const { state, laden, fout, herlaad, startTelling } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const [vanaf, setVanaf] = useState(() => eersteVanDeMaand(new Date()));
  const [tot, setTot] = useState(() => new Date().toISOString().slice(0, 10));
  const [boeken, setBoeken] = useState<string | null>(null);
  const [exporteert, setExporteert] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);

  const magBoeken = mag("beheerder", "magazijnmedewerker");

  /**
   * Tellen is hier de manier waarop het verbruik binnenkomt: er ging 96 in,
   * er staat nog 36, dus er is 60 doorheen. Een tekort op een
   * personeelslocatie boekt de database daarom als personeelsverbruik en
   * niet als telverschil — zie migratie 018.
   */
  async function tellen(locatieId: string) {
    setActieFout(null);
    const lopend = state.tellingen.find((t) => t.locatieId === locatieId && t.status === "open");
    if (lopend) {
      navigate(ROUTES.tellingDetail(lopend.id));
      return;
    }
    try {
      const id = await startTelling(locatieId);
      navigate(ROUTES.tellingDetail(id));
    } catch (err) {
      setActieFout(foutBericht(err) || "De telling kon niet gestart worden.");
    }
  }

  const samenvattingen = useMemo(
    () => personeelsverbruik(state.mutaties, state.producten, state.locaties, { vanaf, tot }),
    [state.mutaties, state.producten, state.locaties, vanaf, tot]
  );

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p])),
    [state.producten]
  );

  const totaalVerbruik = samenvattingen.reduce((som, s) => som + s.waardeVerbruik, 0);
  const totaalAangevuld = samenvattingen.reduce((som, s) => som + s.waardeAangevuld, 0);

  function regelsVan(samenvatting: PersoneelsverbruikPerLocatie): Regel[] {
    const per = new Map<string, Regel>();
    const zorg = (productId: string): Regel => {
      const bestaand = per.get(productId);
      if (bestaand) return bestaand;
      const nieuw: Regel = {
        productId,
        naam: productNaam.get(productId)?.naam ?? "Onbekend product",
        aangevuld: 0,
        verbruikt: 0,
        waardeVerbruikt: 0,
        voorraad:
          state.voorraad.find(
            (v) => v.locatieId === samenvatting.locatie.id && v.productId === productId
          )?.aantal ?? 0,
      };
      per.set(productId, nieuw);
      return nieuw;
    };

    for (const r of samenvatting.aangevuld) zorg(r.productId).aangevuld += r.aantal;
    for (const r of samenvatting.verbruik) {
      const regel = zorg(r.productId);
      regel.verbruikt += r.aantal;
      regel.waardeVerbruikt += r.waarde;
    }
    return Array.from(per.values()).sort((a, b) => b.waardeVerbruikt - a.waardeVerbruikt);
  }

  async function exporteer() {
    setExporteert(true);
    try {
      const rijen = samenvattingen.flatMap((s) =>
        regelsVan(s).map((r) => ({ locatie: s.locatie.naam, ...r }))
      );
      await exporteerNaarExcel<(typeof rijen)[number]>({
        bestandsnaam: `personeelsverbruik-${vanaf}-tot-${tot}`,
        titel: "Personeelsverbruik",
        ondertitel: `${formatDate(vanaf)} tot en met ${formatDate(tot)}`,
        rijen,
        kolommen: [
          { header: "Locatie", value: (r) => r.locatie },
          { header: "Product", value: (r) => r.naam },
          { header: "Aangevuld", opmaak: "getal", value: (r) => r.aangevuld },
          { header: "Verbruikt", opmaak: "getal", value: (r) => r.verbruikt },
          { header: "Nu in voorraad", opmaak: "getal", value: (r) => r.voorraad },
          { header: "Inkoopwaarde verbruik", opmaak: "bedrag", value: (r) => r.waardeVerbruikt },
        ],
        totalen: { 0: "Totaal verbruik", 5: totaalVerbruik },
      });
    } finally {
      setExporteert(false);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="intern"
        title="Personeelsverbruik"
        toelichting="De kantine en de kroeg zijn voor het personeel. Wat daar opgaat telt nooit mee bij een evenement — de database weigert die koppeling zelfs. Het verbruik komt uit de telling: wat erin ging min wat er nog staat."
        actions={
          <>
            {magBoeken && samenvattingen.length > 0 ? (
              <Button
                icon="plus"
                iconPosition="leading"
                onClick={() => void tellen(samenvattingen[0].locatie.id)}
              >
                {samenvattingen[0].locatie.naam} tellen
              </Button>
            ) : null}
            <ActieMenu
              label="Meer"
              items={[
                ...(magBoeken && samenvattingen.length > 0
                  ? [
                      {
                        label: "Handmatig afboeken",
                        onClick: () => setBoeken(samenvattingen[0].locatie.id),
                      },
                    ]
                  : []),
                { label: exporteert ? "Bezig…" : "Exporteren naar Excel", onClick: () => void exporteer() },
              ]}
            />
          </>
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      <Card>
        <div className="periode-kiezer">
          <div className="field-group">
            <label className="field-group__label" htmlFor="personeel-vanaf">Vanaf</label>
            <Input id="personeel-vanaf" type="date" value={vanaf} onChange={(e) => setVanaf(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-group__label" htmlFor="personeel-tot">Tot en met</label>
            <Input id="personeel-tot" type="date" value={tot} onChange={(e) => setTot(e.target.value)} />
          </div>
          <div className="periode-cijfers">
            <span className="periode-cijfer">
              <span className="periode-cijfer__label">Verbruikt</span>
              <strong className="periode-cijfer__waarde">{formatCurrency(totaalVerbruik)}</strong>
            </span>
            <span className="periode-cijfer">
              <span className="periode-cijfer__label">Aangevuld</span>
              <strong className="periode-cijfer__waarde">{formatCurrency(totaalAangevuld)}</strong>
            </span>
          </div>
        </div>
      </Card>

      {samenvattingen.length === 0 ? (
        <EmptyState
          title="Nog geen locatie voor personeel"
          body="Draai migratie 011_personeelslocaties.sql, of zet bij een bestaande locatie het vinkje 'voor personeel' aan."
        />
      ) : (
        samenvattingen.map((samenvatting) => {
          const regels = regelsVan(samenvatting);
          const geteld = laatsteTelling(state.tellingen, samenvatting.locatie.id);
          return (
            <Card key={samenvatting.locatie.id} className="card--tabel">
              <KaartKop
                titel={samenvatting.locatie.naam}
                sub={
                  geteld?.afgerondOp
                    ? `Laatst geteld op ${formatDate(geteld.afgerondOp)}`
                    : "Nog nooit geteld — tot die tijd staat het verbruik op nul"
                }
                rechts={
                  <span className="kaart-kop__cijfers">
                    <Badge variant="neutral">{formatCurrency(samenvatting.waardeVerbruik)} verbruikt</Badge>
                    {magBoeken ? (
                      <Button
                        variant="ghost-dark"
                        icon={null}
                        onClick={() => void tellen(samenvatting.locatie.id)}
                      >
                        Tellen
                      </Button>
                    ) : null}
                  </span>
                }
              />
              <Table<Regel>
                rowKey={(r) => r.productId}
                rows={regels}
                emptyMessage="Niets geboekt in deze periode."
                columns={[
                  { header: "Product", primair: true, render: (r) => r.naam },
                  {
                    header: "Aangevuld",
                    align: "right",
                    render: (r) => {
                      const product = productNaam.get(r.productId);
                      return product ? omschrijfAantal(product, r.aangevuld) : r.aangevuld;
                    },
                  },
                  {
                    header: "Verbruikt",
                    align: "right",
                    render: (r) => {
                      const product = productNaam.get(r.productId);
                      return product ? omschrijfAantal(product, r.verbruikt) : r.verbruikt;
                    },
                  },
                  {
                    header: "Nu in voorraad",
                    align: "right",
                    verbergOpMobiel: true,
                    render: (r) => {
                      const product = productNaam.get(r.productId);
                      return product ? omschrijfAantal(product, r.voorraad) : r.voorraad;
                    },
                  },
                  {
                    header: "Waarde verbruik",
                    align: "right",
                    render: (r) => formatCurrency(r.waardeVerbruikt),
                  },
                ]}
                totaal={[
                  "Totaal",
                  null,
                  null,
                  null,
                  formatCurrency(samenvatting.waardeVerbruik),
                ]}
              />
              {samenvatting.waardeAangevuld > 0 &&
              samenvatting.waardeAangevuld > samenvatting.waardeVerbruik * 2 ? (
                <p className="kaart-tekst">
                  Er is meer bijgevuld dan er afgeboekt is. Dat kan kloppen — het staat er dan nog —
                  maar als het langer geleden is dat er geteld is, weet je dat pas zeker na de
                  volgende telling.
                </p>
              ) : null}
            </Card>
          );
        })
      )}

      <VoorraadMutatieModal
        open={boeken !== null}
        actie="personeelsverbruik"
        standaardLocatieId={boeken ?? undefined}
        onClose={() => setBoeken(null)}
      />
    </>
  );
}
