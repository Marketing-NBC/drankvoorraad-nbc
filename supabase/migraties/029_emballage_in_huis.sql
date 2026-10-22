-- ═══════════════════════════════════════════════════════════════════
-- 029 — hoeveel emballage er in huis staat, en wat die waard is
--
-- Robin wil onder Magazijn → Emballage zien hoeveel kratten, fusten en
-- PET-flessen er in huis staan en wat daar aan borg in zit. De retourbon
-- zelf verhuist in de app naar Leveringen.
--
-- De stand volgt vanzelf uit wat er al geboekt wordt:
--
--   + wat er binnenkomt: elke inkoop (ook die van een levering) van een
--     product met emballage. Een krat Coca-Cola 0,2 L is 24 flesjes en
--     één krat emballage; een fles van 1,25 L is één PET-fles; een fust
--     is één fust.
--   − wat er retour gaat: de regels van de retourbon (021).
--   ± een telling: wie de lege en volle emballage telt, legt het verschil
--     vast als `telling-plus` of `telling-min`. Zo komt ook de emballage
--     die er al stond vóór de app erin, en wat er zonder product binnenkomt
--     (rolcontainers, koolzuurcilinders).
--
-- Volle en lege emballage tellen allebei mee: borg die betaald is en nog
-- niet terug is, staat in huis — of de krat nu vol in de koelcel staat of
-- leeg achter de bar. Wat er naar een evenement gaat verandert de stand
-- dus niet; het blijft ons spul tot de leverancier het ophaalt.
--
-- Fase 9 had `producten.emballage_id` al, met een trigger die bij elke
-- uitgifte emballage meeboekte. Die trigger is teruggedraaid
-- (fase9-terugdraaien.sql); hier wordt alleen de koppeling weer gebruikt.
-- `emballage_aantal` van fase 9 blijft ongebruikt: één emballage per stuk
-- of per verpakking zegt het nieuwe `emballage_per`.
--
-- Net als de retour is een telling append-only: niets wijzigen, niets
-- verwijderen. De volgende telling zet het weer recht.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Zekerheid: de trigger van fase 9 hoort weg te zijn ───────────
-- Zou hij er nog staan, dan boekt hij bij elke uitgifte emballage zodra
-- er weer een product aan een soort hangt.
drop trigger if exists mutatie_emballage on mutaties;
drop function if exists verwerk_emballage();

-- ─── Koppeling product → emballage ────────────────────────────────
alter table producten
  add column if not exists emballage_id uuid references emballage on delete set null,
  add column if not exists emballage_per text not null default 'verpakking';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'producten_emballage_per_check'
  ) then
    alter table producten
      add constraint producten_emballage_per_check check (emballage_per in ('stuk', 'verpakking'));
  end if;
end;
$$;

comment on column producten.emballage_id is
  'Welke emballage er met dit product binnenkomt. Leeg = geen (wijn, mocktails).';
