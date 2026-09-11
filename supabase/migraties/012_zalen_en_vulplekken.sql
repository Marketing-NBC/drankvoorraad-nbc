-- ═══════════════════════════════════════════════════════════════════
-- 012 — zalen, koelkasten en bars
--
-- Twee begrippen die vaak door elkaar lopen en daarom expres verschillende
-- woorden krijgen:
--
--   zaal     — de ruimte waar een evenement plaatsvindt. HOS 1, Lounge,
--              Grand Hall. Hier wordt geen drank naartoe geboekt; een zaal
--              zegt alleen wáár het evenement is. Dat is genoeg om het
--              verbruik van een koffiemachine aan het juiste evenement te
--              kunnen koppelen (zie 013).
--
--   vulplek  — een koelkast of bar die bijgevuld wordt. Géén voorraad-
--              locatie: uit een koelkast wordt niet geboekt, er wordt uit
--              gedronken. Zou de app er voorraad van bijhouden, dan bleef
--              die eeuwig vol staan.
--
-- De standaardvulling per vulplek komt van de lijst van Robin. Die is het
-- startpunt bij het aanvullen: de app zet hem klaar en je past aan wat er
-- werkelijk in ging. Wat erin gaat is wat eruit gedronken is.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Zalen ────────────────────────────────────────────────────────
create table if not exists zalen (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  actief boolean not null default true,
  aangemaakt_op timestamptz not null default now()
);

-- Een evenement kan in meerdere zalen tegelijk zitten.
create table if not exists evenement_zalen (
  evenement_id text not null references evenementen on delete cascade,
  zaal_id uuid not null references zalen on delete restrict,
  primary key (evenement_id, zaal_id)
);

create index if not exists evenement_zalen_zaal_idx on evenement_zalen (zaal_id);

insert into zalen (naam) values
  ('HOS 1'), ('HOS 2'), ('Lounge'), ('Grand Hall'), ('Event hall'), ('ES1'), ('ES2')
on conflict (naam) do nothing;

-- ─── Vulplekken ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vulplek_type') then
    create type vulplek_type as enum ('koelkast', 'bar');
  end if;
end;
$$;

create table if not exists vulplekken (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  type vulplek_type not null,
  /* Waar de vulplek staat. Leeg mag: de Wijn Bar en de Cocktail Bar staan
     niet vast in één zaal. */
  zaal_id uuid references zalen on delete set null,
  actief boolean not null default true,
  aangemaakt_op timestamptz not null default now()
);

create table if not exists vulplek_standaard (
  vulplek_id uuid not null references vulplekken on delete cascade,
  product_id uuid not null references producten on delete cascade,
  aantal integer not null check (aantal >= 0),
  primary key (vulplek_id, product_id)
);

insert into vulplekken (naam, type, zaal_id)
select v.naam, v.type::vulplek_type, z.id
from (values
  ('Koelkast ES1',        'koelkast', 'ES1'),
  ('Koelkast ES2',        'koelkast', 'ES2'),
  ('Koelkast HOS 1',      'koelkast', 'HOS 1'),
  ('Koelkast HOS 2',      'koelkast', 'HOS 2'),
  ('Koelkast Lounge',     'koelkast', 'Lounge'),
  ('Koelkast Grand Hall', 'koelkast', 'Grand Hall'),
  ('Bar HOS 1',           'bar',      'HOS 1'),
  ('Bar HOS 2',           'bar',      'HOS 2'),
  ('Bar ES2',             'bar',      'ES2'),
  ('Bar Lounge',          'bar',      'Lounge'),
  ('Bar Grand Hall',      'bar',      'Grand Hall'),
  ('Wijn Bar',            'bar',      null),
  ('Cocktail Bar',        'bar',      null)
) as v(naam, type, zaal)
left join zalen z on z.naam = v.zaal
on conflict (naam) do nothing;

