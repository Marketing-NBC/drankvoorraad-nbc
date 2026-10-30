import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input } from "../../design-system";
import { PageHeader } from "../../components/layout/PageHeader";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { KaartKop } from "../../components/ui/KaartKop";
import { Modal } from "../../components/ui/Modal";
import { useAppState } from "../../context/AppStateContext";
import { gisteren, terugzetMoment } from "../../data/terugzetten";
import type { TerugzetOverzicht, Terugzetting } from "../../data/types";
import { ROUTES } from "../../routes/routes";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";
import { foutBericht } from "../../utils/fouten";

/**
 * Voorraad terugzetten — alleen voor de beheerder.
 *
 * Is er op de vloer niet of verkeerd geboekt, dan kiest de beheerder het
 * moment waarop het misging. Alles wat er vanaf dan geboekt is gaat eruit,
 * de voorraad staat weer zoals hij op dat moment was, en daarna wordt er
 * opnieuw geteld. De database bewaart wat eruit gaat in een archief; zie
 * migratie 032 voor wat er precies weg gaat en wat blijft.
 */
export function Terugzetten() {
  const { state, terugzettenOverzicht, zetTerug, haalTerugzettingen } = useAppState();
  const navigate = useNavigate();

  const [datum, setDatum] = useState(gisteren);
  const [tijd, setTijd] = useState("00:00");
  const [metEvenementen, setMetEvenementen] = useState(true);
  const [reden, setReden] = useState("");
  const [overzicht, setOverzicht] = useState<TerugzetOverzicht | null>(null);
  const [overzichtFout, setOverzichtFout] = useState<string | null>(null);
  const [eerder, setEerder] = useState<Terugzetting[]>([]);
  const [bevestigen, setBevestigen] = useState(false);
  const [begrepen, setBegrepen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const moment = terugzetMoment(datum, tijd);
  const momentTijd = moment?.getTime() ?? null;
  const inToekomst = momentTijd !== null && momentTijd > Date.now();
  const gebruikerNaam = new Map(state.profielen.map((p) => [p.id, p.naam]));

  useEffect(() => {
    haalTerugzettingen().then(setEerder, () => setEerder([]));
  }, [haalTerugzettingen]);

  // Bij elke andere keuze opnieuw laten zien wat er weg zou gaan.
  useEffect(() => {
    setOverzicht(null);
    setOverzichtFout(null);
    if (momentTijd === null || momentTijd > Date.now()) return;
    let actueel = true;
    terugzettenOverzicht(new Date(momentTijd), metEvenementen).then(
      (o) => actueel && setOverzicht(o),
      (err) => actueel && setOverzichtFout(foutBericht(err))
    );
    return () => {
      actueel = false;
    };
  }, [momentTijd, metEvenementen, terugzettenOverzicht]);

  const kanTerugzetten =
    moment !== null && !inToekomst && overzicht !== null && !overzicht.uitgezetMetVoorraad && reden.trim() !== "";

  async function voerUit() {
    if (!moment) return;
    setBezig(true);
    setFout(null);
    try {
      await zetTerug(moment, metEvenementen, reden.trim());
      navigate(ROUTES.tellingen, {
        state: {
          melding: `De voorraad staat weer zoals hij was op ${formatDateTime(moment.toISOString())}. Tel nu elke locatie en de emballage opnieuw.`,
        },
      });
    } catch (err) {
      setFout(foutBericht(err));
      setBezig(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="beheer"
        title="Voorraad terugzetten"
        toelichting="Is er op de vloer niet of verkeerd geboekt? Kies het moment waarop het misging. Alles wat er vanaf dan geboekt is gaat eruit, ook bij de emballage, en de voorraad staat weer zoals hij toen was. Tel daarna elke locatie en de emballage opnieuw, dan klopt alles weer."
      />

      <Card>
        <KaartKop titel="Vanaf wanneer" sub="Wat er vanaf dit moment geboekt is, gaat eruit" />
        <div className="product-form">
          <div className="field-row">
            <div className="field-group">
              <label className="field-group__label" htmlFor="terugzetten-datum">Datum</label>
              <Input id="terugzetten-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-group__label" htmlFor="terugzetten-tijd">
                Tijd <span className="field-group__hint">00:00 is het begin van de dag</span>
              </label>
              <Input id="terugzetten-tijd" type="time" value={tijd} onChange={(e) => setTijd(e.target.value)} />
            </div>
          </div>
          <label className="keuzevakje">
            <input type="checkbox" checked={metEvenementen} onChange={(e) => setMetEvenementen(e.target.checked)} />
            <span>
              Ook evenementen die sindsdien zijn aangemaakt verwijderen
              <span className="field-group__hint">evenementen van daarvóór blijven staan, alleen hun boekingen van na dit moment gaan eruit</span>
            </span>
          </label>
          <div className="field-group">
            <label className="field-group__label" htmlFor="terugzetten-reden">Waarom</label>
            <Input
              id="terugzetten-reden"
              placeholder="bijvoorbeeld: op de vloer niet geboekt"
              value={reden}
              onChange={(e) => setReden(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <KaartKop
          titel="Wat er gebeurt"
          sub={moment && !inToekomst ? `Terug naar ${formatDateTime(moment.toISOString())}` : undefined}
        />
        {moment === null ? (
          <p className="modal-toelichting">Kies een datum.</p>
        ) : inToekomst ? (
          <p className="melding-waarschuwing">Dat moment ligt in de toekomst.</p>
        ) : overzichtFout ? (
          <FoutMelding melding={overzichtFout} />
        ) : overzicht === null ? (
          <p className="modal-toelichting">Bezig met kijken…</p>
        ) : (
          <div className="product-form">
            <ul className="terugzet-lijst">
              <li><strong>{formatNumber(overzicht.mutaties)}</strong> {overzicht.mutaties === 1 ? "boeking gaat" : "boekingen gaan"} eruit</li>
              <li><strong>{formatNumber(overzicht.pakbonnen)}</strong> {overzicht.pakbonnen === 1 ? "pakbon" : "pakbonnen"}</li>
              <li><strong>{formatNumber(overzicht.tellingen)}</strong> {overzicht.tellingen === 1 ? "telling" : "tellingen"} (afgerond na dit moment, of nog open)</li>
              <li>
                <strong>{formatNumber(overzicht.emballage)}</strong>{" "}
                {overzicht.emballage === 1 ? "emballageregel" : "emballageregels"}
                {overzicht.retourbonnen > 0
                  ? `, waarvan ${overzicht.retourbonnen === 1 ? "één retourbon" : `${formatNumber(overzicht.retourbonnen)} retourbonnen`}`
                  : null}
              </li>
              <li>
                <strong>{formatNumber(overzicht.evenementen.length)}</strong>{" "}
                {overzicht.evenementen.length === 1 ? "evenement" : "evenementen"}
                {overzicht.evenementen.length > 0
                  ? `: ${overzicht.evenementen.map((e) => `${e.naam} (${formatDate(e.datum)})`).join(", ")}`
                  : null}
              </li>
            </ul>
            {overzicht.leveringen > 0 ? (
              <p className="modal-toelichting">
                {overzicht.leveringen === 1 ? "Eén levering blijft" : `${formatNumber(overzicht.leveringen)} leveringen blijven`}{" "}
                staan, met het verschil richting de leverancier. Wat ze in de voorraad brachten gaat eruit; dat tel je
                straks weer mee.
              </p>
            ) : null}
            {overzicht.uitgezetMetVoorraad ? (
              <p className="form-error">
                Dit kan niet: dan komt er weer voorraad in {overzicht.uitgezetMetVoorraad}, en die locatie is niet meer in
                gebruik. Kies een later moment, of een moment vóór er iets geboekt was.
              </p>
            ) : null}
            <Button icon={null} onClick={() => { setBegrepen(false); setFout(null); setBevestigen(true); }} disabled={!kanTerugzetten}>
              Terugzetten
            </Button>
            {!reden.trim() && !overzicht.uitgezetMetVoorraad ? (
              <p className="modal-toelichting">Vul eerst in waarom.</p>
            ) : null}
          </div>
        )}
      </Card>

      {eerder.length > 0 ? (
        <Card>
          <KaartKop titel="Eerder teruggezet" sub="nieuwste eerst" />
          <div className="lijst">
            {eerder.map((t) => (
              <div key={t.id} className="event-rij">
                <span className="event-rij__main">
                  <span className="event-rij__titel">Terug naar {formatDateTime(t.vanaf)}</span>
                  <span className="event-rij__meta">
                    {formatDateTime(t.uitgevoerdOp)}
                    <span>door {gebruikerNaam.get(t.gebruikerId) ?? "onbekend"}</span>
                    <span>{t.reden}</span>
                  </span>
                </span>
                <span className="event-rij__marge">
                  {formatNumber(t.aantalMutaties)} {t.aantalMutaties === 1 ? "boeking" : "boekingen"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal open={bevestigen} onClose={() => !bezig && setBevestigen(false)} title="Voorraad terugzetten">
        <div className="product-form">
          <p className="modal-toelichting">
            Alles wat er vanaf {moment ? formatDateTime(moment.toISOString()) : "dit moment"} geboekt is gaat eruit
            {overzicht && overzicht.evenementen.length > 0
              ? `, en ${overzicht.evenementen.length === 1 ? "één evenement" : `${overzicht.evenementen.length} evenementen`} verdwijnt`
              : ""}
            . Dat geldt meteen voor iedereen die de app gebruikt. Laat wie nog een boeking in de wachtrij op
            de telefoon heeft die eerst versturen.
          </p>
          <p className="melding-waarschuwing">
            Dit is niet vanuit de app terug te draaien. De database bewaart wel wat eruit gaat, dus er raakt niets
            echt kwijt.
          </p>
          <label className="keuzevakje">
            <input type="checkbox" checked={begrepen} onChange={(e) => setBegrepen(e.target.checked)} />
            <span>Ik begrijp het, en ik ga daarna elke locatie en de emballage opnieuw tellen</span>
          </label>
          {fout ? <p className="form-error">{fout}</p> : null}
          <div className="modal-actions">
            <Button type="button" variant="ghost-dark" icon={null} onClick={() => setBevestigen(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button type="button" icon={null} onClick={() => void voerUit()} disabled={!begrepen || bezig}>
              {bezig ? "Bezig…" : "Ja, terugzetten"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
