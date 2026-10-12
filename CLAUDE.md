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
  knop verbergen is geen beveiliging. De rollen zijn `beheerder`, `medewerker`
  en `housekeeping` (migratie 026; `magazijnmedewerker` bestaat nog als
  enumwaarde maar een controle op `profiles` laat hem niet meer toe).
  Magazijnwerk (pakbonnen, inkoop, verplaatsen, tellen, leveringen, emballage)
  mogen beheerder en medewerker; zie `mag_magazijnwerk()`. De medewerker
  beheert daarnaast evenementen, maar richt niets in: producten,
  minimumvoorraad, vulplekken en koppelingen zijn voor de beheerder.
  Housekeeping doet alleen de kantine en de kroeg: aanvullen, tellen en
  afboeken (`mag_tellen()` en de trigger `controleer_mutatie_rol`).
- **Afronden is voor de beheerder.** Een evenement op Afgerond zetten, en het
  daarna nog wijzigen of erop boeken, mag alleen de beheerder: na afloop
  controleert die alles en sluit het af. Zie `controleer_evenement` en
  `controleer_mutatie_rol` in migratie 027.
- **Uitgifte voor een evenement komt altijd uit Koelcel NBC**, ook bij Green
  Village. De app kiest die locatie zelf (`uitgiftelocatie` in
  `AppStateContext`); er is geen keuze meer.
- **Bedragen en marges zijn alleen voor de beheerder.** Inkoopprijs,
  statiegeld, omzet en borg zijn voor andere rollen ingetrokken en alleen te
  lezen of te zetten via `productbedragen`, `evenementomzet`,
  `emballageborg`, `stel_productbedragen` en `stel_omzet` (migratie 019).
  In de app staan ze dan op 0; schermen tonen ze alleen bij `zietBedragen`.
  Gevolg: een **nieuwe kolom** op `producten`, `evenementen` of `emballage`
  is niet vanzelf leesbaar — geef hem in dezelfde migratie een
  `grant select (kolom)`, anders laadt de app voor niemand.
- **Voorraad rekent altijd in stuks.** Een verpakking bepaalt alleen hoe er
  ingevoerd en getoond wordt: bij `alleen_per_verpakking` vult het magazijn
  kratten in en rekent de app om (× `stuks_per_verpakking`). De omrekening zit
  op één plek — `app/src/data/verpakking.ts` — en nergens anders. Reden: een
  koelkast wordt met 12 flesjes gevuld, niet met een halve krat, dus het
  product kán geen krat zijn. Raakt een boeking of telling de kantine of de
  kroeg, dan gaat het altijd per flesje (`losOpLocatie`).
- **De kantine en de kroeg zijn voor personeel.** Wat daar opgaat telt nooit
  mee bij een evenement. Een trigger weigert elke boeking die die twee mengt;
  zie `supabase/migraties/011_personeelslocaties.sql`. Er komen alleen
  producten met `voor_personeel` in: de grote flessen fris (1,25 en 1,5 L),
  radler, alcoholvrij bier en wijn (migratie 027).
- **In de kantine en de kroeg meet de telling het verbruik.** Een tekort wordt
  daar geboekt als `personeelsverbruik` en niet als `correctie` — niemand houdt
  achter de bar bij wie wat pakt. Een overschot blijft wél een correctie: meer
  vinden dan verwacht is een telfout of een niet-geboekte aanvulling. Zo blijft
  het telverschillenrapport gaan over voorraad die zoek is. Zie
  `supabase/migraties/018_personeelsverbruik_uit_telling.sql`.
- **In het magazijn heeft een tekort een reden.** Over datum of kapot wordt
  `beschadigd` (derving); een andere reden blijft een `correctie` met notitie
  "Voorraadtelling: <reden>". Zonder reden rondt `rond_telling_af` niet af
  (migratie 027).
- **Koffie en water hebben geen voorraad.** Franke en Aquablu leveren verbruik,
  geen kratten. Een meting is daarom géén mutatie: `mutaties` blijft over
  voorraadbewegingen gaan. Het verbruik telt wel mee in de marge.
