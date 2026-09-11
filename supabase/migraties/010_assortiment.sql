-- ═══════════════════════════════════════════════════════════════════
-- 010 — het echte assortiment
--
-- Drie dingen tegelijk, omdat ze niet los van elkaar kloppen:
--
-- 1. Verkoopprijs vervalt. NBC verkoopt niet per product maar per pakket,
--    dus een verkoopprijs per fles is een getal dat nergens op slaat. De
--    omzet blijft per evenement ingevuld worden; daar rekent de marge mee.
--
-- 2. Verpakkingen. Een product wordt geteld in stuks (flesjes, fusten),
--    maar sommige producten worden nooit los behandeld. De flesjes van
--    0,2 L gaan altijd per krat van 24 het magazijn in en uit. Dat is wat
--    `alleen_per_verpakking` regelt: de app laat dan kratten invullen en
--    rekent zelf naar flesjes om.
--
--    Waarom niet gewoon "het product ís een krat"? Omdat een koelkast met
--    12 flesjes gevuld wordt en niet met een halve krat. In stuks rekenen
--    en in kratten invoeren is het enige dat allebei aankan.
--
-- 3. Statiegeld. De bedragen van de leverancierslijst worden vastgelegd,
--    per stuk én per verpakking — een krat is €5,00 borg, een PET-fles
--    €0,25. Er wordt nog niets mee geboekt: hoe emballage terugkomt is nog
--    een open beslissing. Dit zet alleen de bedragen vast waar die later
--    mee gaat rekenen.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Categorieën voor koffie en water ─────────────────────────────
-- Franke en Aquablu leveren geen drank uit het magazijn maar wel verbruik.
-- Zie 013_koppelingen.sql; de categorie hoort bij het product en dus hier.
alter type product_categorie add value if not exists 'koffie';
alter type product_categorie add value if not exists 'water';

-- De SQL-editor draait dit script als één transactie, en Postgres weigert een
-- zojuist toegevoegde enumwaarde te gebruiken zolang die transactie loopt.
-- Deze commit sluit hem af; alles hieronder draait daarna gewoon door.
commit;

-- ─── Productvelden ────────────────────────────────────────────────
alter table producten
  add column if not exists inhoud                    text,
  add column if not exists verpakking                text,
  add column if not exists stuks_per_verpakking      integer not null default 1,
  add column if not exists alleen_per_verpakking     boolean not null default false,
  add column if not exists statiegeld_per_stuk       numeric(10,2) not null default 0,
  add column if not exists statiegeld_per_verpakking numeric(10,2) not null default 0,
  add column if not exists voorraadloos              boolean not null default false;

comment on column producten.inhoud is
  'Inhoud per stuk zoals op de leverancierslijst: ''0,2 L'', ''20 L''. Puur voor weergave.';
comment on column producten.verpakking is
  'Naam van de verpakkingseenheid (''krat''), of NULL als het product los gaat.';
comment on column producten.stuks_per_verpakking is
  'Aantal stuks in één verpakking. 1 wanneer er geen verpakking is.';
comment on column producten.alleen_per_verpakking is
  'True = in het magazijn nooit los boeken of tellen. De app vraagt dan kratten '
  'en slaat stuks op (aantal × stuks_per_verpakking).';
comment on column producten.statiegeld_per_stuk is
  'Borg per stuk. PET-fles €0,25, fust €30,00.';
comment on column producten.statiegeld_per_verpakking is
  'Borg per verpakking bovenop die per stuk. Krat fris €5,00, bierkrat €3,90.';
comment on column producten.voorraadloos is
  'True = er wordt geen fysieke voorraad bijgehouden. Koffie en water: verbruik '
  'komt uit de machines, niet uit het magazijn.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'producten_stuks_per_verpakking_positief'
  ) then
    alter table producten
      add constraint producten_stuks_per_verpakking_positief
      check (stuks_per_verpakking >= 1);
  end if;

  -- Een product dat alleen per verpakking mag, heeft ook een verpakking nodig.
  if not exists (
    select 1 from pg_constraint where conname = 'producten_verpakking_compleet'
  ) then
    alter table producten
      add constraint producten_verpakking_compleet
      check (
        not alleen_per_verpakking
        or (verpakking is not null and stuks_per_verpakking > 1)
      );
  end if;
end;
$$;

-- ─── Verkoopprijs weg ─────────────────────────────────────────────
alter table producten drop column if exists verkoopprijs;

