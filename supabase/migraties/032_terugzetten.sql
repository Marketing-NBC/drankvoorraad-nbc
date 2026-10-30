-- ═══════════════════════════════════════════════════════════════════
-- 032 — de voorraad terugzetten naar een moment
--
-- Op de vloer is soms niet geboekt, en dan klopt de voorraad niet meer.
-- Robin wil kunnen zeggen: "gisteren ging het mis, zet alles terug naar
-- gisterochtend". Daarna telt hij opnieuw en staat alles weer goed.
--
-- Dit is de enige uitzondering op "mutaties is append-only", en bewust
-- een smalle:
--
--   * Alleen de beheerder, en alleen via `zet_terug` hieronder. Er komt
--     geen delete-policy op `mutaties`: de app kan nog steeds niets
--     verwijderen.
--   * Niets verdwijnt echt. Elke mutatie die eruit gaat staat daarna in
--     `teruggezette_mutaties`, als volledige rij. Evenementen, pakbonnen en
--     tellingen die eruit gaan staan als JSON bij de terugzetting zelf.
--     Wie, wanneer, vanaf welk moment en waarom staat in `terugzettingen`.
--   * `voorraad` blijft van een trigger: verwijderde mutaties draaien hun
--     effect zelf terug (`mutaties_verwijderd`), zoals een nieuwe mutatie
--     het zelf boekt.
--
-- Wat er vanaf het gekozen moment uit gaat:
--   - alle mutaties (boekingen, uitgifte, verplaatsingen, inkoop,
--     correcties, personeelsverbruik);
--   - de pakbonnen van na dat moment: hun boekingen zijn weg;
--   - de tellingen die na dat moment zijn afgerond, en tellingen die nog
--     openstaan: hun verwachte aantallen kloppen niet meer;
--   - als de beheerder dat aanvinkt: de evenementen die na dat moment zijn
--     aangemaakt, met hun zalen.
--
-- Wat blijft staan: producten, locaties, minimumvoorraad, gebruikers,
-- evenementen van vóór dat moment, leveringen (de bon en het openstaande
-- verschil met de leverancier zijn echt gebeurd; alleen wat ze in de
-- voorraad brachten gaat eruit), metingen van koffie en water, en de
-- emballage. Inkoop telt in `emballage_stand` ook mee als hij is
-- teruggezet: de kratten zijn echt binnengekomen.
--
-- Herhaalbaar: `if not exists` en `create or replace`.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Wie zette wanneer wat terug ──────────────────────────────────
create table if not exists terugzettingen (
  id uuid primary key default gen_random_uuid(),
  vanaf timestamptz not null,
  reden text not null,
  gebruiker_id uuid not null references profiles on delete restrict,
  uitgevoerd_op timestamptz not null default now(),
  aantal_mutaties integer not null default 0,
  aantal_evenementen integer not null default 0,
  aantal_pakbonnen integer not null default 0,
  aantal_tellingen integer not null default 0,
  /* De evenementen, pakbonnen en tellingen die eruit gingen, als JSON.
     Niet om terug te zetten vanuit de app, wel om nooit iets kwijt te zijn. */
  verwijderd jsonb not null default '{}'::jsonb
);

-- Een kopie van elke mutatie die eruit ging. De volledige rij staat in
-- `rij`; de kolommen ernaast zijn er om op te zoeken en te rekenen.
create table if not exists teruggezette_mutaties (
  mutatie_id uuid primary key,
  terugzetting_id uuid not null references terugzettingen on delete restrict,
  product_id uuid not null,
  type mutatie_type not null,
  aantal integer not null,
  datum_tijd timestamptz not null,
  rij jsonb not null
);

create index if not exists teruggezette_mutaties_terugzetting_idx
  on teruggezette_mutaties (terugzetting_id);

alter table terugzettingen enable row level security;
alter table teruggezette_mutaties enable row level security;

