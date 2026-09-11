import { useState } from "react";
import { AppIcon } from "../ui/AppIcon";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import { formatDateTimeKort } from "../../utils/format";

/**
 * De balk die vertelt dat er nog iets wacht.
 *
 * Een boeking die stilletjes in een la ligt is erger dan een boeking die
 * mislukt. Daarom is deze balk niet weg te klikken: hij staat er zolang er
 * iets in de wachtrij zit, op elk scherm, met eronder precies wát er wacht.
 * Pas als alles verstuurd is verdwijnt hij — en dan even met een bevestiging,
 * zodat je ziet dát het gelukt is.
 *
 * Boekingen van iemand anders die op dit apparaat heeft gewerkt blijven
 * staan tot diegene weer inlogt. Ze worden niet op jouw naam verstuurd: bij
 * elke boeking hoort wie het deed, en dat is precies waarom je bij een
 * telverschil kunt navragen wat er gebeurd is.
 */
export function Wachtbalk() {
  const { wachtrij, verstuurWachtrij, verwijderUitWachtrij } = useAppState();
  const { profiel } = useAuth();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  if (wachtrij.length === 0) return null;

  const vanJou = wachtrij.filter((i) => i.gebruikerId === profiel?.id);
  const vanAnderen = wachtrij.length - vanJou.length;

  async function versturen() {
    setBezig(true);
    try {
      await verstuurWachtrij();
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="wachtbalk" role="status">
      <div className="wachtbalk__kop">
        <span className="wachtbalk__tekst">
          <AppIcon name="clock" size={18} />
          <span>
            {vanJou.length > 0 ? (
              <>
                <strong>
                  {vanJou.length} {vanJou.length === 1 ? "boeking wacht" : "boekingen wachten"}
                </strong>{" "}
                op verbinding
              </>
            ) : (
              <>
                <strong>
                  {vanAnderen} {vanAnderen === 1 ? "boeking" : "boekingen"}
                </strong>{" "}
                van een ander account
              </>
            )}
            {vanJou.length > 0 && vanAnderen > 0 ? ` · ${vanAnderen} van een ander account` : ""}
          </span>
        </span>
        <span className="wachtbalk__acties">
          {vanJou.length > 0 ? (
            <button type="button" className="wachtbalk__knop" disabled={bezig} onClick={() => void versturen()}>
              {bezig ? "Bezig…" : "Nu versturen"}
            </button>
          ) : null}
          <button
            type="button"
            className="wachtbalk__knop wachtbalk__knop--zacht"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Verbergen" : "Bekijken"}
          </button>
        </span>
      </div>

      {open ? (
        <ul className="wachtbalk__lijst">
          {wachtrij.map((item) => {
            const eigen = item.gebruikerId === profiel?.id;
            return (
              <li key={item.id} className="wachtbalk__item">
                <span>
                  <span className="wachtbalk__omschrijving">{item.omschrijving}</span>
                  <span className="wachtbalk__meta">
                    {formatDateTimeKort(item.aangemaaktOp)}
                    {item.laatsteFout ? ` · ${item.laatsteFout}` : ""}
                    {eigen ? "" : " · wacht op de gebruiker die hem maakte"}
                  </span>
                </span>
                {/* Weggooien kan, maar alleen met de hand: er verdwijnt hier
                    nooit iets vanzelf. */}
                <button
                  type="button"
                  className="wachtbalk__knop wachtbalk__knop--zacht"
                  onClick={() => {
                    if (window.confirm(`"${item.omschrijving}" weggooien? Deze boeking wordt dan nooit verstuurd.`)) {
                      verwijderUitWachtrij(item.id);
                    }
                  }}
                >
                  Weggooien
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
