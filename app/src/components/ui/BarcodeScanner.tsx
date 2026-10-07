import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Badge, Button } from "../../design-system";
import { meldScan, ontgrendelGeluid } from "../../lib/scanfeedback";

/**
 * Wat de aanroeper teruggeeft na een scan. Niets: de code is verwerkt en het
 * scanscherm sluit. Een tekst: de code hoort nergens bij; het scherm blijft
 * open met die melding, zodat je meteen opnieuw kunt scannen.
 */
export type ScanUitkomst = void | string;

/**
 * Camerascanner voor streepjescodes (EAN/UPC) en QR, als scherm over de hele
 * telefoon. Draait volledig in de browser via ZXing — geen native app nodig.
 * Werkt op Android Chrome en iOS Safari, mits de pagina via HTTPS geserveerd
 * wordt (of via localhost).
 *
 * Eén scan per keer: na een geslaagde scan gaat het scherm vanzelf dicht en
 * roept het `onSluit` aan. De aanroeper sluit het dus niet zelf vanuit
 * `onGevonden`.
 *
 * ZXing wordt pas ingeladen zodra er daadwerkelijk gescand wordt: de
 * decoder is bijna een halve megabyte, en de meeste paginabezoeken (zeker
 * op mobiel netwerk tijdens een evenement) scannen nooit.
 */
export function BarcodeScanner({
  open,
  onGevonden,
  onSluit,
  titel = "Barcode scannen",
  context,
}: {
  open: boolean;
  onGevonden: (code: string) => ScanUitkomst;
  onSluit: () => void;
  titel?: string;
  /** Kleine regel onder de titel: waar je mee bezig bent. */
  context?: string;
}) {
  if (!open) return null;
  return createPortal(
    <ScanScherm onGevonden={onGevonden} onSluit={onSluit} titel={titel} context={context} />,
    document.body
  );
}

type Fase = "zoeken" | "gevonden" | "onbekend";

/** Hoe lang het groene kader blijft staan voor het scherm dichtgaat. */
const SLUIT_NA_MS = 300;

