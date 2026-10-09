-- ═══════════════════════════════════════════════════════════════════
-- 027 — uitkomsten van het gesprek met Robin
--
-- Draai eerst 026: deze migratie gebruikt mag_tellen() en
-- is_housekeeping() van daar.
--
--   1. Evenementen krijgen een aantal personen, voor de consumpties per
--      persoon. Afronden mag alleen de beheerder, en op een afgerond
--      evenement boekt daarna alleen de beheerder nog.
--   2. Een levering gaat alleen naar het hoofdmagazijn of een koelcel,
--      van Swinkels of Bidfood.
--   3. Artikelnummers van de leverancier: welk product hoort bij een
--      regel op de afleverbon, en hoeveel stuks zit er in één eenheid.
--      Zo kan de app een gelezen bon meteen invullen.
--   4. Een tekort bij een telling in het magazijn krijgt een reden: over
--      datum of kapot (derving), of een andere reden (blijft een
--      telverschil). In de kantine en de kroeg blijft een tekort
--      personeelsverbruik (018).
--   5. Producten krijgen een vinkje "voor personeel": alleen die kun je
--      in de kantine en de kroeg aanvullen en tellen.
--   6. Emballage volgt de retourbon van Swinkels, met artikelnummers.
--   7. Migratie 025 zette Coca-Cola op Bidfood. De afleverbon laat zien
--      dat Swinkels die levert; dat wordt hier rechtgezet.
-- ═══════════════════════════════════════════════════════════════════

-- ═══ 1. Evenementen ═════════════════════════════════════════════════
alter table evenementen add column if not exists aantal_personen integer;
alter table evenementen drop constraint if exists evenementen_aantal_personen_positief;
alter table evenementen add constraint evenementen_aantal_personen_positief
  check (aantal_personen is null or aantal_personen > 0);

-- Kolomrechten: sinds 019 is niets op evenementen vanzelf leesbaar.
grant select (aantal_personen) on public.evenementen to authenticated;
grant insert (aantal_personen) on public.evenementen to authenticated;
grant update (aantal_personen) on public.evenementen to authenticated;

-- Robin checkt na afloop alles en rondt dan af. Zonder auth.uid() is
-- het iemand in de SQL-editor of een servicefunctie: die laten we door.
create or replace function controleer_evenement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_beheerder() then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Afgerond' then
    raise exception 'Dit evenement is afgerond. Alleen de beheerder kan het nog wijzigen.';
  end if;
  if new.status = 'Afgerond' then
    raise exception 'Alleen de beheerder rondt een evenement af.';
  end if;

  return new;
end;
$$;

drop trigger if exists evenement_gecontroleerd on evenementen;
create trigger evenement_gecontroleerd
  before insert or update on evenementen
  for each row execute function controleer_evenement();

-- ═══ 5. Producten voor personeel ════════════════════════════════════
-- Alleen bij het aanmaken van de kolom vullen: daarna is het vinkje van
-- de beheerder en mag een tweede keer draaien het niet terugzetten.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'producten' and column_name = 'voor_personeel'
  ) then
    alter table producten add column voor_personeel boolean not null default false;

    -- Robin: in de kantine en de kroeg alleen de grote flessen fris
    -- (1,25 en 1,5 L), plus radler, alcoholvrij bier en wijn.
    update producten set voor_personeel = true
    where (categorie = 'fris' and inhoud in ('1,25 L', '1,5 L'))
       or categorie = 'wijn'
       or naam in ('Radler 0% 0,3 L', 'Swinckels 0% 0,3 L');
  end if;
end $$;

grant select (voor_personeel) on public.producten to authenticated;
grant insert (voor_personeel) on public.producten to authenticated;
grant update (voor_personeel) on public.producten to authenticated;

-- ═══ Boekingen: rol, afgerond evenement, kantine en kroeg ═══════════
-- Uitbreiding van de functie uit 026.
create or replace function controleer_mutatie_rol()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_van_personeel  boolean;
  v_naar_personeel boolean;
  v_status         evenement_status;
  v_product        record;
