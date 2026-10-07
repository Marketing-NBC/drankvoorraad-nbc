-- ═══════════════════════════════════════════════════════════════════
-- 022 — een tweede barcode: die van de krat
--
-- Een product had één barcode, die van het flesje. In het magazijn scan
-- je de krat, en daar staat meestal een andere code op. Dan zegt de app
-- "onbekende barcode" terwijl het product er gewoon staat.
--
-- Daarom een tweede kolom. Beide codes leiden naar hetzelfde product; wat
-- er geboekt wordt blijft in stuks (zie app/src/data/verpakking.ts).
-- ═══════════════════════════════════════════════════════════════════

alter table producten
  add column if not exists barcode_verpakking text;

comment on column producten.barcode_verpakking is
  'Barcode op de verpakking (krat, doos, tray). De barcode op het losse stuk staat in `barcode`.';

create unique index if not exists producten_barcode_verpakking_uniek
  on producten (barcode_verpakking) where barcode_verpakking is not null;

-- Na 019 is een nieuwe kolom niet vanzelf leesbaar of schrijfbaar.
grant select (barcode_verpakking), insert (barcode_verpakking), update (barcode_verpakking)
  on public.producten to authenticated;

-- ─── Eén code, één product ────────────────────────────────────────
-- Een code mag niet op het ene product de flesbarcode en op het andere de
-- kratbarcode zijn: dan weet de scanner niet welk product hij moet kiezen.
create or replace function controleer_barcodes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.barcode is not null and new.barcode = new.barcode_verpakking then
    raise exception 'De barcode van het stuk en van de verpakking kunnen niet dezelfde zijn.';
  end if;

  if exists (
    select 1 from producten p
    where p.id <> new.id
      and (
        (new.barcode is not null and p.barcode_verpakking = new.barcode)
        or (new.barcode_verpakking is not null and p.barcode = new.barcode_verpakking)
      )
  ) then
    raise exception 'Deze barcode hoort al bij een ander product.';
  end if;

  return new;
end;
$$;

drop trigger if exists barcodes_gecontroleerd on producten;
create trigger barcodes_gecontroleerd
  before insert or update of barcode, barcode_verpakking on producten
  for each row execute function controleer_barcodes();

-- ─── Controle ─────────────────────────────────────────────────────
select
  count(barcode)            as met_barcode_stuk,
  count(barcode_verpakking) as met_barcode_verpakking,
  count(*)                  as producten
from producten
where not voorraadloos;
