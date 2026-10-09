-- ═══════════════════════════════════════════════════════════════════
-- 024 — de evenementmanager werkt ook in het magazijn
--
-- Floor (en elke andere evenementmanager) moet naast evenementen ook
-- inboeken, tellen, leveringen aannemen, pakbonnen maken en emballage
-- retour boeken kunnen. Daarvoor komt geen nieuwe rol: alle
-- evenementmanagers krijgen dit.
--
-- Wat de evenementmanager NIET krijgt, ook al staat het in de app bij
-- "magazijn": wijzigingen aan de inrichting. Dus geen producten
-- aanmaken of wijzigen, geen minimumvoorraad, geen vulplekken, machines
-- of koppelingen. Bedragen blijven ingetrokken (019): die lopen via
-- functies die alleen een beheerder mag aanroepen.
--
-- De functies hieronder zijn ongewijzigd, op één regel na: de
-- rolcontrole vraagt nu mag_magazijnwerk() in plaats van een eigen
-- lijst. De laatste definitie van elke functie is het uitgangspunt
-- (rond_telling_af uit 018, de rest uit fase 5, 6, 015 en 021).
-- ═══════════════════════════════════════════════════════════════════

create or replace function mag_magazijnwerk()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and rol in ('beheerder', 'magazijnmedewerker', 'evenementmanager')
  );
$$;

create or replace function start_telling(p_locatie_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_telling_id uuid;
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een telling te starten.';
  end if;

  if exists (select 1 from tellingen where locatie_id = p_locatie_id and status = 'open') then
    raise exception 'Er loopt al een telling voor deze locatie.';
  end if;

  insert into tellingen (locatie_id, gebruiker_id)
  values (p_locatie_id, auth.uid())
  returning id into v_telling_id;

  insert into tellingregels (telling_id, product_id, verwacht_aantal)
  select v_telling_id, p.id, coalesce(v.aantal, 0)
  from producten p
  left join voorraad v on v.product_id = p.id and v.locatie_id = p_locatie_id;

  return v_telling_id;
end;
$$;

create or replace function annuleer_telling(p_telling_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een telling te annuleren.';
  end if;

  delete from tellingen where id = p_telling_id and status = 'open';
end;
$$;

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
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een telling af te ronden.';
  end if;

  select locatie_id, status into v_locatie_id, v_status
  from tellingen where id = p_telling_id
  for update;

  if v_locatie_id is null then
    raise exception 'Telling bestaat niet.';
  end if;
  if v_status <> 'open' then
    raise exception 'Deze telling is al afgerond.';
  end if;

  select voor_personeel into v_voor_personeel from locaties where id = v_locatie_id;
  v_voor_personeel := coalesce(v_voor_personeel, false);

  for v_regel in
    select product_id, geteld_aantal
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

    if v_verschil <> 0 then
      if v_voor_personeel and v_verschil < 0 then
        insert into mutaties (product_id, aantal, type, van_locatie_id, gebruiker_id, notitie)
        values (
          v_regel.product_id,
          abs(v_verschil),
          'personeelsverbruik',
          v_locatie_id,
          auth.uid(),
          'Uit telling'
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
    end if;
  end loop;

  update tellingen
  set status = 'afgerond', afgerond_op = now()
  where id = p_telling_id;

  return v_aantal_correcties;
end;
$$;

create or replace function maak_pakbon(
  p_evenement_id text,
  p_van_locatie_id uuid,
  p_ontvanger_naam text,
  p_handtekening text,
  p_regels jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_pakbon_id uuid;
  v_regel record;
  v_aantal_regels integer;
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een pakbon vast te leggen.';
  end if;

  if not exists (select 1 from evenementen where id = p_evenement_id) then
    raise exception 'Evenement bestaat niet.';
  end if;

  if not exists (select 1 from locaties where id = p_van_locatie_id) then
    raise exception 'Locatie bestaat niet.';
  end if;

  if coalesce(trim(p_ontvanger_naam), '') = '' then
    raise exception 'Vul de naam van de ontvanger in.';
  end if;

  select count(*) into v_aantal_regels
  from jsonb_array_elements(coalesce(p_regels, '[]'::jsonb));

  if v_aantal_regels = 0 then
    raise exception 'Een pakbon heeft minstens één product nodig.';
  end if;

  -- Alle regels vooraf controleren. Een ongeldige regel halverwege zou
  -- anders de hele transactie terugdraaien nádat er al mutaties geboekt zijn
  -- — functioneel hetzelfde, maar de foutmelding is zo een stuk duidelijker.
  for v_regel in
    select
      (waarde ->> 'product_id')::uuid as product_id,
      (waarde ->> 'aantal')::integer  as aantal
    from jsonb_array_elements(p_regels) as waarde
  loop
    if v_regel.aantal is null or v_regel.aantal <= 0 then
      raise exception 'Elk product op de pakbon heeft een aantal groter dan 0 nodig.';
    end if;
    if not exists (select 1 from producten where id = v_regel.product_id) then
      raise exception 'Product bestaat niet.';
    end if;
  end loop;

  insert into pakbonnen (evenement_id, van_locatie_id, ontvanger_naam, handtekening, gebruiker_id)
  values (
    p_evenement_id,
    p_van_locatie_id,
    trim(p_ontvanger_naam),
    nullif(p_handtekening, ''),
    auth.uid()
  )
  returning id into v_pakbon_id;

  -- De trigger op mutaties werkt de voorraad bij; hier alleen boeken.
  insert into mutaties (
    product_id, aantal, type, van_locatie_id, evenement_id, pakbon_id, gebruiker_id, notitie
  )
  select
    (waarde ->> 'product_id')::uuid,
    (waarde ->> 'aantal')::integer,
    'magazijn-naar-evenement',
    p_van_locatie_id,
    p_evenement_id,
    v_pakbon_id,
    auth.uid(),
    'Pakbon'
  from jsonb_array_elements(p_regels) as waarde;

  return v_pakbon_id;
end;
$$;

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

create or replace function handel_verschil_af(p_regel_id uuid, p_notitie text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not mag_magazijnwerk() then
    raise exception 'Geen rechten om een verschil af te handelen.';
  end if;

  update leveringregels
  set afgehandeld_op = now(),
      afgehandeld_door = auth.uid(),
      notitie = coalesce(nullif(trim(coalesce(p_notitie, '')), ''), notitie)
  where id = p_regel_id and afgehandeld_op is null;
end;
$$;

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
  if not mag_magazijnwerk() then
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

-- ─── Tellingen: ook rechtstreeks op de tabel ─────────────────────
-- De app schrijft tellingregels zelf weg; dezelfde rechten als de functies.
drop policy if exists "tellingen uitvoeren" on tellingen;
create policy "tellingen uitvoeren" on tellingen
  for insert to authenticated
  with check (gebruiker_id = auth.uid() and mag_magazijnwerk());

drop policy if exists "tellingen afronden" on tellingen;
create policy "tellingen afronden" on tellingen
  for update to authenticated
  using (mag_magazijnwerk());

drop policy if exists "tellingregels beheren" on tellingregels;
create policy "tellingregels beheren" on tellingregels
  for all to authenticated
  using (mag_magazijnwerk())
  with check (mag_magazijnwerk());
