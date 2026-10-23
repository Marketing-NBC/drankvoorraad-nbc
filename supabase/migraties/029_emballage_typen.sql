-- ═══════════════════════════════════════════════════════════════════
-- 029 — twee soorten emballagebeweging: erbij en eraf
--
-- Los van 030, omdat Postgres een nieuwe enumwaarde pas laat gebruiken
-- nadat de transactie die hem toevoegde is afgesloten. De SQL-editor van
-- Supabase draait een heel bestand als één transactie; 030 boekt meteen
-- een beginstand met `erbij`. Draai dit bestand dus eerst, apart.
--
-- `aantal` is altijd positief (fase 9), dus de richting zit in het type.
-- De beginstand, een telling en een losse invoer met de hand zijn allemaal
-- `erbij` of `eraf`; de notitie zegt welke van de drie het was.
-- ═══════════════════════════════════════════════════════════════════

alter type emballage_mutatie_type add value if not exists 'erbij';
alter type emballage_mutatie_type add value if not exists 'eraf';
