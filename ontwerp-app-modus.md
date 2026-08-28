# Ontwerpnotitie — een app-modus voor het NBC design system

Vastgelegd op 28 augustus 2026, na een verkenning van de huidige vormgeving.
Er is nog niets van gebouwd: dit is de analyse en de afgesproken volgorde, zodat
een volgende sessie niet opnieuw bij nul begint.

## Waar het aan schort

De huisstijl in `app/src/design-system/` is een merksysteem voor een
marketingsite, en wordt hier gebruikt als product-UI. Dat is de gemeenschappelijke
oorzaak van vrijwel alles wat aan het scherm niet klopt — de uitstraling, het
gebrek aan hiërarchie, het gebruik op een telefoon en de vlakke navigatie.

Het is terug te lezen in de code:

- `tokens/spacing.css` gaat uit van `--section-y: 160px`, `--container-max: 1792px`
  en `--layout-pad: 64px`: een 1920-referentiegrid, terwijl de app in het magazijn
  op een telefoon draait.
- `tokens/typography.css` heeft display-formaten tot 168px. Een voorraadscherm
  heeft eerder een dichtheidsschaal nodig dan een display-schaal.
- `components/content/Stat.tsx` rendert `clamp(72px, 7vw, 120px)` en `app.css`
  draait dat terug naar `clamp(28px, 12cqi, 40px)` — met een comment dat precies
  benoemt waarom. Het dashboard vecht met zijn eigen designsysteem.
- `components/core/Button.tsx` heeft `icon = "arrow-right"` als standaardwaarde.
  Elke knop is daarmee een marketing-CTA, ook "Opslaan" en "Boeken".
- `app.css` pelt met `.card:has(> .card__body > .data-table-wrap)` een kaart weer
  weg, omdat `Card` voor contentblokken is ontworpen en niet voor tabellen.
- Knopmaten worden op meerdere plekken opnieuw uitgevonden
  (`.page-header__actions .btn`, `.button-row .btn`,
  `.section-title--compact .actie-menu__knop`), omdat er geen maatvoering voor een
  werkscherm bestaat.
- Er is één accentkleur, goud is expliciet nooit een CTA, en naast
  `success`/`warning`/`error` is er niets. Referentiedata en "dit moet nu" zien er
  daardoor hetzelfde uit.
- `AppShell.tsx` heeft zeven gelijkwaardige navigatie-items, module-gedreven,
  terwijl het werk een route is: evenement → pakbon → uitgifte → retour → telling.

Wat níét het probleem is: de app-CSS zelf. Die is mobile-first, zorgvuldig
becommentarieerd, laat tabellen op een telefoon netjes naar kaartjes vallen, en de
onderbalk werkt goed. Er ontbreekt een laag tússen merk en scherm.

## Wat we willen

Eén NBC design system, met een gedeelde merkbasis en twee contexten daarbovenop:

| | Web (bestaand) | App (nieuw) |
|---|---|---|
| Type | Pockota display tot 168px | Area Normal draagt de UI; Pockota alleen op identiteitsmomenten — inlogscherm, lege staten |
| Ruimte | `--section-y: 160px` | Eigen dichtheidsschaal; regelhoogtes in plaats van secties |
| Knoppen | Pill met pijl, CTA-gedrag | Werkbare knop; de pijl is een uitzondering, geen standaard |
| Kleur | Teal en goud als sfeer | Statuskleuren met betekenis: normaal / let op / actie nodig / fout |
| Componenten | Card, Stat, Eyebrow, hero | Tabelrij, filterbalk, actiebalk, formulierveld, bodemblad, lege staat, statusbadge |

Kleuren, fonts, logo, iconografie, toon en bewegingscurve blijven gedeeld. Het
blijft dus herkenbaar NBC; wat verandert is de maatvoering en het componentbestand.

Let op dat dit een **verbouwing** is en geen toevoeging. Een deel van wat nu als
fundament in het systeem staat, is in werkelijkheid een web-regel en moet naar de
web-context verhuizen. Zolang `--section-y: 160px` op het niveau van "de huisstijl"
staat, blijft elke app ertegen vechten.

## Wat dat voor deze repo betekent

De bron van waarheid wordt het NBC design system in Claude Design.
`app/src/design-system/` wordt daarmee een **opgehaalde kopie** en geen map die je
nog met de hand bijwerkt. Zodra die synchronisatie er is, hoort die regel in
`CLAUDE.md` bij de afspraken die je niet mag breken — anders loopt het binnen twee
sprints weer uit elkaar.

Nu bestaan er twee losse kopieën: het project in Claude Design en deze map. De map
heeft precies één commit en geen enkele verbinding met Claude Design, dus niemand
weet welke van de twee voorloopt of hoever ze uit elkaar zijn gelopen.

## Volgorde

1. **App-modus opzetten** in `src/design-system/`: tokens en de componentenset uit
   de tabel hierboven. Nog geen scherm aanraken. Niets nieuws in `app.css` — wat de
   app-modus is, hoort vanaf de eerste regel in het designsysteem thuis, ook al is
   dat voorlopig dezelfde repo. Later extraheren wordt dan een verplaatsing en geen
   herschrijving.
2. **Drie schermen omzetten** als bewijs: magazijn (tabel en dichtheid), tellen
   (veldwerk, één hand), evenementdetail (formulier en status). Wat daar nodig
   blijkt en nog niet in de app-modus zit, voeg je dáár toe.
3. **Vastzetten** als v1 van de app-laag en verhuizen naar een plek waar een
   tweede app hem kan ophalen.
4. **Cosmetiek** als laatste, want dan is het goedkoop.

Deze volgorde staat vóór de schermrefactor die in `CLAUDE.md` onder "Startpunt voor
V2" staat, niet erna: het gaat om dezelfde bestanden, en het ontwerp bepaalt waar
de componentgrenzen komen te liggen. Design eerst is hier goedkoper.

Dit staat los van de twee echte V2-risico's uit `CLAUDE.md` — de databasemigraties
en het ontbreken van een testomgeving. Die horen niet in hetzelfde traject.

## Eerste stappen in een lokale sessie

Dit werk kan niet vanuit een cloudsessie: `DesignSync` heeft een autorisatie nodig
die aan de eigen machine hangt.

1. Draai `/design-login` in een **lokale** sessie (Environment op `Local`, niet
   `Cloud`). Eenmalig; de autorisatie blijft daarna staan.
2. Controleer met `get_project` of het NBC-project van het type *design system* is.
   Dat type ligt vast bij het aanmaken en is achteraf niet meer te veranderen. Is
   het een gewoon designproject, dan is er een nieuw project nodig en verhuist de
   inhoud — goed om te weten vóórdat er werk in gaat zitten.
3. Vergelijk het project met `app/src/design-system/`: wat staat er in de een en
   niet in de ander, en welke van de twee loopt voor. Pas daarna ontwerpen.

## Wat nog openstaat

- Welke kopie leidend is. Dat is de eerste vraag die beantwoord moet worden.
- Of de app-modus een eigen sectie in het bestaande project wordt, of dat de
  indeling van het project op de schop moet.
- De vormgeving van de app-modus zelf. Er zijn nog geen richtingen geschetst en er
  is nog niets gekozen; de tabel hierboven beschrijft de structuur, niet de look.
- Waar de bron komt te staan zodra er een tweede NBC-app is.
