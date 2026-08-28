# Werken aan deze app

Voorraadbeheer voor drank rond evenementen, voor NBC en Green Village.
Live op https://marketing-nbc.github.io/drankvoorraad-nbc/

De app staat in `app/` — de projectmap is níét de app-map. Commando's als
`npm run dev`, `npm run test` en `npm run build` draai je vanuit `app/`.

## Regels die je niet mag breken

Dit zijn geen stijlvoorkeuren maar afspraken waar de betrouwbaarheid van de
voorraadstand op rust:

- **`mutaties` is append-only.** Nooit wijzigen, nooit verwijderen. De tabel is
  het audit trail: de volledige voorraadstand is er altijd uit af te leiden.
- **`voorraad` wordt alleen door een databasetrigger bijgewerkt**, nooit
  rechtstreeks vanuit de app. Zie `supabase/schema.sql`.
- **Rollen worden in de database afgedwongen**, niet alleen in het scherm. Een
  knop verbergen is geen beveiliging. De rollen zijn `beheerder`,
  `magazijnmedewerker` en `evenementmanager`.
- **De basis-URL staat op één plek**: `base` in `app/vite.config.ts`. De router
  leest dezelfde waarde via `import.meta.env.BASE_URL` in `app/src/main.tsx`.
  Verander die twee nooit los van elkaar.

## Hoe het in elkaar zit

| | |
|---|---|
| **App** | React 18 + TypeScript, gebouwd met Vite. Alles in `app/` |
| **Database** | Supabase (Postgres). Schema en migraties in `supabase/` |
| **Hosting** | GitHub Pages, workflows in `.github/workflows/` |
| **Huisstijl** | NBC design system in `app/src/design-system/` |

Er is geen backend van onszelf: de browser praat rechtstreeks met Supabase,
afgeschermd door RLS-policies. Serverlogica zit in Postgres, aangeroepen via
RPC's: `start_telling`, `rond_telling_af`, `annuleer_telling`, `maak_pakbon`,
`stel_min_voorraad`.

`app/src/context/AppStateContext.tsx` is de enige datalaag. Die laadt alles bij
het opstarten en abonneert zich op een realtime-kanaal (`drankvoorraad`) dat bij
elke wijziging in `mutaties`, `evenementen`, `producten`, `voorraad`, `locaties`
of `pakbonnen` een stille herlaad doet.

Inloggen gaat uitsluitend met e-mail en wachtwoord (`signInWithPassword`). Er is
geen magic link, geen OAuth en geen wachtwoordherstel — dus ook geen
redirect-URL's die in Supabase geconfigureerd moeten staan.

## Publiceren

Een push naar `main` draait de tests, de typecontrole en de build, en zet het
resultaat live. Faalt er iets, dan wordt er niets gepubliceerd en blijft de
vorige versie staan. Pull requests krijgen dezelfde controle zonder te
publiceren.

`VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` staan lokaal in `app/.env` en
voor het publiceren in GitHub onder Settings → Secrets and variables → Actions.
Ontbreken ze, dan stopt de build expres — zie
`app/scripts/controleer-omgeving.mjs`. Dat bestand bestaat omdat een build met
lege waarden gewoon slaagt en er dan een witte pagina live gaat.

GitHub Pages kan geen paden naar `index.html` sturen zoals een gewone webserver.
Daarom zet de workflow een kopie van `index.html` neer als `404.html`; Pages valt
daarop terug en de router leest het pad uit de adresbalk. Diepe links en F5
blijven zo werken. Die kopie wordt bij het bouwen gemaakt en staat bewust niet in
de repo, omdat `index.html` naar bestandsnamen met een hash verwijst.

Twee dingen die op Pages niet kunnen en bewust vervallen zijn: eigen
beveiligingsheaders en een lange cachetijd op `/assets/*`.

## Startpunt voor V2

Wat er nu staat is een proof of concept dat echt draait. De stap naar V2 is het
afmaken ervan. Deze paragraaf mag weg zodra dat plan er ligt.

Werk je aan de vormgeving? Lees dan eerst `ontwerp-app-modus.md`. Daar staat
waarom de huisstijl in `app/src/design-system/` tegenwerkt op een werkscherm, en
in welke volgorde dat wordt aangepakt.

Vier dingen die bij "van PoC naar af" waarschijnlijk terugkomen. Geen van deze is
kapot — het zijn keuzes die passen bij een PoC en knellen zodra het menens wordt:

- **Testdekking.** 38 tests, alleen over rekenlogica (`app/src/data/`) en de
  Excel-export (`app/src/utils/`). Geen enkel scherm of gebruikersstroom is
  getest, terwijl daar de meeste code zit.
- **Databasemigraties.** `supabase/` bevat losse bestanden `fase2.sql` t/m
  `fase9.sql` die met de hand in de SQL-editor zijn uitgevoerd, plus een
  `fase9-terugdraaien.sql`. Er is geen manier om vast te stellen wat er
  daadwerkelijk op productie staat, en geen manier om iets terug te draaien. Dit
  is het eerste dat je ter discussie stelt zodra V2 het datamodel raakt.
- **Zware schermen.** Ongeveer de helft van de code zit in `app/src/screens/`
  (3.400 regels over 10 schermen). Logica en weergave lopen door elkaar, wat
  testen en wijzigen duur maakt.
- **Eén omgeving.** Er is geen test-Supabase naast productie, dus experimenteren
  gebeurt op echte data.

Verder is `npm run lint` stuk: er is geen `eslint.config.js` voor ESLint 9. Lint
zit niet in het publicatiepad, dus het houdt niets tegen — maar het betekent ook
dat er feitelijk niet gelint wordt.

## Wat bewust niet gebouwd is

Geen native app (de mobiele browser volstaat), geen offline synchronisatie
(conflicten oplossen is te risicovol), geen RFID (metaal en vloeistof verstoren
het signaal). De koppeling met SEM is een apart traject; het datamodel is er al
op voorbereid met een vrij invulbaar evenementnummer.
