-- ═══════════════════════════════════════════════════════════════════
-- 020 — productlijst V2 van Robin
--
-- Wat er verandert ten opzichte van 010 en 012:
--
--   * Nieuw product: Fust Swinckels 0% 20 L.
--   * Wijn, bubbels en mocktails krijgen een doos van 6 als verpakking. Ze
--     blijven los te boeken — een Wijn Bar krijgt 8 flessen Cava, geen
--     anderhalve doos — maar de voorraad wordt nu ook in dozen getoond.
--   * Minimumvoorraad per product in het hoofdmagazijn. Robin geeft die in
--     kratten, flessen, fusten en dozen; hier staat hij in stuks, want zo
--     rekent de voorraad.
--   * De standaardvulling van koelkasten en bars volgt de nieuwe lijst.
--     De koelkast van de Lounge valt nu in het rijtje van ES1 en ES2.
--
-- VOORLOPIG, nog na te vragen bij Robin (zie ook de lijst in de PR):
--   * Inkoopprijs Fust Swinckels 0% — staat voorlopig gelijk aan de gewone fust.
--   * Een doos wijn of mocktail = 6 flessen.
--   * "Cava" en "Cava 0%" op de lijst = Prosecco en Prosecco 0%.
--   * "Coca Cola 1,5 L" op de bars = de Coca Cola 1,25 L uit het assortiment.
--   * 21 Jus d'orange op de bar van HOS 1 is zo overgenomen.
-- Klopt iets niet, dan zet een volgende migratie het recht.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Nieuw product ────────────────────────────────────────────────
insert into producten (
  naam, categorie, inhoud, eenheid, leverancier, inkoopprijs,
  verpakking, stuks_per_verpakking, alleen_per_verpakking,
  statiegeld_per_stuk, statiegeld_per_verpakking
) values
  ('Fust Swinckels 0% 20 L', 'bier', '20 L', 'fust', 'Swinkels', 40.70, null, 1, false, 30.00, 0)
on conflict (lower(naam)) do nothing;

-- ─── Dozen van 6 ──────────────────────────────────────────────────
update producten
set verpakking = 'doos', stuks_per_verpakking = 6
where naam in (
  'Witte wijn 0,7 L', 'Rosé 0,7 L', 'Rode wijn 0,7 L',
  'Prosecco 0,7 L', 'Prosecco 0% 0,7 L',
  'Mojito 0% 0,7 L', 'Passion Mojito 0% 0,7 L', 'Paloma Rosa 0% 0,7 L'
)
and verpakking is null;

-- ─── Minimumvoorraad in het hoofdmagazijn ─────────────────────────
-- Alleen `min_voorraad`: het aantal blijft van de trigger. Een nieuwe rij
-- begint op 0, precies zoals stel_min_voorraad() dat doet.
do $$
declare
  v_magazijn uuid;
  v_ontbreekt text;