-- ─── Standaardvulling ─────────────────────────────────────────────
-- Aantallen in stuks, zoals op de lijst. Een product dat (nog) niet in het
-- assortiment staat wordt overgeslagen en onderaan gemeld.
do $$
declare
  v_ontbreekt text;
begin
  drop table if exists vulling_invoer;
  create temporary table vulling_invoer (vulplek text, product text, aantal integer);

  insert into vulling_invoer (vulplek, product, aantal) values
    -- Koelkasten ES1 en ES2
    ('Koelkast ES1', 'Coca Cola 0,2 L', 12),          ('Koelkast ES2', 'Coca Cola 0,2 L', 12),
    ('Koelkast ES1', 'Coca Cola Zero 0,2 L', 12),     ('Koelkast ES2', 'Coca Cola Zero 0,2 L', 12),
    ('Koelkast ES1', 'Jus d''orange 0,2 L', 6),       ('Koelkast ES2', 'Jus d''orange 0,2 L', 6),
    ('Koelkast ES1', 'Fuze Tea Green 0,2 L', 9),      ('Koelkast ES2', 'Fuze Tea Green 0,2 L', 9),
    ('Koelkast ES1', 'Fuze Tea Sparkling 0,2 L', 9),  ('Koelkast ES2', 'Fuze Tea Sparkling 0,2 L', 9),
    ('Koelkast ES1', 'Fanta 0,2 L', 6),               ('Koelkast ES2', 'Fanta 0,2 L', 6),
    ('Koelkast ES1', 'Tonic 0,2 L', 6),               ('Koelkast ES2', 'Tonic 0,2 L', 6),
    ('Koelkast ES1', 'Bitter lemon 0,2 L', 6),        ('Koelkast ES2', 'Bitter lemon 0,2 L', 6),
    ('Koelkast ES1', 'Ginger ale 0,2 L', 6),          ('Koelkast ES2', 'Ginger ale 0,2 L', 6),

    -- Koelkasten HOS 1, HOS 2, Lounge en Grand Hall
    ('Koelkast HOS 1', 'Coca Cola 0,2 L', 20),        ('Koelkast HOS 2', 'Coca Cola 0,2 L', 20),
    ('Koelkast Lounge', 'Coca Cola 0,2 L', 20),       ('Koelkast Grand Hall', 'Coca Cola 0,2 L', 20),
    ('Koelkast HOS 1', 'Coca Cola Zero 0,2 L', 20),   ('Koelkast HOS 2', 'Coca Cola Zero 0,2 L', 20),
    ('Koelkast Lounge', 'Coca Cola Zero 0,2 L', 20),  ('Koelkast Grand Hall', 'Coca Cola Zero 0,2 L', 20),
    ('Koelkast HOS 1', 'Jus d''orange 0,2 L', 10),    ('Koelkast HOS 2', 'Jus d''orange 0,2 L', 10),
    ('Koelkast Lounge', 'Jus d''orange 0,2 L', 10),   ('Koelkast Grand Hall', 'Jus d''orange 0,2 L', 10),
    ('Koelkast HOS 1', 'Fuze Tea Green 0,2 L', 15),   ('Koelkast HOS 2', 'Fuze Tea Green 0,2 L', 15),
    ('Koelkast Lounge', 'Fuze Tea Green 0,2 L', 15),  ('Koelkast Grand Hall', 'Fuze Tea Green 0,2 L', 15),
    ('Koelkast HOS 1', 'Fuze Tea Sparkling 0,2 L', 15), ('Koelkast HOS 2', 'Fuze Tea Sparkling 0,2 L', 15),
    ('Koelkast Lounge', 'Fuze Tea Sparkling 0,2 L', 15), ('Koelkast Grand Hall', 'Fuze Tea Sparkling 0,2 L', 15),
    ('Koelkast HOS 1', 'Fanta 0,2 L', 8),             ('Koelkast HOS 2', 'Fanta 0,2 L', 8),
    ('Koelkast Lounge', 'Fanta 0,2 L', 8),            ('Koelkast Grand Hall', 'Fanta 0,2 L', 8),
    ('Koelkast HOS 1', 'Tonic 0,2 L', 8),             ('Koelkast HOS 2', 'Tonic 0,2 L', 8),
    ('Koelkast Lounge', 'Tonic 0,2 L', 8),            ('Koelkast Grand Hall', 'Tonic 0,2 L', 8),
    ('Koelkast HOS 1', 'Bitter lemon 0,2 L', 8),      ('Koelkast HOS 2', 'Bitter lemon 0,2 L', 8),
    ('Koelkast Lounge', 'Bitter lemon 0,2 L', 8),     ('Koelkast Grand Hall', 'Bitter lemon 0,2 L', 8),
    ('Koelkast HOS 1', 'Ginger ale 0,2 L', 8),        ('Koelkast HOS 2', 'Ginger ale 0,2 L', 8),
    ('Koelkast Lounge', 'Ginger ale 0,2 L', 8),       ('Koelkast Grand Hall', 'Ginger ale 0,2 L', 8),

    -- Bars — grote flessen
    ('Bar HOS 1', 'Coca Cola 1,25 L', 6),             ('Bar HOS 2', 'Coca Cola 1,25 L', 12),
    ('Cocktail Bar', 'Coca Cola 1,25 L', 6),          ('Bar Grand Hall', 'Coca Cola 1,25 L', 6),
    ('Bar HOS 1', 'Coca Cola Zero 1,25 L', 6),        ('Bar HOS 2', 'Coca Cola Zero 1,25 L', 12),
    ('Cocktail Bar', 'Coca Cola Zero 1,25 L', 6),     ('Bar Grand Hall', 'Coca Cola Zero 1,25 L', 6),
    ('Bar HOS 1', 'Fuze Tea Green 1,25 L', 4),        ('Bar HOS 2', 'Fuze Tea Green 1,25 L', 6),
    ('Cocktail Bar', 'Fuze Tea Green 1,25 L', 4),     ('Bar Grand Hall', 'Fuze Tea Green 1,25 L', 4),
    ('Bar HOS 1', 'Fuze Tea Sparkling 1,25 L', 4),    ('Bar HOS 2', 'Fuze Tea Sparkling 1,25 L', 9),
    ('Cocktail Bar', 'Fuze Tea Sparkling 1,25 L', 4), ('Bar Grand Hall', 'Fuze Tea Sparkling 1,25 L', 4),
    ('Bar HOS 1', 'Fanta 1,5 L', 4),                  ('Bar HOS 2', 'Fanta 1,5 L', 6),
    ('Cocktail Bar', 'Fanta 1,5 L', 4),               ('Bar Grand Hall', 'Fanta 1,5 L', 4),

    -- Bars — kleine flesjes
    ('Wijn Bar', 'Coca Cola 0,2 L', 24),              ('Bar ES2', 'Coca Cola 0,2 L', 24),
    ('Bar Lounge', 'Coca Cola 0,2 L', 24),
    ('Wijn Bar', 'Coca Cola Zero 0,2 L', 24),         ('Bar ES2', 'Coca Cola Zero 0,2 L', 24),
    ('Bar Lounge', 'Coca Cola Zero 0,2 L', 24),
    ('Bar HOS 1', 'Jus d''orange 0,2 L', 24),         ('Bar HOS 2', 'Jus d''orange 0,2 L', 24),
    ('Wijn Bar', 'Jus d''orange 0,2 L', 24),          ('Cocktail Bar', 'Jus d''orange 0,2 L', 12),
    ('Bar ES2', 'Jus d''orange 0,2 L', 24),           ('Bar Lounge', 'Jus d''orange 0,2 L', 24),
    ('Bar Grand Hall', 'Jus d''orange 0,2 L', 12),
    ('Wijn Bar', 'Fuze Tea Green 0,2 L', 12),         ('Bar ES2', 'Fuze Tea Green 0,2 L', 12),
    ('Bar Lounge', 'Fuze Tea Green 0,2 L', 12),
    ('Wijn Bar', 'Fuze Tea Sparkling 0,2 L', 12),     ('Bar ES2', 'Fuze Tea Sparkling 0,2 L', 12),
    ('Bar Lounge', 'Fuze Tea Sparkling 0,2 L', 12),
    ('Wijn Bar', 'Fanta 0,2 L', 12),                  ('Bar ES2', 'Fanta 0,2 L', 9),
    ('Bar Lounge', 'Fanta 0,2 L', 12),
    ('Bar HOS 1', 'Tonic 0,2 L', 9),                  ('Bar HOS 2', 'Tonic 0,2 L', 12),
    ('Wijn Bar', 'Tonic 0,2 L', 12),                  ('Cocktail Bar', 'Tonic 0,2 L', 9),
    ('Bar ES2', 'Tonic 0,2 L', 9),                    ('Bar Lounge', 'Tonic 0,2 L', 12),
    ('Bar Grand Hall', 'Tonic 0,2 L', 9),
    ('Bar HOS 1', 'Bitter lemon 0,2 L', 9),           ('Bar HOS 2', 'Bitter lemon 0,2 L', 12),
    ('Wijn Bar', 'Bitter lemon 0,2 L', 12),           ('Cocktail Bar', 'Bitter lemon 0,2 L', 9),
    ('Bar ES2', 'Bitter lemon 0,2 L', 9),             ('Bar Lounge', 'Bitter lemon 0,2 L', 12),
    ('Bar Grand Hall', 'Bitter lemon 0,2 L', 9),
    ('Bar HOS 1', 'Ginger ale 0,2 L', 9),             ('Bar HOS 2', 'Ginger ale 0,2 L', 12),
    ('Wijn Bar', 'Ginger ale 0,2 L', 12),             ('Cocktail Bar', 'Ginger ale 0,2 L', 9),
    ('Bar ES2', 'Ginger ale 0,2 L', 9),               ('Bar Lounge', 'Ginger ale 0,2 L', 12),
    ('Bar Grand Hall', 'Ginger ale 0,2 L', 9),

    -- Bars — wijn
    ('Bar HOS 1', 'Witte wijn 0,7 L', 6),             ('Bar HOS 2', 'Witte wijn 0,7 L', 12),
    ('Wijn Bar', 'Witte wijn 0,7 L', 12),             ('Cocktail Bar', 'Witte wijn 0,7 L', 12),
    ('Bar ES2', 'Witte wijn 0,7 L', 12),              ('Bar Lounge', 'Witte wijn 0,7 L', 12),
    ('Bar Grand Hall', 'Witte wijn 0,7 L', 12),
    ('Bar HOS 1', 'Rosé 0,7 L', 6),                   ('Bar HOS 2', 'Rosé 0,7 L', 12),
    ('Wijn Bar', 'Rosé 0,7 L', 12),                   ('Cocktail Bar', 'Rosé 0,7 L', 12),
    ('Bar ES2', 'Rosé 0,7 L', 6),                     ('Bar Lounge', 'Rosé 0,7 L', 6),
    ('Bar Grand Hall', 'Rosé 0,7 L', 6),
    ('Bar HOS 1', 'Rode wijn 0,7 L', 6),              ('Bar HOS 2', 'Rode wijn 0,7 L', 6),
    ('Wijn Bar', 'Rode wijn 0,7 L', 6),               ('Cocktail Bar', 'Rode wijn 0,7 L', 6),
    ('Bar ES2', 'Rode wijn 0,7 L', 6),                ('Bar Lounge', 'Rode wijn 0,7 L', 6),
    ('Bar Grand Hall', 'Rode wijn 0,7 L', 6),

    -- Bars — bier
    ('Bar HOS 1', 'Fust Swinckels 20 L', 2),          ('Bar HOS 2', 'Fust Swinckels 20 L', 4),
    ('Wijn Bar', 'Fust Swinckels 20 L', 2),           ('Cocktail Bar', 'Fust Swinckels 20 L', 2),
    ('Bar ES2', 'Fust Swinckels 20 L', 2),            ('Bar Lounge', 'Fust Swinckels 20 L', 2),
    ('Bar Grand Hall', 'Fust Swinckels 20 L', 2),
    ('Bar HOS 1', 'Swinckels 0% 0,3 L', 12),          ('Bar HOS 2', 'Swinckels 0% 0,3 L', 24),
    ('Wijn Bar', 'Swinckels 0% 0,3 L', 24),           ('Cocktail Bar', 'Swinckels 0% 0,3 L', 24),
    ('Bar ES2', 'Swinckels 0% 0,3 L', 12),            ('Bar Lounge', 'Swinckels 0% 0,3 L', 12),
    ('Bar Grand Hall', 'Swinckels 0% 0,3 L', 12),
    ('Bar HOS 1', 'Radler 0% 0,3 L', 12),             ('Bar HOS 2', 'Radler 0% 0,3 L', 24),
    ('Wijn Bar', 'Radler 0% 0,3 L', 24),              ('Cocktail Bar', 'Radler 0% 0,3 L', 12),
    ('Bar ES2', 'Radler 0% 0,3 L', 12),               ('Bar Lounge', 'Radler 0% 0,3 L', 12),
    ('Bar Grand Hall', 'Radler 0% 0,3 L', 12);

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

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security — lezen mag iedereen, inrichten is beheerwerk
-- ═══════════════════════════════════════════════════════════════════
alter table zalen             enable row level security;
alter table evenement_zalen   enable row level security;
alter table vulplekken        enable row level security;
alter table vulplek_standaard enable row level security;

