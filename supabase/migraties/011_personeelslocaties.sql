-- ═══════════════════════════════════════════════════════════════════
-- 011 — kantine en kroeg: voorraad voor personeel
--
-- De kantine en de kroeg zijn gewone voorraadlocaties: er staat drank, het
-- wordt aangevuld vanuit het magazijn en het kan geteld worden. Wat ze
-- anders maakt is dat het verbruik daar van het personeel is en dus nooit
-- aan een evenement mag hangen. Anders lijkt een evenement duurder dan het
-- was, en dat is precies het getal waar straks op gestuurd wordt.
--
-- Dat onderscheid staat daarom in de database en niet alleen in het scherm:
--   * `voor_personeel` markeert de locatie;
--   * het mutatietype `personeelsverbruik` boekt wat er opgaat;
--   * een trigger weigert elke boeking die de twee werelden mengt.
-- ═══════════════════════════════════════════════════════════════════

alter type locatie_type add value if not exists 'kantine';
alter type locatie_type add value if not exists 'kroeg';
alter type mutatie_type add value if not exists 'personeelsverbruik';

-- Zie 010: een nieuwe enumwaarde is pas te gebruiken ná de transactie
-- waarin hij is aangemaakt.
commit;

-- ─── De markering ─────────────────────────────────────────────────
alter table locaties
  add column if not exists voor_personeel boolean not null default false;

comment on column locaties.voor_personeel is
  'True = wat hier opgaat is personeelsverbruik. Telt nooit mee in de cijfers '
  'van een evenement.';

-- ─── De twee locaties ─────────────────────────────────────────────
insert into locaties (naam, type, merk, voor_personeel)
select 'Kantine', 'kantine', 'NBC', true
where not exists (select 1 from locaties where lower(naam) = 'kantine');

insert into locaties (naam, type, merk, voor_personeel)
select 'Kroeg', 'kroeg', 'NBC', true
where not exists (select 1 from locaties where lower(naam) = 'kroeg');

update locaties set voor_personeel = true
where type in ('kantine', 'kroeg') and not voor_personeel;

-- ─── De scheiding afdwingen ───────────────────────────────────────
-- Vier regels, allemaal om dezelfde reden: personeelsverbruik en
-- evenementverbruik mogen elkaar nooit raken.
create or replace function controleer_mutatie()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_van_personeel  boolean := false;
  v_naar_personeel boolean := false;
begin
  select voor_personeel into v_van_personeel
  from locaties where id = new.van_locatie_id;
  select voor_personeel into v_naar_personeel
  from locaties where id = new.naar_locatie_id;

  v_van_personeel  := coalesce(v_van_personeel, false);
  v_naar_personeel := coalesce(v_naar_personeel, false);

  if new.type = 'personeelsverbruik' then
    if new.evenement_id is not null then
      raise exception 'Personeelsverbruik hoort niet bij een evenement.';
    end if;
    if not v_van_personeel then
      raise exception 'Personeelsverbruik boek je vanaf de kantine of de kroeg.';
    end if;
    if new.naar_locatie_id is not null then
      raise exception 'Personeelsverbruik gaat nergens heen: het is op.';
    end if;
  elsif new.evenement_id is not null and (v_van_personeel or v_naar_personeel) then
    raise exception 'De kantine en de kroeg zijn voor personeel; koppel daar geen evenement aan.';
  end if;

  return new;
end;
$$;

drop trigger if exists mutatie_gecontroleerd on mutaties;
create trigger mutatie_gecontroleerd
  before insert on mutaties
  for each row execute function controleer_mutatie();

-- ─── Controle ─────────────────────────────────────────────────────
select naam, type, merk, voor_personeel
from locaties
order by voor_personeel desc, naam;
