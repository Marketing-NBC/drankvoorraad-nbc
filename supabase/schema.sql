-- ═══════════════════════════════════════════════════════════════════
-- Drankvoorraad Beheerapplicatie — databaseschema
-- NBC / Green Village
--
-- Draai dit script één keer in de Supabase SQL Editor
-- (Supabase dashboard → SQL Editor → New query → plakken → Run).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Enums ────────────────────────────────────────────────────────
create type gebruiker_rol as enum ('beheerder', 'magazijnmedewerker', 'evenementmanager');
create type merk as enum ('NBC', 'Green Village');
create type locatie_type as enum ('magazijn', 'koelcel', 'bar');
create type evenement_status as enum ('Gepland', 'Actief', 'Afgerond');
create type product_categorie as enum ('bier', 'wijn', 'fris', 'sterke drank', 'overig');
create type mutatie_type as enum (
  'magazijn-naar-evenement',
  'evenement-naar-magazijn',
  'magazijn-naar-magazijn',
  'inkoop',
  'beschadigd',
  'correctie'
);
create type telling_status as enum ('open', 'afgerond');

-- ─── Profielen (gekoppeld aan auth.users) ─────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  naam text not null default '',
  rol gebruiker_rol not null default 'evenementmanager',
  aangemaakt_op timestamptz not null default now()
);

-- Nieuwe auth-gebruikers krijgen automatisch een profiel.
-- Rol standaard 'evenementmanager' — de beheerder past dit daarna aan.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, naam)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: rol van de huidige gebruiker (security definer voorkomt RLS-recursie)
create function huidige_rol()
returns gebruiker_rol
language sql
stable
security definer set search_path = public
as $$
  select rol from public.profiles where id = auth.uid();
$$;

create function is_beheerder()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'beheerder');
$$;

-- ─── Locaties ─────────────────────────────────────────────────────
-- merk NULL = gedeeld tussen NBC en Green Village (het hoofdmagazijn).
create table locaties (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  type locatie_type not null,
  merk merk,
  aangemaakt_op timestamptz not null default now()
);

-- ─── Producten ────────────────────────────────────────────────────
create table producten (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  sku text,
  barcode text unique,
  categorie product_categorie not null default 'overig',
  leverancier text,
  inkoopprijs numeric(10,2) not null default 0,
  verkoopprijs numeric(10,2) not null default 0,
  eenheid text not null default 'fles',
  aangemaakt_op timestamptz not null default now()
);

create index producten_barcode_idx on producten (barcode);

-- ─── Voorraad (stand per product per locatie) ─────────────────────
create table voorraad (
  locatie_id uuid not null references locaties on delete cascade,
  product_id uuid not null references producten on delete cascade,
  aantal integer not null default 0,
  min_voorraad integer not null default 0,
  primary key (locatie_id, product_id)
);

-- ─── Evenementen ──────────────────────────────────────────────────
-- id is een vrije-vorm tekst (géén auto-nummering) zodat later een
-- SEM-reserveringsnummer hier direct in past.
create table evenementen (
  id text primary key,
  naam text not null,
  datum date not null,
  merk merk not null,
  opdrachtgever text,
  status evenement_status not null default 'Gepland',
  omzet numeric(12,2) not null default 0,
  aangemaakt_op timestamptz not null default now()
);

-- ─── Mutaties (alle voorraadbewegingen + audit trail) ─────────────
-- Append-only: nooit wijzigen of verwijderen, alleen toevoegen.
-- Correcties zijn zelf ook weer een mutatie.
create table mutaties (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references producten on delete restrict,
  aantal integer not null,
  type mutatie_type not null,
  van_locatie_id uuid references locaties on delete restrict,
  naar_locatie_id uuid references locaties on delete restrict,
  evenement_id text references evenementen on delete restrict,
  pakbon_id uuid,
  gebruiker_id uuid not null references profiles on delete restrict,
  notitie text,
  datum_tijd timestamptz not null default now()
);

create index mutaties_evenement_idx on mutaties (evenement_id);
create index mutaties_product_idx on mutaties (product_id);
create index mutaties_datum_idx on mutaties (datum_tijd desc);

-- Voorraad automatisch bijwerken bij elke mutatie.
create function verwerk_mutatie()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.van_locatie_id is not null then
    insert into voorraad (locatie_id, product_id, aantal)
    values (new.van_locatie_id, new.product_id, -new.aantal)
    on conflict (locatie_id, product_id)
      do update set aantal = voorraad.aantal - new.aantal;
  end if;

  if new.naar_locatie_id is not null then
    insert into voorraad (locatie_id, product_id, aantal)
    values (new.naar_locatie_id, new.product_id, new.aantal)
    on conflict (locatie_id, product_id)
      do update set aantal = voorraad.aantal + new.aantal;
  end if;

  return new;
end;
$$;

create trigger mutatie_verwerkt
  after insert on mutaties
  for each row execute function verwerk_mutatie();

-- ─── Pakbonnen (overdracht magazijn → evenement, met handtekening) ─
create table pakbonnen (
  id uuid primary key default gen_random_uuid(),
  evenement_id text not null references evenementen on delete restrict,
  van_locatie_id uuid not null references locaties on delete restrict,
  ontvanger_naam text not null default '',
  handtekening text,
  gebruiker_id uuid not null references profiles on delete restrict,
  aangemaakt_op timestamptz not null default now()
);