function ScanScherm({
  onGevonden,
  onSluit,
  titel,
  context,
}: {
  onGevonden: (code: string) => ScanUitkomst;
  onSluit: () => void;
  titel: string;
  context?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sluitknopRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<{ stop: () => void; switchTorch?: (aan: boolean) => Promise<void> }>();
  const onGevondenRef = useRef(onGevonden);
  const onSluitRef = useRef(onSluit);
  /** Leest de decoder-callback, die buiten de React-cyclus draait. */
  const faseRef = useRef<Fase>("zoeken");

  const [camera, setCamera] = useState<"start" | "bezig" | "fout">("start");
  const [cameraMelding, setCameraMelding] = useState<string | null>(null);
  const [fase, setFaseState] = useState<Fase>("zoeken");
  const [melding, setMelding] = useState<string | null>(null);
  const [laatsteCode, setLaatsteCode] = useState("");
  const [typen, setTypen] = useState(false);
  const [getypt, setGetypt] = useState("");
  /** null: deze camera heeft geen zaklamp (of de browser laat hem niet toe). */
  const [zaklamp, setZaklamp] = useState<boolean | null>(null);

  useEffect(() => {
    onGevondenRef.current = onGevonden;
    onSluitRef.current = onSluit;
  });

  function zetFase(f: Fase) {
    faseRef.current = f;
    setFaseState(f);
  }

  function verwerk(ruweCode: string) {
    const code = ruweCode.trim();
    if (!code || faseRef.current !== "zoeken") return;
    const uitkomst = onGevondenRef.current(code);
    setLaatsteCode(code);
    if (typeof uitkomst === "string") {
      zetFase("onbekend");
      setMelding(uitkomst);
      meldScan("fout");
    } else {
      zetFase("gevonden");
      meldScan("goed");
    }
  }

  function opnieuw() {
    setMelding(null);
    setGetypt("");
    zetFase("zoeken");
  }

  // Na een geslaagde scan nog heel even het groene kader, dan dicht.
  useEffect(() => {
    if (fase !== "gevonden") return;
    const t = window.setTimeout(() => onSluitRef.current(), SLUIT_NA_MS);
    return () => window.clearTimeout(t);
  }, [fase]);

  // Synchroon met de tik die het scherm opende, zodat iOS het piepje toelaat.
  useLayoutEffect(() => {
    ontgrendelGeluid();
  }, []);

  // Pagina eronder vastzetten, focus op sluiten, Escape sluit alleen dit
  // scherm en niet ook de modal eronder.
  useEffect(() => {
    const vorigeOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sluitknopRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onSluitRef.current();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = vorigeOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    let gestopt = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (gestopt) return;

        const reader = new BrowserMultiFormatReader();
        const c = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (resultaat) => {
            if (gestopt || !resultaat) return;
            verwerk(resultaat.getText());
          }
        );

        if (gestopt) {
          c.stop();
          return;
        }
        controlsRef.current = c;
        setCamera("bezig");
        // ZXing zet switchTorch alleen als de camera een zaklamp heeft.
        if (c.switchTorch) setZaklamp(false);
      } catch (err: unknown) {
        if (gestopt) return;
        setCamera("fout");
        setTypen(true);
        const naam = err instanceof Error ? err.name : "";
        setCameraMelding(
          naam === "NotAllowedError"
            ? "Geen toegang tot de camera. Sta cameragebruik toe in je browser en probeer opnieuw, of typ de code hieronder."
            : naam === "NotFoundError"
              ? "Geen camera gevonden op dit apparaat. Typ de code hieronder."
              : "De camera kon niet gestart worden. Typ de code hieronder."
        );
      }
    })();

    return () => {
      gestopt = true;
      controlsRef.current?.stop();
      controlsRef.current = undefined;
    };
    // verwerk leest alles via refs; de camera start één keer per scherm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function wisselZaklamp() {
    const c = controlsRef.current;
    if (!c?.switchTorch || zaklamp === null) return;
    try {
      await c.switchTorch(!zaklamp);
      setZaklamp(!zaklamp);
    } catch {
      setZaklamp(null);
    }
  }

  function bevestigGetypt(e: FormEvent) {
    e.preventDefault();
    // Het scherm staat via een portal in <body>, maar React laat events
    // gewoon doorbubbelen naar de boom erboven — en daar zit vaak het
    // boekingsformulier. Zonder dit zou "Zoek" dat formulier indienen.
    e.stopPropagation();
    if (faseRef.current === "onbekend") opnieuw();
    verwerk(getypt);
  }

  const status =
    camera === "fout"
      ? null
      : camera === "start"
        ? "Camera starten…"
        : fase === "zoeken"
          ? "Houd de streepjescode in het kader"
          : null;

  return (
    <div
      className="scanscherm"
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      onPointerDown={ontgrendelGeluid}
    >
      <video ref={videoRef} className="scanscherm__video" muted playsInline />

      <div className={`scanscherm__kader scanscherm__kader--${fase}`} aria-hidden="true">
        <span className="scanscherm__hoek scanscherm__hoek--lb" />
        <span className="scanscherm__hoek scanscherm__hoek--rb" />
        <span className="scanscherm__hoek scanscherm__hoek--lo" />
        <span className="scanscherm__hoek scanscherm__hoek--ro" />
        {fase === "zoeken" && camera === "bezig" ? <span className="scanscherm__lijn" /> : null}
        {fase === "gevonden" ? (
          <span className="scanscherm__vink">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        ) : null}
      </div>

      <div className="scanscherm__kop">
        <button ref={sluitknopRef} type="button" className="scanscherm__rond" aria-label="Sluiten" onClick={onSluit}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="scanscherm__titel">
          <span className="scanscherm__titel-hoofd">{titel}</span>
          {context ? <span className="scanscherm__titel-sub">{context}</span> : null}
        </div>
        {zaklamp !== null ? (
          <button
            type="button"
            className={`scanscherm__rond${zaklamp ? " scanscherm__rond--aan" : ""}`}
            aria-label={zaklamp ? "Zaklamp uit" : "Zaklamp aan"}
            aria-pressed={zaklamp}
            onClick={wisselZaklamp}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2h8l-1 6H9z" />
              <path d="M9 8v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8" />
              <path d="M12 13v2" />
            </svg>
          </button>
        ) : (
          <span className="scanscherm__rond scanscherm__rond--leeg" aria-hidden="true" />
        )}
      </div>

      {status ? (
        <p className="scanscherm__status" aria-live="polite">{status}</p>
      ) : null}

      <div className="scanscherm__voet">
        {fase === "onbekend" ? (
          <div className="scanscherm__paneel" role="alert">
            <div className="scanscherm__paneel-kop">
              <Badge variant="gold">onbekend</Badge>
              <span className="scanscherm__code">{laatsteCode}</span>
            </div>
            <p className="scanscherm__melding">{melding}</p>
            <div className="scanscherm__knoppen">
              <Button icon={null} onClick={opnieuw}>Opnieuw scannen</Button>
              <Button variant="zacht" icon={null} onClick={onSluit}>Sluiten</Button>
            </div>
          </div>
        ) : typen ? (
          <form className="scanscherm__paneel" onSubmit={bevestigGetypt}>
            {cameraMelding ? <p className="scanscherm__melding">{cameraMelding}</p> : null}
            <label className="field-group__label" htmlFor="scanscherm-code">
              Barcode <span className="field-group__hint">werkt ook met een losse scanner</span>
            </label>
            <div className="scanscherm__invoer">
              <input
                id="scanscherm-code"
                className="input"
                value={getypt}
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                placeholder="Typ of scan de code"
                onChange={(e) => setGetypt(e.target.value)}
              />
              <Button type="submit" icon={null} disabled={!getypt.trim()}>Zoek</Button>
            </div>
          </form>
        ) : (
          <button type="button" className="scanscherm__typknop" onClick={() => setTypen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
            </svg>
            Code intypen
          </button>
        )}
      </div>
    </div>
  );
}