begin
  select id into v_magazijn from locaties
  where merk is null and type = 'magazijn'
  limit 1;

  if v_magazijn is null then
    raise exception 'Geen gedeeld hoofdmagazijn gevonden (locatie met merk = null en type = magazijn).';
  end if;

  drop table if exists minimum_invoer;
  create temporary table minimum_invoer (product text, aantal integer, per text);
  insert into minimum_invoer (product, aantal, per) values
    ('Coca Cola 0,2 L',           48, 'verpakking'),
    ('Coca Cola Zero 0,2 L',      72, 'verpakking'),
    ('Fanta 0,2 L',               24, 'verpakking'),
    ('Fuze Tea Sparkling 0,2 L',  24, 'verpakking'),
    ('Fuze Tea Green 0,2 L',      48, 'verpakking'),
    ('Jus d''orange 0,2 L',       24, 'verpakking'),
    ('Tonic 0,2 L',               24, 'verpakking'),
    ('Bitter lemon 0,2 L',        24, 'verpakking'),
    ('Ginger ale 0,2 L',          24, 'verpakking'),
    ('Coca Cola 1,25 L',         120, 'stuk'),
    ('Coca Cola Zero 1,25 L',    120, 'stuk'),
    ('Sprite 1,5 L',              60, 'stuk'),
    ('Fanta 1,5 L',               60, 'stuk'),
    ('Fuze Tea Sparkling 1,25 L', 60, 'stuk'),
    ('Fuze Tea Green 1,25 L',     60, 'stuk'),
    ('Spa blauw 1 L',             10, 'verpakking'),
    ('Spa rood 1 L',              10, 'verpakking'),
    ('Fust Swinckels 20 L',       32, 'stuk'),
    ('Fust Swinckels 0% 20 L',     3, 'stuk'),
    ('Swinckels 0,3 L',           48, 'verpakking'),
    ('Swinckels 0% 0,3 L',        24, 'verpakking'),
    ('Radler 0% 0,3 L',           24, 'verpakking'),
    ('Witte wijn 0,7 L',          80, 'verpakking'),
    ('Rosé 0,7 L',                40, 'verpakking'),
    ('Rode wijn 0,7 L',           20, 'verpakking'),
    ('Prosecco 0,7 L',            15, 'verpakking'),
    ('Prosecco 0% 0,7 L',         10, 'verpakking'),
    ('Mojito 0% 0,7 L',           10, 'verpakking'),
    ('Passion Mojito 0% 0,7 L',   10, 'verpakking'),
    ('Paloma Rosa 0% 0,7 L',      10, 'verpakking');

  insert into voorraad (locatie_id, product_id, aantal, min_voorraad)
  select
    v_magazijn,
    p.id,
    0,
    i.aantal * case when i.per = 'verpakking' then p.stuks_per_verpakking else 1 end
  from minimum_invoer i
  join producten p on lower(p.naam) = lower(i.product)
  on conflict (locatie_id, product_id)
    do update set min_voorraad = excluded.min_voorraad;

  select string_agg(i.product, ', ') into v_ontbreekt
  from minimum_invoer i
  where not exists (select 1 from producten p where lower(p.naam) = lower(i.product));
  if v_ontbreekt is not null then
    raise notice 'Geen minimum gezet, product onbekend: %', v_ontbreekt;
  end if;

  drop table minimum_invoer;
end;
$$;

-- ─── Standaardvulling koelkasten en bars ──────────────────────────
-- In stuks. De vulling van elke vulplek op de lijst wordt in zijn geheel
-- vervangen, zodat een product dat eraf is gehaald ook echt verdwijnt.
do $$
declare
  v_ontbreekt text;
