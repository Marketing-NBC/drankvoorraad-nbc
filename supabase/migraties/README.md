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

## Waarom `010` en niet `1`

De oude bestanden heten `fase2` t/m `fase9`. Door bij 010 te beginnen loopt de
nummering door zonder dat een nieuw bestand ooit hetzelfde nummer krijgt als een
oud bestand.
