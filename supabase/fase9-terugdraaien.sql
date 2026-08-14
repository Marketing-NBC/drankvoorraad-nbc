-- ═══════════════════════════════════════════════════════════════════
-- Emballage uit gebruik nemen
--
-- De app kent emballage niet meer. Zonder dit script blijft de trigger
-- wél bij elke uitgifte emballageregels aanmaken die niemand meer ziet:
-- onzichtbare administratie die alleen maar verwarring geeft als je er
-- over een jaar op stuit.
--
-- De TABELLEN blijven bewust staan. Ze zijn leeg genoeg om geen last te
-- geven, en zo blijft de deur open om emballage later terug te zetten
-- zonder het schema opnieuw te bouwen. Wil je ze echt weg, dan staat dat
-- onderaan — maar dat is onomkeerbaar.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Automatisch meeboeken stoppen ─────────────────────────────
drop trigger if exists mutatie_emballage on mutaties;
drop function if exists verwerk_emballage();

-- ─── 2. Handmatig boeken onmogelijk maken ─────────────────────────
drop function if exists boek_emballage(uuid, integer, emballage_mutatie_type, text, text);

-- ─── 3. Koppeling product → emballage losmaken ────────────────────
-- De kolommen zelf blijven staan; ze zijn optioneel en storen niet.
update producten set emballage_id = null, emballage_aantal = 0;

-- ─── Controle ─────────────────────────────────────────────────────
select
  (select count(*) from emballage_mutaties) as emballagebewegingen_bewaard,
  (select count(*) from producten where emballage_id is not null) as producten_nog_gekoppeld;

-- ═══════════════════════════════════════════════════════════════════
-- ALLEEN als je emballage definitief niet meer wilt. Onomkeerbaar.
-- Laat dit staan als commentaar tenzij je zeker weet dat je de
-- geschiedenis niet meer nodig hebt.
--
-- drop table if exists emballage_mutaties;
-- drop table if exists emballage;
-- drop type if exists emballage_mutatie_type;
-- alter table producten drop column if exists emballage_id;
-- alter table producten drop column if exists emballage_aantal;
-- ═══════════════════════════════════════════════════════════════════