drop policy if exists "beheerder ziet terugzettingen" on terugzettingen;
create policy "beheerder ziet terugzettingen" on terugzettingen
  for select to authenticated using (is_beheerder());

drop policy if exists "beheerder ziet teruggezette mutaties" on teruggezette_mutaties;
create policy "beheerder ziet teruggezette mutaties" on teruggezette_mutaties
  for select to authenticated using (is_beheerder());

-- Schrijven gaat alleen via `zet_terug` (security definer).
revoke insert, update, delete on terugzettingen from authenticated, anon;
revoke insert, update, delete on teruggezette_mutaties from authenticated, anon;
grant select on terugzettingen to authenticated;
grant select on teruggezette_mutaties to authenticated;

-- ─── Voorraad volgt een verwijderde mutatie ───────────────────────
-- De tegenhanger van `verwerk_mutatie` uit schema.sql. Per statement en
-- in één keer opgeteld: dan komt de stand in één stap uit op wat hij
-- vóór die mutaties was, ongeacht de volgorde waarin ze verdwijnen.
create or replace function verwerk_verwijderde_mutaties()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  with delta as (
    select van_locatie_id as locatie_id, product_id, aantal as verschil
    from weg where van_locatie_id is not null
    union all
    select naar_locatie_id, product_id, -aantal
    from weg where naar_locatie_id is not null
  ),
  per_plek as (
    select locatie_id, product_id, sum(verschil)::integer as verschil
    from delta
    group by locatie_id, product_id
  )
  update voorraad v
  set aantal = v.aantal + p.verschil
  from per_plek p
  where v.locatie_id = p.locatie_id
    and v.product_id = p.product_id
    and p.verschil <> 0;

  return null;
end;
$$;

drop trigger if exists mutaties_verwijderd on mutaties;
create trigger mutaties_verwijderd
  after delete on mutaties
  referencing old table as weg
  for each statement execute function verwerk_verwijderde_mutaties();

-- ─── De stand op een uitgezette locatie na terugzetten ────────────
-- De kroeg staat sinds 031 op `actief = false`: zijn voorraad is met een
-- verplaatsing naar "Kantine en kroeg" gegaan. Valt die verplaatsing bij
-- het terugzetten weg, dan komt er weer voorraad in een locatie die
-- niemand meer kan kiezen of tellen. Deze functie zegt welke uitgezette
-- locaties dan voorraad zouden hebben.
create or replace function uitgezet_met_voorraad_na(p_vanaf timestamptz)
returns text
language sql
stable
security definer set search_path = public
as $$
  with delta as (
    select van_locatie_id as locatie_id, product_id, aantal as verschil
    from mutaties where datum_tijd >= p_vanaf and van_locatie_id is not null
    union all
    select naar_locatie_id, product_id, -aantal
    from mutaties where datum_tijd >= p_vanaf and naar_locatie_id is not null
  ),
  na as (
    select v.locatie_id, v.product_id,
           v.aantal + coalesce((select sum(d.verschil) from delta d
                                where d.locatie_id = v.locatie_id and d.product_id = v.product_id), 0) as aantal
    from voorraad v
    join locaties l on l.id = v.locatie_id
    where not l.actief
  )
  select string_agg(distinct l.naam, ', ')
  from na
  join locaties l on l.id = na.locatie_id
  where na.aantal <> 0;
$$;

revoke execute on function uitgezet_met_voorraad_na(timestamptz) from public, anon;