-- ─── Naam wordt de sleutel van het assortiment ────────────────────
-- Nodig om deze migratie herhaalbaar te maken: zonder unieke naam zou een
-- tweede keer draaien het hele assortiment verdubbelen.
create unique index if not exists producten_naam_uniek on producten (lower(naam));

-- ═══════════════════════════════════════════════════════════════════
-- Het assortiment
-- Inkoopprijs is ex btw per stuk, zoals aangeleverd door Robin.
-- ═══════════════════════════════════════════════════════════════════
insert into producten (
  naam, categorie, inhoud, eenheid, leverancier, inkoopprijs,
  verpakking, stuks_per_verpakking, alleen_per_verpakking,
  statiegeld_per_stuk, statiegeld_per_verpakking
) values
  -- Fris 0,2 L — krat van 24, nooit los
  ('Coca Cola 0,2 L',          'fris', '0,2 L', 'fles', 'Coca-Cola', 0.46, 'krat', 24, true, 0, 5.00),
  ('Coca Cola Zero 0,2 L',     'fris', '0,2 L', 'fles', 'Coca-Cola', 0.46, 'krat', 24, true, 0, 5.00),
  ('Fanta 0,2 L',              'fris', '0,2 L', 'fles', 'Coca-Cola', 0.46, 'krat', 24, true, 0, 5.00),
  ('Fuze Tea Sparkling 0,2 L', 'fris', '0,2 L', 'fles', 'Coca-Cola', 0.49, 'krat', 24, true, 0, 5.00),
  ('Fuze Tea Green 0,2 L',     'fris', '0,2 L', 'fles', 'Coca-Cola', 0.49, 'krat', 24, true, 0, 5.00),
  ('Jus d''orange 0,2 L',      'fris', '0,2 L', 'fles', 'Coca-Cola', 0.67, 'krat', 24, true, 0, 5.00),
  ('Tonic 0,2 L',              'fris', '0,2 L', 'fles', 'Coca-Cola', 0.51, 'krat', 24, true, 0, 5.00),
  ('Bitter lemon 0,2 L',       'fris', '0,2 L', 'fles', 'Coca-Cola', 0.51, 'krat', 24, true, 0, 5.00),
  ('Ginger ale 0,2 L',         'fris', '0,2 L', 'fles', 'Coca-Cola', 0.51, 'krat', 24, true, 0, 5.00),

  -- Grote flessen — los, €0,25 statiegeld per fles
  ('Coca Cola 1,25 L',          'fris', '1,25 L', 'fles', 'Coca-Cola', 2.05, null, 1, false, 0.25, 0),
  ('Coca Cola Zero 1,25 L',     'fris', '1,25 L', 'fles', 'Coca-Cola', 2.05, null, 1, false, 0.25, 0),
  ('Sprite 1,5 L',              'fris', '1,5 L',  'fles', 'Coca-Cola', 2.10, null, 1, false, 0.25, 0),
  ('Fanta 1,5 L',               'fris', '1,5 L',  'fles', 'Coca-Cola', 2.14, null, 1, false, 0.25, 0),
  ('Fuze Tea Sparkling 1,25 L', 'fris', '1,25 L', 'fles', 'Coca-Cola', 2.43, null, 1, false, 0.25, 0),
  ('Fuze Tea Green 1,25 L',     'fris', '1,25 L', 'fles', 'Coca-Cola', 2.43, null, 1, false, 0.25, 0),

  -- Water — krat van 12
  ('Spa blauw 1 L', 'fris', '1 L', 'fles', 'Spadel', 0.95, 'krat', 12, false, 0, 5.00),
  ('Spa rood 1 L',  'fris', '1 L', 'fles', 'Spadel', 0.95, 'krat', 12, false, 0, 5.00),

  -- Bier
  ('Fust Swinckels 20 L', 'bier', '20 L',  'fust', 'Swinkels', 40.70, null,   1, false, 30.00, 0),
  ('Swinckels 0,3 L',     'bier', '0,3 L', 'fles', 'Swinkels',  0.53, 'krat', 24, false, 0, 3.90),
  ('Swinckels 0% 0,3 L',  'bier', '0,3 L', 'fles', 'Swinkels',  0.60, 'krat', 24, false, 0, 3.90),
  ('Radler 0% 0,3 L',     'bier', '0,3 L', 'fles', 'Swinkels',  1.05, 'krat', 24, false, 0, 3.90),

  -- Wijn en bubbels
  ('Witte wijn 0,7 L',   'wijn', '0,7 L', 'fles', null, 4.15, null, 1, false, 0, 0),
  ('Rosé 0,7 L',         'wijn', '0,7 L', 'fles', null, 4.15, null, 1, false, 0, 0),
  ('Rode wijn 0,7 L',    'wijn', '0,7 L', 'fles', null, 5.60, null, 1, false, 0, 0),
  ('Prosecco 0,7 L',     'wijn', '0,7 L', 'fles', null, 7.15, null, 1, false, 0, 0),
  ('Prosecco 0% 0,7 L',  'wijn', '0,7 L', 'fles', null, 7.31, null, 1, false, 0, 0),

  -- Mocktails
  ('Mojito 0% 0,7 L',         'overig', '0,7 L', 'fles', null, 10.90, null, 1, false, 0, 0),
  ('Passion Mojito 0% 0,7 L', 'overig', '0,7 L', 'fles', null, 10.90, null, 1, false, 0, 0),
  ('Paloma Rosa 0% 0,7 L',    'overig', '0,7 L', 'fles', null, 10.90, null, 1, false, 0, 0)
