import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Button, Logo } from "../../design-system";
import { FoutMelding } from "../../components/ui/FoutMelding";
import { useAppState } from "../../context/AppStateContext";
import type { Pakbon } from "../../data/types";
import { formatDate, formatDateTime, formatNumber } from "../../utils/format";
import { ROUTES } from "../../routes/routes";

/**
 * De pakbon zoals hij afgedrukt of als PDF opgeslagen wordt. Bewust een
 * losse pagina en geen modal: bij het afdrukken (Ctrl+P → Opslaan als PDF)
 * telt alleen wat er op de pagina staat, en zo is dat exact dit document.
 */
export function PakbonWeergave() {
  const { id } = useParams<{ id: string }>();
  const { state, laden, haalPakbon } = useAppState();

  const [pakbon, setPakbon] = useState<Pakbon | null>(null);
  const [pakbonLaden, setPakbonLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let actueel = true;
    setPakbonLaden(true);
    haalPakbon(id)
      .then((gevonden) => {
        if (!actueel) return;
        setPakbon(gevonden);
        setFout(gevonden ? null : "Deze pakbon bestaat niet (meer).");
      })
      .catch(() => actueel && setFout("De pakbon kon niet opgehaald worden."))
      .finally(() => actueel && setPakbonLaden(false));
    return () => {
      actueel = false;
    };
  }, [id, haalPakbon]);

  const regels = useMemo(
    () => state.mutaties.filter((m) => m.pakbonId === id),
    [state.mutaties, id]
  );

  if (laden || pakbonLaden) return <p className="app-laden">Bezig met laden…</p>;
  if (fout) return <FoutMelding melding={fout} />;
  if (!pakbon) return <Navigate to={ROUTES.overzicht} replace />;

  const evenement = state.evenementen.find((e) => e.id === pakbon.evenementId);
  const locatie = state.locaties.find((l) => l.id === pakbon.vanLocatieId);
  const uitgegevenDoor = state.profielen.find((p) => p.id === pakbon.gebruikerId);
  const productenById = new Map(state.producten.map((p) => [p.id, p]));

  return (
    <>
      <div className="pakbon-acties no-print">
        <Button variant="ghost-dark" icon="arrow-left" iconPosition="leading" onClick={() => window.history.back()}>
          Terug
        </Button>
        <Button icon={null} onClick={() => window.print()}>Afdrukken of opslaan als PDF</Button>
      </div>

      <article className="pakbon">
        <header className="pakbon__kop">
          <Logo height={44} />
          <div className="pakbon__nummer">
            <span className="pakbon__label">Pakbon</span>
            {/* De eerste acht tekens van de uuid: kort genoeg om over te nemen
                op papier, lang genoeg om uniek te zijn binnen dit bedrijf. */}
            <strong>{pakbon.id.slice(0, 8).toUpperCase()}</strong>
          </div>
        </header>

        <dl className="pakbon__gegevens">
          <div>
            <dt>Evenement</dt>
            <dd>{evenement?.naam ?? pakbon.evenementId}</dd>
          </div>
          <div>
            <dt>Evenementnummer</dt>
            <dd>{pakbon.evenementId}</dd>
          </div>
          <div>
            <dt>Evenementdatum</dt>
            <dd>{evenement ? formatDate(evenement.datum) : "onbekend"}</dd>
          </div>
          <div>
            <dt>Merk</dt>
            <dd>{evenement?.merk ?? "onbekend"}</dd>
          </div>
          <div>
            <dt>Uitgegeven vanaf</dt>
            <dd>{locatie?.naam ?? "onbekende locatie"}</dd>
          </div>
          <div>
            <dt>Uitgifte op</dt>
            <dd>{formatDateTime(pakbon.aangemaaktOp)}</dd>
          </div>
        </dl>

        <table className="pakbon__tabel">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Eenheid</th>
              <th scope="col" className="pakbon__tabel-getal">Aantal</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((regel) => {
              const product = productenById.get(regel.productId);
              return (
                <tr key={regel.id}>
                  <td>{product?.naam ?? "Onbekend product"}</td>
                  <td>{product?.eenheid ?? ""}</td>
                  <td className="pakbon__tabel-getal">{formatNumber(regel.aantal)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Totaal aantal regels</td>
              <td className="pakbon__tabel-getal">{formatNumber(regels.length)}</td>
            </tr>
          </tfoot>
        </table>


        <div className="pakbon__ondertekening">
          <div className="pakbon__partij">
            <span className="pakbon__label">Uitgegeven door</span>
            <span className="pakbon__naam">{uitgegevenDoor?.naam ?? "onbekend"}</span>
          </div>
          <div className="pakbon__partij">
            <span className="pakbon__label">Ontvangen door</span>
            <span className="pakbon__naam">{pakbon.ontvangerNaam}</span>
            {pakbon.handtekening ? (
              <img
                className="pakbon__handtekening"
                src={pakbon.handtekening}
                alt={`Handtekening van ${pakbon.ontvangerNaam}`}
              />
            ) : (
              <span className="pakbon__geen-handtekening">Niet ondertekend</span>
            )}
          </div>
        </div>

        <p className="pakbon__voet">
          Voor akkoord ontvangen. Retour te melden via de app, zodat het werkelijke verbruik klopt.
        </p>
      </article>
    </>
  );
}
