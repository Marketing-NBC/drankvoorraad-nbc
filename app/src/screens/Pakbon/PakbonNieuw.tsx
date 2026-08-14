import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, IconButton, Input } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { Handtekening, type HandtekeningHandle } from "../../components/ui/Handtekening";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState, useEvenement } from "../../context/AppStateContext";
import { useAuth } from "../../context/AuthContext";
import type { PakbonRegel } from "../../data/types";
import { formatDate, formatNumber } from "../../utils/format";
import { foutBericht } from "../../utils/fouten";
import { ROUTES } from "../../routes/routes";

export function PakbonNieuw() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, laden, hoofdmagazijn, maakPakbon } = useAppState();
  const { mag } = useAuth();
  const evenement = useEvenement(id);
  const handtekeningRef = useRef<HandtekeningHandle>(null);

  const magazijnen = useMemo(
    () => state.locaties.filter((l) => l.type === "magazijn" || l.type === "koelcel"),
    [state.locaties]
  );

  const [locatieId, setLocatieId] = useState("");
  const [regels, setRegels] = useState<PakbonRegel[]>([]);
  const [productId, setProductId] = useState("");
  const [aantal, setAantal] = useState("");
  const [ontvanger, setOntvanger] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const gekozenLocatie = locatieId || hoofdmagazijn?.id || magazijnen[0]?.id || "";
  const productenById = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p])),
    [state.producten]
  );

  /** Voorraad van dit product op de gekozen uitgiftelocatie. */
  function voorraadVan(pid: string): number {
    return state.voorraad.find((v) => v.productId === pid && v.locatieId === gekozenLocatie)?.aantal ?? 0;
  }

  function voegRegelToe() {
    const gekozenProduct = productId || state.producten[0]?.id;
    const aantalGetal = Number(aantal);
    if (!gekozenProduct) {
      setFout("Kies eerst een product.");
      return;
    }
    if (!aantalGetal || aantalGetal <= 0) {
      setFout("Vul een aantal groter dan 0 in.");
      return;
    }
    setFout(null);
    // Hetzelfde product twee keer scannen telt op in plaats van een tweede
    // regel te maken — dat is wat je verwacht als je een tweede fust pakt.
    setRegels((huidig) => {
      const bestaand = huidig.find((r) => r.productId === gekozenProduct);
      if (bestaand) {
        return huidig.map((r) =>
          r.productId === gekozenProduct ? { ...r, aantal: r.aantal + aantalGetal } : r
        );
      }
      return [...huidig, { productId: gekozenProduct, aantal: aantalGetal }];
    });
    setAantal("");
  }

  async function vastleggen() {
    if (regels.length === 0) {
      setFout("Zet eerst minstens één product op de pakbon.");
      return;
    }
    if (!ontvanger.trim()) {
      setFout("Vul de naam in van degene die de producten in ontvangst neemt.");
      return;
    }

    const handtekening = handtekeningRef.current?.exporteer() ?? null;
    if (!handtekening && !window.confirm("Er is niet ondertekend. Toch vastleggen?")) return;

    setBezig(true);
    setFout(null);
    try {
      const pakbonId = await maakPakbon({
        evenementId: evenement!.id,
        vanLocatieId: gekozenLocatie,
        ontvangerNaam: ontvanger.trim(),
        handtekening,
        regels,
      });
      navigate(ROUTES.pakbon(pakbonId), { replace: true });
    } catch (err) {
      const bericht = foutBericht(err);
      setFout(
        bericht.includes("Geen rechten")
          ? "Je hebt geen rechten om een pakbon vast te leggen."
          : bericht || "De pakbon kon niet vastgelegd worden. Controleer je verbinding en probeer opnieuw."
      );
      setBezig(false);
    }
  }

  if (laden) return <p className="app-laden">Bezig met laden…</p>;
  if (!evenement) return <Navigate to={ROUTES.overzicht} replace />;
  if (!mag("beheerder", "magazijnmedewerker")) {
    return <Navigate to={ROUTES.evenementDetail(evenement.id)} replace />;
  }

  const tekort = regels.filter((r) => r.aantal > voorraadVan(r.productId));

  return (
    <>
      <PageHeader
        eyebrow={`${evenement.id} · ${formatDate(evenement.datum)}`}
        title={`Pakbon voor ${evenement.naam}`}
      />

      {fout ? <FoutMelding melding={fout} /> : null}

      <p className="scherm-toelichting">
        Zet de producten op de pakbon die daadwerkelijk meegaan, laat de ontvanger tekenen en leg de
        pakbon vast. De voorraad wordt dan in één keer afgeboekt van de gekozen locatie.
      </p>

      <Card style={{ marginBottom: "var(--s-6)" }}>
        <div className="field-group">
          <label className="field-group__label" htmlFor="pakbon-locatie">Uitgifte vanaf</label>
          <Select
            id="pakbon-locatie"
            aria-label="Uitgiftelocatie"
            value={gekozenLocatie}
            onChange={(e) => setLocatieId(e.target.value)}
            options={magazijnen.map((l) => ({ value: l.id, label: l.naam }))}
          />
        </div>

        <ProductKiezer
          producten={state.producten}
          productId={productId || state.producten[0]?.id || ""}
          onProductIdChange={setProductId}
          onOnbekendeBarcode={() =>
            setFout("Onbekende barcode. Koppel de code eerst aan een product via Producten.")
          }
        />

        <div className="field-row">
          <div className="field-group">
            <label className="field-group__label" htmlFor="pakbon-aantal">Aantal</label>
            <Input
              id="pakbon-aantal"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={aantal}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAantal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  voegRegelToe();
                }
              }}
            />
          </div>
          <div className="field-group field-group--knop">
            <Button icon="plus" iconPosition="leading" onClick={voegRegelToe}>Op de pakbon</Button>
          </div>
        </div>
      </Card>

      <div className="section-title">
        <h3>Op deze pakbon</h3>
      </div>
      <Card style={{ marginBottom: "var(--s-6)" }}>
        {regels.length === 0 ? (
          <p className="data-table__empty">Nog geen producten toegevoegd.</p>
        ) : (
          <ul className="pakbon-regels">
            {regels.map((regel) => {
              const product = productenById.get(regel.productId);
              const beschikbaar = voorraadVan(regel.productId);
              return (
                <li key={regel.productId} className="pakbon-regel">
                  <div className="pakbon-regel__tekst">
                    <span className="pakbon-regel__naam">{product?.naam ?? "Onbekend product"}</span>
                    <span className="pakbon-regel__meta">
                      {formatNumber(regel.aantal)} {product?.eenheid ?? ""}
                      {regel.aantal > beschikbaar ? (
                        <Badge variant="gold">voorraad: {formatNumber(beschikbaar)}</Badge>
                      ) : null}
                    </span>
                  </div>
                  <IconButton
                    icon="x"
                    aria-label={`${product?.naam ?? "Product"} van de pakbon halen`}
                    onClick={() => setRegels((h) => h.filter((r) => r.productId !== regel.productId))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {tekort.length > 0 ? (
        <p className="melding-waarschuwing">
          Van {tekort.length === 1 ? "één product" : `${tekort.length} producten`} gaat er meer mee dan er
          op deze locatie geregistreerd staat. Dat kan kloppen als de voorraad nog niet bijgewerkt is —
          de pakbon wordt gewoon vastgelegd.
        </p>
      ) : null}

      <Card>
        <div className="field-group">
          <label className="field-group__label" htmlFor="pakbon-ontvanger">Ontvangen door</label>
          <Input
            id="pakbon-ontvanger"
            placeholder="Naam van de ontvanger"
            value={ontvanger}
            onChange={(e) => setOntvanger(e.target.value)}
          />
        </div>
        <Handtekening ref={handtekeningRef} />
        <div className="modal-actions">
          <Button
            variant="ghost-dark"
            icon={null}
            onClick={() => navigate(ROUTES.evenementDetail(evenement.id))}
          >
            Annuleren
          </Button>
          <Button icon={null} onClick={() => void vastleggen()} disabled={bezig}>
            {bezig ? "Bezig…" : "Pakbon vastleggen"}
          </Button>
        </div>
      </Card>
    </>
  );
}
