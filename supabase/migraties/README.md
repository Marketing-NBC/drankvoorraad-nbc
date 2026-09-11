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

## Waarom `010` en niet `1`

De oude bestanden heten `fase2` t/m `fase9`. Door bij 010 te beginnen loopt de
nummering door zonder dat een nieuw bestand ooit hetzelfde nummer krijgt als een
oud bestand.
