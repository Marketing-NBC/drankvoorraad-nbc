import { NavLink } from "react-router-dom";
import { ROUTES } from "../../routes/routes";

/**
 * Magazijn heeft twee koppen: de voorraad drank en de emballage die in huis
 * staat. Wat er aan emballage terug naar de leverancier gaat — de retourbon —
 * staat bij Leveringen; zie LeveringTabs.
 */
export function MagazijnTabs() {
  const klasse = ({ isActive }: { isActive: boolean }) =>
    ["rapport-tab", "magazijn-tab", isActive && "rapport-tab--actief"].filter(Boolean).join(" ");
  return (
    <nav className="rapport-kiezer" aria-label="Magazijn">
      <NavLink to={ROUTES.magazijn} end className={klasse}>
        Voorraad
      </NavLink>
      <NavLink to={ROUTES.emballage} className={klasse}>
        Emballage
      </NavLink>
    </nav>
  );
}
