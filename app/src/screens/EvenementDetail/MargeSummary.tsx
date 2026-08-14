import type { EvenementMarge } from "../../data/calculations";
import { formatBrutomarge, formatCurrency } from "../../utils/format";

export function MargeSummary({ marge }: { marge: EvenementMarge }) {
  return (
    <div className="marge-summary">
      <div className="marge-summary__row">
        <span>Waarde uitgegeven</span>
        <span>{formatCurrency(marge.waardeUitgegeven)}</span>
      </div>
      <div className="marge-summary__row">
        <span>Waarde retour</span>
        <span>{formatCurrency(marge.waardeRetour)}</span>
      </div>
      <div className="marge-summary__row">
        <span>Kostprijs verbruik</span>
        <span>{formatCurrency(marge.kostprijsVerbruik)}</span>
      </div>
      <div className="marge-summary__row">
        <span>Brutowinst</span>
        <span>{formatCurrency(marge.brutowinst)}</span>
      </div>
      <div className="marge-summary__row marge-summary__row--total">
        <span>Brutomarge</span>
        <span>{formatBrutomarge(marge.brutomarge)}</span>
      </div>
    </div>
  );
}
