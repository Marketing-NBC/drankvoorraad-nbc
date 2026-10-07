-- ═══════════════════════════════════════════════════════════════════
-- Schoon beginnen — eenmalig, vóór de app echt in gebruik gaat
--
-- LET OP: dit verwijdert onomkeerbaar ALLE evenementen, boekingen,
-- pakbonnen, tellingen, leveringen, metingen van koffie en water en
-- emballageretouren, en zet de voorraad overal op nul.
--
-- Dit is de enige keer dat `mutaties` geleegd wordt. Vanaf het moment dat
-- de app echt in gebruik is, geldt de regel weer zonder uitzondering:
-- mutaties zijn append-only. Draai dit dus NIET meer zodra er echte
-- voorraad in staat.
--
-- Blijft staan: producten (zonder de oude proefproducten), locaties,
-- zalen, koelkasten en bars met hun standaardvulling, machines,
-- gebruikers, soorten emballage en de ingestelde minimumvoorraden.
--
-- Volgorde: eerst alle migraties tot en met 022, dan dit script. Daarna
-- vul je het magazijn met een levering of met Inboeken in de app.
--
-- Vervangt het oude reset-testdata.sql. Dat zette de oude proefproducten
-- terug in de voorraad, en daardoor waren ze niet meer te verwijderen.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Alles wat er geboekt is ───────────────────────────────────
-- Volgorde volgt de foreign keys.
delete from emballage_mutaties;
delete from emballage_retouren;
delete from machine_metingen;
delete from mutaties;
delete from leveringregels;
delete from leveringen;
delete from pakbonnen;
delete from tellingregels;
delete from tellingen;
delete from evenement_zalen;
delete from evenementen;

-- ─── 2. Voorraad op nul ───────────────────────────────────────────
-- Bewust `update` en geen `delete`: de rijen dragen ook de ingestelde
-- minimumvoorraden.
update voorraad set aantal = 0;

-- ─── 3. De oude proefproducten weg ────────────────────────────────
-- Nu er geen boekingen meer aan hangen, kunnen ze eruit. Alleen deze
-- vaste lijst: een product dat iemand zelf heeft toegevoegd blijft staan
-- en wordt onderaan genoemd, zodat je het zelf kunt beoordelen.
delete from voorraad v
using producten p
where p.id = v.product_id
  and p.naam in (
    'Heineken Pils fust 50L', 'Amstel Radler blik', 'Chardonnay huiswijn fles',
    'Merlot huiswijn fles', 'Coca-Cola fles', 'Bronwater fles',
    'Gin fles 70cl', 'Vodka fles 70cl'
  );

delete from producten
where naam in (
  'Heineken Pils fust 50L', 'Amstel Radler blik', 'Chardonnay huiswijn fles',
  'Merlot huiswijn fles', 'Coca-Cola fles', 'Bronwater fles',
  'Gin fles 70cl', 'Vodka fles 70cl'
)
and not exists (select 1 from machines m where m.product_id = producten.id);

commit;

-- ─── Controle ─────────────────────────────────────────────────────
select
  (select count(*) from evenementen)                 as evenementen,
  (select count(*) from mutaties)                    as mutaties,
  (select count(*) from voorraad where aantal <> 0)  as locaties_met_voorraad,
  (select count(*) from producten)                   as producten;

-- Producten die niet in de productlijst V2 staan. Leeg is goed; staat hier
-- iets, kijk dan of het weg moet (via Producten in de app).
select naam
from producten
where not voorraadloos
  and naam not in (
    'Coca Cola 0,2 L', 'Coca Cola Zero 0,2 L', 'Fanta 0,2 L', 'Fuze Tea Sparkling 0,2 L',
    'Fuze Tea Green 0,2 L', 'Jus d''orange 0,2 L', 'Tonic 0,2 L', 'Bitter lemon 0,2 L',
    'Ginger ale 0,2 L', 'Coca Cola 1,25 L', 'Coca Cola Zero 1,25 L', 'Sprite 1,5 L',
    'Fanta 1,5 L', 'Fuze Tea Sparkling 1,25 L', 'Fuze Tea Green 1,25 L', 'Spa blauw 1 L',
    'Spa rood 1 L', 'Fust Swinckels 20 L', 'Fust Swinckels 0% 20 L', 'Swinckels 0,3 L',
    'Swinckels 0% 0,3 L', 'Radler 0% 0,3 L', 'Witte wijn 0,7 L', 'Rosé 0,7 L',
    'Rode wijn 0,7 L', 'Prosecco 0,7 L', 'Prosecco 0% 0,7 L', 'Mojito 0% 0,7 L',
    'Passion Mojito 0% 0,7 L', 'Paloma Rosa 0% 0,7 L'
  )
order by naam;
