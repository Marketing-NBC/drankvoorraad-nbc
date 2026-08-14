-- ═══════════════════════════════════════════════════════════════════
-- Testdata wissen en het magazijn vullen
--
-- LET OP: dit verwijdert onomkeerbaar ALLE evenementen, mutaties,
-- pakbonnen, tellingen en emballagebewegingen. Draai dit alleen zolang
-- de app nog niet echt in gebruik is.
--
-- Blijft staan: producten, locaties, gebruikers, soorten emballage en de
-- ingestelde minimumvoorraden.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Alles wat bij evenementen hoort weg ───────────────────────
-- Volgorde volgt de foreign keys: emballage verwijst naar mutaties én
-- evenementen, mutaties verwijzen naar pakbonnen.
delete from emballage_mutaties;
delete from mutaties;
delete from pakbonnen;
delete from tellingregels;
delete from tellingen;
delete from evenementen;

-- ─── 2. Voorraad op nul ───────────────────────────────────────────
-- Bewust `update` en geen `delete`: de rijen dragen ook de ingestelde
-- minimumvoorraden, en die wil je niet opnieuw hoeven invullen.
update voorraad set aantal = 0;

-- ─── 3. Magazijn vullen ───────────────────────────────────────────
-- Als inkoopmutaties, niet door de voorraadtabel te vullen: de trigger
-- werkt de stand bij én je hebt meteen een audit trail dat verklaart
-- waar de voorraad vandaan komt. Precies zoals bij een echte levering.
--
-- Hoeveelheden voor een ruim gevuld magazijn — genoeg voor een
-- evenement van 500 personen met marge over.
-- De gebruiker en het magazijn worden eerst opgezocht en gecontroleerd.
-- Anders levert een niet-gevonden id een onleesbare not-null-fout op een
-- willekeurige regel op, in plaats van te zeggen wat er ontbreekt.
do $$
declare
  v_gebruiker uuid;
  v_magazijn uuid;
begin
  -- Supabase bewaart e-mailadressen in kleine letters, vandaar lower().
  select p.id into v_gebruiker
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower('Abel@nbcevents.nl');

  -- Staat het account onder een ander adres, dan volstaat elke beheerder.
  if v_gebruiker is null then
    select id into v_gebruiker from profiles
    where rol = 'beheerder'
    order by aangemaakt_op
    limit 1;
  end if;

  if v_gebruiker is null then
    raise exception 'Geen beheerdersprofiel gevonden om de startvoorraad op te boeken.';
  end if;

  select id into v_magazijn from locaties
  where merk is null and type = 'magazijn'
  limit 1;

  if v_magazijn is null then
    raise exception 'Geen gedeeld hoofdmagazijn gevonden (locatie met merk = null en type = magazijn).';
  end if;

  insert into mutaties (product_id, aantal, type, naar_locatie_id, gebruiker_id, notitie)
  select p.id, v.aantal, 'inkoop', v_magazijn, v_gebruiker, 'Startvoorraad'
  from (values
    ('Heineken Pils fust 50L',  12),
    ('Amstel Radler blik',     600),
    ('Coca-Cola fles',         400),
    ('Bronwater fles',         400),
    ('Chardonnay huiswijn fles', 120),
    ('Merlot huiswijn fles',   120),
    ('Gin fles 70cl',           12),
    ('Vodka fles 70cl',         12)
  ) as v(naam, aantal)
  join producten p on p.naam = v.naam;
end $$;

commit;

-- ─── Controle ─────────────────────────────────────────────────────
select l.naam as locatie, p.naam as product, v.aantal, v.min_voorraad
from voorraad v
join producten p on p.id = v.product_id
join locaties l on l.id = v.locatie_id
where v.aantal > 0
order by l.naam, p.naam;