- **Een levering boekt wat er werkelijk stond**, nooit wat de bon beweert. Het
  verschil blijft staan als openstaand punt richting de leverancier tot iemand
  het afhandelt. Zie `supabase/migraties/015_leveringen.sql`. Een gelezen
  foto van de bon vult alleen "op de bon" in. Een levering gaat naar het
  hoofdmagazijn of een koelcel, van Swinkels of Bidfood.
- **De wachtrij verliest nooit een boeking en boekt er nooit één dubbel.** Bij
  een haperende verbinding wacht de boeking op de telefoon; bij een weigering
  van de database krijgt de gebruiker de melding meteen. Het onderscheid zit in
  `isNetwerkfout` (`app/src/lib/wachtrij.ts`), en dubbel boeken wordt
  tegengehouden door een unieke index op `client_id`. Tellingen gaan er bewust
  niet in: die rekenen af tegen de voorraad van dát moment.
- **Een foto van de afleverbon verlaat de telefoon niet.** Tekstherkenning
  (Tesseract) draait in de browser: `app/src/lib/bonHerkenning.ts` leest de
  foto, `app/src/data/bonTekst.ts` maakt er bonnummer en regels van en zegt
  waar hij twijfelt. De herkenning zelf komt de eerste keer van
  cdn.jsdelivr.net. De Edge Function `supabase/functions/lees-bon` (Claude)
  staat klaar voor later, maar de app gebruikt hem niet zolang er geen
  API-sleutel is; die sleutel hoort dan alleen in Supabase, nooit in de
  browser.
- **De servicesleutel komt nooit in de browser.** Accounts aanmaken, een
  wachtwoord zetten en toegang intrekken gaat via de Edge Function
  `supabase/functions/gebruikers`, die zelf controleert of de aanvrager
  beheerder is.
- **De basis-URL staat op één plek**: `base` in `app/vite.config.ts`. De router
  leest dezelfde waarde via `import.meta.env.BASE_URL` in `app/src/main.tsx`.
  Verander die twee nooit los van elkaar.

## Hoe het in elkaar zit

| | |
|---|---|
| **App** | React 18 + TypeScript, gebouwd met Vite. Alles in `app/` |
| **Database** | Supabase (Postgres). Schema in `supabase/`, wijzigingen in `supabase/migraties/` |
| **Hosting** | GitHub Pages, workflows in `.github/workflows/` |
| **Huisstijl** | NBC design system in `app/src/design-system/` |

De map `design-system/` is een schone kopie van het NBC design system: daar
horen geen app-specifieke toevoegingen in. De vormgeving van deze app —
eigen tokens (creme pagina, petrol- en goudvlakken, statuskleuren, radii,
de UI-typeschaal) én de herstyling van de basisklassen `.btn`, `.card`,
`.badge` en `.input` — staat in `app/src/app.css`. Dat bestand wordt ná
`design-system/styles.css` geladen, dus die regels winnen.

Er is geen backend van onszelf: de browser praat rechtstreeks met Supabase,
afgeschermd door RLS-policies. Serverlogica zit in Postgres, aangeroepen via
RPC's: `start_telling`, `rond_telling_af`, `annuleer_telling`, `maak_pakbon`,
`stel_min_voorraad`, `boek_meting`, `boek_levering`, `handel_verschil_af`,
`gebruikers_overzicht`, `boek_emballage_retour`, `koppel_artikel`, en de
bedragfuncties uit migratie 019.

Lege emballage die terug gaat naar de leverancier wordt vastgelegd op de
tabellen `emballage` (soorten met borg en het artikelnummer van de
retourbon), `emballage_retouren` (de bon) en `emballage_mutaties` (de regels).
Dat raakt de drankvoorraad niet; het is de controle op de creditnota. In de
app is het de tweede kop onder Magazijn. De retourbon wordt met de hand
overgenomen van het papier.

Welk product bij een artikelnummer op de afleverbon hoort, staat in
`leverancier_artikelen` (met het aantal stuks per eenheid: krat 24, tray 12).
Een onbekend artikel koppelt het magazijn bij het uitpakken; de app onthoudt
het via `koppel_artikel`. De omzetting van een gelezen bon naar regels zit in
`app/src/data/bon.ts`; een artikelnummer dat op één cijfer na gelijk is aan
een bekend nummer telt als dat artikel, met de markering "nakijken". De test
`bonTekst.test.ts` draait op de echte herkende tekst van een gekreukte bon
van Swinkels; verander je de instellingen van de herkenning, maak die fixture
dan opnieuw.

