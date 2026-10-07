-- ═══════════════════════════════════════════════════════════════════
-- 021 — lege emballage retour naar de leverancier
--
-- Lege kratten, fusten en PET-flessen gaan terug naar de leverancier, en
-- op elke krat zit borg. Wat er teruggaat wil Robin kunnen vastleggen: per
-- ophaling één bon, met per soort emballage hoeveel er meeging.
--
-- Dit bouwt voort op wat fase 9 al heeft neergezet en wat sindsdien
-- ongebruikt op productie staat:
--
--   * `emballage` — de soorten, met hun borg. Krijgt een leverancier en
--     een vinkje `actief`. De soorten van fase 9 (Fust 50L, Krat, …) passen
--     niet bij het echte assortiment en worden op inactief gezet; ze
--     blijven staan omdat er geschiedenis aan kan hangen.
--   * `emballage_mutaties` — het logboek, type 'naar-leverancier'. Krijgt
--     een verwijzing naar de bon waar de regel bij hoort.
--
-- Nieuw is alleen de bon zelf: `emballage_retouren`.
--
-- Wat hier bewust NIET gebeurt: bijhouden hoeveel lege emballage er in
-- het magazijn staat. Daarvoor zou elke uitgifte en elke retour van een
-- evenement ook emballage moeten boeken, en dat is in fase 9 juist
-- teruggedraaid. Dit legt vast wat er de deur uit ging en wat dat aan
-- borg terug hoort te geven — de controle op de creditnota van de
-- leverancier.
--
-- Net als drankmutaties is dit append-only: niets wijzigen, niets
-- verwijderen. Een vergissing herstel je met een correctiebon.
--
-- De borg is een bedrag, dus alleen de beheerder ziet hem (zie 019).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Soorten emballage ────────────────────────────────────────────
alter table emballage
  add column if not exists leverancier text,
  add column if not exists actief boolean not null default true;

comment on column emballage.borg is
  'Borg per stuk emballage (één krat, één fust, één PET-fles). Alleen leesbaar voor een beheerder.';

update emballage set actief = false
where naam in ('Fust 50L', 'Fust 20L', 'Krat', 'Pallet');

-- Borg zoals op de productlijst V2. Een krat is de hele krat inclusief de
-- flesjes erin; een PET-fles gaat per fles.
insert into emballage (naam, leverancier, borg) values
  ('Krat Coca-Cola 24 × 0,2 L', 'Coca-Cola',  5.00),
  ('PET-fles Coca-Cola',        'Coca-Cola',  0.25),
  ('Krat Spa 12 × 1 L',         'Spadel',     5.00),
  ('Bierkrat Swinkels 24 × 0,3 L', 'Swinkels', 3.90),
  ('Fust Swinkels 20 L',        'Swinkels',  30.00)
on conflict (naam) do update set
  leverancier = excluded.leverancier,
  borg        = excluded.borg,
  actief      = true;

-- ─── De bon ───────────────────────────────────────────────────────
create table if not exists emballage_retouren (
  id uuid primary key default gen_random_uuid(),
  leverancier text not null,
  bonnummer text,
  opmerking text,
  gebruiker_id uuid not null references profiles on delete restrict,
  /* Zelfde kenmerk als bij mutaties (016): een tweede verzendpoging landt
     niet twee keer. */
  client_id uuid,
  aangemaakt_op timestamptz not null default now()
);

create unique index if not exists emballage_retouren_client_uniek
  on emballage_retouren (client_id) where client_id is not null;
create index if not exists emballage_retouren_datum_idx
  on emballage_retouren (aangemaakt_op desc);

alter table emballage_mutaties
  add column if not exists retour_id uuid references emballage_retouren on delete restrict;

create index if not exists emballage_mutaties_retour_idx on emballage_mutaties (retour_id);

-- ─── Vastleggen ───────────────────────────────────────────────────
-- p_regels: [{ "emballage_id": "...", "aantal": 12 }, ...]
create or replace function boek_emballage_retour(
  p_leverancier text,
  p_bonnummer text,
  p_opmerking text,
  p_regels jsonb,
  p_client_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_retour_id uuid;
  v_regel jsonb;
  v_emballage_id uuid;
  v_aantal integer;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om emballage retour te boeken.';
  end if;

  -- Al binnen? Dan is dit een tweede poging van dezelfde telefoon.
  if p_client_id is not null then
    select id into v_retour_id from emballage_retouren where client_id = p_client_id;
    if v_retour_id is not null then
      return v_retour_id;
    end if;
  end if;

  if coalesce(trim(p_leverancier), '') = '' then
    raise exception 'Vul in naar welke leverancier de emballage gaat.';
  end if;
  if p_regels is null or jsonb_array_length(p_regels) = 0 then
    raise exception 'Een retour heeft minstens één regel nodig.';
  end if;

  insert into emballage_retouren (leverancier, bonnummer, opmerking, gebruiker_id, client_id)
  values (
    trim(p_leverancier),
    nullif(trim(p_bonnummer), ''),
    nullif(trim(p_opmerking), ''),
    auth.uid(),
    p_client_id
  )
  returning id into v_retour_id;

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    v_emballage_id := (v_regel->>'emballage_id')::uuid;
    v_aantal := (v_regel->>'aantal')::integer;

    if v_aantal is null or v_aantal <= 0 then
      raise exception 'Elke regel heeft een aantal groter dan 0 nodig.';
    end if;
    if not exists (select 1 from emballage where id = v_emballage_id) then
      raise exception 'Onbekende soort emballage.';
    end if;

    insert into emballage_mutaties (emballage_id, aantal, type, retour_id, gebruiker_id, notitie)
    values (v_emballage_id, v_aantal, 'naar-leverancier', v_retour_id, auth.uid(), 'Retour naar leverancier');
  end loop;

  return v_retour_id;
end;
$$;

-- ─── Borg voor de beheerder ───────────────────────────────────────
create or replace function emballageborg()
returns table (id uuid, borg numeric)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder ziet bedragen.';
  end if;

  return query select e.id, e.borg from emballage e;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Rechten
-- ═══════════════════════════════════════════════════════════════════
alter table emballage_retouren enable row level security;

drop policy if exists "emballageretouren zichtbaar" on emballage_retouren;
create policy "emballageretouren zichtbaar" on emballage_retouren
  for select to authenticated using (true);
-- Geen insert-, update- of delete-policy: vastleggen gaat alleen via
-- boek_emballage_retour(), en daarna verandert er niets meer aan.

-- De borg afschermen, net als de geldkolommen in 019.
revoke select, insert, update on public.emballage from authenticated;
grant select (id, naam, leverancier, actief, aangemaakt_op) on public.emballage to authenticated;

-- ─── Realtime ─────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'emballage_retouren'
  ) then
    alter publication supabase_realtime add table emballage_retouren;
  end if;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select naam, leverancier, actief from emballage order by actief desc, naam;
