import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Input, Link } from "../../design-system";
import { AantalStepper } from "../../components/ui/AantalStepper";
import { AppIcon } from "../../components/ui/AppIcon";
import { KaartKop } from "../../components/ui/KaartKop";
import { ProductKiezer } from "../../components/ui/ProductKiezer";
import { Select } from "../../components/ui/Select";
import { useAppState } from "../../context/AppStateContext";
import { bonNaarVoorstel, herkenLeverancier, type Bonvoorstel, type GelezenBon } from "../../data/bon";
import { LEVERANCIERS, type NieuweLeveringregel, type Product } from "../../data/types";
import { invoer, omschrijfAantal, verpakkingLabel } from "../../data/verpakking";
import { foutBericht } from "../../utils/fouten";
import { ROUTES } from "../../routes/routes";
import { BonLezen } from "./BonLezen";
import { OnbekendeArtikelen } from "./OnbekendeArtikelen";

type Stap = "bon" | "regels" | "controleren";

const stappen: { id: Stap; label: string }[] = [
  { id: "bon", label: "De bon" },
  { id: "regels", label: "Uitpakken" },
  { id: "controleren", label: "Vastleggen" },
];

/**
 * Levering aannemen — het scherm dat bij de kar hoort.
 *
 * Eén ding tegelijk, grote knoppen, scannen als eerste manier om een product
 * te kiezen. Per regel twee getallen: wat er op de bon staat en wat er
 * werkelijk is. Die twee mogen verschillen, en dat is precies het punt — de
 * voorraad gaat omhoog met wat er werkelijk stond, en het verschil blijft
 * staan als openstaand punt richting de leverancier.
 *
 * Valt de verbinding weg, dan gaat de levering de wachtrij in en wordt hij
 * later alsnog verstuurd. Twee keer versturen kan geen kwaad: de database
 * herkent het kenmerk van de telefoon.
 */