begin
  drop table if exists vulling_invoer;
  create temporary table vulling_invoer (vulplek text, product text, aantal integer);

  -- Koelkasten: twee rijtjes met elk dezelfde vulling.
  insert into vulling_invoer (vulplek, product, aantal)
  select k.vulplek, v.product, case when k.groot then v.groot else v.klein end
  from (values
    ('Coca Cola 0,2 L',          12, 24),
    ('Coca Cola Zero 0,2 L',     12, 24),
    ('Jus d''orange 0,2 L',       6, 12),
    ('Fuze Tea Green 0,2 L',      9, 18),
    ('Fuze Tea Sparkling 0,2 L',  9, 18),
    ('Fanta 0,2 L',               6,  8),
    ('Tonic 0,2 L',               6,  8),
    ('Bitter lemon 0,2 L',        6,  8),
    ('Ginger ale 0,2 L',          6,  8)
  ) as v(product, klein, groot)
  cross join (values
    ('Koelkast ES1', false), ('Koelkast ES2', false), ('Koelkast Lounge', false),
    ('Koelkast HOS 1', true), ('Koelkast HOS 2', true), ('Koelkast Grand Hall', true)
  ) as k(vulplek, groot);

  -- Bars: één kolom per bar, leeg = staat er niet.
  insert into vulling_invoer (vulplek, product, aantal)
  select b.vulplek, r.product, b.aantal
  from (values
    --                              HOS 1 HOS 2 Wijn Cocktail ES2 Lounge GH
    ('Coca Cola 1,25 L',             6,   12, null,  6,  null, null,  6),
    ('Coca Cola 0,2 L',           null, null,  24, null,   24,   24, null),
    ('Coca Cola Zero 1,25 L',        6,   12, null,  6,  null, null,  6),
    ('Coca Cola Zero 0,2 L',      null, null,  24, null,   24,   24, null),
    ('Jus d''orange 0,2 L',         21,   24,  24,   12,   24,   24,  12),
    ('Fuze Tea Green 1,25 L',        4,    6, null,  4,  null, null,  4),
    ('Fuze Tea Green 0,2 L',      null, null,  12, null,   12,   12, null),
    ('Fuze Tea Sparkling 1,25 L',    4,    9, null,  4,  null, null,  4),
    ('Fuze Tea Sparkling 0,2 L',  null, null,  12, null,   12,   12, null),
    ('Fanta 1,5 L',                  4,    6, null,  4,  null, null,  4),
    ('Fanta 0,2 L',               null, null,  12, null,    9,   12, null),
    ('Sprite 1,5 L',                 4,    6, null, null, null, null, null),
    ('Tonic 0,2 L',                  9,   12,  12,    9,   12,   12,   9),
    ('Bitter lemon 0,2 L',           9,   12,  12,    9,   12,   12,   9),
    ('Ginger ale 0,2 L',             9,   12,  12,    9,   12,   12,   9),
    ('Witte wijn 0,7 L',             6,   12,  12,   12,   12,   12,  12),
    ('Rosé 0,7 L',                   6,   12,  12,   12,    6,    6,   6),
    ('Rode wijn 0,7 L',              6,    6,   6,    6,    6,    6,   6),
    ('Prosecco 0,7 L',            null, null,   8, null, null, null, null),
    ('Prosecco 0% 0,7 L',         null, null,   8, null, null, null, null),
    ('Fust Swinckels 20 L',          2,    4,   2,    2,    2,    2,   2),
    ('Fust Swinckels 0% 20 L',    null, null, null,   1, null, null, null),
    ('Swinckels 0% 0,3 L',          12,   24,  24,   24,   12,   12,  12),
    ('Radler 0% 0,3 L',             12,   24,  24,   12,   12,   12,  12)
  ) as r(product, hos1, hos2, wijn, cocktail, es2, lounge, gh)
  cross join lateral (values
    ('Bar HOS 1', r.hos1), ('Bar HOS 2', r.hos2), ('Wijn Bar', r.wijn),
    ('Cocktail Bar', r.cocktail), ('Bar ES2', r.es2), ('Bar Lounge', r.lounge),
    ('Bar Grand Hall', r.gh)
  ) as b(vulplek, aantal)
  where b.aantal is not null;

  delete from vulplek_standaard s
  using vulplekken vp
  where vp.id = s.vulplek_id
    and vp.naam in (select distinct vulplek from vulling_invoer);

  insert into vulplek_standaard (vulplek_id, product_id, aantal)
  select vp.id, p.id, i.aantal
  from vulling_invoer i
  join vulplekken vp on vp.naam = i.vulplek
  join producten p on lower(p.naam) = lower(i.product)
  on conflict (vulplek_id, product_id) do update set aantal = excluded.aantal;

  select string_agg(distinct i.product, ', ') into v_ontbreekt
  from vulling_invoer i
  where not exists (select 1 from producten p where lower(p.naam) = lower(i.product));
  if v_ontbreekt is not null then
    raise notice 'Niet in het assortiment, dus overgeslagen: %', v_ontbreekt;
  end if;

  drop table vulling_invoer;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select p.naam, v.min_voorraad
from voorraad v
join producten p on p.id = v.product_id
join locaties l on l.id = v.locatie_id
where l.merk is null and l.type = 'magazijn' and v.min_voorraad > 0
order by p.naam;
