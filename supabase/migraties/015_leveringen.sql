-- ═══════════════════════════════════════════════════════════════════
-- 015 — leveringen aannemen
--
-- Post staat bij de kar met de bon van de leverancier in de hand. Per
-- regel komt er te staan wat er op de bon staat en wat er werkelijk is.
-- Komen er 8 kratten terwijl er 10 op de bon staan, dan gaan die 8 de
-- voorraad in en blijft het verschil staan als openstaand punt richting
-- de leverancier.
--
-- Twee dingen die dat afdwingt:
--
--   * De voorraad gaat omhoog met wat er WERKELIJK stond, nooit met wat de
--     bon beweert. Anders klopt de voorraad op papier en niet in de koelcel,
--     en dat is precies het verschil dat een telling later duur maakt.
--   * Het verschil verdwijnt niet. Het blijft een open regel tot iemand hem
--     afhandelt, met zijn naam eronder.
--
-- `aangenomen_door` is een tekstveld en geen gebruiker, omdat Post met één
-- gedeeld account werkt: er loopt elke dag iemand anders beneden. Wie het
-- aannam typ je in; dat scheelt het rooster erbij pakken als er iets niet
-- klopt.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists leveringen (
  id uuid primary key default gen_random_uuid(),
  locatie_id uuid not null references locaties on delete restrict,
  leverancier text,
  bonnummer text,
  aangenomen_door text not null default '',
  gebruiker_id uuid not null references profiles on delete restrict,
  opmerking text,
  /* Door de telefoon meegegeven, zodat een boeking die uit de wachtrij
     twee keer wordt verstuurd niet twee keer telt. Zie 016. */
  client_id uuid unique,
  aangemaakt_op timestamptz not null default now()
);

create index if not exists leveringen_datum_idx on leveringen (aangemaakt_op desc);

create table if not exists leveringregels (
  id uuid primary key default gen_random_uuid(),
  levering_id uuid not null references leveringen on delete cascade,
  product_id uuid not null references producten on delete restrict,
  aantal_bon integer not null check (aantal_bon >= 0),
  aantal_werkelijk integer not null check (aantal_werkelijk >= 0),
  /* Berekend en opgeslagen: hier wordt op gefilterd en gesorteerd, en het
     mag nooit uit de pas lopen met de twee getallen erboven. */
  verschil integer generated always as (aantal_werkelijk - aantal_bon) stored,
  notitie text,
  afgehandeld_op timestamptz,
  afgehandeld_door uuid references profiles on delete set null
);

create index if not exists leveringregels_levering_idx on leveringregels (levering_id);
create index if not exists leveringregels_open_idx on leveringregels (verschil) where afgehandeld_op is null;

-- Elke voorraadmutatie uit een levering wijst terug naar die levering,
-- zoals een pakbonmutatie terugwijst naar zijn pakbon.
alter table mutaties
  add column if not exists levering_id uuid references leveringen on delete set null;

create index if not exists mutaties_levering_idx on mutaties (levering_id);