-- ─── Vooraf kijken wat er gebeurt ─────────────────────────────────
-- Dezelfde selectie als `zet_terug`, zonder iets te veranderen. Het
-- scherm laat dit zien voordat de beheerder bevestigt.
create or replace function terugzetten_overzicht(p_vanaf timestamptz, p_evenementen boolean)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen de beheerder kan de voorraad terugzetten.';
  end if;
  if p_vanaf is null then
    raise exception 'Kies vanaf wanneer.';
  end if;

  return jsonb_build_object(
    'mutaties', (select count(*) from mutaties where datum_tijd >= p_vanaf),
    'pakbonnen', (select count(*) from pakbonnen where aangemaakt_op >= p_vanaf),
    'tellingen', (
      select count(*) from tellingen
      where status = 'open' or afgerond_op >= p_vanaf
    ),
    'evenementen', case when p_evenementen then (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'datum', datum) order by datum), '[]'::jsonb)
      from evenementen where aangemaakt_op >= p_vanaf
    ) else '[]'::jsonb end,
    'leveringen', (select count(*) from leveringen where aangemaakt_op >= p_vanaf),
    'uitgezet_met_voorraad', uitgezet_met_voorraad_na(p_vanaf)
  );
end;
$$;

-- ─── Terugzetten ──────────────────────────────────────────────────
create or replace function zet_terug(p_vanaf timestamptz, p_evenementen boolean, p_reden text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_evenement_ids text[];
  v_pakbon_ids uuid[];
  v_telling_ids uuid[];
  v_mutaties integer;
  v_uitgezet text;
begin
  if not is_beheerder() then
    raise exception 'Alleen de beheerder kan de voorraad terugzetten.';
  end if;
  if p_vanaf is null then
    raise exception 'Kies vanaf wanneer.';
  end if;
  if p_vanaf > now() then
    raise exception 'Dat moment ligt in de toekomst.';
  end if;
  if coalesce(trim(p_reden), '') = '' then
    raise exception 'Vul in waarom de voorraad wordt teruggezet.';
  end if;

  -- Niemand boekt tussendoor: een mutatie die halverwege binnenkomt zou
  -- anders net wel of net niet meegaan.
  lock table mutaties in share row exclusive mode;

  select coalesce(array_agg(id), '{}') into v_evenement_ids
  from evenementen
  where p_evenementen and aangemaakt_op >= p_vanaf;

  select coalesce(array_agg(id), '{}') into v_pakbon_ids
  from pakbonnen
  where aangemaakt_op >= p_vanaf or evenement_id = any(v_evenement_ids);

  select coalesce(array_agg(id), '{}') into v_telling_ids
  from tellingen
  where status = 'open' or afgerond_op >= p_vanaf;

  -- Kan een evenement niet weg omdat er van vóór dat moment nog een
  -- mutatie aan hangt? Dat kan alleen als de klok van een boeking vóór
  -- het aanmaken staat. Liever een duidelijke melding dan een halve klus.
  if exists (
    select 1 from mutaties
    where evenement_id = any(v_evenement_ids) and datum_tijd < p_vanaf
  ) then
    raise exception 'Een evenement van na dit moment heeft boekingen van ervoor. Kies een eerder moment.';
  end if;

  v_uitgezet := uitgezet_met_voorraad_na(p_vanaf);
  if v_uitgezet is not null then
    raise exception 'Dan komt er weer voorraad in %, en die locatie is niet meer in gebruik. Kies een later moment, of een moment vóór er iets geboekt was.', v_uitgezet;
  end if;

  insert into terugzettingen (vanaf, reden, gebruiker_id, verwijderd)
  values (
    p_vanaf,
    trim(p_reden),
    auth.uid(),
    jsonb_build_object(
      'evenementen', (
        select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object(
          'zalen', (select coalesce(jsonb_agg(z.zaal_id), '[]'::jsonb) from evenement_zalen z where z.evenement_id = e.id)
        )), '[]'::jsonb)
        from evenementen e where e.id = any(v_evenement_ids)
      ),
      'pakbonnen', (
        select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
        from pakbonnen p where p.id = any(v_pakbon_ids)
      ),
      'tellingen', (
        select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object(
          'regels', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from tellingregels r where r.telling_id = t.id)
        )), '[]'::jsonb)
        from tellingen t where t.id = any(v_telling_ids)
      )
    )
  )
  returning id into v_id;

  insert into teruggezette_mutaties (mutatie_id, terugzetting_id, product_id, type, aantal, datum_tijd, rij)
  select m.id, v_id, m.product_id, m.type, m.aantal, m.datum_tijd, to_jsonb(m)
  from mutaties m
  where m.datum_tijd >= p_vanaf;
  get diagnostics v_mutaties = row_count;

  -- De trigger `mutaties_verwijderd` zet de voorraad terug.
  delete from mutaties where datum_tijd >= p_vanaf;

  delete from pakbonnen where id = any(v_pakbon_ids);
  delete from tellingen where id = any(v_telling_ids);
  delete from evenementen where id = any(v_evenement_ids);

  update terugzettingen
  set aantal_mutaties = v_mutaties,
      aantal_evenementen = coalesce(array_length(v_evenement_ids, 1), 0),
      aantal_pakbonnen = coalesce(array_length(v_pakbon_ids, 1), 0),
      aantal_tellingen = coalesce(array_length(v_telling_ids, 1), 0)
  where id = v_id;

  return jsonb_build_object(
    'mutaties', v_mutaties,
    'evenementen', coalesce(array_length(v_evenement_ids, 1), 0),
    'pakbonnen', coalesce(array_length(v_pakbon_ids, 1), 0),
    'tellingen', coalesce(array_length(v_telling_ids, 1), 0)
  );
