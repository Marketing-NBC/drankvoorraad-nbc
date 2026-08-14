import { Card, Stat } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { LageVoorraadMelding } from "../../components/ui/LageVoorraadMelding";
import { useAppState } from "../../context/AppStateContext";
import {
  dervingWaarde,
  lageVoorraad,
  topProducten,
  totaleBrutowinst,
  uitstaandPerEvenement,
} from "../../data/calculations";
import { formatCurrency, formatNumber } from "../../utils/format";
import { MargePerEvenementChart } from "./MargePerEvenementChart";
import { Rapporten } from "./Rapporten";
import { TopProducts } from "./TopProducts";

export function Dashboard() {
  const { state, laden, mutatiesPerEvenement } = useAppState();

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  const { totaalBrutowinst } = totaleBrutowinst(
    state.evenementen,
    mutatiesPerEvenement,
    state.producten
  );
  const top5 = topProducten(state.mutaties, state.producten, 5);
  const derving = dervingWaarde(state.mutaties, state.producten);
  const tekorten = lageVoorraad(state.voorraad);
  const uitstaand = uitstaandPerEvenement(state.evenementen, mutatiesPerEvenement, state.producten);
  const waardeUitstaand = uitstaand.reduce((som, r) => som + r.waardeUitstaand, 0);

  return (
    <>
      <PageHeader eyebrow="in één oogopslag" title="Dashboard" />

      <LageVoorraadMelding />

      <div className="stat-grid">
        <Card padding="feature">
          <Stat
            value={formatCurrency(totaalBrutowinst)}
            label="Totale brutowinst"
            body="Evenementen die bezig of afgerond zijn."
          />
        </Card>
        <Card padding="feature">
          <Stat value={formatCurrency(derving)} label="Derving" body="Waarde van beschadigde producten." />
        </Card>
        <Card padding="feature">
          <Stat
            value={formatCurrency(waardeUitstaand)}
            label="Uitstaand op evenementen"
            body="Uitgegeven en nog niet retour geboekt."
          />
        </Card>
        <Card padding="feature">
          <Stat
            value={formatNumber(tekorten.length)}
            label="Onder minimum"
            body="Producten die bijbesteld moeten worden."
          />
        </Card>
      </div>

      <div className="dashboard-grid">
        <div>
          <div className="section-title">
            <h3>Top 5 meest gebruikte producten</h3>
          </div>
          <Card>
            <TopProducts producten={top5} />
          </Card>
        </div>

        <div>
          <div className="section-title">
            <h3>Brutomarge per evenement</h3>
          </div>
          <Card>
            <MargePerEvenementChart
              evenementen={state.evenementen}
              mutatiesPerEvenement={mutatiesPerEvenement}
              producten={state.producten}
            />
          </Card>
        </div>
      </div>

      <Rapporten />
    </>
  );
}
