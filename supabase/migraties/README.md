# Migraties

Vanaf hier gaat elke databasewijziging als een genummerd bestand in deze map.
Niet meer als los `faseN.sql` in de bovenliggende map: die bestanden zijn met de
hand in de SQL-editor uitgevoerd en er is achteraf niet vast te stellen wat er
werkelijk op productie staat. Dat is precies het probleem dat deze map oplost.

## Wat er al op productie staat

De bestanden in `supabase/` (één map hoger) zijn de geschiedenis tot nu toe.
De verwachte volgorde waarin ze gedraaid zijn:

1. `schema.sql`
2. `seed.sql`
3. `fase2.sql` — minimumvoorraad
4. `fase5.sql` — tellingen
5. `fase6.sql` — pakbonnen
6. `fase9.sql` — emballage, daarna teruggedraaid met `fase9-terugdraaien.sql`

De tabellen `emballage` en `emballage_mutaties` staan er dus wél, maar de
trigger en de functie zijn weg. De migraties hieronder gaan daarvan uit.

## Volgorde en regels

- Draai de bestanden op nummer, één keer, van laag naar hoog.
- Elk bestand is **herhaalbaar**: twee keer draaien mag geen schade doen.
  Daarom overal `if not exists`, `on conflict` en `create or replace`.
- Draai een migratie eerst op een wegwerpkopie van de database voordat hij de
  echte voorraad raakt.
- Een migratie wordt na het draaien nooit meer gewijzigd. Iets rechtzetten doe
  je met een volgend nummer.

## Wat er in staat

| Bestand | Wat het doet |
|---|---|
| `010_assortiment.sql` | Het echte assortiment, verpakkingen (krat/fust), statiegeld. Verkoopprijs vervalt. |
| `011_personeelslocaties.sql` | Kantine en Kroeg als voorraadlocatie voor personeel, plus het mutatietype `personeelsverbruik`. |
| `012_zalen_en_vulplekken.sql` | Zalen bij een evenement; koelkasten en bars als vulplek met standaardvulling. |
| `013_koppelingen.sql` | Machines van Franke en Aquablu, hun dagmetingen, en de invoerpoort waar een koppeling later op aansluit. |
| `014_bierflesjes_per_krat.sql` | De flesjes van 0,3 L gaan ook per krat, net als die van 0,2 L. |
| `015_leveringen.sql` | Leveringen aannemen: wat er op de bon staat, wat er werkelijk kwam, en het verschil dat openstaat. |
| `016_wachtrij.sql` | Het kenmerk waarmee een boeking uit de wachtrij niet twee keer kan landen. |
| `017_gebruikersbeheer.sql` | E-mailadres bij het profiel (alleen voor een beheerder), en wie er toegang heeft. |
| `018_personeelsverbruik_uit_telling.sql` | Een tekort in de kantine of de kroeg is personeelsverbruik, geen telverschil. |
| `019_rechten_en_bedragen.sql` | Inkoopprijs, statiegeld en omzet alleen voor de beheerder. **Pas draaien samen met de app-versie die erbij hoort.** |
| `020_assortiment_v2.sql` | Productlijst V2: fust 0%, dozen van 6, minimumvoorraad, nieuwe standaardvulling. |
| `021_emballage_retour.sql` | Lege emballage retour naar de leverancier vastleggen; borg alleen voor de beheerder. |
| `022_barcode_verpakking.sql` | Tweede barcode per product: die op de krat. |
| `023_antwoorden_robin.sql` | Fust 0% naar € 93,21, 24 Jus d'orange op Bar HOS 1, emballage blikje, rolcontainer en koolzuurcilinder. |
| `024_evenementmanager_magazijnwerk.sql` | De evenementmanager mag ook tellen, leveringen aannemen, pakbonnen maken en emballage retour boeken. Geen inrichting, geen bedragen. |
| `025_leveranciers_swinkels_bidfood.sql` | Alleen Swinkels en Bidfood als leverancier; Coca-Cola en Spadel gaan naar Bidfood. |
| `026_rollen_medewerker_housekeeping.sql` | Magazijnmedewerker en evenementmanager worden samen `medewerker`; nieuwe rol `housekeeping` (alleen kantine en kroeg). **Daarna `gebruikers` opnieuw neerzetten.** |
| `027_uitkomsten_robin.sql` | Aantal personen bij een evenement; afronden alleen door de beheerder; leveringen alleen naar magazijn of koelcel; artikelnummers van de leverancier; reden bij een tekort; producten voor personeel; emballage volgens de retourbon van Swinkels; Coca-Cola weer bij Swinkels. Draai na 026. |
| `028_antwoorden_robin_checklist.sql` | Antwoorden van Robin: Swinkels levert alles (Spa en blikje erbij), Chaudfontaine is Spa blauw, de Spa-krat vervalt, geen Prosecco in de kantine en de kroeg. |
| `029_emballage_typen.sql` | De emballagebewegingen `erbij` en `eraf`. Apart van 030, omdat een nieuwe enumwaarde pas na de transactie bruikbaar is. **Eerst draaien, los.** |
| `030_emballage_in_huis.sql` | Hoeveel emballage er in huis staat: product gekoppeld aan een soort emballage, de beginstand uit de huidige drankvoorraad, daarna inkoop min retour, plus invoer met de hand en tellen. **Draaien vóórdat de app-versie erbij live gaat** — die leest de nieuwe kolommen en `emballage_stand()`, en laadt anders niet. De oude app heeft er geen last van. |
| `031_locaties_robin.sql` | "Bar Green Village" wordt "Koelkasten buffetten en bekkens NBC", "Koelcel NBC" wordt "Koelcellen NBC", kantine en kroeg worden één locatie (de voorraad van de kroeg verhuist met een verplaatsing, de kroeg gaat op `actief = false`), Swinkels 0,3 L en het fust mogen in de kantine. Mag vóór of na de app; de app vangt beide op. |
| `032_terugzetten.sql` | De beheerder kan de voorraad terugzetten naar een moment: boekingen, pakbonnen, tellingen en (naar keuze) evenementen van daarna gaan eruit, naar een archief. De voorraad volgt via een trigger op het verwijderen. Leveringen en emballage blijven staan. **Draaien vóórdat de app-versie erbij live gaat**: anders werkt de knop niet, de rest van de app wel. |
| `033_terugzetten_emballage.sql` | Terugzetten neemt de emballage mee: emballageregels en retourbonnen vanaf dat moment gaan er ook uit (naar het archief), en teruggezette inkoop telt niet meer mee in `emballage_stand`. Na 032. Mag vóór of na de app. |
| `034_emballage_uit_telling.sql` | Emballage telt mee als de voorraad met een telling (of een correctie) binnenkomt, niet alleen bij inkoop. Nodig sinds terugzetten de beginstand van 030 kan weghalen. Mag vóór of na de app. |

## Waarom `010` en niet `1`

De oude bestanden heten `fase2` t/m `fase9`. Door bij 010 te beginnen loopt de
nummering door zonder dat een nieuw bestand ooit hetzelfde nummer krijgt als een
oud bestand.