end;
$$;

revoke execute on function terugzetten_overzicht(timestamptz, boolean) from public, anon;
revoke execute on function zet_terug(timestamptz, boolean, text) from public, anon;
grant execute on function terugzetten_overzicht(timestamptz, boolean) to authenticated;
grant execute on function zet_terug(timestamptz, boolean, text) to authenticated;

-- ─── Emballage: teruggezette inkoop is wel binnengekomen ──────────
-- Gelijk aan 030, alleen telt de inkoop uit `teruggezette_mutaties` mee.
-- Terugzetten gaat over de drankvoorraad; de kratten, fusten en
-- PET-flessen die met die inkoop kwamen, staan er echt.
create or replace function emballage_stand()
returns table (
  emballage_id uuid,
  binnen integer,
  handmatig integer,
  retour integer,
  in_huis integer
)
language sql
stable
security definer set search_path = public
as $$
  with begin_moment as (
    select coalesce(max(datum_tijd), '-infinity'::timestamptz) as vanaf
    from emballage_mutaties
    where notitie = 'Beginstand uit de drankvoorraad'
  ),
  inkoop as (
    select product_id, aantal, datum_tijd from mutaties where type = 'inkoop'
    union all
    select product_id, aantal, datum_tijd from teruggezette_mutaties where type = 'inkoop'
  ),
  binnen as (
    select
      p.emballage_id,
      floor(sum(
        m.aantal::numeric
        / case when p.emballage_per = 'verpakking' then greatest(p.stuks_per_verpakking, 1) else 1 end
      ))::integer as aantal
    from inkoop m
    join producten p on p.id = m.product_id
    cross join begin_moment b
    where m.datum_tijd > b.vanaf
      and p.emballage_id is not null
    group by p.emballage_id
  ),
  bewegingen as (
    select
      em.emballage_id,
      coalesce(sum(case em.type::text
        when 'erbij' then em.aantal
        when 'eraf' then -em.aantal
        else 0 end), 0)::integer as handmatig,
      coalesce(sum(em.aantal) filter (where em.type = 'naar-leverancier'), 0)::integer as retour
    from emballage_mutaties em
    group by em.emballage_id
  )
  select
    e.id,
    coalesce(b.aantal, 0),
    coalesce(bw.handmatig, 0),
    coalesce(bw.retour, 0),
    coalesce(b.aantal, 0) + coalesce(bw.handmatig, 0) - coalesce(bw.retour, 0)
  from emballage e
  left join binnen b on b.emballage_id = e.id
  left join bewegingen bw on bw.emballage_id = e.id;
$$;

revoke execute on function emballage_stand() from public, anon;
grant execute on function emballage_stand() to authenticated;