comment on column producten.emballage_per is
  '''verpakking'' = één emballage per krat (stuks_per_verpakking stuks), ''stuk'' = één per stuk (fust, PET-fles).';

-- Nieuwe kolommen zijn sinds 019 niet vanzelf leesbaar.
grant select (emballage_id, emballage_per) on public.producten to authenticated;
grant insert (emballage_id, emballage_per) on public.producten to authenticated;
grant update (emballage_id, emballage_per) on public.producten to authenticated;

-- Het assortiment zoals het binnenkomt. Alleen waar nog niets gekoppeld
-- is, zodat een koppeling die de beheerder zelf zette blijft staan.
update producten p
set emballage_id = e.id, emballage_per = k.per
from (values
  ('Coca Cola 0,2 L',           'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Coca Cola Zero 0,2 L',      'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Fanta 0,2 L',               'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Fuze Tea Sparkling 0,2 L',  'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Fuze Tea Green 0,2 L',      'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Jus d''orange 0,2 L',       'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Tonic 0,2 L',               'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Bitter lemon 0,2 L',        'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Ginger ale 0,2 L',          'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  -- Chaudfontaine blauw gaat terug als krat fris handel (028).
  ('Spa blauw 1 L',             'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Spa rood 1 L',              'Krat fris handel 8 t/m 28 vaks', 'verpakking'),
  ('Coca Cola 1,25 L',          'PET-fles Coca-Cola',             'stuk'),
  ('Coca Cola Zero 1,25 L',     'PET-fles Coca-Cola',             'stuk'),
  ('Sprite 1,5 L',              'PET-fles Coca-Cola',             'stuk'),
  ('Fanta 1,5 L',               'PET-fles Coca-Cola',             'stuk'),
  ('Fuze Tea Sparkling 1,25 L', 'PET-fles Coca-Cola',             'stuk'),
  ('Fuze Tea Green 1,25 L',     'PET-fles Coca-Cola',             'stuk'),
  ('Swinckels 0,3 L',           'Bierkrat Swinkels 24 × 0,3 L',   'verpakking'),
  ('Swinckels 0% 0,3 L',        'Bierkrat Swinkels 24 × 0,3 L',   'verpakking'),
  ('Radler 0% 0,3 L',           'Bierkrat Swinkels 24 × 0,3 L',   'verpakking'),
  ('Fust Swinckels 20 L',       'Fust Swinkels 20 L',             'stuk'),
  ('Fust Swinckels 0% 20 L',    'Fust Swinkels 20 L',             'stuk')
) as k(product, soort, per)
join emballage e on e.naam = k.soort
where lower(p.naam) = lower(k.product)
  and p.emballage_id is null;

-- ─── Telling: twee nieuwe soorten beweging ────────────────────────
-- `aantal` is altijd positief (fase 9), dus de richting zit in het type.
alter type emballage_mutatie_type add value if not exists 'telling-plus';
alter type emballage_mutatie_type add value if not exists 'telling-min';

-- ─── De stand ─────────────────────────────────────────────────────
-- Eén regel per soort. `binnen` wordt per soort naar beneden afgerond:
-- twaalf losse flesjes uit een krat van 24 zijn nog geen krat.
create or replace function emballage_stand()
returns table (
  emballage_id uuid,
  binnen integer,
  retour integer,
  geteld integer,
  in_huis integer
)
language sql
stable
security definer set search_path = public
as $$
  with binnen as (
    select
      p.emballage_id,
      floor(sum(
        m.aantal::numeric
        / case when p.emballage_per = 'verpakking' then greatest(p.stuks_per_verpakking, 1) else 1 end
      ))::integer as aantal
    from mutaties m
    join producten p on p.id = m.product_id
    where m.type = 'inkoop'
      and p.emballage_id is not null
    group by p.emballage_id
  ),
  bewegingen as (
    select
      em.emballage_id,
      coalesce(sum(em.aantal) filter (where em.type = 'naar-leverancier'), 0)::integer as retour,
      coalesce(sum(case em.type::text
        when 'telling-plus' then em.aantal
        when 'telling-min' then -em.aantal
        else 0 end), 0)::integer as geteld
    from emballage_mutaties em
    group by em.emballage_id
  )
  select
    e.id,
    coalesce(b.aantal, 0),
    coalesce(bw.retour, 0),
    coalesce(bw.geteld, 0),
    coalesce(b.aantal, 0) - coalesce(bw.retour, 0) + coalesce(bw.geteld, 0)
  from emballage e
  left join binnen b on b.emballage_id = e.id
  left join bewegingen bw on bw.emballage_id = e.id;
$$;

-- ─── Tellen ───────────────────────────────────────────────────────
-- p_regels: [{ "emballage_id": "...", "geteld": 140 }, ...]
-- Rekent het verschil met de stand van dít moment zelf uit, zodat twee
-- telefoons die tegelijk tellen elkaar niet dubbel corrigeren. Geeft het
-- aantal soorten waar een verschil was.
create or replace function tel_emballage(p_regels jsonb)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_regel jsonb;
  v_emballage_id uuid;
  v_geteld integer;
  v_in_huis integer;
  v_verschil integer;
  v_aantal integer := 0;
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om emballage te tellen.';
  end if;
  if p_regels is null or jsonb_array_length(p_regels) = 0 then
    raise exception 'Vul bij minstens één soort in hoeveel er staat.';
  end if;

  -- Eén telling tegelijk: de stand die hier gelezen wordt, is de stand
  -- waartegen geboekt wordt.
  perform pg_advisory_xact_lock(hashtext('tel_emballage'));

  for v_regel in select * from jsonb_array_elements(p_regels)
  loop
    v_emballage_id := (v_regel->>'emballage_id')::uuid;
    v_geteld := (v_regel->>'geteld')::integer;

    if v_geteld is null or v_geteld < 0 then
      raise exception 'Een geteld aantal is 0 of meer.';
    end if;

    select s.in_huis into v_in_huis from emballage_stand() s where s.emballage_id = v_emballage_id;
    if not found then
      raise exception 'Onbekende soort emballage.';
    end if;

    v_verschil := v_geteld - v_in_huis;
    if v_verschil <> 0 then
      insert into emballage_mutaties (emballage_id, aantal, type, gebruiker_id, notitie)
      values (
        v_emballage_id,
        abs(v_verschil),
        (case when v_verschil > 0 then 'telling-plus' else 'telling-min' end)::emballage_mutatie_type,
        auth.uid(),
        'Emballagetelling'
      );
      v_aantal := v_aantal + 1;
    end if;
  end loop;

  return v_aantal;
end;
$$;

revoke execute on function emballage_stand() from public, anon;
revoke execute on function tel_emballage(jsonb) from public, anon;
grant execute on function emballage_stand() to authenticated;
grant execute on function tel_emballage(jsonb) to authenticated;

-- ─── Realtime ─────────────────────────────────────────────────────
-- Een telling schrijft alleen emballage_mutaties; zonder dit ziet een
-- tweede telefoon de nieuwe stand pas na verversen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'emballage_mutaties'
  ) then
    alter publication supabase_realtime add table emballage_mutaties;
  end if;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select p.naam as product, e.naam as emballage, p.emballage_per
from producten p left join emballage e on e.id = p.emballage_id
where not p.voorraadloos
order by e.naam nulls last, p.naam;
select e.naam, s.binnen, s.retour, s.geteld, s.in_huis
from emballage_stand() s join emballage e on e.id = s.emballage_id
where e.actief
order by e.naam;
