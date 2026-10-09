import { useEffect, useState } from "react";
import { Badge, Button, Card } from "../../design-system";
import { MagazijnTabs } from "../../components/layout/MagazijnTabs";
import { PageHeader } from "../../components/layout/PageHeader";
import { ActieMenu } from "../../components/ui/ActieMenu";
import { EmptyState } from "../../components/ui/EmptyState";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { LageVoorraadMelding } from "../../components/ui/LageVoorraadMelding";
import { useAppState } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { Locatie, Product } from "../../data/types";
import { exporteerNaarExcel, type ExcelKolom } from "../../utils/excel";
import { formatCurrency, formatNumber } from "../../utils/format";
import { ProductForm } from "../Productbeheer/ProductForm";
import { LocatieForm } from "./LocatieForm";
import { VoorraadMutatieModal, type MagazijnActie } from "./VoorraadMutatieModal";
import { VoorraadTabel } from "./VoorraadTabel";

export function Magazijn() {
  const { state, laden, fout, herlaad, verwijderLocatie, hoofdmagazijn } = useAppState();
  const { mag, zietBedragen } = useAuth();
  const [actieveLocatieId, setActieveLocatieId] = useState<string | null>(null);
  const [locatieForm, setLocatieForm] = useState<{ open: boolean; locatie: Locatie | null }>({
    open: false,
    locatie: null,
  });
  const [actie, setActie] = useState<{ soort: MagazijnActie; productId?: string } | null>(null);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [nieuweBarcode, setNieuweBarcode] = useState<string | null>(null);

  /* Boeken (inkoop, verplaatsen, aanvullen) mag ook de medewerker.
     Inrichten — minimum zetten, producten aanmaken — is voor de beheerder. */
  const magBeheren = mag("beheerder");
  const magBoeken = mag("beheerder", "medewerker");
  const magLocatiesBeheren = mag("beheerder");

  useEffect(() => {
    if (actieveLocatieId || state.locaties.length === 0) return;
    const hoofd = state.locaties.find((l) => l.merk === null && l.type === "magazijn");
    setActieveLocatieId(hoofd?.id ?? state.locaties[0].id);
  }, [state.locaties, actieveLocatieId]);

  const actieveLocatie = state.locaties.find((l) => l.id === actieveLocatieId) ?? null;
  /* Staat de kantine of de kroeg open, dan is "erbij" altijd: aanvullen
     vanuit het magazijn. Inkoop van buiten gaat nooit rechtstreeks daarheen. */
  const opPersoneelslocatie = actieveLocatie?.voorPersoneel ?? false;
  const overigeLocaties = state.locaties.filter((l) => l.id !== hoofdmagazijn?.id);
  const heeftPersoneelslocatie = state.locaties.some((l) => l.voorPersoneel);

  /**
   * Kerncijfers van het hoofdmagazijn, ook zichtbaar wanneer er een andere
   * locatie geselecteerd staat — het blok hoort altijd het hoofdmagazijn te
   * beschrijven, niet de huidige selectie.
   */
  const hoofdCijfers = (() => {
    const regels = state.voorraad.filter((v) => v.locatieId === hoofdmagazijn?.id && v.aantal > 0);
    const prijsVan = new Map(state.producten.map((p) => [p.id, p.inkoopprijs]));
    return {
      stuks: regels.reduce((som, v) => som + v.aantal, 0),
      producten: regels.length,
      waarde: regels.reduce((som, v) => som + v.aantal * (prijsVan.get(v.productId) ?? 0), 0),
    };
  })();

  async function handleExport() {
    const locatie = state.locaties.find((l) => l.id === actieveLocatieId);
    if (!locatie) return;
    const perProduct = new Map(
      state.voorraad.filter((v) => v.locatieId === locatie.id).map((v) => [v.productId, v])
    );
    await exporteerNaarExcel<Product>({
      bestandsnaam: `voorraad-${locatie.naam.toLowerCase().replace(/\s+/g, "-")}`,
      titel: `Voorraad ${locatie.naam}`,
      ondertitel: `${locatie.type} · ${locatie.merk ?? "gedeeld tussen NBC en Green Village"}`,
      rijen: state.producten,
      kolommen: [
        { header: "Product", value: (p) => p.naam },
        { header: "Eenheid", value: (p) => p.eenheid },
        { header: "Voorraad", opmaak: "getal", value: (p) => perProduct.get(p.id)?.aantal ?? 0 },
        { header: "Minimum", opmaak: "getal", value: (p) => perProduct.get(p.id)?.minVoorraad ?? 0 },
        {
          header: "Status",
          value: (p) => {
            const v = perProduct.get(p.id);
            if (!v || v.minVoorraad === 0) return "";
            return v.aantal < v.minVoorraad ? "Onder minimum" : "Voldoende";
          },
        },
        // Bedragen alleen voor de beheerder (migratie 019).
        ...(zietBedragen
          ? ([
              { header: "Inkoopprijs", opmaak: "bedrag", value: (p) => p.inkoopprijs },
              {
                header: "Voorraadwaarde",
                opmaak: "bedrag",
                value: (p) => (perProduct.get(p.id)?.aantal ?? 0) * p.inkoopprijs,
              },
            ] satisfies ExcelKolom<Product>[])
          : []),
      ],
      ...(zietBedragen && {
        totalen: {
          0: "Totale voorraadwaarde",
          6: state.producten.reduce((som, p) => som + (perProduct.get(p.id)?.aantal ?? 0) * p.inkoopprijs, 0),
        },
      }),
    });
  }

  async function handleVerwijderLocatie(locatie: Locatie) {
    if (!window.confirm(`Locatie "${locatie.naam}" verwijderen?`)) return;
    setActieFout(null);
    try {
      await verwijderLocatie(locatie.id);
      setActieveLocatieId(null);
    } catch {
      setActieFout(
        `"${locatie.naam}" kan niet verwijderd worden omdat er al voorraadmutaties aan gekoppeld zijn.`
      );
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;

  return (
    <>
      <PageHeader
        eyebrow="centrale voorraad"
        title="Magazijn"
        toelichting="Het hoofdmagazijn vult alle andere locaties. Minimumvoorraad pas je in de tabel aan; hij bewaart bij verlaten van het veld."
        actions={
          magBoeken ? (
            <>
              {opPersoneelslocatie ? (
                <Button icon="plus" iconPosition="leading" onClick={() => setActie({ soort: "aanvullen" })}>
                  Aanvullen
                </Button>
              ) : (
                <Button icon="plus" iconPosition="leading" onClick={() => setActie({ soort: "inkoop" })}>
                  Inboeken
                </Button>
              )}
              <ActieMenu
                label="Beheren"
                items={[
                  ...(opPersoneelslocatie
                    ? [{ label: "Inboeken (inkoop)", onClick: () => setActie({ soort: "inkoop" as const }) }]
                    : [
                        { label: "Verplaatsen", onClick: () => setActie({ soort: "verplaatsen" as const }) },
                        ...(heeftPersoneelslocatie
                          ? [
                              {
                                label: "Kantine of kroeg aanvullen",
                                onClick: () => setActie({ soort: "aanvullen" as const }),
                              },
                            ]
                          : []),
                      ]),
                  { label: "Afschrijven", onClick: () => setActie({ soort: "beschadigd" }) },
                  { label: "Corrigeren", onClick: () => setActie({ soort: "correctie" }) },
                  ...(heeftPersoneelslocatie
                    ? [
                        {
                          label: "Personeelsverbruik boeken",
                          onClick: () => setActie({ soort: "personeelsverbruik" as const }),
                        },
                      ]
                    : []),
                  { label: "Exporteren naar Excel", onClick: () => void handleExport() },
                ]}
              />
            </>
          ) : null
        }
      />

      <MagazijnTabs />

      {fout ? <FoutMelding melding={fout} onOpnieuw={() => void herlaad()} /> : null}
      {actieFout ? <FoutMelding melding={actieFout} /> : null}

      {state.locaties.length === 0 ? (
        <EmptyState
          title="Nog geen locaties"
          body="Maak eerst een locatie aan om voorraad bij te houden."
          action={
            magLocatiesBeheren ? (
              <Button icon={null} onClick={() => setLocatieForm({ open: true, locatie: null })}>
                Locatie toevoegen
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Het hoofdmagazijn is de bron waar alle andere locaties uit
              gevuld worden, en het is waar vrijwel altijd naar gekeken wordt.
              Daarom een eigen blok met de cijfers erin, in plaats van een
              gelijkwaardige pil tussen de koelcellen en bars. */}
          {hoofdmagazijn ? (
            <button
              type="button"
              className={[
                "magazijn-hoofd",
                hoofdmagazijn.id === actieveLocatieId && "magazijn-hoofd--actief",
              ].filter(Boolean).join(" ")}
              aria-pressed={hoofdmagazijn.id === actieveLocatieId}
              onClick={() => setActieveLocatieId(hoofdmagazijn.id)}
            >
              <span>
                <span className="magazijn-hoofd__kop">
                  <span className="magazijn-hoofd__naam">{hoofdmagazijn.naam}</span>
                  <Badge variant="op-donker">gedeeld</Badge>
                </span>
                <span className="magazijn-hoofd__sub">bron voor NBC en Green Village</span>
              </span>
              <span className="magazijn-hoofd__cijfers">
                <span className="magazijn-hoofd__cijfer">
                  <strong>{formatNumber(hoofdCijfers.stuks)}</strong>
                  <span>stuks</span>
                </span>
                <span className="magazijn-hoofd__cijfer">
                  <strong>{formatNumber(hoofdCijfers.producten)}</strong>
                  <span>producten</span>
                </span>
                {zietBedragen ? (
                  <span className="magazijn-hoofd__cijfer">
                    <strong>{formatCurrency(hoofdCijfers.waarde)}</strong>
                    <span>voorraadwaarde</span>
                  </span>
                ) : null}
              </span>
            </button>
          ) : null}

          {overigeLocaties.length > 0 ? (
            <div className="locatie-groep">
              <span className="locatie-groep__label">
                {hoofdmagazijn ? "Andere locaties" : "Locaties"}
              </span>
              <div className="locatie-balk">
                {overigeLocaties.map((locatie) => (
                  <button
                    key={locatie.id}
                    type="button"
                    className={[
                      "locatie-tab",
                      locatie.id === actieveLocatieId && "locatie-tab--actief",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setActieveLocatieId(locatie.id)}
                  >
                    {locatie.naam}
                    <Badge variant={locatie.id === actieveLocatieId ? "op-donker" : "neutral"}>
                      {locatie.voorPersoneel ? "personeel" : locatie.merk ?? "gedeeld"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {actieveLocatie ? (
            <>
              <LageVoorraadMelding
                locatieId={actieveLocatie.id}
                locatieNaam={actieveLocatie.naam}
                onBijbestellen={magBoeken ? () => setActie({ soort: "inkoop" }) : undefined}
              />
              <Card className="card--tabel">
                <KaartKop
                  titel={actieveLocatie.naam}
                  sub={
                    actieveLocatie.voorPersoneel
                      ? "personeelsvoorraad — telt niet mee bij evenementen"
                      : "voorraad, minimum en directe boekingen"
                  }
                  rechts={
                    magLocatiesBeheren ? (
                      <ActieMenu
                        label="Beheren"
                        items={[
                          { label: "Nieuwe locatie", onClick: () => setLocatieForm({ open: true, locatie: null }) },
                          { label: "Locatie wijzigen", onClick: () => setLocatieForm({ open: true, locatie: actieveLocatie }) },
                          { label: "Locatie verwijderen", onClick: () => void handleVerwijderLocatie(actieveLocatie) },
                        ]}
                      />
                    ) : null
                  }
                />
                <VoorraadTabel
                  locatieId={actieveLocatie.id}
                  producten={state.producten}
                  voorraad={state.voorraad}
                  magBeheren={magBeheren}
                  magBoeken={magBoeken}
                  onInboeken={(product) =>
                    setActie({ soort: opPersoneelslocatie ? "aanvullen" : "inkoop", productId: product.id })
                  }
                  perStuk={opPersoneelslocatie}
                  onVerplaatsen={(product) => setActie({ soort: "verplaatsen", productId: product.id })}
                />
              </Card>
            </>
          ) : null}
        </>
      )}

      <LocatieForm
        open={locatieForm.open}
        locatie={locatieForm.locatie}
        onClose={() => setLocatieForm({ open: false, locatie: null })}
      />
      <VoorraadMutatieModal
        open={actie !== null}
        actie={actie?.soort ?? "inkoop"}
        /* Aanvullen: van het hoofdmagazijn naar de kantine of kroeg die open staat. */
        standaardLocatieId={
          actie?.soort === "aanvullen" ? hoofdmagazijn?.id : actieveLocatieId ?? undefined
        }
        standaardNaarLocatieId={
          actie?.soort === "aanvullen" && opPersoneelslocatie ? actieveLocatieId ?? undefined : undefined
        }
        standaardProductId={actie?.productId}
        onClose={() => setActie(null)}
        onNieuwProduct={
          magBeheren
            ? (barcode) => {
                setActie(null);
                setNieuweBarcode(barcode);
              }
            : undefined
        }
      />
      <ProductForm
        open={nieuweBarcode !== null}
        product={null}
        barcodeVooraf={nieuweBarcode ?? undefined}
        onClose={() => setNieuweBarcode(null)}
      />
    </>
  );
}
