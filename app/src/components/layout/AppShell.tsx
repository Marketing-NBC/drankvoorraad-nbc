import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Logo } from "../../design-system";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes/routes";

interface NavItem {
  to: string;
  label: string;
  /** Kortere variant voor de smalle onderbalk; valt terug op `label`. */
  tabLabel?: string;
  icon: AppIconName;
  alleenBeheerder?: boolean;
  /** Niet in de mobiele onderbalk — die wordt anders te vol. */
  buitenTabbalk?: boolean;
}

const navItems: NavItem[] = [
  { to: ROUTES.overzicht, label: "Evenementen", tabLabel: "Events", icon: "calendar" },
  { to: ROUTES.magazijn, label: "Magazijn", icon: "building" },
  { to: ROUTES.tellingen, label: "Tellingen", tabLabel: "Tellen", icon: "scan" },
  { to: ROUTES.producten, label: "Producten", icon: "doos" },
  { to: ROUTES.historie, label: "Mutaties", icon: "clock" },
  { to: ROUTES.dashboard, label: "Dashboard", tabLabel: "Cijfers", icon: "grafiek" },
  { to: ROUTES.gebruikers, label: "Gebruikers", icon: "gebruikers", alleenBeheerder: true, buitenTabbalk: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profiel, profielFout, uitloggen, mag } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  const zichtbareNav = navItems.filter((item) => !item.alleenBeheerder || mag("beheerder"));
  const tabbalkNav = zichtbareNav.filter((item) => !item.buitenTabbalk);
  const menuNav = zichtbareNav.filter((item) => item.buitenTabbalk);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to={ROUTES.overzicht} aria-label="Naar evenementenoverzicht" className="app-shell__merk">
          <Logo variant="color" height={28} />
        </NavLink>

        {/* Bovenbalk-navigatie: alleen vanaf tablet. Op mobiel zit de navigatie onderin. */}
        <nav className="app-shell__nav" aria-label="Hoofdnavigatie">
          {zichtbareNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.overzicht}
              className={({ isActive }) =>
                ["app-shell__nav-link", isActive && "app-shell__nav-link--actief"].filter(Boolean).join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-shell__account">
          <button
            type="button"
            className="app-shell__account-knop"
            aria-expanded={accountOpen}
            aria-label={profiel ? `Account: ${profiel.naam}` : "Account"}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <span className="app-shell__avatar" aria-hidden="true">
              {(profiel?.naam ?? "?").trim().charAt(0).toUpperCase()}
            </span>
            <span className="app-shell__gebruiker">
              {profiel?.naam}
              <span className="app-shell__rol">{profiel?.rol}</span>
            </span>
          </button>

          {accountOpen ? (
            <>
              <button
                type="button"
                className="app-shell__overlay"
                aria-label="Menu sluiten"
                onClick={() => setAccountOpen(false)}
              />
              <div className="app-shell__menu" role="menu">
                <span className="app-shell__menu-naam">
                  {profiel?.naam}
                  <span className="app-shell__rol">{profiel?.rol}</span>
                </span>
                {/* Beheerschermen die niet in de onderbalk passen. */}
                {menuNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="app-shell__menu-actie app-shell__menu-actie--link"
                    onClick={() => setAccountOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
                <button type="button" className="app-shell__menu-actie" onClick={() => void uitloggen()}>
                  Uitloggen
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <main className="app-shell__main">
        {profielFout ? <p className="form-error rol-waarschuwing">{profielFout}</p> : null}
        {children}
      </main>

      {/* Onderbalk: alleen op mobiel — binnen duimbereik, zoals in een app. */}
      <nav className="app-shell__tabbalk" aria-label="Hoofdnavigatie">
        {tabbalkNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ROUTES.overzicht}
            className={({ isActive }) =>
              ["app-shell__tab", isActive && "app-shell__tab--actief"].filter(Boolean).join(" ")
            }
          >
            <AppIcon name={item.icon} size={22} />
            <span className="app-shell__tab-label">{item.tabLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
