-- ═══════════════════════════════════════════════════════════════════
-- 014 — de bierflesjes gaan ook per krat
--
-- Bij 010 gold "nooit los boeken" alleen voor de flesjes van 0,2 L. De
-- bierflesjes van 0,3 L horen er net zo goed bij: die komen en gaan per
-- krat van 24, dus vraagt de app kratten en rekent zelf naar flesjes om.
--
-- De voorraad zelf verandert hier niet. Die staat en blijft in stuks; wat
-- verandert is hoe er ingevoerd en getoond wordt.
-- ═══════════════════════════════════════════════════════════════════

update producten
set alleen_per_verpakking = true
where naam in ('Swinckels 0,3 L', 'Swinckels 0% 0,3 L', 'Radler 0% 0,3 L')
  and verpakking is not null
  and stuks_per_verpakking > 1;

-- ─── Controle ─────────────────────────────────────────────────────
select naam, verpakking, stuks_per_verpakking, alleen_per_verpakking
from producten
where alleen_per_verpakking
order by naam;
