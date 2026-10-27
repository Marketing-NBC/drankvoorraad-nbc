import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Icon } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmballageMutatieTabel } from "../../components/ui/EmballageMutatieTabel";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { MutatieTabel } from "../../components/ui/MutatieTabel";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import {
  emballageBeweging,
  emballageNotitie,
  emballageVerschil,
  type EmballageBeweging,
} from "../../data/emballage";
import {
  emballageBewegingLabels,
  emballageBewegingOpties,
  mutatieLabels,
  mutatieTypeOpties,
} from "../../data/labels";
import type { EmballageMutatie, Mutatie, MutatieType } from "../../data/types";
import { exporteerNaarExcel } from "../../utils/excel";
import { formatNumber } from "../../utils/format";

type Weergave = "drank" | "emballage";

const WEERGAVEN: { id: Weergave; label: string }[] = [
  { id: "drank", label: "Drank" },
  { id: "emballage", label: "Emballage" },
];

/**
 * Mutaties: het audit trail van de drankvoorraad, en daarnaast dat van de
 * emballage. Twee aparte lijsten, omdat emballage de drankvoorraad niet raakt
 * en in eigen tabellen staat (zie migratie 030). De keuze staat in de URL
 * (`?soort=emballage`), zodat Magazijn → Emballage er rechtstreeks naartoe
 * kan linken.
 */
