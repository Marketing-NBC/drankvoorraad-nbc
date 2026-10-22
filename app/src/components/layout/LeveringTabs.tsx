import { NavLink } from "react-router-dom";
import { ROUTES } from "../../routes/routes";

/**
 * Leveringen heeft twee koppen: wat er binnenkomt en de lege emballage die
 * met de vrachtwagen weer meegaat. Beide gebeuren bij dezelfde chauffeur,
 * dus de retourbon staat hier en niet onder Magazijn.
 */
export function LeveringTabs() {
  const klasse = ({ isActive }: { isActive: boolean }) =>
    ["rapport-tab", "magazijn-tab", isActive && "rapport-tab--actief"].filter(Boolean).join(" ");
  return (
    <nav className="rapport-kiezer" aria-label="Leveringen">
      <NavLink to={ROUTES.leveringen} end className={klasse}>
        Binnenkomst
      </NavLink>
      <NavLink to={ROUTES.emballageRetour} className={klasse}>
        Emballage retour
      </NavLink>
    </nav>
  );
}
