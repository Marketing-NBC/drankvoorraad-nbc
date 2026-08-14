import { useMemo, useState } from "react";
import { Button, Card, Icon } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { MutatieTabel } from "../../components/ui/MutatieTabel";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { mutatieLabels, mutatieTypeOpties } from "../../data/labels";
import type { MutatieType } from "../../data/types";
import { exporteerNaarExcel } from "../../utils/excel";
import type { Mutatie } from "../../data/types";

export function Historie() {
  const { state, laden, fout, herlaad } = useAppState();
  const [zoek, setZoek] = useState("");
  const [type, setType] = useState<MutatieType | "">("");
  const [locatieId, setLocatieId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p.naam])),
    [state.producten]
  );
  const evenementNaam = useMemo(
    () => new Map(state.evenementen.map((e) => [e.id, e.naam])),
    [state.evenementen]
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

  const actieveFilters = [type, locatieId].filter(Boolean).length;

  const [exporteert, setExporteert] = useState(false);

  async function exporteer() {
    const locatieNaam = new Map(state.locaties.map((l) => [l.id, l.naam]));
    const gebruikerNaam = new Map(state.profielen.map((p) => [p.id, p.naam]));
    const filterOmschrijving = [
      type ? `soort: ${mutatieLabels[type]}` : null,
      locatieId ? `locatie: ${locatieNaam.get(locatieId)}` : null,
      zoek.trim() ? `zoekterm: "${zoek.trim()}"` : null,
    ].filter(Boolean).join(" · ");

    setExporteert(true);
    try {
      await exporteerNaarExcel<Mutatie>({
        bestandsnaam: `voorraadmutaties-${new Date().toISOString().slice(0, 10)}`,
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
        actions={
          <Button
            variant="ghost-dark"
            icon={null}
            onClick={() => void exporteer()}
            disabled={mutaties.length === 0 || exporteert}
          >
            {exporteert ? "Bezig…" : "Exporteren (Excel)"}
          </Button>
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}

      <p className="scherm-toelichting">
        Elke voorraadbeweging wordt hier vastgelegd met tijdstip en gebruiker. Mutaties worden nooit
        gewijzigd of verwijderd — een correctie is zelf ook weer een mutatie.
      </p>

      <div className={["filters-bar", filtersOpen && "filters-bar--open"].filter(Boolean).join(" ")}>
        <div className="search">
          <Icon name="search" size={18} className="search__icoon" />
          <input
            className="input search__veld"
            placeholder="Zoek op product, evenement of notitie…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="filters-bar__schakelaar"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
          {actieveFilters > 0 ? <span className="filters-bar__teller">{actieveFilters}</span> : null}
          <Icon name="chevron-down" size={16} />
        </button>
        <div className="filters-bar__keuzes">
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
            options={state.locaties.map((l) => ({ value: l.id, label: l.naam }))}
          />
        </div>
      </div>

      <Card>
        <MutatieTabel
          mutaties={mutaties}
          producten={state.producten}
          locaties={state.locaties}
          profielen={state.profielen}
          toonEvenement
          evenementNaam={(id) => evenementNaam.get(id) ?? id}
          legeMelding={
            state.mutaties.length === 0
              ? "Nog geen voorraadmutaties geboekt."
              : "Geen mutaties gevonden met deze filters."
          }
        />
      </Card>
    </>
  );
}
