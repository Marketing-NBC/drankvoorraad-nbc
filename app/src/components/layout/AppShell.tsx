import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../../design-system";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { useAppState } from "../../context/AppStateContext";
import type { GebruikerRol } from "../../data/types";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes/routes";
import { rolLabel } from "../../screens/Gebruikers/rollen";
import { Wachtbalk } from "./Wachtbalk";
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

/** Iedereen behalve housekeeping: die regelt alleen de kantine en de kroeg. */
const WERK: GebruikerRol[] = ["beheerder", "medewerker"];

/** Volgorde in de zijbalk: cijfers eerst, dan het dagelijkse werk. */
const navItems: NavItem[] = [
  /* Het dashboard is cijfers: marges, derving, voorraadwaarde. Dat zijn
     bedragen, en die zijn alleen voor de beheerder. */
  { to: ROUTES.dashboard, label: "Dashboard", tabLabel: "Cijfers", icon: "grafiek", rollen: ["beheerder"] },
  { to: ROUTES.overzicht, label: "Evenementen", tabLabel: "Events", icon: "calendar", rollen: WERK },
  { to: ROUTES.magazijn, label: "Magazijn", icon: "building", rollen: WERK },
  { to: ROUTES.leveringen, label: "Leveringen", tabLabel: "Binnen", icon: "doos", rollen: WERK },
  { to: ROUTES.tellingen, label: "Tellingen", tabLabel: "Tellen", icon: "scan" },
  { to: ROUTES.producten, label: "Producten", icon: "doos", rollen: WERK },
  { to: ROUTES.historie, label: "Mutaties", icon: "clock", rollen: WERK },
  /* Koffie, water en personeel zijn beheerwerk dat niet dagelijks op de vloer
     gebeurt. Ze horen in de zijbalk en het accountmenu, niet in de zes vakken
     van de onderbalk — die is voor wat je met een kar in je hand doet. */
  {
    to: ROUTES.koppelingen,
    label: "Koffie en water",
    tabLabel: "Koffie",
    icon: "doos",
    buitenTabbalk: true,
    rollen: ["beheerder"],
  },
  { to: ROUTES.personeel, label: "Personeel", icon: "gebruikers", buitenTabbalk: true },
  { to: ROUTES.gebruikers, label: "Gebruikers", icon: "gebruikers", alleenBeheerder: true, buitenTabbalk: true },
];

/** Volgorde in de onderbalk — zes gelijke vakken, duim-eerst. */
/* Zes vakken, duim-eerst. Leveringen staat erin omdat dat dagelijks werk op
   de vloer is; Mutaties niet, want dat lees je achteraf op een groot scherm —
   die staat in de zijbalk en het accountmenu. */
const tabVolgorde = [ROUTES.overzicht, ROUTES.magazijn, ROUTES.leveringen, ROUTES.tellingen, ROUTES.producten, ROUTES.dashboard];

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
  if (pad === ROUTES.leveringNieuw) return { label: "Levering aannemen", terug: true };
  if (pad === ROUTES.emballage) return { label: "Emballage", terug: false };
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
  /* Housekeeping heeft maar twee schermen: personeel en tellen. Die staan
     dan gewoon allebei in de onderbalk. */
  const tabs = mag("housekeeping")
    ? zichtbareNav
    : opGebruikers && mag("beheerder")
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
          <span className="app-shell__rol">{profiel ? rolLabel[profiel.rol] : ""}</span>
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
              <span className="app-shell__rol">{profiel ? rolLabel[profiel.rol] : ""}</span>
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
        <NavLink
          to={mag("beheerder") ? ROUTES.dashboard : mag("housekeeping") ? ROUTES.personeel : ROUTES.overzicht}
          aria-label={
            mag("beheerder") ? "Naar dashboard" : mag("housekeeping") ? "Naar personeel" : "Naar evenementen"
          }
          className="zijbalk__merk"
        >
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

      </aside>

      <div className="app-shell__kolom">
        <header className="topbalk">
          {/* Zoeken gaat over evenementen en producten: niets voor housekeeping. */}
          {mag("housekeeping") ? <span style={{ flex: 1 }} /> : <Zoekbalk />}
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
          <Wachtbalk />
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