on conflict (lower(naam)) do update set
  categorie                 = excluded.categorie,
  inhoud                    = excluded.inhoud,
  eenheid                   = excluded.eenheid,
  leverancier               = excluded.leverancier,
  inkoopprijs               = excluded.inkoopprijs,
  verpakking                = excluded.verpakking,
  stuks_per_verpakking      = excluded.stuks_per_verpakking,
  alleen_per_verpakking     = excluded.alleen_per_verpakking,
  statiegeld_per_stuk       = excluded.statiegeld_per_stuk,
  statiegeld_per_verpakking = excluded.statiegeld_per_verpakking;

-- ─── Koffie en water ──────────────────────────────────────────────
-- Voorraadloos: er staat niets van in het magazijn, het verbruik komt uit
-- de machines. De inkoopprijs staat bewust op 0 — die is nog niet
-- aangeleverd. Zolang hij 0 is telt koffie en water voor € 0,00 mee in de
-- marge; de app zegt dat er ook bij.
insert into producten (naam, categorie, eenheid, leverancier, inkoopprijs, voorraadloos)
values
  ('Koffie',      'koffie', 'kop',  'Franke',  0, true),
  ('Thee',        'koffie', 'kop',  'Franke',  0, true),
  ('Water koud',  'water',  'glas', 'Aquablu', 0, true),
  ('Water bruis', 'water',  'glas', 'Aquablu', 0, true)
on conflict (lower(naam)) do update set
  categorie    = excluded.categorie,
  eenheid      = excluded.eenheid,
  leverancier  = excluded.leverancier,
  voorraadloos = excluded.voorraadloos;

-- ─── Oude proefproducten opruimen ─────────────────────────────────
-- Alleen wat nergens aan hangt. Een product met mutaties of tellingregels
-- blijft staan: dat is geschiedenis, en die gooien we niet weg. Wat blijft
-- staan wordt hieronder genoemd zodat je het zelf kunt nalopen.
do $$
declare
  v_proef text[] := array[
    'Heineken Pils fust 50L', 'Amstel Radler blik', 'Chardonnay huiswijn fles',
    'Merlot huiswijn fles', 'Coca-Cola fles', 'Bronwater fles',
    'Gin fles 70cl', 'Vodka fles 70cl'
  ];
  v_blijft text;
begin
  -- Voorraadregels van proefproducten waar geen enkele mutatie aan hangt zijn
  -- de nulmeting uit seed.sql: getypte startgetallen, geen geschiedenis.
  delete from voorraad v
  using producten p
  where p.id = v.product_id
    and p.naam = any (v_proef)
    and not exists (select 1 from mutaties m where m.product_id = p.id);

  delete from producten p
  where p.naam = any (v_proef)
    and not exists (select 1 from mutaties m where m.product_id = p.id)
    and not exists (select 1 from tellingregels t where t.product_id = p.id)
    and not exists (select 1 from voorraad v where v.product_id = p.id);

  select string_agg(naam, ', ' order by naam) into v_blijft
  from producten where naam = any (v_proef);

  if v_blijft is not null then
    raise notice 'Deze proefproducten blijven staan omdat er geschiedenis aan hangt: %', v_blijft;
  end if;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select
  count(*) filter (where not voorraadloos)          as producten_met_voorraad,
  count(*) filter (where voorraadloos)              as producten_zonder_voorraad,
  count(*) filter (where alleen_per_verpakking)     as alleen_per_krat,
  count(*) filter (where inkoopprijs = 0)           as zonder_inkoopprijs
from producten;
