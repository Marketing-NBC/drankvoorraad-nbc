-- ═══════════════════════════════════════════════════════════════════
-- 026 — twee rollen worden één, en housekeeping komt erbij
--
-- Uit het gesprek met Robin:
--
--   * De magazijnmedewerker krijgt precies dezelfde rechten als de
--     evenementmanager. Dat wordt één rol: `medewerker`. De waarde
--     `evenementmanager` wordt hernoemd (iedereen die hem had houdt
--     zijn rechten), en wie magazijnmedewerker was, wordt medewerker.
--     Gevolg: de inrichting — producten, minimumvoorraad, vulplekken,
--     koffie en water — is vanaf nu alleen voor de beheerder. Dat stond
--     al zo voor de evenementmanager (024).
--
--   * Housekeeping regelt alleen het personeelsverbruik: de kantine en
--     de kroeg aanvullen, tellen en afboeken. Geen bedragen (die lopen
--     al via beheerdersfuncties, 019), geen evenementen, geen magazijn.
--     Dat wordt hier in de database afgedwongen, niet alleen in het
--     scherm.
--
-- Waarom `magazijnmedewerker` als waarde blijft bestaan: Postgres kan
-- een waarde uit een enum niet weggooien zonder het hele type opnieuw
-- te maken, en daar hangen alle policies aan. Een controle op
-- `profiles` zorgt dat niemand die rol nog krijgt; de policies die hem
-- noemen (producten, vulplekken, machines) gelden daarmee alleen nog
-- voor de beheerder, en dat is precies de bedoeling.
--
-- Let op: `housekeeping` is een nieuwe enumwaarde. Die mag in dezelfde
-- transactie niet als enum gebruikt worden, daarom vergelijkt alles
-- hieronder `rol::text`. Functies lezen de waarde pas bij het draaien.
--
-- Na deze migratie moet de Edge Function `gebruikers` opnieuw neergezet
-- worden: die kent de nieuwe rollen anders niet.
-- ═══════════════════════════════════════════════════════════════════

-- ─── De enum ──────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'gebruiker_rol' and e.enumlabel = 'evenementmanager'
  ) then
    alter type gebruiker_rol rename value 'evenementmanager' to 'medewerker';
  end if;
end $$;

alter type gebruiker_rol add value if not exists 'housekeeping';

-- ─── Iedereen die magazijnmedewerker was, wordt medewerker ────────
update profiles set rol = 'medewerker' where rol = 'magazijnmedewerker';

alter table profiles drop constraint if exists profiles_geen_magazijnmedewerker;
alter table profiles add constraint profiles_geen_magazijnmedewerker
  check (rol::text <> 'magazijnmedewerker');

alter table profiles alter column rol set default 'medewerker';

-- ─── Wie mag wat ──────────────────────────────────────────────────
-- Magazijnwerk: pakbonnen, leveringen, verplaatsen, tellen, emballage.
create or replace function mag_magazijnwerk()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and rol::text in ('beheerder', 'medewerker')
  );
$$;

create or replace function is_housekeeping()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol::text = 'housekeeping'
  );
$$;

-- Tellen mag wie magazijnwerk doet, en housekeeping in de kantine en
-- de kroeg. Een telling is de meting van het personeelsverbruik (018).
create or replace function mag_tellen(p_locatie_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.mag_magazijnwerk()
      or (
        public.is_housekeeping()
        and exists (select 1 from public.locaties where id = p_locatie_id and voor_personeel)
      );
$$;

-- `alter policy` en geen drop + create: de policies bestaan al (024 en
-- fase 6), en zo blijft er geen moment zonder policy.
alter policy "tellingen uitvoeren" on tellingen
  with check (gebruiker_id = auth.uid() and mag_tellen(locatie_id));

alter policy "tellingen afronden" on tellingen
  using (mag_tellen(locatie_id));

alter policy "tellingregels beheren" on tellingregels
  using (mag_tellen((select t.locatie_id from tellingen t where t.id = telling_id)))
  with check (mag_tellen((select t.locatie_id from tellingen t where t.id = telling_id)));

-- Een pakbon hoort bij magazijnwerk. Hij komt via maak_pakbon(), maar
-- de tabel stond nog open voor iedereen die op eigen naam schreef.
alter policy "pakbonnen aanmaken" on pakbonnen
  with check (gebruiker_id = auth.uid() and mag_magazijnwerk());

-- ─── Housekeeping boekt alleen rond de kantine en de kroeg ────────
-- Een trigger en geen policy: boekingen komen ook binnen via functies
-- die als eigenaar draaien (rond_telling_af), en daar kijkt RLS niet.
-- Toegestaan voor housekeeping:
--   * personeelsverbruik (de trigger uit 011 eist al dat dat vanaf de
--     kantine of de kroeg gaat);
--   * aanvullen: van een magazijn of koelcel náár de kantine of kroeg;
--   * een correctie op de kantine of kroeg (een overschot uit de telling).
-- Migratie 027 breidt deze functie uit; dit is de eerste versie.
create or replace function controleer_mutatie_rol()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_van_personeel  boolean;
  v_naar_personeel boolean;
begin
  if not is_housekeeping() then
    return new;
  end if;

  select voor_personeel into v_van_personeel from locaties where id = new.van_locatie_id;
  select voor_personeel into v_naar_personeel from locaties where id = new.naar_locatie_id;
  v_van_personeel  := coalesce(v_van_personeel, false);
  v_naar_personeel := coalesce(v_naar_personeel, false);

  if new.evenement_id is null and (
       new.type = 'personeelsverbruik'
    or (new.type = 'magazijn-naar-magazijn' and v_naar_personeel)
    or (new.type = 'correctie' and (v_van_personeel or v_naar_personeel)
        and not (new.van_locatie_id is not null and new.naar_locatie_id is not null))
  ) then
    return new;
  end if;

  raise exception 'Housekeeping boekt alleen het aanvullen, tellen en afboeken van de kantine en de kroeg.';
end;
$$;

create or replace trigger mutatie_rol_gecontroleerd
  before insert on mutaties
  for each row execute function controleer_mutatie_rol();

-- ─── Controle ─────────────────────────────────────────────────────
select rol::text, count(*) from profiles group by 1 order by 1;
