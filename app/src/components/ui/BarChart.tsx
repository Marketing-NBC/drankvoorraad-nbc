export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  formatValue?: (value: number) => string;
  /** Wat de staven laten zien, voor schermlezers. */
  label?: string;
}

/**
 * Liggende staven, één regel per item: naam en waarde erboven, de staaf
 * eronder over de volle breedte. Op een telefoon past een evenementnaam zo
 * altijd, en tien evenementen worden een lijst in plaats van tien smalle
 * zuilen. Zonder grafiekbibliotheek: het is gewoon HTML en CSS.
 *
 * Een negatieve waarde krijgt een rode staaf; de lengte is steeds de
 * grootte ten opzichte van de grootste waarde.
 */
export function BarChart({ data, formatValue = (v) => `${Math.round(v)}%`, label = "Staafdiagram" }: BarChartProps) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  return (
    <ul className="ui-barchart" aria-label={label}>
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} className="ui-barchart__rij">
          <span className="ui-barchart__label" title={d.label}>{d.label}</span>
          <span className={["ui-barchart__waarde", d.value < 0 && "ui-barchart__waarde--negatief"].filter(Boolean).join(" ")}>
            {formatValue(d.value)}
          </span>
          <span className="ui-barchart__baan" aria-hidden="true">
            <span
              className={["ui-barchart__staaf", d.value < 0 && "ui-barchart__staaf--negatief"].filter(Boolean).join(" ")}
              style={{ width: `${Math.max(1.5, (Math.abs(d.value) / max) * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
