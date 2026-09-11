import type { EvenementMarge } from "../../data/calculations";
import { formatBrutomarge, formatCurrency } from "../../utils/format";

export function MargeSummary({ marge }: { marge: EvenementMarge }) {
  return (
    <div className="regellijst">
      <div className="regellijst__regel">
        <span>Waarde uitgegeven</span>
        <span>{formatCurrency(marge.waardeUitgegeven)}</span>
      </div>
      <div className="regellijst__regel">
        <span>Waarde retour</span>
        <span>{formatCurrency(marge.waardeRetour)}</span>
      </div>
      <div className="regellijst__regel">
        <span>Kostprijs verbruik</span>
        <span>{formatCurrency(marge.kostprijsVerbruik)}</span>
      </div>
      <div className="regellijst__regel">
        <span>Brutowinst</span>
        <span>{formatCurrency(marge.brutowinst)}</span>
      </div>
      <div className="regellijst__regel regellijst__regel--totaal">
        <span>Brutomarge</span>
        <span>{formatBrutomarge(marge.brutomarge)}</span>
      </div>
    </div>
  );
}
