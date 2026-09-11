import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../../design-system";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { useAppState } from "../../context/AppStateContext";
import type { GebruikerRol } from "../../data/types";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes/routes";
import { Zoekbalk } from "./Zoekbalk";

interface NavItem {
  to: string;
  label: string;
  /** Kortere variant voor de smalle onderbalk; valt terug op `label`. */
  tabLabel?: string;
  icon: AppIconName;
  alleenBeheerder?: boolean;
  /** Beperkt het item tot deze rollen — houd gelijk aan de guard in App.tsx. */
  rollen?: GebruikerRol[];
  /** Niet in de mobiele onderbalk — die wordt anders te vol. */
  buitenTabbalk?: boolean;
}

/** Volgorde in de zijbalk: cijfers eerst, dan het dagelijkse werk. */
const navItems: NavItem[] = [
  { to: ROUTES.dashboard, label: "Dashboard", tabLabel: "Cijfers", icon: "grafiek" },
  { to: ROUTES.overzicht, label: "Evenementen", tabLabel: "Events", icon: "calendar" },
  { to: ROUTES.magazijn, label: "Magazijn", icon: "building" },
  { to: ROUTES.tellingen, label: "Tellingen", tabLabel: "Tellen", icon: "scan" },
  { to: ROUTES.producten, label: "Producten", icon: "doos" },
  { to: ROUTES.historie, label: "Mutaties", icon: "clock" },
  /* Koffie, water en personeel zijn beheerwerk dat niet dagelijks op de vloer
     gebeurt. Ze horen in de zijbalk en het accountmenu, niet in de zes vakken
     van de onderbalk — die is voor wat je met een kar in je hand doet. */
  {
    to: ROUTES.koppelingen,
    label: "Koffie en water",
    tabLabel: "Koffie",
    icon: "doos",
    buitenTabbalk: true,
    rollen: ["beheerder", "magazijnmedewerker"],
  },
  { to: ROUTES.personeel, label: "Personeel", icon: "gebruikers", buitenTabbalk: true },
  { to: ROUTES.gebruikers, label: "Gebruikers", icon: "gebruikers", alleenBeheerder: true, buitenTabbalk: true },
];

/** Volgorde in de onderbalk — zes gelijke vakken, duim-eerst. */
const tabVolgorde = [ROUTES.overzicht, ROUTES.magazijn, ROUTES.tellingen, ROUTES.producten, ROUTES.historie, ROUTES.dashboard];

/**
 * Naam van het scherm in de mobiele kop, plus of er een pijl terug hoort.
 * Detailschermen hebben geen eigen tab in de onderbalk; de pijl is daar de
 * weg omhoog.
 */
function schermNaam(pad: string): { label: string; terug: boolean } {
  if (pad === ROUTES.overzicht) return { label: "Overzicht", terug: false };
  if (pad.startsWith("/evenementen/") && pad.endsWith("/pakbon")) return { label: "Pakbon", terug: true };
  if (pad.startsWith("/evenementen/")) return { label: "Evenement", terug: true };
  if (pad.startsWith("/pakbonnen/")) return { label: "Pakbon", terug: true };
  if (pad.startsWith("/tellingen/")) return { label: "Telling", terug: true };
  const item = navItems.find((n) => n.to === pad);
  return { label: item?.label ?? "Drankvoorraad", terug: false };
}

const maandNotatie = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

