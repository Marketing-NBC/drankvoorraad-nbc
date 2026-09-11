import type { ReactNode } from "react";
import { Card } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { KaartKop } from "../../components/ui/KaartKop";
import { LageVoorraadMelding } from "../../components/ui/LageVoorraadMelding";
import { useAppState } from "../../context/AppStateContext";
import {
  dervingWaarde,
  lageVoorraad,
  topProducten,
  kostprijsMetingen,
  totaleBrutowinst,
  uitstaandPerEvenement,
} from "../../data/calculations";
import { formatCurrency, formatNumber } from "../../utils/format";
import { MargePerEvenementChart } from "./MargePerEvenementChart";
import { Rapporten } from "./Rapporten";
import { TopProducts } from "./TopProducts";

function StatKaart({
  label,
  waarde,
  body,
  petrol = false,
  alarm = false,
}: {
  label: string;
  waarde: ReactNode;
  body: string;
  /** Eén kaart per rij mag de aandacht pakken; hier is dat de brutowinst. */
  petrol?: boolean;
  alarm?: boolean;
}) {
  return (
    <div className={["stat-kaart", petrol && "stat-kaart--petrol"].filter(Boolean).join(" ")}>
      <div className="stat-kaart__kop">
        <span className="stat-kaart__label">{label}</span>
      </div>
      <div className={["stat-kaart__waarde", alarm && "stat-kaart__waarde--alarm"].filter(Boolean).join(" ")}>
        {waarde}
      </div>
      <div className="stat-kaart__body">{body}</div>
    </div>
  );
}

export function Dashboard() {
  const { state, laden, mutatiesPerEvenement, metingenPerEvenement } = useAppState();

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  /* Koffie en water komen niet uit het magazijn maar drukken wel op de marge.
     Per evenement de waarde van wat de machines daar getapt hebben. */
  const machineKosten = new Map(
    Array.from(metingenPerEvenement.entries()).map(([evenementId, metingen]) => [
      evenementId,
      kostprijsMetingen(metingen, state.machines, state.producten),
    ])
  );

  const { totaalBrutowinst } = totaleBrutowinst(
    state.evenementen,
    mutatiesPerEvenement,
    state.producten,
    machineKosten
  );
  const top5 = topProducten(state.mutaties, state.producten, 5);
  const derving = dervingWaarde(state.mutaties, state.producten);
  const tekorten = lageVoorraad(state.voorraad);
  const uitstaand = uitstaandPerEvenement(state.evenementen, mutatiesPerEvenement, state.producten);
  const waardeUitstaand = uitstaand.reduce((som, r) => som + r.waardeUitstaand, 0);

  return (
    <>
      <PageHeader
        eyebrow="in één oogopslag"
        title="Dashboard"
        toelichting="Wat er drinkt, wat er uitstaat en wat er bij moet — per evenement."
      />

      <LageVoorraadMelding />

      <div className="stat-grid">
        <StatKaart
          petrol
          label="Totale brutowinst"
          waarde={formatCurrency(totaalBrutowinst)}
          body="Evenementen die bezig of afgerond zijn."
        />
        <StatKaart
          label="Derving"
          waarde={formatCurrency(derving)}
          body="Waarde van beschadigde producten."
        />
        <StatKaart
          label="Uitstaand op evenementen"
          waarde={formatCurrency(waardeUitstaand)}
          body="Uitgegeven en nog niet retour geboekt."
        />
        <StatKaart
          label="Onder minimum"
          waarde={formatNumber(tekorten.length)}
          alarm={tekorten.length > 0}
          body="Producten die bijbesteld moeten worden."
        />
      </div>

      <div className="dashboard-grid">
        <Card className="card--tabel">
          <KaartKop titel="Top 5 meest gebruikte producten" sub="werkelijk verbruik over alle evenementen" />
          <TopProducts producten={top5} />
        </Card>

        <Card>
          <KaartKop titel="Brutomarge per evenement" sub="alleen evenementen met een ingevulde omzet" />
          <MargePerEvenementChart
            evenementen={state.evenementen}
            mutatiesPerEvenement={mutatiesPerEvenement}
            producten={state.producten}
          />
        </Card>
      </div>

      <Rapporten />
    </>
  );
}
