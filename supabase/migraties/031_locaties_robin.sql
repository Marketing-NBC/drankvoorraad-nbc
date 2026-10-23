-- ═══════════════════════════════════════════════════════════════════
-- 031 — locaties volgens Robin, na de eerste volledige telling
--
--   * "Bar Green Village" heet "Koelkasten buffetten en bekkens NBC". Hij
--     hoort bij NBC, dus het merk gaat mee. Het type blijft `bar`: de
--     uitgiftelocatie is de koelcel van NBC, en dat moet er één blijven.
--   * "Koelcel NBC" heet "Koelcellen NBC". De app vindt de uitgiftelocatie
--     op type en merk, niet op naam; de naam veranderen is dus veilig.
--   * De kantine en de kroeg worden één locatie: "Kantine en kroeg".
--     De kantine blijft bestaan en krijgt de nieuwe naam; de voorraad van de
--     kroeg gaat er met een gewone verplaatsing heen, zodat het in het
--     audit trail staat. De kroeg zelf kan niet weg — er hangen mutaties
--     aan — en gaat op `actief = false`. De app laat hem dan nergens meer
--     kiezen, maar oude boekingen houden hun naam.
--   * Swinkels 0,3 L en het fust Swinkels 20 L mogen voortaan ook in de
--     kantine en de kroeg.
--
-- Herhaalbaar: elke stap kijkt eerst of hij al gedaan is.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Nieuwe kolom: actief ─────────────────────────────────────────
alter table locaties add column if not exists actief boolean not null default true;
comment on column locaties.actief is
  'false = niet meer in gebruik. Blijft bestaan voor oude mutaties, maar is nergens meer te kiezen.';

-- ─── Namen ────────────────────────────────────────────────────────
update locaties
set naam = 'Koelkasten buffetten en bekkens NBC', merk = 'NBC'
where naam = 'Bar Green Village';

update locaties
set naam = 'Koelcellen NBC'
where naam = 'Koelcel NBC';

-- ─── Kantine en kroeg samenvoegen ─────────────────────────────────
do $$
declare
  v_kantine uuid;
  v_kroeg uuid;
  v_beheerder uuid;
  v_regel record;
begin
  select id into v_kantine from locaties where type = 'kantine' and voor_personeel order by aangemaakt_op limit 1;
  select id into v_kroeg from locaties where type = 'kroeg' and voor_personeel and actief order by aangemaakt_op limit 1;

  if v_kantine is null or v_kroeg is null then
    raise notice 'Geen actieve kroeg naast de kantine gevonden; samenvoegen overgeslagen.';
    return;
  end if;

  -- Een telling die openstaat rekent af tegen de voorraad van de kroeg;
  -- die eerst afronden of annuleren.
  if exists (select 1 from tellingen where locatie_id = v_kroeg and status = 'open') then
    raise exception 'Er staat nog een telling open op de kroeg. Rond die eerst af of annuleer hem.';
  end if;

  select id into v_beheerder from profiles where rol = 'beheerder' order by aangemaakt_op limit 1;
  if v_beheerder is null then
    raise exception 'Geen beheerder gevonden om de verplaatsing op naam van te zetten.';
  end if;

  -- De voorraad van de kroeg naar de kantine. Een negatieve stand (iets
  -- afgeboekt dat nooit was aangevuld) gaat de andere kant op, zodat beide
  -- uitkomen op wat er samen werkelijk is.
  for v_regel in
    select product_id, aantal from voorraad where locatie_id = v_kroeg and aantal <> 0
  loop
    insert into mutaties (product_id, aantal, type, van_locatie_id, naar_locatie_id, gebruiker_id, notitie)
    values (
      v_regel.product_id,
      abs(v_regel.aantal),
      'magazijn-naar-magazijn',
      case when v_regel.aantal > 0 then v_kroeg else v_kantine end,
      case when v_regel.aantal > 0 then v_kantine else v_kroeg end,
      v_beheerder,
      'Kantine en kroeg samengevoegd'
    );
  end loop;

  -- Het minimum van beide bij elkaar. Alleen min_voorraad: het aantal is
  -- van de trigger en staat hierboven al goed.
  insert into voorraad (locatie_id, product_id, aantal, min_voorraad)
  select v_kantine, product_id, 0, min_voorraad
  from voorraad
  where locatie_id = v_kroeg and min_voorraad > 0
  on conflict (locatie_id, product_id)
    do update set min_voorraad = voorraad.min_voorraad + excluded.min_voorraad;
  update voorraad set min_voorraad = 0 where locatie_id = v_kroeg;

  update locaties set naam = 'Kantine en kroeg' where id = v_kantine;
  update locaties set actief = false where id = v_kroeg;
end;
$$;

-- ─── Swinkels fles en fust ook voor personeel ─────────────────────
update producten
set voor_personeel = true
where naam in ('Swinckels 0,3 L', 'Fust Swinckels 20 L')
  and not voor_personeel;

-- ─── Controle ─────────────────────────────────────────────────────
select l.naam, l.type, l.merk, l.voor_personeel, l.actief,
       coalesce(sum(v.aantal), 0) as stuks
from locaties l
left join voorraad v on v.locatie_id = l.id
group by l.id
order by l.actief desc, l.naam;
select naam from producten where voor_personeel order by naam;
