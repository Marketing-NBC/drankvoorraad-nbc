-- ═══════════════════════════════════════════════════════════════════
-- 013 — koffie en water: machines, metingen en de koppeling
--
-- Franke (koffie) en Aquablu (water) leveren geen drank uit het magazijn.
-- Er staat een machine in een zaal, die telt hoeveel er getapt is, en dat
-- verbruik hoort bij het evenement dat op dat moment in die zaal zat.
--
-- De koppeling met beide systemen is aangevraagd maar er nog niet. Daarom
-- is dit zo gebouwd dat er niets aan hoeft te veranderen zodra hij er wél
-- is: handmatige invoer en een import uit een koppeling komen allebei uit
-- op dezelfde tabel, via dezelfde controles. Het enige verschil is de
-- kolom `bron` — zodat je achteraf kunt zien wie of wat het getal zette.
--
-- Een meting is géén voorraadmutatie. Er is geen voorraad om af te boeken:
-- de bonen en het water zitten niet in `voorraad`. Daarom staat het hier
-- apart en niet in `mutaties`; die tabel blijft over voorraadbewegingen
-- gaan en blijft append-only.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_type where typname = 'koppeling_soort') then
    create type koppeling_soort as enum ('franke', 'aquablu');
  end if;
  if not exists (select 1 from pg_type where typname = 'meting_bron') then
    create type meting_bron as enum ('handmatig', 'koppeling');
  end if;
end;
$$;

-- ─── De koppeling zelf ────────────────────────────────────────────
-- `actief` staat op false tot de koppeling er werkelijk is. De app laat dan
-- zien dat er handmatig ingevoerd wordt, en waarom.
--
-- Let op: hier staat gééń sleutel of wachtwoord. Die horen in de omgeving
-- van de Edge Function die de import doet, niet in een tabel die elke
-- ingelogde gebruiker mag lezen.
create table if not exists koppelingen (
  id uuid primary key default gen_random_uuid(),
  soort koppeling_soort not null unique,
  naam text not null,
  actief boolean not null default false,
  api_basis_url text,
  notitie text,
  laatste_import timestamptz,
  laatste_fout text,
  aangemaakt_op timestamptz not null default now()
);

insert into koppelingen (soort, naam, notitie) values
  ('franke',  'Franke',  'Koffiemachines. Koppeling aangevraagd, nog niet beschikbaar — voer het dagverbruik zolang handmatig in.'),
  ('aquablu', 'Aquablu', 'Watertappunten. Koppeling aangevraagd, nog niet beschikbaar — voer het dagverbruik zolang handmatig in.')
on conflict (soort) do nothing;

-- ─── De machines ──────────────────────────────────────────────────
-- `extern_id` is het nummer waaronder de machine in het systeem van Franke
-- of Aquablu bekend staat. Zolang de koppeling er niet is mag die leeg
-- blijven; hij is het haakje waar de import straks op matcht.
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  koppeling_id uuid not null references koppelingen on delete restrict,
  naam text not null,
  extern_id text,
  product_id uuid not null references producten on delete restrict,
  zaal_id uuid references zalen on delete set null,
  actief boolean not null default true,
  aangemaakt_op timestamptz not null default now()
);

create unique index if not exists machines_extern_uniek
  on machines (koppeling_id, extern_id) where extern_id is not null;
create index if not exists machines_zaal_idx on machines (zaal_id);

-- ─── De metingen ──────────────────────────────────────────────────
-- Eén regel per machine per dag. Een tweede invoer voor dezelfde dag
-- overschrijft de eerste: een dagtotaal is een waarneming die je corrigeert,
-- geen voorraadbeweging die je terugboekt.
create table if not exists machine_metingen (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines on delete cascade,
  datum date not null,
  aantal integer not null check (aantal >= 0),
  bron meting_bron not null default 'handmatig',
  /* Het regelnummer uit het bronsysteem. Zorgt dat een import die twee keer
     langskomt niet twee keer telt. */
  extern_id text,
  evenement_id text references evenementen on delete set null,
  /* Leeg wanneer de koppeling het boekte: dan zat er geen mens aan. */
  gebruiker_id uuid references profiles on delete restrict,
  notitie text,
  aangemaakt_op timestamptz not null default now(),
  bijgewerkt_op timestamptz not null default now(),
  unique (machine_id, datum)
);

create index if not exists machine_metingen_evenement_idx on machine_metingen (evenement_id);
create index if not exists machine_metingen_datum_idx on machine_metingen (datum desc);

