-- ═══════════════════════════════════════════════════════════════════
-- Fase 9 — emballage (fusten, kratten, pallets met statiegeld)
-- Draai dit ná schema.sql, seed.sql, fase2.sql, fase5.sql en fase6.sql.
-- Eén keer.
--
-- Emballage is de verpakking waar borg op zit: je koopt geen fust, je
-- leent het. Het bier gaat op, het fust moet terug. Deze fase houdt bij
-- waar die verpakking is, want dat is direct geld.
--
-- Twee bewuste keuzes:
--
-- 1. Emballage wordt NIET per locatie bijgehouden, drank wel. Niemand
--    hoeft te weten in welke koelcel een leeg fust staat; je wilt weten
--    of het terug is van het evenement en of de leverancier het al heeft
--    opgehaald. Per locatie boeken zou de administratie verdubbelen
--    zonder dat iemand er een beslissing op neemt.
--
-- 2. Uitgifte en retour van emballage worden AUTOMATISCH afgeleid uit de
--    drankmutaties. Ga je 5 fusten bier uitgeven, dan gaan er 5 fusten
--    emballage mee — daar wil je niet apart aan hoeven denken. Alleen wat
--    de app niet kan weten (lege verpakking terug, ophaling door de
--    leverancier, kwijtgeraakte emballage) boek je zelf.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Soorten emballage ────────────────────────────────────────────
create table emballage (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  borg numeric(10,2) not null default 0,
  aangemaakt_op timestamptz not null default now()
);

-- ─── Koppeling product → emballage ────────────────────────────────
-- emballage_aantal = hoeveel stuks verpakking er per producteenheid
-- meegaan. Voor een fust bier is dat 1. Voor een krat met 24 flesjes dat
-- als één krat wordt uitgegeven ook 1. Zet 0 als het product wel een
-- soort heeft maar de verpakking niet mee terug hoeft.
alter table producten
  add column emballage_id uuid references emballage on delete set null,
  add column emballage_aantal integer not null default 1;

-- ─── Emballagebewegingen ──────────────────────────────────────────
--   uit              van ons naar een evenement      (+uitstaand)
--   retour           terug van het evenement         (−uitstaand, +leeg bij ons)
--   naar-leverancier leeg opgehaald door leverancier (−leeg bij ons)
--   vermist          kwijt, borg verloren            (−uitstaand)
create type emballage_mutatie_type as enum ('uit', 'retour', 'naar-leverancier', 'vermist');

create table emballage_mutaties (
  id uuid primary key default gen_random_uuid(),
  emballage_id uuid not null references emballage on delete restrict,
  aantal integer not null check (aantal > 0),
  type emballage_mutatie_type not null,
  evenement_id text references evenementen on delete restrict,
  /* Gevuld wanneer deze regel automatisch uit een drankmutatie volgde.
     Zo is achteraf te zien wat de app zelf boekte en wat een mens deed. */
  mutatie_id uuid references mutaties on delete set null,
  gebruiker_id uuid not null references profiles on delete restrict,
  notitie text,
  datum_tijd timestamptz not null default now()
);

create index emballage_mutaties_evenement_idx on emballage_mutaties (evenement_id);
create index emballage_mutaties_soort_idx on emballage_mutaties (emballage_id);
create index emballage_mutaties_datum_idx on emballage_mutaties (datum_tijd desc);

-- ─── Automatisch meeboeken bij drankmutaties ──────────────────────
create function verwerk_emballage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_emballage_id uuid;
  v_per_eenheid integer;
begin
  select emballage_id, emballage_aantal
    into v_emballage_id, v_per_eenheid
  from producten
  where id = new.product_id;

  -- Geen emballage aan dit product gekoppeld, of bewust op 0 gezet.
  if v_emballage_id is null or coalesce(v_per_eenheid, 0) = 0 then
    return new;
  end if;

  if new.type = 'magazijn-naar-evenement' then
    insert into emballage_mutaties (emballage_id, aantal, type, evenement_id, mutatie_id, gebruiker_id, notitie)
    values (v_emballage_id, new.aantal * v_per_eenheid, 'uit', new.evenement_id, new.id, new.gebruiker_id,
            'Automatisch bij uitgifte');

  elsif new.type = 'evenement-naar-magazijn' then
    -- Een vol product dat terugkomt, brengt zijn verpakking mee.
    insert into emballage_mutaties (emballage_id, aantal, type, evenement_id, mutatie_id, gebruiker_id, notitie)
    values (v_emballage_id, new.aantal * v_per_eenheid, 'retour', new.evenement_id, new.id, new.gebruiker_id,
            'Automatisch bij retour');
  end if;

  return new;
end;
$$;

create trigger mutatie_emballage
  after insert on mutaties
  for each row execute function verwerk_emballage();

-- ─── Handmatig boeken ─────────────────────────────────────────────
-- Voor alles wat de app niet uit de drankmutaties kan afleiden.
create or replace function boek_emballage(
  p_emballage_id uuid,
  p_aantal integer,
  p_type emballage_mutatie_type,
  p_evenement_id text,
  p_notitie text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om emballage te boeken.';
  end if;

  if p_aantal is null or p_aantal <= 0 then
    raise exception 'Vul een aantal groter dan 0 in.';
  end if;

  -- 'uit' ontstaat uitsluitend automatisch bij een drankuitgifte. Zou je
  -- dat ook met de hand mogen boeken, dan telt dezelfde verpakking dubbel.
  if p_type = 'uit' then
    raise exception 'Uitgifte van emballage volgt automatisch uit de drankuitgifte.';
  end if;

  if p_type in ('retour', 'vermist') and p_evenement_id is null then
    raise exception 'Kies bij welk evenement dit hoort.';
  end if;

  insert into emballage_mutaties (emballage_id, aantal, type, evenement_id, gebruiker_id, notitie)
  values (p_emballage_id, p_aantal, p_type, p_evenement_id, auth.uid(), nullif(trim(coalesce(p_notitie, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════
alter table emballage           enable row level security;
alter table emballage_mutaties  enable row level security;

create policy "emballage zichtbaar" on emballage
  for select to authenticated using (true);
create policy "beheerder beheert emballage" on emballage
  for all to authenticated using (is_beheerder()) with check (is_beheerder());

-- Net als bij drankmutaties: iedereen leest (traceerbaarheid), niemand
-- wijzigt of verwijdert. Toevoegen gaat via boek_emballage of de trigger.
create policy "emballagemutaties zichtbaar" on emballage_mutaties
  for select to authenticated using (true);

-- ─── Realtime ─────────────────────────────────────────────────────
alter publication supabase_realtime add table emballage;
alter publication supabase_realtime add table emballage_mutaties;

-- ─── Startwaarden ─────────────────────────────────────────────────
-- Pas de borgbedragen aan naar wat er op de leveranciersfactuur staat.
insert into emballage (naam, borg) values
  ('Fust 50L', 30.00),
  ('Fust 20L', 30.00),
  ('Krat', 3.90),
  ('Pallet', 25.00)
on conflict (naam) do nothing;

-- Fusten koppelen aan de fustproducten die er al zijn.
update producten
set emballage_id = (select id from emballage where naam = 'Fust 50L')
where eenheid = 'fust' and emballage_id is null;
