import { AppIcon } from "./AppIcon";

/**
 * Aantal invullen met de duim.
 *
 * Op de vloer staat iemand met een kar in zijn hand bij een pallet. Een
 * cijferveld betekent: toetsenbord omhoog, veld raken, typen, toetsenbord
 * weg. Twee grote knoppen is één beweging. Het veld ertussen blijft wel
 * bestaan, want 240 flesjes tik je sneller dan je klikt.
 */
export function AantalStepper({
  waarde,
  onChange,
  min = 0,
  max,
  stap = 1,
  ariaLabel,
  id,
}: {
  waarde: number;
  onChange: (nieuw: number) => void;
  min?: number;
  max?: number;
  stap?: number;
  ariaLabel: string;
  id?: string;
}) {
  function zet(nieuw: number) {
    let begrensd = Number.isFinite(nieuw) ? nieuw : min;
    if (begrensd < min) begrensd = min;
    if (max !== undefined && begrensd > max) begrensd = max;
    onChange(begrensd);
  }

  return (
    <div className="aantal-stepper">
      <button
        type="button"
        className="aantal-stepper__knop"
        aria-label={`${ariaLabel}: eentje minder`}
        disabled={waarde <= min}
        onClick={() => zet(waarde - stap)}
      >
        <AppIcon name="minus" size={20} />
      </button>
      <input
        id={id}
        className="aantal-stepper__veld"
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={stap}
        value={Number.isNaN(waarde) ? "" : waarde}
        onFocus={(e) => e.target.select()}
        onChange={(e) => zet(e.target.value === "" ? min : Number(e.target.value))}
      />
      <button
        type="button"
        className="aantal-stepper__knop"
        aria-label={`${ariaLabel}: eentje meer`}
        disabled={max !== undefined && waarde >= max}
        onClick={() => zet(waarde + stap)}
      >
        <AppIcon name="plus" size={20} />
      </button>
    </div>
  );
}