-- ─── Bij welk evenement hoort een meting? ─────────────────────────
-- De machine staat in een zaal, het evenement kent zijn zalen. Zit er op die
-- dag precies één evenement in die zaal, dan is het antwoord eenduidig.
-- Zijn het er twee (een vergadering 's ochtends, een borrel 's avonds), dan
-- geeft deze functie NULL terug en kiest een mens. Gokken zou een kostenpost
-- bij het verkeerde evenement leggen zonder dat iemand het ziet.
create or replace function evenement_voor_zaal(p_zaal_id uuid, p_datum date)
returns text
language sql
stable
security definer set search_path = public
as $$
  select evenement_id
  from (
    select ez.evenement_id, count(*) over () as aantal
    from evenement_zalen ez
    join evenementen e on e.id = ez.evenement_id
    where ez.zaal_id = p_zaal_id and e.datum = p_datum
  ) as kandidaten
  where aantal = 1;
$$;

-- ─── Handmatig boeken ─────────────────────────────────────────────
create or replace function boek_meting(
  p_machine_id uuid,
  p_datum date,
  p_aantal integer,
  p_evenement_id text default null,
  p_notitie text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_zaal_id uuid;
  v_evenement_id text := p_evenement_id;
  v_id uuid;
begin
  if huidige_rol() is null then
    raise exception 'Alleen ingelogde gebruikers kunnen verbruik invoeren.';
  end if;
  if p_aantal is null or p_aantal < 0 then
    raise exception 'Vul een aantal van 0 of hoger in.';
  end if;
  if p_datum is null then
    raise exception 'Vul een datum in.';
  end if;

  select zaal_id into v_zaal_id from machines where id = p_machine_id;
  if not found then
    raise exception 'Machine bestaat niet.';
  end if;

  if v_evenement_id is null and v_zaal_id is not null then
    v_evenement_id := evenement_voor_zaal(v_zaal_id, p_datum);
  end if;

  insert into machine_metingen (
    machine_id, datum, aantal, bron, evenement_id, gebruiker_id, notitie
  )
  values (
    p_machine_id, p_datum, p_aantal, 'handmatig', v_evenement_id, auth.uid(),
    nullif(trim(coalesce(p_notitie, '')), '')
  )
  on conflict (machine_id, datum) do update set
    aantal        = excluded.aantal,
    bron          = excluded.bron,
    evenement_id  = excluded.evenement_id,
    gebruiker_id  = excluded.gebruiker_id,
    notitie       = excluded.notitie,
    bijgewerkt_op = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── De poort waar de koppeling straks op aansluit ────────────────
-- Eén ingang voor Franke én Aquablu. Wat er nog niet is, is het stukje dat
-- de gegevens ophaalt: een Edge Function die periodiek bij hun API langsgaat
-- en het resultaat hierin gooit. De vorm van wat hij aanlevert staat hier
-- vast, dus die functie kan geschreven worden zodra de koppeling er is,
-- zonder dat er iets aan de app of de database verandert.
--
-- p_metingen: [{"machine": "<extern_id>", "datum": "2026-09-11", "aantal": 84,
--               "extern_id": "<regelnummer, optioneel>"}, …]
--
-- Idempotent: dezelfde regel twee keer aanleveren geeft hetzelfde resultaat.
-- Een meting die met de hand is ingevoerd wordt wél overschreven — de meter
-- van de machine weet het beter dan een geheugen aan het eind van de dag.
create or replace function importeer_metingen(
  p_soort koppeling_soort,
  p_metingen jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_koppeling_id uuid;
  v_regel record;
  v_machine record;
  v_evenement_id text;
  v_verwerkt integer := 0;
  v_onbekend text[] := '{}';
begin
  select id into v_koppeling_id from koppelingen where soort = p_soort;
  if v_koppeling_id is null then
    raise exception 'Onbekende koppeling.';
  end if;

  for v_regel in
    select
      regel ->> 'machine'    as machine,
      (regel ->> 'datum')::date as datum,
      (regel ->> 'aantal')::integer as aantal,
      regel ->> 'extern_id'  as extern_id
    from jsonb_array_elements(coalesce(p_metingen, '[]'::jsonb)) as regel
  loop
    select m.id, m.zaal_id into v_machine
    from machines m
    where m.koppeling_id = v_koppeling_id and m.extern_id = v_regel.machine and m.actief;

    if not found then
      v_onbekend := v_onbekend || v_regel.machine;
      continue;
    end if;

    if v_regel.aantal is null or v_regel.aantal < 0 or v_regel.datum is null then
      continue;
    end if;

    v_evenement_id := case
      when v_machine.zaal_id is null then null
      else evenement_voor_zaal(v_machine.zaal_id, v_regel.datum)
    end;

    insert into machine_metingen (machine_id, datum, aantal, bron, extern_id, evenement_id)
    values (v_machine.id, v_regel.datum, v_regel.aantal, 'koppeling', v_regel.extern_id, v_evenement_id)
    on conflict (machine_id, datum) do update set
      aantal        = excluded.aantal,
      bron          = 'koppeling',
      extern_id     = excluded.extern_id,
      /* Een handmatig gekozen evenement blijft staan; alleen een lege wordt
         alsnog ingevuld. Iemand die de ochtend- en middagborrel uit elkaar
         trok moet dat niet bij de volgende import kwijtraken. */
      evenement_id  = coalesce(machine_metingen.evenement_id, excluded.evenement_id),
      gebruiker_id  = null,
      bijgewerkt_op = now();

    v_verwerkt := v_verwerkt + 1;
  end loop;

  update koppelingen
  set laatste_import = now(),
      laatste_fout = case when array_length(v_onbekend, 1) is null then null
                          else 'Onbekende machines: ' || array_to_string(v_onbekend, ', ') end
  where id = v_koppeling_id;

  return jsonb_build_object(
    'verwerkt', v_verwerkt,
    'onbekende_machines', to_jsonb(v_onbekend)
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- Lezen mag iedereen — verbruik is geen geheim. Inrichten is beheerwerk,
-- en schrijven in de metingen gaat uitsluitend via de functies hierboven.
-- ═══════════════════════════════════════════════════════════════════
alter table koppelingen      enable row level security;
alter table machines         enable row level security;
alter table machine_metingen enable row level security;

drop policy if exists "koppelingen zichtbaar" on koppelingen;
create policy "koppelingen zichtbaar" on koppelingen
  for select to authenticated using (true);
drop policy if exists "beheerder beheert koppelingen" on koppelingen;
create policy "beheerder beheert koppelingen" on koppelingen
  for all to authenticated using (is_beheerder()) with check (is_beheerder());

drop policy if exists "machines zichtbaar" on machines;
create policy "machines zichtbaar" on machines
  for select to authenticated using (true);
drop policy if exists "beheerder beheert machines" on machines;
create policy "beheerder beheert machines" on machines
  for all to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'))
  with check (huidige_rol() in ('beheerder', 'magazijnmedewerker'));

drop policy if exists "metingen zichtbaar" on machine_metingen;
create policy "metingen zichtbaar" on machine_metingen
  for select to authenticated using (true);

-- ─── Realtime ─────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table koppelingen;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table machines;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table machine_metingen;
exception when duplicate_object then null;
end;
$$;

-- ─── Startwaarden ─────────────────────────────────────────────────
-- Eén koffiemachine en één tappunt per zaal, zodat er meteen iets in te
-- vullen valt. Namen, zalen en externe nummers pas je in de app aan.
insert into machines (koppeling_id, naam, product_id, zaal_id)
select k.id, 'Koffiemachine ' || z.naam, p.id, z.id
from zalen z
cross join koppelingen k
join producten p on lower(p.naam) = 'koffie'
where k.soort = 'franke'
  and z.naam in ('HOS 1', 'HOS 2', 'Lounge', 'Grand Hall', 'Event hall')
  and not exists (
    select 1 from machines m where m.naam = 'Koffiemachine ' || z.naam
  );

insert into machines (koppeling_id, naam, product_id, zaal_id)
select k.id, 'Watertappunt ' || z.naam, p.id, z.id
from zalen z
cross join koppelingen k
join producten p on lower(p.naam) = 'water koud'
where k.soort = 'aquablu'
  and z.naam in ('HOS 1', 'HOS 2', 'Lounge', 'Grand Hall', 'Event hall')
  and not exists (
    select 1 from machines m where m.naam = 'Watertappunt ' || z.naam
  );

-- ─── Controle ─────────────────────────────────────────────────────
select k.naam as koppeling, k.actief, count(m.id) as machines
from koppelingen k
left join machines m on m.koppeling_id = k.id
group by k.naam, k.actief
order by k.naam;