Consumpties per persoon (`app/src/data/consumpties.ts`) rekenen met het
werkelijke verbruik en `aantal_personen` op het evenement. Een flesje is één
consumptie; fust en wijn tellen in glazen van 25 cl.

`importeer_metingen` is de enige RPC die de app zelf niet aanroept. Dat is de
poort waar de koppeling met Franke en Aquablu straks op aansluit: een Edge
Function haalt hun dagtotalen op en gooit ze daarin. De vorm ligt vast en is
idempotent, dus die functie kan geschreven worden zodra de koppeling er is,
zonder dat er aan de app of de database iets verandert.

`app/src/context/AppStateContext.tsx` is de enige datalaag. Die laadt alles bij
het opstarten en abonneert zich op een realtime-kanaal (`drankvoorraad`) dat bij
elke wijziging in `mutaties`, `evenementen`, `producten`, `voorraad`, `locaties`
of `pakbonnen` een stille herlaad doet.

Inloggen gaat uitsluitend met e-mail en wachtwoord (`signInWithPassword`). Er is
geen magic link, geen OAuth en geen wachtwoordherstel — dus ook geen
redirect-URL's die in Supabase geconfigureerd moeten staan.

Serverwerk dat niet in Postgres kan staat in `supabase/functions/`: de
functies `gebruikers` en `lees-bon` (die laatste nog niet in gebruik). Die
moeten apart neergezet worden (`supabase functions deploy …`) — zie de README
daar, inclusief wat er in het dashboard nog uit moet staan.

## Databasewijzigingen

Vanaf `010` gaat elke wijziging als genummerd bestand in `supabase/migraties/`;
zie de README daar. De losse `faseN.sql`-bestanden één map hoger zijn de
geschiedenis tot dat punt. Elke migratie is herhaalbaar (`if not exists`,
`on conflict`, `create or replace`) en wordt eerst op een wegwerpkopie gedraaid.

Lokaal uitproberen kan zonder Supabase: start een Postgres, draai
`schema.sql`, `seed.sql`, de `faseN.sql`-bestanden en daarna de migraties. Er
is één ding dat Supabase meebrengt en Postgres niet: het schema `auth` met
`auth.users` en `auth.uid()`, plus de publicatie `supabase_realtime`. Een stub
daarvan is genoeg om alles te laten draaien.

## De schermen zonder Supabase bekijken

`npm run preview:ui` draait de échte schermen met verzonnen gegevens. De twee
contextmodules worden door `vite.preview.config.ts` vervangen door de stubs in
`app/preview/`; verder is het dezelfde code. Handig om vormgeving te
beoordelen zonder op productiedata te werken, en het enige dat er nu voor in
de plaats is zolang er geen test-Supabase naast productie staat.

Voeg een pad toe met `?pad=`, bijvoorbeeld
`http://localhost:5173/?pad=/magazijn`. Met `&rol=medewerker` of
`&rol=housekeeping` zie je het scherm zoals die rol het ziet (zonder
bedragen). De map `app/preview/` hoort niet in de
publicatiebuild: die gebruikt `vite.config.ts`.

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

Vier dingen die bij "van PoC naar af" waarschijnlijk terugkomen. Geen van deze is
kapot — het zijn keuzes die passen bij een PoC en knellen zodra het menens wordt:

- **Testdekking.** 121 tests over rekenlogica (`app/src/data/`), de wachtrij
  (`app/src/lib/`) en de Excel-export (`app/src/utils/`). Geen enkel scherm of
  gebruikersstroom is getest, terwijl daar de meeste code zit.
- **Databasemigraties.** Half opgelost: nieuwe wijzigingen staan genummerd in
  `supabase/migraties/`, maar van de oude `faseN.sql`-bestanden is nog steeds
  niet vast te stellen wat er precies op productie staat. Er is ook geen
  terugdraaipad.
- **Zware schermen.** Ongeveer de helft van de code zit in `app/src/screens/`.
  Logica en weergave lopen door elkaar, wat testen en wijzigen duur maakt.
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
