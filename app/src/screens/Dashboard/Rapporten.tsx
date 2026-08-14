import { useMemo, useState } from "react";
import { Badge, Button, Card } from "../../design-system";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import {
  dervingPerProduct,
  uitstaandPerEvenement,
  voorraadverschillen,
  type DervingRegel,
  type EvenementUitstaand,
  type Voorraadverschil,
} from "../../data/calculations";
import { exporteerNaarExcel } from "../../utils/excel";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../../utils/format";

type RapportId = "uitstaand" | "verschillen" | "derving";

const rapporten: { id: RapportId; label: string; titel: string; toelichting: string }[] = [
  {
    id: "uitstaand",
    label: "Per evenement",
    titel: "Voorraad per evenement",
    toelichting:
      "Wat er per evenement is uitgegeven en nog niet retour is. Bij een lopend evenement staat dat er nog fysiek; bij een afgerond evenement is het het werkelijke verbruik — of een vergeten retour.",
  },
  {
    id: "verschillen",
    label: "Verschillen",
    titel: "Voorraadverschillen uit tellingen",
    toelichting:
      "Elk verschil dat een telling aan het licht bracht. Een plus betekent dat er meer stond dan verwacht, een min dat er minder stond.",
  },
  {
    id: "derving",
    label: "Derving",
    titel: "Derving per product",
    toelichting: "Alles wat als beschadigd is afgeboekt, opgeteld per product.",
  },
];

