import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Card, Link } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Table } from "../../components/ui/Table";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Leveringregel } from "../../data/types";
import { omschrijfAantal } from "../../data/verpakking";
import { foutBericht } from "../../utils/fouten";
import { formatDateTimeKort } from "../../utils/format";
import { ROUTES } from "../../routes/routes";

/**
 * Wat er binnenkwam, en wat er níét binnenkwam.
 *
 * De openstaande verschillen staan bovenaan en niet onderin een archief: dat
 * is het enige op dit scherm waar nog iets mee moet. Een tekort dat niemand
 * meer ziet is een creditnota die niet komt.
 */
export function Leveringen() {
  const { state, laden, fout, herlaad, handelVerschilAf } = useAppState();
  const { mag } = useAuth();
  const navigate = useNavigate();
  const routeState = useLocation().state as { inWachtrij?: boolean } | null;
  const [actieFout, setActieFout] = useState<string | null>(null);

  const magAannemen = mag("beheerder", "magazijnmedewerker");

  const productNaam = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p])),
    [state.producten]
  );
  const leveringById = useMemo(
    () => new Map(state.leveringen.map((l) => [l.id, l])),
    [state.leveringen]
  );

  const open = state.leveringregels
    .filter((r) => r.verschil !== 0 && !r.afgehandeldOp)
    .sort((a, b) => a.verschil - b.verschil);

  async function afhandelen(regel: Leveringregel) {
    const notitie = window.prompt(
      "Wat is er met dit verschil gebeurd? (bijvoorbeeld: nagestuurd, gecrediteerd, toch gevonden)",
      regel.notitie ?? ""
    );
    if (notitie === null) return;

    setActieFout(null);
    try {
      await handelVerschilAf(regel.id, notitie);
    } catch (err) {
      setActieFout(foutBericht(err) || "Afhandelen is niet gelukt.");
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="binnenkomst"
        title="Leveringen"
        toelichting="Wat er op de bon staat en wat er werkelijk kwam. De voorraad gaat omhoog met wat er werkelijk stond; het verschil blijft openstaan tot iemand het afhandelt."
        actions={
          <>
            {magAannemen ? (
              <Button icon="plus" iconPosition="leading" onClick={() => navigate(ROUTES.leveringNieuw)}>
                Levering aannemen
              </Button>
            ) : null}
            {/* Lege emballage gaat de andere kant op, maar met dezelfde
                leveranciers en dezelfde kar — daarom hier. */}
            <Button variant="zacht" icon={null} onClick={() => navigate(ROUTES.emballage)}>
              Emballage retour
            </Button>
          </>
        }
      />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}
      {routeState?.inWachtrij ? (
        <p className="melding-waarschuwing">
          Geen verbinding — de levering staat in de wachtrij en wordt verstuurd zodra er weer
          bereik is. Hij telt pas mee in de voorraad als dat gelukt is.
        </p>
      ) : null}

      {open.length > 0 ? (
        <Card className="card--tabel">
          <KaartKop
            titel={`${open.length} openstaand${open.length === 1 ? " verschil" : "e verschillen"}`}
            sub="richting de leverancier"
            rechts={<Badge variant="gold">actie nodig</Badge>}
          />
          <Table<Leveringregel>
            rowKey={(r) => r.id}
            rows={open}
            columns={[
              {
                header: "Product",
                primair: true,
                render: (r) => productNaam.get(r.productId)?.naam ?? r.productId,
              },
              {
                header: "Levering",
                verbergOpMobiel: true,
                render: (r) => {
                  const levering = leveringById.get(r.leveringId);
                  if (!levering) return "—";
                  return `${levering.leverancier ?? "onbekend"}${
                    levering.bonnummer ? ` · bon ${levering.bonnummer}` : ""
                  }`;
                },
              },
              {
                header: "Op de bon",
                align: "right",
                render: (r) => {
                  const p = productNaam.get(r.productId);
                  return p ? omschrijfAantal(p, r.aantalBon) : r.aantalBon;
                },
              },
              {
                header: "Werkelijk",
                align: "right",
                render: (r) => {
                  const p = productNaam.get(r.productId);
                  return p ? omschrijfAantal(p, r.aantalWerkelijk) : r.aantalWerkelijk;
                },
              },
              {
                header: "Verschil",
                align: "right",
                render: (r) => (
                  <strong className={r.verschil < 0 ? "verschil-tekort" : undefined}>
                    {r.verschil > 0 ? "+" : ""}
                    {r.verschil}
                  </strong>
                ),
              },
              {
                header: "",
                align: "right",
                render: (r) =>
                  magAannemen ? (
                    <Link icon={null} onClick={() => void afhandelen(r)}>Afhandelen</Link>
                  ) : null,
              },
            ]}
          />
        </Card>
      ) : null}

      {state.leveringen.length === 0 ? (
        <EmptyState
          title="Nog geen leveringen aangenomen"
          body="Neem een levering aan bij de kar: per regel wat er op de bon staat en wat er werkelijk is."
          action={
            magAannemen ? (
              <Button icon={null} onClick={() => navigate(ROUTES.leveringNieuw)}>
                Levering aannemen
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="card--tabel">
          <KaartKop titel="Aangenomen" sub="nieuwste eerst" />
          <Table<(typeof state.leveringen)[number]>
            rowKey={(l) => l.id}
            rows={state.leveringen.slice(0, 30)}
            columns={[
              {
                header: "Wanneer",
                primair: true,
                render: (l) => formatDateTimeKort(l.aangemaaktOp),
              },
              { header: "Leverancier", render: (l) => l.leverancier ?? <span className="tekst-leeg">onbekend</span> },
              { header: "Bon", verbergOpMobiel: true, render: (l) => l.bonnummer ?? "—" },
              { header: "Aangenomen door", render: (l) => l.aangenomenDoor },
              {
                header: "Regels",
                align: "right",
                render: (l) => {
                  const regels = state.leveringregels.filter((r) => r.leveringId === l.id);
                  const afwijkend = regels.filter((r) => r.verschil !== 0).length;
                  return (
                    <span className="kaart-kop__cijfers">
                      {regels.length}
                      {afwijkend > 0 ? <Badge variant="gold">{afwijkend} afwijkend</Badge> : null}
                    </span>
                  );
                },
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