export function AppShell({ children }: { children: ReactNode }) {
  const { profiel, profielFout, uitloggen, mag } = useAuth();
  const { state } = useAppState();
  const navigate = useNavigate();
  const pad = useLocation().pathname;
  const [accountOpen, setAccountOpen] = useState(false);

  const zichtbareNav = navItems.filter(
    (item) =>
      (!item.alleenBeheerder || mag("beheerder")) && (!item.rollen || mag(...item.rollen))
  );
  const menuNav = zichtbareNav.filter((item) => item.buitenTabbalk);
  const gebruikersItem = navItems.find((item) => item.to === ROUTES.gebruikers)!;

  /* De onderbalk heeft zes vakken. Staat de gebruiker op een scherm dat er
     niet in zit (Gebruikers), dan neemt dat scherm het laatste vak over —
     zo is altijd zichtbaar waar je bent. Via het accountmenu kom je er weer
     terug. */
  const opGebruikers = pad === ROUTES.gebruikers;
  const tabbalkNav = tabVolgorde
    .map((to) => zichtbareNav.find((item) => item.to === to))
    .filter((item): item is NavItem => item !== undefined);
  const tabs = opGebruikers && mag("beheerder")
    ? [...tabbalkNav.slice(0, 5), { ...gebruikersItem, tabLabel: "Meer" }]
    : tabbalkNav;

  const kop = schermNaam(pad);
  const maand = maandNotatie.format(new Date());
  const initiaal = (profiel?.naam ?? "?").trim().charAt(0).toUpperCase();
  const aantalEvenementen = state.evenementen.length;

  const accountMenu = (
    <div className="app-shell__account">
      <button
        type="button"
        className="app-shell__account-knop"
        aria-expanded={accountOpen}
        aria-label={profiel ? `Account: ${profiel.naam}` : "Account"}
        onClick={() => setAccountOpen(!accountOpen)}
      >
        <span className="avatar" aria-hidden="true">{initiaal}</span>
        <span className="app-shell__gebruiker">
          <span>{profiel?.naam}</span>
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
            {menuNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="app-shell__menu-actie"
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
  );

  return (
    <div className="app-shell">
      {/* Zijbalk: alleen op desktop. Daaronder neemt de onderbalk het over. */}
      <aside className="zijbalk">
        <NavLink to={ROUTES.dashboard} aria-label="Naar dashboard" className="zijbalk__merk">
          <Logo variant="mark-color" height={26} />
        </NavLink>

        <nav className="zijbalk__groep" aria-label="Voorraad">
          <span className="zijbalk__label">Voorraad</span>
          {zichtbareNav
            .filter((item) => item.to !== ROUTES.gebruikers)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.overzicht}
                className={({ isActive }) =>
                  ["zijbalk__item", isActive && "zijbalk__item--actief"].filter(Boolean).join(" ")
                }
              >
                <AppIcon name={item.icon} size={18} />
                {item.label}
                {item.to === ROUTES.overzicht && aantalEvenementen > 0 ? (
                  <span className="zijbalk__teller">{aantalEvenementen}</span>
                ) : null}
              </NavLink>
            ))}
        </nav>

        <nav className="zijbalk__groep" aria-label="Algemeen">
          <span className="zijbalk__label">Algemeen</span>
          {mag("beheerder") ? (
            <NavLink
              to={ROUTES.gebruikers}
              className={({ isActive }) =>
                ["zijbalk__item", isActive && "zijbalk__item--actief"].filter(Boolean).join(" ")
              }
            >
              <AppIcon name="gebruikers" size={18} />
              Gebruikers
            </NavLink>
          ) : null}
          <button type="button" className="zijbalk__item" onClick={() => void uitloggen()}>
            <AppIcon name="uitloggen" size={18} />
            Uitloggen
          </button>
        </nav>

        {/* Tellen gebeurt op de vloer, niet achter dit scherm — vandaar de
            snelste weg ernaartoe onderaan de zijbalk. */}
        {mag("beheerder", "magazijnmedewerker") ? (
          <NavLink to={ROUTES.tellingen} className="zijbalk__promo">
            <span className="zijbalk__promo-titel">Telling<br />op de vloer</span>
            <span className="zijbalk__promo-sub">Scan met de tablet in de koelcel.</span>
            <span className="zijbalk__promo-knop">Start telling</span>
          </NavLink>
        ) : null}
      </aside>

      <div className="app-shell__kolom">
        <header className="topbalk">
          <Zoekbalk />
          <span className="topbalk__maand">{maand.charAt(0).toUpperCase() + maand.slice(1)}</span>
          {accountMenu}
        </header>

        <header className="mobiele-kop">
          {kop.terug ? (
            <button type="button" className="mobiele-kop__naam" onClick={() => navigate(-1)}>
              <AppIcon name="arrow-left" size={16} />
              {kop.label}
            </button>
          ) : (
            <span className="mobiele-kop__naam">{kop.label}</span>
          )}
          <span className="mobiele-kop__rechts">{accountMenu}</span>
        </header>

        <main className="app-shell__main">
          {profielFout ? <p className="form-error rol-waarschuwing">{profielFout}</p> : null}
          {children}
        </main>
      </div>

      {/* Onderbalk: alleen op mobiel — binnen duimbereik, zoals in een app. */}
      <nav className="tabbalk" aria-label="Hoofdnavigatie">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ROUTES.overzicht}
            className={({ isActive }) =>
              ["tabbalk__item", isActive && "tabbalk__item--actief"].filter(Boolean).join(" ")
            }
          >
            <AppIcon name={item.icon} size={22} />
            <span className="tabbalk__label">{item.tabLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