begin
  -- SQL-editor of servicefunctie: geen gebruiker, geen rolregels.
  if auth.uid() is null then
    return new;
  end if;

  select voor_personeel into v_van_personeel from locaties where id = new.van_locatie_id;
  select voor_personeel into v_naar_personeel from locaties where id = new.naar_locatie_id;
  v_van_personeel  := coalesce(v_van_personeel, false);
  v_naar_personeel := coalesce(v_naar_personeel, false);

  -- Housekeeping: alleen rond de kantine en de kroeg.
  if is_housekeeping() and not (
    new.evenement_id is null and (
         new.type = 'personeelsverbruik'
      or (new.type = 'magazijn-naar-magazijn' and v_naar_personeel)
      or (new.type = 'correctie' and (v_van_personeel or v_naar_personeel)
          and not (new.van_locatie_id is not null and new.naar_locatie_id is not null))
    )
  ) then
    raise exception 'Housekeeping boekt alleen het aanvullen, tellen en afboeken van de kantine en de kroeg.';
  end if;

  -- Afgerond is afgerond: daarna boekt alleen de beheerder nog.
  if new.evenement_id is not null and not is_beheerder() then
    select status into v_status from evenementen where id = new.evenement_id;
    if v_status = 'Afgerond' then
      raise exception 'Dit evenement is afgerond. Alleen de beheerder kan er nog op boeken.';
    end if;
  end if;

  -- In de kantine en de kroeg komen alleen producten voor personeel. Een
  -- correctie mag wel: die zet een telling recht, ook van iets dat er
  -- nog van vroeger staat.
  if v_naar_personeel and new.type <> 'correctie' then
    select naam, voor_personeel into v_product from producten where id = new.product_id;
    if not coalesce(v_product.voor_personeel, false) then
      raise exception '% hoort niet in de kantine of de kroeg.', v_product.naam;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists mutatie_rol_gecontroleerd on mutaties;
create trigger mutatie_rol_gecontroleerd
  before insert on mutaties
  for each row execute function controleer_mutatie_rol();

-- ═══ 3. Artikelnummers van de leverancier ═══════════════════════════
create table if not exists leverancier_artikelen (
  leverancier       text not null,
  artikelnummer     text not null,
  omschrijving      text,
  product_id        uuid not null references producten(id) on delete cascade,
  -- Hoeveel stuks er in één eenheid op de bon zit: een krat van 24, een
  -- tray van 12, een fust is 1.
  stuks_per_eenheid integer not null default 1 check (stuks_per_eenheid > 0),
  aangemaakt_op     timestamptz not null default now(),
  primary key (leverancier, artikelnummer)
);

alter table leverancier_artikelen enable row level security;
drop policy if exists "artikelen zichtbaar" on leverancier_artikelen;
create policy "artikelen zichtbaar" on leverancier_artikelen
  for select to authenticated using (true);
grant select on public.leverancier_artikelen to authenticated;