alter table mutaties
  add constraint mutaties_pakbon_fk
  foreign key (pakbon_id) references pakbonnen on delete set null;

-- ─── Voorraadtellingen (inventarisatie) ───────────────────────────
create table tellingen (
  id uuid primary key default gen_random_uuid(),
  locatie_id uuid not null references locaties on delete restrict,
  status telling_status not null default 'open',
  gebruiker_id uuid not null references profiles on delete restrict,
  aangemaakt_op timestamptz not null default now(),
  afgerond_op timestamptz
);

create table tellingregels (
  id uuid primary key default gen_random_uuid(),
  telling_id uuid not null references tellingen on delete cascade,
  product_id uuid not null references producten on delete restrict,
  verwacht_aantal integer not null default 0,
  geteld_aantal integer,
  unique (telling_id, product_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- Iedereen moet ingelogd zijn. Daarbovenop gelden rolbeperkingen.
-- ═══════════════════════════════════════════════════════════════════

alter table profiles      enable row level security;
alter table locaties      enable row level security;
alter table producten     enable row level security;
alter table voorraad      enable row level security;
alter table evenementen   enable row level security;
alter table mutaties      enable row level security;
alter table pakbonnen     enable row level security;
alter table tellingen     enable row level security;
alter table tellingregels enable row level security;

-- Profielen: iedereen ziet alle profielen (nodig om namen te tonen bij
-- mutaties); alleen de beheerder mag rollen aanpassen.
create policy "profielen zichtbaar voor ingelogde gebruikers"
  on profiles for select to authenticated using (true);
create policy "beheerder beheert profielen"
  on profiles for update to authenticated using (is_beheerder());

-- Locaties: iedereen leest, beheerder beheert.
create policy "locaties zichtbaar" on locaties
  for select to authenticated using (true);
create policy "beheerder beheert locaties" on locaties
  for all to authenticated using (is_beheerder()) with check (is_beheerder());

-- Producten: iedereen leest. Beheerder en magazijnmedewerker mogen
-- producten aanmaken/wijzigen (nodig om een gescande barcode direct
-- aan een nieuw product te koppelen). Alleen beheerder verwijdert.
create policy "producten zichtbaar" on producten
  for select to authenticated using (true);
create policy "magazijn maakt producten aan" on producten
  for insert to authenticated
  with check (huidige_rol() in ('beheerder', 'magazijnmedewerker'));
create policy "magazijn wijzigt producten" on producten
  for update to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'));
create policy "beheerder verwijdert producten" on producten
  for delete to authenticated using (is_beheerder());

-- Voorraad: iedereen leest; schrijven gebeurt uitsluitend via de
-- mutatie-trigger (security definer), niet rechtstreeks.
create policy "voorraad zichtbaar" on voorraad
  for select to authenticated using (true);

-- Evenementen: iedereen leest. Beheerder en evenementmanager beheren.
create policy "evenementen zichtbaar" on evenementen
  for select to authenticated using (true);
create policy "evenementen beheren" on evenementen
  for insert to authenticated
  with check (huidige_rol() in ('beheerder', 'evenementmanager'));
create policy "evenementen wijzigen" on evenementen
  for update to authenticated
  using (huidige_rol() in ('beheerder', 'evenementmanager'));
create policy "beheerder verwijdert evenementen" on evenementen
  for delete to authenticated using (is_beheerder());

-- Mutaties: iedereen leest (volledige traceerbaarheid). Iedereen mag
-- boeken, maar altijd op eigen naam. Nooit wijzigen of verwijderen —
-- dat maakt dit het audit trail.
create policy "mutaties zichtbaar" on mutaties
  for select to authenticated using (true);
create policy "mutaties toevoegen op eigen naam" on mutaties
  for insert to authenticated with check (gebruiker_id = auth.uid());

-- Pakbonnen
create policy "pakbonnen zichtbaar" on pakbonnen
  for select to authenticated using (true);
create policy "pakbonnen aanmaken" on pakbonnen
  for insert to authenticated with check (gebruiker_id = auth.uid());

-- Tellingen: magazijnmedewerker en beheerder voeren ze uit.
create policy "tellingen zichtbaar" on tellingen
  for select to authenticated using (true);
create policy "tellingen uitvoeren" on tellingen
  for insert to authenticated
  with check (gebruiker_id = auth.uid() and huidige_rol() in ('beheerder', 'magazijnmedewerker'));
create policy "tellingen afronden" on tellingen
  for update to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'));

create policy "tellingregels zichtbaar" on tellingregels
  for select to authenticated using (true);
create policy "tellingregels beheren" on tellingregels
  for all to authenticated
  using (huidige_rol() in ('beheerder', 'magazijnmedewerker'))
  with check (huidige_rol() in ('beheerder', 'magazijnmedewerker'));

-- ═══════════════════════════════════════════════════════════════════
-- Realtime: wijzigingen live doorsturen naar alle geopende apparaten
-- ═══════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table producten;
alter publication supabase_realtime add table evenementen;
alter publication supabase_realtime add table mutaties;
alter publication supabase_realtime add table voorraad;
