-- ═══════════════════════════════════════════════════════════════════
-- 016 — boekingen die op verbinding staan te wachten
--
-- In de koelcel en achter in het magazijn valt het bereik weg. Een boeking
-- blijft dan op de telefoon staan en gaat later alsnog weg. Het enige wat
-- de database daarvoor nodig heeft is een kenmerk dat de telefoon zelf
-- bedenkt, zodat een tweede poging nooit dubbel telt.
--
-- Waarom een unieke index en niet "even kijken of hij er al is"? Omdat twee
-- pogingen elkaar kunnen overlappen — de eerste is onderweg, de verbinding
-- valt weg, de telefoon probeert opnieuw. Alleen de database kan dat
-- betrouwbaar tegenhouden. De app herkent de fout op de unieke index en
-- weet dan: hij is al binnen, klaar.
--
-- Mutaties blijven append-only. Er wordt hier niets overschreven; er komt
-- alleen een kolom bij waarmee dezelfde boeking maar één keer landt.
-- ═══════════════════════════════════════════════════════════════════

alter table mutaties
  add column if not exists client_id uuid;

comment on column mutaties.client_id is
  'Kenmerk van de telefoon, gezet bij een boeking die in de wachtrij stond. '
  'Uniek, zodat een tweede verzendpoging niet tot een dubbele afboeking leidt.';

create unique index if not exists mutaties_client_uniek
  on mutaties (client_id) where client_id is not null;

-- ─── Controle ─────────────────────────────────────────────────────
select count(*) filter (where client_id is not null) as via_de_wachtrij_geboekt
from mutaties;