export function Historie() {
  const { state, laden, fout, herlaad } = useAppState();
  const [zoekParams, setZoekParams] = useSearchParams();
  const weergave: Weergave = zoekParams.get("soort") === "emballage" ? "emballage" : "drank";
  const [zoek, setZoek] = useState("");
  const [type, setType] = useState<MutatieType | "">("");
  const [locatieId, setLocatieId] = useState("");
  const [beweging, setBeweging] = useState<EmballageBeweging | "">("");
  const [emballageId, setEmballageId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  function kiesWeergave(nieuw: Weergave) {
    setZoekParams(nieuw === "emballage" ? { soort: "emballage" } : {}, { replace: true });
  }

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p.naam])),
    [state.producten]
  );
  const evenementNaam = useMemo(
    () => new Map(state.evenementen.map((e) => [e.id, e.naam])),
    [state.evenementen]
  );
  const soortNaam = useMemo(
    () => new Map(state.emballage.map((s) => [s.id, s.naam])),
    [state.emballage]
  );
  const retourById = useMemo(
    () => new Map(state.emballageRetouren.map((r) => [r.id, r])),
    [state.emballageRetouren]
  );

  const mutaties = useMemo(() => {
    const zoekterm = zoek.trim().toLowerCase();
    return state.mutaties
      .filter((m) => (type ? m.type === type : true))
      .filter((m) => (locatieId ? m.vanLocatieId === locatieId || m.naarLocatieId === locatieId : true))
      .filter((m) => {
        if (!zoekterm) return true;
        const product = (productNaam.get(m.productId) ?? "").toLowerCase();
        const evenement = m.evenementId ? (evenementNaam.get(m.evenementId) ?? m.evenementId).toLowerCase() : "";
        const notitie = (m.notitie ?? "").toLowerCase();
        return product.includes(zoekterm) || evenement.includes(zoekterm) || notitie.includes(zoekterm);
      });
  }, [state.mutaties, type, locatieId, zoek, productNaam, evenementNaam]);

  const emballageMutaties = useMemo(() => {
    const zoekterm = zoek.trim().toLowerCase();
    return state.emballageMutaties
      .filter((m) => (beweging ? emballageBeweging(m) === beweging : true))
      .filter((m) => (emballageId ? m.emballageId === emballageId : true))
      .filter((m) => {
        if (!zoekterm) return true;
        const soort = (soortNaam.get(m.emballageId) ?? "").toLowerCase();
        const notitie = emballageNotitie(m, m.retourId ? retourById.get(m.retourId) : undefined).toLowerCase();
        return soort.includes(zoekterm) || notitie.includes(zoekterm);
      });
  }, [state.emballageMutaties, beweging, emballageId, zoek, soortNaam, retourById]);

  const aantalRegels = weergave === "drank" ? mutaties.length : emballageMutaties.length;
  const actieveFilters = (weergave === "drank" ? [type, locatieId] : [beweging, emballageId]).filter(Boolean).length;

  /* Twee cijfers die bij het doorbladeren houvast geven: hoeveel er deze
     week geboekt is, en hoeveel daarvan derving was. */
  const dezeWeek = useMemo(() => {
    const grens = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const regels: { datumTijd: string }[] = weergave === "drank" ? mutaties : emballageMutaties;
    return regels.filter((m) => new Date(m.datumTijd).getTime() >= grens).length;
  }, [weergave, mutaties, emballageMutaties]);
  const afschrijvingen = useMemo(
    () => mutaties.filter((m) => m.type === "beschadigd").length,
    [mutaties]
  );

  const [exporteert, setExporteert] = useState(false);

  async function exporteer() {
    const locatieNaam = new Map(state.alleLocaties.map((l) => [l.id, l.naam]));
    const gebruikerNaam = new Map(state.profielen.map((p) => [p.id, p.naam]));
    const datum = new Date().toISOString().slice(0, 10);

    setExporteert(true);
    try {
      if (weergave === "emballage") {
        const filterOmschrijving = [
          beweging ? `soort: ${emballageBewegingLabels[beweging]}` : null,
          emballageId ? `emballage: ${soortNaam.get(emballageId)}` : null,
          zoek.trim() ? `zoekterm: "${zoek.trim()}"` : null,
        ].filter(Boolean).join(" · ");
        await exporteerNaarExcel<EmballageMutatie>({
          bestandsnaam: `emballagemutaties-${datum}`,
          titel: "Emballagemutaties",
          ondertitel: filterOmschrijving
            ? `${emballageMutaties.length} mutaties — ${filterOmschrijving}`
            : `${emballageMutaties.length} mutaties — volledige historie`,
          rijen: emballageMutaties,
          kolommen: [
            { header: "Datum en tijd", opmaak: "datum", value: (m) => new Date(m.datumTijd) },
            { header: "Soort", value: (m) => emballageBewegingLabels[emballageBeweging(m)] },
            { header: "Emballage", value: (m) => soortNaam.get(m.emballageId) ?? m.emballageId },
            { header: "Aantal", opmaak: "getal", value: (m) => emballageVerschil(m) },
            { header: "Door", value: (m) => gebruikerNaam.get(m.gebruikerId) ?? "onbekend" },
            {
              header: "Notitie",
              value: (m) => emballageNotitie(m, m.retourId ? retourById.get(m.retourId) : undefined),
            },
          ],
        });
        return;
      }

      const filterOmschrijving = [
        type ? `soort: ${mutatieLabels[type]}` : null,
        locatieId ? `locatie: ${locatieNaam.get(locatieId)}` : null,
        zoek.trim() ? `zoekterm: "${zoek.trim()}"` : null,
      ].filter(Boolean).join(" · ");
      await exporteerNaarExcel<Mutatie>({
        bestandsnaam: `voorraadmutaties-${datum}`,
        titel: "Voorraadmutaties",
        ondertitel: filterOmschrijving
          ? `${mutaties.length} mutaties — ${filterOmschrijving}`
          : `${mutaties.length} mutaties — volledige historie`,
        rijen: mutaties,
        kolommen: [
          { header: "Datum en tijd", opmaak: "datum", value: (m) => new Date(m.datumTijd) },
          { header: "Soort", value: (m) => mutatieLabels[m.type] },
          { header: "Product", value: (m) => productNaam.get(m.productId) ?? m.productId },
          { header: "Aantal", opmaak: "getal", value: (m) => m.aantal },
          { header: "Van locatie", value: (m) => (m.vanLocatieId ? locatieNaam.get(m.vanLocatieId) ?? "" : "") },
          { header: "Naar locatie", value: (m) => (m.naarLocatieId ? locatieNaam.get(m.naarLocatieId) ?? "" : "") },
          { header: "Evenement", value: (m) => (m.evenementId ? evenementNaam.get(m.evenementId) ?? m.evenementId : "") },
          { header: "Door", value: (m) => gebruikerNaam.get(m.gebruikerId) ?? "onbekend" },
          { header: "Notitie", value: (m) => m.notitie ?? "" },
        ],
      });
    } finally {
      setExporteert(false);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="volledige historie"
        title="Mutaties"
        toelichting={
          weergave === "drank"
            ? "Elke voorraadbeweging wordt vastgelegd met tijdstip en gebruiker. Mutaties worden nooit gewijzigd — een correctie is zelf ook weer een mutatie."
            : "Wat er onder Magazijn → Emballage is ingevoerd of geteld, en wat er met de retourbon terugging. Wat er met de inkoop binnenkomt telt vanzelf mee in de stand en staat hier niet apart."
        }
        actions={
          <Button
            variant="ghost-dark"
            icon={null}
            onClick={() => void exporteer()}
            disabled={aantalRegels === 0 || exporteert}
          >
            {exporteert ? "Bezig…" : "Exporteren (Excel)"}
          </Button>
        }
      />

      <nav className="rapport-kiezer" aria-label="Soort mutaties">
        {WEERGAVEN.map((w) => (
          <button
            key={w.id}
            type="button"
            className={["rapport-tab", weergave === w.id && "rapport-tab--actief"].filter(Boolean).join(" ")}
            aria-pressed={weergave === w.id}
            onClick={() => kiesWeergave(w.id)}
          >
            {w.label}
          </button>
        ))}
      </nav>

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}

      <div className={["filters-bar", filtersOpen && "filters-bar--open"].filter(Boolean).join(" ")}>
        <div className="search">
          <Icon name="search" size={16} className="search__icoon" />
          <input
            className="input search__veld"
            placeholder={
              weergave === "drank"
                ? "Zoek op product, evenement of notitie…"
                : "Zoek op emballage, reden of leverancier…"
            }
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="filters-bar__schakelaar"
          aria-expanded={filtersOpen}
          aria-label="Filters tonen"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
          {actieveFilters > 0 ? <span className="filters-bar__teller">{actieveFilters}</span> : null}
        </button>
        <div className="filters-bar__keuzes">
          {weergave === "drank" ? (
            <>
              <Select
                aria-label="Filter op soort mutatie"
                placeholder="Alle soorten"
                value={type}
                onChange={(e) => setType(e.target.value as MutatieType | "")}
                options={mutatieTypeOpties}
              />
              <Select
                aria-label="Filter op locatie"
                placeholder="Alle locaties"
                value={locatieId}
                onChange={(e) => setLocatieId(e.target.value)}
                options={state.alleLocaties.map((l) => ({ value: l.id, label: l.naam }))}
              />
            </>
          ) : (
            <>
              <Select
                aria-label="Filter op soort beweging"
                placeholder="Alle soorten"
                value={beweging}
                onChange={(e) => setBeweging(e.target.value as EmballageBeweging | "")}
                options={emballageBewegingOpties}
              />
              <Select
                aria-label="Filter op emballage"
                placeholder="Alle emballage"
                value={emballageId}
                onChange={(e) => setEmballageId(e.target.value)}
                options={state.emballage.map((s) => ({ value: s.id, label: s.naam }))}
              />
            </>
          )}
        </div>
      </div>

      <Card className="card--tabel">
        <KaartKop
          titel={`${formatNumber(aantalRegels)} ${aantalRegels === 1 ? "mutatie" : "mutaties"}`}
          sub="nieuwste eerst"
          rechts={
            <>
              {dezeWeek > 0 ? <Badge variant="neutral">deze week {dezeWeek}</Badge> : null}
              {weergave === "drank" && afschrijvingen > 0 ? (
                <Badge variant="gold">
                  {afschrijvingen} {afschrijvingen === 1 ? "afschrijving" : "afschrijvingen"}
                </Badge>
              ) : null}
            </>
          }
        />
        {weergave === "drank" ? (
          <MutatieTabel
            mutaties={mutaties}
            producten={state.producten}
            locaties={state.alleLocaties}
            profielen={state.profielen}
            toonEvenement
            evenementNaam={(id) => evenementNaam.get(id) ?? id}
            legeMelding={
              state.mutaties.length === 0
                ? "Nog geen voorraadmutaties geboekt."
                : "Geen mutaties gevonden met deze filters."
            }
          />
        ) : (
          <EmballageMutatieTabel
            mutaties={emballageMutaties}
            soorten={state.emballage}
            retouren={state.emballageRetouren}
            profielen={state.profielen}
            legeMelding={
              state.emballageMutaties.length === 0
                ? "Nog geen emballage ingevoerd, geteld of retour gestuurd."
                : "Geen mutaties gevonden met deze filters."
            }
          />
        )}
      </Card>
    </>
  );
}