-- Een onbekend artikel koppelen hoort bij het aannemen van een levering,
-- dus wie leveringen aanneemt mag het. Schrijven alleen via deze functie.
create or replace function koppel_artikel(
  p_leverancier text,
  p_artikelnummer text,
  p_omschrijving text,
  p_product_id uuid,
  p_stuks_per_eenheid integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een artikel te koppelen.';
  end if;
  if coalesce(trim(p_leverancier), '') = '' or coalesce(trim(p_artikelnummer), '') = '' then
    raise exception 'Leverancier en artikelnummer zijn nodig.';
  end if;
  if coalesce(p_stuks_per_eenheid, 0) <= 0 then
    raise exception 'Vul in hoeveel stuks er in één eenheid zit.';
  end if;
  if not exists (select 1 from producten where id = p_product_id) then
    raise exception 'Product bestaat niet.';
  end if;

  insert into leverancier_artikelen (leverancier, artikelnummer, omschrijving, product_id, stuks_per_eenheid)
  values (trim(p_leverancier), trim(p_artikelnummer), nullif(trim(coalesce(p_omschrijving, '')), ''),
          p_product_id, p_stuks_per_eenheid)
  on conflict (leverancier, artikelnummer) do update
    set product_id = excluded.product_id,
        stuks_per_eenheid = excluded.stuks_per_eenheid,
        omschrijving = coalesce(excluded.omschrijving, leverancier_artikelen.omschrijving);
end;
$$;

-- Wat al bekend is van de afleverbon van Swinkels van 2 oktober 2026.
-- Twijfelgevallen (Fanta Zero, Minute Maid) staan op de checklist voor
-- Robin; Chaudfontaine heeft nog geen product en blijft open.
insert into leverancier_artikelen (leverancier, artikelnummer, omschrijving, product_id, stuks_per_eenheid)
select 'Swinkels', a.artikelnummer, a.omschrijving, p.id, a.stuks
from (values
  ('118573', 'Swinckels 0.0 Crate 4x6x30',           'Swinckels 0% 0,3 L',    24),
  ('117919', 'Swinckels Pilsener Crate 4x6x30',       'Swinckels 0,3 L',       24),
  ('200084', 'Coca-Cola Regular Crate Bot 24x20',     'Coca Cola 0,2 L',       24),
  ('206110', 'Coca-Cola Zero Crate 24x20',            'Coca Cola Zero 0,2 L',  24),
  ('216410', 'Coca-Cola Zero Tray Bot 12x125',        'Coca Cola Zero 1,25 L', 12),
  ('216418', 'Fuze Tea Green Tea Tray Bot 6x125',     'Fuze Tea Green 1,25 L',  6),
  ('213774', 'Fuze Tea Spark. Black Crate 24x20',     'Fuze Tea Sparkling 0,2 L', 24),
  ('213770', 'Fuze Tea Green Tea Crate 24x20',        'Fuze Tea Green 0,2 L',  24),
  ('217335', 'Fanta Orange Zero Sugar Crate 24x20',   'Fanta 0,2 L',           24),
  ('224865', 'Minute Maid Orange Nectar Crate Bot24x20', 'Jus d''orange 0,2 L', 24),
  ('108244', 'Swinckels'' Pilsener 20L A-Kopp',       'Fust Swinckels 20 L',    1)
) as a(artikelnummer, omschrijving, product, stuks)
join producten p on lower(p.naam) = lower(a.product)
on conflict (leverancier, artikelnummer) do nothing;

-- ═══ 2. Leveringen ══════════════════════════════════════════════════
-- Ongewijzigd ten opzichte van 024, op twee controles na: de locatie
-- en de leverancier.
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
begin
  if not mag_magazijnwerk() then
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

  -- Een levering komt binnen in het hoofdmagazijn of een koelcel, nooit
  -- direct aan een bar, de kantine of de kroeg.
  if not exists (
    select 1 from locaties
    where id = p_locatie_id and type in ('magazijn', 'koelcel') and not voor_personeel
  ) then
    raise exception 'Een levering gaat naar het hoofdmagazijn of een koelcel.';
  end if;

  if nullif(trim(coalesce(p_leverancier, '')), '') is not null
     and trim(p_leverancier) not in ('Swinkels', 'Bidfood') then
    raise exception 'De leverancier is Swinkels of Bidfood.';
  end if;

  if coalesce(trim(p_aangenomen_door), '') = '' then
    raise exception 'Vul in wie de levering heeft aangenomen.';
  end if;

  if (select count(*) from jsonb_array_elements(coalesce(p_regels, '[]'::jsonb))) = 0 then
    raise exception 'Een levering heeft minstens één regel nodig.';
  end if;

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

-- ═══ 4. Tellingen ═══════════════════════════════════════════════════
alter table tellingregels add column if not exists reden text;
alter table tellingregels add column if not exists reden_toelichting text;
alter table tellingregels drop constraint if exists tellingregels_reden_geldig;
alter table tellingregels add constraint tellingregels_reden_geldig
  check (reden is null or reden in ('over_datum', 'kapot', 'anders'));

-- In de kantine en de kroeg alleen producten voor personeel, plus wat
-- er nog staat van vroeger: dat moet op te tellen zijn tot het op is.
create or replace function start_telling(p_locatie_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_telling_id uuid;
  v_voor_personeel boolean;
begin
  if not mag_tellen(p_locatie_id) then
    raise exception 'Geen rechten om hier een telling te starten.';
  end if;

  if exists (select 1 from tellingen where locatie_id = p_locatie_id and status = 'open') then
    raise exception 'Er loopt al een telling voor deze locatie.';
  end if;

  select voor_personeel into v_voor_personeel from locaties where id = p_locatie_id;

  insert into tellingen (locatie_id, gebruiker_id)
  values (p_locatie_id, auth.uid())
  returning id into v_telling_id;

  insert into tellingregels (telling_id, product_id, verwacht_aantal)
  select v_telling_id, p.id, coalesce(v.aantal, 0)
  from producten p
  left join voorraad v on v.product_id = p.id and v.locatie_id = p_locatie_id
  where not coalesce(v_voor_personeel, false)
     or p.voor_personeel
     or coalesce(v.aantal, 0) <> 0;

  return v_telling_id;
end;
$$;

create or replace function annuleer_telling(p_telling_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not mag_tellen((select locatie_id from tellingen where id = p_telling_id)) then
    raise exception 'Geen rechten om een telling te annuleren.';
  end if;

  delete from tellingen where id = p_telling_id and status = 'open';
end;
$$;

-- Ten opzichte van 018/024: een tekort in het magazijn heeft een reden
-- nodig. Over datum en kapot zijn derving (`beschadigd`); een andere
-- reden blijft een telverschil (`correctie`) met die reden erbij. De
-- notitie begint altijd met "Voorraadtelling", zodat het rapport de
-- telverschillen blijft vinden.
create or replace function rond_telling_af(p_telling_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_locatie_id uuid;
  v_status telling_status;
  v_voor_personeel boolean;
  v_regel record;
  v_huidig integer;
  v_verschil integer;
  v_aantal_correcties integer := 0;
  v_zonder_reden text;
begin
  select locatie_id, status into v_locatie_id, v_status
  from tellingen where id = p_telling_id
  for update;

  if v_locatie_id is null then
    raise exception 'Telling bestaat niet.';
  end if;
  if not mag_tellen(v_locatie_id) then
    raise exception 'Geen rechten om een telling af te ronden.';
  end if;
  if v_status <> 'open' then
    raise exception 'Deze telling is al afgerond.';
  end if;

  select voor_personeel into v_voor_personeel from locaties where id = v_locatie_id;
  v_voor_personeel := coalesce(v_voor_personeel, false);

  -- Eerst kijken of elk tekort in het magazijn een reden heeft. Tegen de
  -- HUIDIGE voorraad, net als het boeken hieronder.
  if not v_voor_personeel then
    select string_agg(p.naam, ', ' order by p.naam) into v_zonder_reden
    from tellingregels r
    join producten p on p.id = r.product_id
    left join voorraad v on v.locatie_id = v_locatie_id and v.product_id = r.product_id
    where r.telling_id = p_telling_id
      and r.geteld_aantal is not null
      and r.geteld_aantal < coalesce(v.aantal, 0)
      and (r.reden is null
           or (r.reden = 'anders' and coalesce(trim(r.reden_toelichting), '') = ''));

    if v_zonder_reden is not null then
      raise exception 'Geef bij elk tekort aan wat er gebeurd is: %', v_zonder_reden;
    end if;
  end if;

  for v_regel in
    select product_id, geteld_aantal, reden, reden_toelichting
    from tellingregels
    where telling_id = p_telling_id and geteld_aantal is not null
  loop
    -- Let op: tegen de HUIDIGE voorraad, niet tegen de momentopname bij het
    -- starten. Heeft iemand tijdens het tellen nog iets geboekt, dan zou
    -- rekenen met de oude stand dat ongedaan maken.
    select coalesce(aantal, 0) into v_huidig
    from voorraad
    where locatie_id = v_locatie_id and product_id = v_regel.product_id;

    v_huidig := coalesce(v_huidig, 0);
    v_verschil := v_regel.geteld_aantal - v_huidig;

    if v_verschil = 0 then
      continue;
    end if;

    if v_voor_personeel and v_verschil < 0 then
      insert into mutaties (product_id, aantal, type, van_locatie_id, gebruiker_id, notitie)
      values (v_regel.product_id, abs(v_verschil), 'personeelsverbruik', v_locatie_id, auth.uid(), 'Uit telling');
    elsif v_verschil < 0 and v_regel.reden in ('over_datum', 'kapot') then
      insert into mutaties (product_id, aantal, type, van_locatie_id, gebruiker_id, notitie)
      values (
        v_regel.product_id, abs(v_verschil), 'beschadigd', v_locatie_id, auth.uid(),
        'Voorraadtelling: ' || case v_regel.reden when 'over_datum' then 'over datum' else 'kapot' end
      );
    elsif v_verschil < 0 and v_regel.reden = 'anders' then
      insert into mutaties (product_id, aantal, type, van_locatie_id, gebruiker_id, notitie)
      values (
        v_regel.product_id, abs(v_verschil), 'correctie', v_locatie_id, auth.uid(),
        'Voorraadtelling: ' || trim(v_regel.reden_toelichting)
      );
    else
      insert into mutaties (product_id, aantal, type, van_locatie_id, naar_locatie_id, gebruiker_id, notitie)
      values (
        v_regel.product_id,
        abs(v_verschil),
        'correctie',
        case when v_verschil < 0 then v_locatie_id else null end,
        case when v_verschil > 0 then v_locatie_id else null end,
        auth.uid(),
        'Voorraadtelling'
      );
    end if;
    v_aantal_correcties := v_aantal_correcties + 1;
  end loop;

  update tellingen
  set status = 'afgerond', afgerond_op = now()
  where id = p_telling_id;

  return v_aantal_correcties;
end;
$$;

-- ═══ 6. Emballage volgens de retourbon van Swinkels ═════════════════
alter table emballage add column if not exists artikelnummer text;
grant select (artikelnummer) on public.emballage to authenticated;

update emballage set artikelnummer = '800307', leverancier = 'Swinkels'
where naam = 'Rolcontainer';

update emballage set artikelnummer = '800004'
where naam = 'Fust Swinkels 20 L';

-- Op de retourbon staat € 120 voor een lege koolzuurcilinder (2-6-10 kg),
-- niet de € 180 uit 023. Staat op de checklist voor Robin.
update emballage set artikelnummer = '800158', borg = 120.00
where naam = 'Koolzuurcilinder';

update emballage set artikelnummer = '800022'
where naam = 'Bierkrat Swinkels 24 × 0,3 L';

-- De fris gaat terug als "krat fris handel 8 t/m 28 vaks" (€ 5,00).
update emballage
set naam = 'Krat fris handel 8 t/m 28 vaks', artikelnummer = '800163', leverancier = 'Swinkels'
where naam = 'Krat Coca-Cola 24 × 0,2 L';

update emballage set leverancier = 'Swinkels'
where naam = 'PET-fles Coca-Cola';

-- De PET-flessen gaan in een zak terug; op de bon staat er één.
insert into emballage (naam, leverancier, borg, artikelnummer)
values ('Big bag PET (2,5 m)', 'Swinkels', 0, '800136')
on conflict (naam) do nothing;

-- ═══ 7. Leveranciers: 025 deels terugdraaien ═══════════════════════
-- De afleverbon van Swinkels heeft Coca-Cola, Fuze Tea, Fanta en Minute
-- Maid. Alles wat in 010 op Coca-Cola stond, is dus Swinkels. Spa blijft
-- bij Bidfood tot Robin zegt wat Bidfood levert.
update producten set leverancier = 'Swinkels'
where naam in (
  'Coca Cola 0,2 L', 'Coca Cola Zero 0,2 L', 'Fanta 0,2 L',
  'Fuze Tea Sparkling 0,2 L', 'Fuze Tea Green 0,2 L', 'Jus d''orange 0,2 L',
  'Tonic 0,2 L', 'Bitter lemon 0,2 L', 'Ginger ale 0,2 L',
  'Coca Cola 1,25 L', 'Coca Cola Zero 1,25 L', 'Sprite 1,5 L', 'Fanta 1,5 L',
  'Fuze Tea Sparkling 1,25 L', 'Fuze Tea Green 1,25 L'
)
and leverancier = 'Bidfood';

-- ─── Controle ─────────────────────────────────────────────────────
select naam, voor_personeel from producten where voor_personeel order by naam;
select artikelnummer, naam, leverancier, borg from emballage where actief order by artikelnummer nulls last;
select a.artikelnummer, p.naam, a.stuks_per_eenheid
from leverancier_artikelen a join producten p on p.id = a.product_id order by 1;