export function Rapporten() {
  const { state, mutatiesPerEvenement } = useAppState();
  const [actief, setActief] = useState<RapportId>("uitstaand");
  const [exporteert, setExporteert] = useState(false);

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p.naam])),
    [state.producten]
  );
  const locatieNaam = useMemo(
    () => new Map(state.locaties.map((l) => [l.id, l.naam])),
    [state.locaties]
  );

  const uitstaand = useMemo(
    () => uitstaandPerEvenement(state.evenementen, mutatiesPerEvenement, state.producten),
    [state.evenementen, mutatiesPerEvenement, state.producten]
  );
  const verschillen = useMemo(
    () => voorraadverschillen(state.mutaties, state.producten),
    [state.mutaties, state.producten]
  );
  const derving = useMemo(
    () => dervingPerProduct(state.mutaties, state.producten),
    [state.mutaties, state.producten]
  );

  const huidig = rapporten.find((r) => r.id === actief)!;
  const datumStempel = new Date().toISOString().slice(0, 10);

  async function exporteer() {
    setExporteert(true);
    try {
      if (actief === "uitstaand") {
        await exporteerNaarExcel<EvenementUitstaand>({
          bestandsnaam: `voorraad-per-evenement-${datumStempel}`,
          titel: huidig.titel,
          ondertitel: `Stand op ${formatDate(new Date().toISOString())}`,
          rijen: uitstaand,
          kolommen: [
            { header: "Evenement", value: (r) => r.evenement.naam },
            { header: "Nummer", value: (r) => r.evenement.id },
            { header: "Datum", opmaak: "datum", value: (r) => new Date(r.evenement.datum) },
            { header: "Merk", value: (r) => r.evenement.merk },
            { header: "Status", value: (r) => r.evenement.status },
            { header: "Uitgegeven", opmaak: "getal", value: (r) => r.aantalUitgegeven },
            { header: "Retour", opmaak: "getal", value: (r) => r.aantalRetour },
            { header: "Uitstaand", opmaak: "getal", value: (r) => r.aantalUitstaand },
            { header: "Waarde uitstaand", opmaak: "bedrag", value: (r) => r.waardeUitstaand },
          ],
          totalen: {
            0: "Totaal",
            7: uitstaand.reduce((s, r) => s + r.aantalUitstaand, 0),
            8: uitstaand.reduce((s, r) => s + r.waardeUitstaand, 0),
          },
        });
      } else if (actief === "verschillen") {
        await exporteerNaarExcel<Voorraadverschil>({
          bestandsnaam: `voorraadverschillen-${datumStempel}`,
          titel: huidig.titel,
          ondertitel: `${verschillen.length} verschil(len) gevonden`,
          rijen: verschillen,
          kolommen: [
            { header: "Product", value: (r) => productNaam.get(r.productId) ?? r.productId },
            { header: "Locatie", value: (r) => (r.locatieId ? locatieNaam.get(r.locatieId) ?? "" : "") },
            { header: "Verschil", opmaak: "getal", value: (r) => r.verschil },
            { header: "Waarde", opmaak: "bedrag", value: (r) => r.waarde },
            { header: "Geteld op", opmaak: "datum", value: (r) => new Date(r.datumTijd) },
          ],
          totalen: {
            0: "Totaal waarde verschillen",
            3: verschillen.reduce((s, r) => s + r.waarde, 0),
          },
        });
      } else {
        await exporteerNaarExcel<DervingRegel>({
          bestandsnaam: `derving-${datumStempel}`,
          titel: huidig.titel,
          ondertitel: `Stand op ${formatDate(new Date().toISOString())}`,
          rijen: derving,
          kolommen: [
            { header: "Product", value: (r) => r.product.naam },
            { header: "Eenheid", value: (r) => r.product.eenheid },
            { header: "Aantal", opmaak: "getal", value: (r) => r.aantal },
            { header: "Inkoopprijs", opmaak: "bedrag", value: (r) => r.product.inkoopprijs },
            { header: "Waarde", opmaak: "bedrag", value: (r) => r.waarde },
          ],
          totalen: { 0: "Totale derving", 4: derving.reduce((s, r) => s + r.waarde, 0) },
        });
      }
    } finally {
      setExporteert(false);
    }
  }

  return (
    <>
      <div className="section-title">
        <h3>Rapportages</h3>
        <div className="button-row no-print">
          <Button variant="ghost-dark" icon={null} onClick={() => void exporteer()} disabled={exporteert}>
            {exporteert ? "Bezig…" : "Exporteren (Excel)"}
          </Button>
        </div>
      </div>

      {/* Eén rapport tegelijk: drie tabellen onder elkaar is op een telefoon
          eindeloos scrollen, en je kijkt toch naar één vraag per keer. */}
      <div className="rapport-kiezer no-print" role="tablist" aria-label="Rapportage kiezen">
        {rapporten.map((rapport) => (
          <button
            key={rapport.id}
            type="button"
            role="tab"
            aria-selected={actief === rapport.id}
            className={["rapport-tab", actief === rapport.id && "rapport-tab--actief"]
              .filter(Boolean).join(" ")}
            onClick={() => setActief(rapport.id)}
          >
            {rapport.label}
          </button>
        ))}
      </div>

      <p className="scherm-toelichting">{huidig.toelichting}</p>

      <Card>
        {actief === "uitstaand" ? (
          <Table<EvenementUitstaand>
            rows={uitstaand}
            rowKey={(r) => r.evenement.id}
            emptyMessage="Er is nog niets naar een evenement uitgegeven."
            columns={[
              { header: "Evenement", primair: true, render: (r) => r.evenement.naam },
              { header: "Datum", verbergOpMobiel: true, render: (r) => formatDate(r.evenement.datum) },
              { header: "Status", render: (r) => r.evenement.status },
              { header: "Uitgegeven", align: "right", verbergOpMobiel: true, render: (r) => formatNumber(r.aantalUitgegeven) },
              { header: "Retour", align: "right", verbergOpMobiel: true, render: (r) => formatNumber(r.aantalRetour) },
              { header: "Uitstaand", align: "right", render: (r) => formatNumber(r.aantalUitstaand) },
              { header: "Waarde", align: "right", render: (r) => formatCurrency(r.waardeUitstaand) },
            ]}
          />
        ) : null}

        {actief === "verschillen" ? (
          <Table<Voorraadverschil>
            rows={verschillen}
            rowKey={(r) => r.mutatieId}
            emptyMessage="Nog geen tellingen afgerond, of alle tellingen kwamen precies uit."
            columns={[
              { header: "Product", primair: true, render: (r) => productNaam.get(r.productId) ?? r.productId },
              { header: "Locatie", render: (r) => (r.locatieId ? locatieNaam.get(r.locatieId) ?? "—" : "—") },
              {
                header: "Verschil",
                align: "right",
                render: (r) => (
                  <Badge variant={r.verschil > 0 ? "success" : "gold"}>
                    {r.verschil > 0 ? "+" : "−"}
                    {formatNumber(Math.abs(r.verschil))}
                  </Badge>
                ),
              },
              { header: "Waarde", align: "right", render: (r) => formatCurrency(r.waarde) },
              { header: "Geteld op", verbergOpMobiel: true, render: (r) => formatDateTime(r.datumTijd) },
            ]}
          />
        ) : null}

        {actief === "derving" ? (
          <Table<DervingRegel>
            rows={derving}
            rowKey={(r) => r.product.id}
            emptyMessage="Er is nog niets als beschadigd afgeboekt."
            columns={[
              { header: "Product", primair: true, render: (r) => r.product.naam },
              { header: "Aantal", align: "right", render: (r) => `${formatNumber(r.aantal)} ${r.product.eenheid}` },
              { header: "Inkoopprijs", align: "right", verbergOpMobiel: true, render: (r) => formatCurrency(r.product.inkoopprijs) },
              { header: "Waarde", align: "right", render: (r) => formatCurrency(r.waarde) },
            ]}
          />
        ) : null}
      </Card>
    </>
  );
}