drop policy if exists "zalen zichtbaar" on zalen;
create policy "zalen zichtbaar" on zalen
  for select to authenticated using (true);
drop policy if exists "beheerder beheert zalen" on zalen;
create policy "beheerder beheert zalen" on zalen
  for all to authenticated using (is_beheerder()) with check (is_beheerder());

drop policy if exists "zalen bij evenement zichtbaar" on evenement_zalen;
create policy "zalen bij evenement zichtbaar" on evenement_zalen
  for select to authenticated using (true);
drop policy if exists "zalen bij evenement koppelen" on evenement_zalen;
create policy "zalen bij evenement koppelen" on evenement_zalen
  for all to authenticated
  using (huidige_rol() in ('beheerder', 'evenementmanager'))
  with check (huidige_rol() in ('beheerder', 'evenementmanager'));

drop policy if exists "vulplekken zichtbaar" on vulplekken;
create policy "vulplekken zichtbaar" on vulplekken
  for select to authenticated using (true);
drop policy if exists "magazijn beheert vulplekken" on vulplekken;
create policy "magazijn beheert vulplekken" on vulplekken
  for all to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'))
  with check (huidige_rol() in ('beheerder', 'magazijnmedewerker'));

drop policy if exists "standaardvulling zichtbaar" on vulplek_standaard;
create policy "standaardvulling zichtbaar" on vulplek_standaard
  for select to authenticated using (true);
drop policy if exists "magazijn beheert standaardvulling" on vulplek_standaard;
create policy "magazijn beheert standaardvulling" on vulplek_standaard
  for all to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'))
  with check (huidige_rol() in ('beheerder', 'magazijnmedewerker'));

-- ─── Realtime ─────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table zalen;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table evenement_zalen;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table vulplekken;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table vulplek_standaard;
exception when duplicate_object then null;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select vp.naam, vp.type, z.naam as zaal, count(vs.product_id) as producten, sum(vs.aantal) as stuks
from vulplekken vp
left join zalen z on z.id = vp.zaal_id
left join vulplek_standaard vs on vs.vulplek_id = vp.id
group by vp.naam, vp.type, z.naam
order by vp.type, vp.naam;
