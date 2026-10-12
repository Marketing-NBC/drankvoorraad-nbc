import { NavLink } from "react-router-dom";
import { ROUTES } from "../../routes/routes";

/**
 * Magazijn heeft twee koppen: de voorraad drank en de lege emballage.
 * Emballage hoort bij het magazijn — daar staan de kratten en fusten tot
 * Swinkels ze meeneemt — en niet bij Leveringen, waar hij eerst zat.
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