export function LeveringNieuw() {
  const { state, boekLevering, hoofdmagazijn, koppelArtikel } = useAppState();
  const navigate = useNavigate();

  const [stap, setStap] = useState<Stap>("bon");
  const [locatieId, setLocatieId] = useState(hoofdmagazijn?.id ?? "");
  const [leverancier, setLeverancier] = useState("");
  const [bonnummer, setBonnummer] = useState("");
  const [aangenomenDoor, setAangenomenDoor] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [regels, setRegels] = useState<NieuweLeveringregel[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  // Invoer van de regel die op dit moment wordt uitgepakt.
  const [productId, setProductId] = useState("");
  const [aantalBon, setAantalBon] = useState(0);
  const [aantalWerkelijk, setAantalWerkelijk] = useState(0);
  const [nieuwProduct, setNieuwProduct] = useState(false);

  /* Uit de foto van de bon: wat herkend is staat meteen in `regels`, wat nog
     geen product heeft wacht hier op koppelen. */
  const [teKoppelen, setTeKoppelen] = useState<Bonvoorstel[]>([]);
  const [vanDeBon, setVanDeBon] = useState<Set<string>>(new Set());
  const [bonMelding, setBonMelding] = useState<string | null>(null);

  const boekbareProducten = useMemo(
    () => state.producten.filter((p) => !p.voorraadloos),
    [state.producten]
  );
  const productenById = useMemo(
    () => new Map(state.producten.map((p) => [p.id, p])),
    [state.producten]
  );

  const product: Product | null = boekbareProducten.find((p) => p.id === productId) ?? null;
  const vorm = product ? invoer(product) : { label: "Aantal", eenheid: "", factor: 1 };

  /* Een levering komt binnen in het hoofdmagazijn of een koelcel; nooit
     direct aan een bar, de kantine of de kroeg. De database eist dat ook. */
  const magazijnen = state.locaties.filter(
    (l) => !l.voorPersoneel && (l.type === "magazijn" || l.type === "koelcel")
  );

  /** Regels erbij, opgeteld per product: twee bonregels kunnen bij één product horen. */
  function voegBonregelsToe(nieuw: NieuweLeveringregel[]) {
    setRegels((huidig) => {
      const per = new Map(huidig.map((r) => [r.productId, { ...r }]));
      for (const r of nieuw) {
        const bestaand = per.get(r.productId);
        if (bestaand) {
          bestaand.aantalBon += r.aantalBon;
          bestaand.aantalWerkelijk += r.aantalWerkelijk;
        } else {
          per.set(r.productId, { ...r });
        }
      }
      return Array.from(per.values());
    });
    setVanDeBon((huidig) => new Set([...huidig, ...nieuw.map((r) => r.productId)]));
  }

  function verwerkBon(bon: GelezenBon) {
    const herkend = herkenLeverancier(bon.leverancier, LEVERANCIERS) ?? leverancier;
    if (herkend) setLeverancier(herkend);
    if (bon.bonnummer) setBonnummer(bon.bonnummer);

    const voorstel = bonNaarVoorstel(bon, herkend || undefined, state.leverancierArtikelen);
    const bekend = voorstel.filter((v) => v.productId && v.aantalBon > 0);
    /* Werkelijk begint gelijk aan de bon, net als bij met de hand invullen:
       meestal klopt hij. Wijkt iets af, dan pas je dat in de volgende stap aan. */
    voegBonregelsToe(
      bekend.map((v) => ({ productId: v.productId!, aantalBon: v.aantalBon, aantalWerkelijk: v.aantalBon }))
    );
    const onbekend = voorstel.filter((v) => !v.productId && v.eenheden > 0);
    setTeKoppelen(onbekend);
    setBonMelding(
      `${bon.regels.length} ${bon.regels.length === 1 ? "regel" : "regels"} gelezen` +
        (onbekend.length > 0 ? `, ${onbekend.length} nog te koppelen bij het uitpakken.` : ".") +
        (bon.leverancier && !herkenLeverancier(bon.leverancier, LEVERANCIERS)
          ? ` Leverancier "${bon.leverancier}" is geen Swinkels of Bidfood — kies hem zelf.`
          : "")
    );
  }

  async function koppel(regel: Bonvoorstel, productId: string, stuksPerEenheid: number, onthouden: boolean) {
    if (onthouden && leverancier && regel.regel.artikelnummer) {
      await koppelArtikel({
        leverancier,
        artikelnummer: regel.regel.artikelnummer,
        omschrijving: regel.regel.omschrijving,
        productId,
        stuksPerEenheid,
      });
    }
    const aantal = regel.eenheden * stuksPerEenheid;
    voegBonregelsToe([{ productId, aantalBon: aantal, aantalWerkelijk: aantal }]);
    setTeKoppelen((huidig) => huidig.filter((r) => r !== regel));
  }

  function voegRegelToe() {
    if (!productId) return setFout("Kies eerst een product.");
    if (aantalBon === 0 && aantalWerkelijk === 0) {
      return setFout("Vul in hoeveel er op de bon staat en hoeveel er werkelijk is.");
    }

    setRegels((huidig) => [
      ...huidig.filter((r) => r.productId !== productId),
      {
        productId,
        aantalBon: aantalBon * vorm.factor,
        aantalWerkelijk: aantalWerkelijk * vorm.factor,
      },
    ]);
    setProductId("");
    setAantalBon(0);
    setAantalWerkelijk(0);
    setFout(null);
  }

  async function vastleggen() {
    if (regels.length === 0) return setFout("Voeg eerst een regel toe.");
    if (!aangenomenDoor.trim()) {
      setStap("bon");
      return setFout("Vul in wie de levering heeft aangenomen.");
    }

    setBezig(true);
    setFout(null);
    try {
      const { inWachtrij } = await boekLevering({
        locatieId,
        leverancier: leverancier.trim() || undefined,
        bonnummer: bonnummer.trim() || undefined,
        aangenomenDoor: aangenomenDoor.trim(),
        opmerking: opmerking.trim() || undefined,
        regels,
      });
      navigate(ROUTES.leveringen, { state: { inWachtrij } });
    } catch (err) {
      setFout(foutBericht(err) || "Vastleggen is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  const verschillen = regels.filter((r) => r.aantalWerkelijk !== r.aantalBon);

  return (
    <div className="stapscherm">
      <div className="stapscherm__kop">
        <button type="button" className="stapscherm__terug" onClick={() => navigate(ROUTES.leveringen)}>
          <AppIcon name="arrow-left" size={16} />
          Leveringen
        </button>
        <ol className="stapbalk">
          {stappen.map((s, i) => (
            <li
              key={s.id}
              className={[
                "stapbalk__stap",
                s.id === stap && "stapbalk__stap--actief",
                stappen.findIndex((x) => x.id === stap) > i && "stapbalk__stap--klaar",
              ].filter(Boolean).join(" ")}
            >
              <span className="stapbalk__nr">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      {stap === "bon" ? (
        <Card>
          <KaartKop titel="Wat komt er binnen?" sub="van de bon van de leverancier" />
          <div className="product-form">
            <BonLezen onGelezen={verwerkBon} />
            {bonMelding ? <p className="melding-goed">{bonMelding}</p> : null}
            <div className="field-group">
              <label className="field-group__label" htmlFor="levering-naam">
                Wie neemt aan? <span className="field-group__hint">jouw naam, ook bij een gedeeld account</span>
              </label>
              <Input
                id="levering-naam"
                value={aangenomenDoor}
                onChange={(e) => setAangenomenDoor(e.target.value)}
                placeholder="bijv. Ricardo"
              />
            </div>
            <div className="field-group">
              <span className="field-group__label">Naar welke locatie?</span>
              <Select
                aria-label="Locatie"
                value={locatieId}
                onChange={(e) => setLocatieId(e.target.value)}
                options={magazijnen.map((l) => ({ value: l.id, label: l.naam }))}
              />
            </div>
            <div className="field-row">
              <div className="field-group">
                <span className="field-group__label">Leverancier</span>
                <Select
                  aria-label="Leverancier"
                  value={leverancier}
                  onChange={(e) => setLeverancier(e.target.value)}
                  options={[
                    { value: "", label: "Kies…" },
                    ...LEVERANCIERS.map((l) => ({ value: l, label: l })),
                  ]}
                />
              </div>
              <div className="field-group">
                <label className="field-group__label" htmlFor="levering-bon">
                  Bonnummer <span className="field-group__hint">bij Swinkels: het nummer onder "Levering"</span>
                </label>
                <Input id="levering-bon" value={bonnummer} onChange={(e) => setBonnummer(e.target.value)} />
              </div>
            </div>
            {fout ? <p className="form-error">{fout}</p> : null}
          </div>
        </Card>
      ) : null}

      {stap === "regels" ? (
        <>
          <OnbekendeArtikelen
            regels={teKoppelen}
            producten={boekbareProducten}
            kanOnthouden={Boolean(leverancier)}
            onKoppel={koppel}
            onOverslaan={(regel) => setTeKoppelen((huidig) => huidig.filter((r) => r !== regel))}
          />
          <Card>
            <KaartKop
              titel="Pak uit en tel"
              sub="eerst wat er op de bon staat, dan wat er werkelijk is"
            />
            <div className="product-form">
              <ProductKiezer
                producten={boekbareProducten}
                productId={productId}
                onProductIdChange={setProductId}
                onOnbekendeBarcode={() => setNieuwProduct(true)}
              />
              {nieuwProduct ? (
                <p className="melding-waarschuwing">
                  Deze barcode hoort nog bij geen enkel product. Kies het product uit de lijst en
                  koppel de code later via Producten.
                </p>
              ) : null}

              {product ? (
                <>
                  <div className="telveld">
                    <span className="telveld__label">
                      Op de bon
                      {vorm.factor > 1 ? (
                        <span className="field-group__hint">in {verpakkingLabel(product)}</span>
                      ) : null}
                    </span>
                    <AantalStepper
                      ariaLabel="Aantal op de bon"
                      waarde={aantalBon}
                      onChange={(n) => {
                        /* Werkelijk loopt mee zolang er niets afwijkt: in verreweg
                           de meeste gevallen klopt de bon, en dan hoeft er niets
                           twee keer ingevuld. */
                        if (aantalWerkelijk === aantalBon) setAantalWerkelijk(n);
                        setAantalBon(n);
                      }}
                    />
                  </div>
                  <div className="telveld">
                    <span className="telveld__label">
                      Werkelijk geteld
                      <span className="field-group__hint">dit gaat de voorraad in</span>
                    </span>
                    <AantalStepper
                      ariaLabel="Aantal werkelijk"
                      waarde={aantalWerkelijk}
                      onChange={setAantalWerkelijk}
                    />
                  </div>
                  {aantalWerkelijk !== aantalBon ? (
                    <p className="melding-waarschuwing">
                      {aantalWerkelijk < aantalBon
                        ? `Er komt ${aantalBon - aantalWerkelijk} te weinig binnen. Dat blijft openstaan richting de leverancier.`
                        : `Er komt ${aantalWerkelijk - aantalBon} meer binnen dan op de bon staat.`}
                    </p>
                  ) : null}
                  <Button icon="plus" iconPosition="leading" onClick={voegRegelToe}>
                    Aan de levering toevoegen
                  </Button>
                </>
              ) : null}
              {fout ? <p className="form-error">{fout}</p> : null}
            </div>
          </Card>

          {vanDeBon.size > 0 ? (
            <p className="melding-waarschuwing">
              De regels van de bon staan er al, met werkelijk gelijk aan de bon. Tel na wat er staat
              en tik een regel aan als het anders is — de voorraad gaat omhoog met wat er werkelijk is.
            </p>
          ) : null}
          {regels.length > 0 ? (
            <Card className="card--tabel">
              <KaartKop titel={`${regels.length} regel${regels.length === 1 ? "" : "s"}`} sub="tik om te wijzigen" />
              <ul className="regel-lijst">
                {regels.map((r) => {
                  const p = productenById.get(r.productId);
                  const afwijkend = r.aantalWerkelijk !== r.aantalBon;
                  return (
                    <li key={r.productId} className="regel-lijst__regel">
                      <button
                        type="button"
                        className="regel-lijst__knop"
                        onClick={() => {
                          const factor = p ? invoer(p).factor : 1;
                          setProductId(r.productId);
                          setAantalBon(r.aantalBon / factor);
                          setAantalWerkelijk(r.aantalWerkelijk / factor);
                          setRegels((huidig) => huidig.filter((x) => x.productId !== r.productId));
                        }}
                      >
                        <span className="regel-lijst__naam">
                          {p?.naam ?? r.productId}
                          {vanDeBon.has(r.productId) ? (
                            <span className="field-group__hint"> van de bon</span>
                          ) : null}
                        </span>
                        <span className="regel-lijst__cijfers">
                          {p ? omschrijfAantal(p, r.aantalWerkelijk) : r.aantalWerkelijk}
                          {afwijkend ? (
                            <Badge variant="gold">
                              {r.aantalWerkelijk - r.aantalBon > 0 ? "+" : ""}
                              {r.aantalWerkelijk - r.aantalBon}
                            </Badge>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}

      {stap === "controleren" ? (
        <Card>
          <KaartKop
            titel="Kloppen deze aantallen?"
            sub={`${regels.length} regel${regels.length === 1 ? "" : "s"} · ${
              verschillen.length === 0 ? "geen verschillen" : `${verschillen.length} met een verschil`
            }`}
          />
          <div className="regellijst">
            {regels.map((r) => {
              const p = productenById.get(r.productId);
              const verschil = r.aantalWerkelijk - r.aantalBon;
              return (
                <div className="regellijst__regel" key={r.productId}>
                  <span>{p?.naam ?? r.productId}</span>
                  <span>
                    {p ? omschrijfAantal(p, r.aantalWerkelijk) : r.aantalWerkelijk}
                    {verschil !== 0 ? (
                      <span className="verschil-tekst">
                        {" "}
                        ({verschil > 0 ? "+" : ""}
                        {verschil} t.o.v. bon)
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="product-form" style={{ marginTop: 16 }}>
            <div className="field-group">
              <label className="field-group__label" htmlFor="levering-opmerking">
                Opmerking <span className="field-group__hint">optioneel — bijvoorbeeld: doos beschadigd</span>
              </label>
              <Input
                id="levering-opmerking"
                value={opmerking}
                onChange={(e) => setOpmerking(e.target.value)}
              />
            </div>
            <p className="veld-toelichting">
              Aangenomen door <strong>{aangenomenDoor || "—"}</strong>
              {leverancier ? `, van ${leverancier}` : ""}
              {bonnummer ? `, bon ${bonnummer}` : ""}.{" "}
              <Link icon={null} onClick={() => setStap("bon")}>Aanpassen</Link>
            </p>
            {fout ? <p className="form-error">{fout}</p> : null}
          </div>
        </Card>
      ) : null}

      {/* De knop staat altijd onderaan in beeld, binnen duimbereik. */}
      <div className="stapscherm__voet">
        {stap !== "bon" ? (
          <Button
            variant="ghost-dark"
            icon={null}
            onClick={() => setStap(stap === "controleren" ? "regels" : "bon")}
          >
            Terug
          </Button>
        ) : (
          <span />
        )}
        {stap === "controleren" ? (
          <Button icon={null} disabled={bezig} onClick={() => void vastleggen()}>
            {bezig ? "Bezig…" : "Levering vastleggen"}
          </Button>
        ) : (
          <Button
            icon="arrow-right"
            onClick={() => {
              if (stap === "bon") {
                if (!aangenomenDoor.trim()) return setFout("Vul in wie de levering aanneemt.");
                if (!leverancier) return setFout("Kies de leverancier: Swinkels of Bidfood.");
                setFout(null);
                return setStap("regels");
              }
              if (regels.length === 0) return setFout("Voeg eerst een regel toe.");
              setFout(null);
              setStap("controleren");
            }}
          >
            Verder
          </Button>
        )}
      </div>
    </div>
  );
}