-- ─── Levering vastleggen ──────────────────────────────────────────
-- Levering, regels en voorraadmutaties in één transactie: een levering
-- zonder voorraad of voorraad zonder levering kan zo niet ontstaan.
--
-- p_regels: [{"product_id": "…", "aantal_bon": 10, "aantal_werkelijk": 8,
--             "notitie": "…"}, …]
create or replace function boek_levering(
  p_locatie_id uuid,
  p_leverancier text,
  p_bonnummer text,
  p_aangenomen_door text,
  p_opmerking text,
  p_regels jsonb,
  p_client_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_levering_id uuid;
  v_regel record;
  v_aantal integer;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een levering aan te nemen.';
  end if;

  -- Al eerder binnengekomen? Dan is dit een tweede poging vanuit de
  -- wachtrij en geven we gewoon dezelfde levering terug.
  if p_client_id is not null then
    select id into v_levering_id from leveringen where client_id = p_client_id;
    if v_levering_id is not null then
      return v_levering_id;
    end if;
  end if;

  if not exists (select 1 from locaties where id = p_locatie_id) then
    raise exception 'Locatie bestaat niet.';
  end if;

  if coalesce(trim(p_aangenomen_door), '') = '' then
    raise exception 'Vul in wie de levering heeft aangenomen.';
  end if;

  if (select count(*) from jsonb_array_elements(coalesce(p_regels, '[]'::jsonb))) = 0 then
    raise exception 'Een levering heeft minstens één regel nodig.';
  end if;

  -- Alles vooraf controleren, zodat een fout halverwege een duidelijke
  -- melding geeft in plaats van een teruggedraaide transactie.
  for v_regel in
    select
      (waarde ->> 'product_id')::uuid       as product_id,
      (waarde ->> 'aantal_bon')::integer    as aantal_bon,
      (waarde ->> 'aantal_werkelijk')::integer as aantal_werkelijk
    from jsonb_array_elements(p_regels) as waarde
  loop
    if v_regel.aantal_bon is null or v_regel.aantal_bon < 0
       or v_regel.aantal_werkelijk is null or v_regel.aantal_werkelijk < 0 then
      raise exception 'Elke regel heeft een aantal van 0 of hoger nodig, op de bon én werkelijk.';
    end if;
    if not exists (select 1 from producten where id = v_regel.product_id) then
      raise exception 'Product bestaat niet.';
    end if;
  end loop;

  insert into leveringen (
    locatie_id, leverancier, bonnummer, aangenomen_door, gebruiker_id, opmerking, client_id
  )
  values (
    p_locatie_id,
    nullif(trim(coalesce(p_leverancier, '')), ''),
    nullif(trim(coalesce(p_bonnummer, '')), ''),
    trim(p_aangenomen_door),
    auth.uid(),
    nullif(trim(coalesce(p_opmerking, '')), ''),
    p_client_id
  )
  returning id into v_levering_id;

  insert into leveringregels (levering_id, product_id, aantal_bon, aantal_werkelijk, notitie)
  select
    v_levering_id,
    (waarde ->> 'product_id')::uuid,
    (waarde ->> 'aantal_bon')::integer,
    (waarde ->> 'aantal_werkelijk')::integer,
    nullif(trim(coalesce(waarde ->> 'notitie', '')), '')
  from jsonb_array_elements(p_regels) as waarde;

  -- De voorraad gaat omhoog met wat er werkelijk stond. Een regel waar
  -- niets van geleverd is levert geen mutatie op: er is niets gebeurd.
  for v_regel in
    select product_id, aantal_werkelijk
    from leveringregels
    where levering_id = v_levering_id and aantal_werkelijk > 0
  loop
    insert into mutaties (
      product_id, aantal, type, naar_locatie_id, gebruiker_id, levering_id, notitie
    )
    values (
      v_regel.product_id, v_regel.aantal_werkelijk, 'inkoop', p_locatie_id, auth.uid(),
      v_levering_id, 'Levering aangenomen'
    );
  end loop;

  return v_levering_id;
end;
$$;

-- ─── Een verschil afhandelen ──────────────────────────────────────
-- Het verschil zelf blijft staan — dat is de geschiedenis. Wat je hier
-- vastlegt is dat er iets mee gedaan is: nagestuurd, gecrediteerd, of
-- toch gevonden.
create or replace function handel_verschil_af(p_regel_id uuid, p_notitie text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een verschil af te handelen.';
  end if;

  update leveringregels
  set afgehandeld_op = now(),
      afgehandeld_door = auth.uid(),
      notitie = coalesce(nullif(trim(coalesce(p_notitie, '')), ''), notitie)
  where id = p_regel_id and afgehandeld_op is null;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- Lezen mag iedereen; schrijven gaat uitsluitend via de functies hierboven.
-- ═══════════════════════════════════════════════════════════════════
alter table leveringen     enable row level security;
alter table leveringregels enable row level security;

drop policy if exists "leveringen zichtbaar" on leveringen;
create policy "leveringen zichtbaar" on leveringen
  for select to authenticated using (true);

drop policy if exists "leveringregels zichtbaar" on leveringregels;
create policy "leveringregels zichtbaar" on leveringregels
  for select to authenticated using (true);

-- ─── Realtime ─────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table leveringen;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table leveringregels;
exception when duplicate_object then null;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select count(*) as leveringen, count(*) filter (where client_id is not null) as via_de_wachtrij
from leveringen;
