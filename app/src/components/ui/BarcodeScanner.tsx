import { useEffect, useRef, useState } from "react";

/**
 * Camerascanner voor streepjescodes (EAN/UPC) en QR. Draait volledig in de
 * browser via ZXing — geen native app nodig. Werkt op Android Chrome en iOS
 * Safari, mits de pagina via HTTPS geserveerd wordt (of via localhost).
 *
 * ZXing wordt pas ingeladen zodra er daadwerkelijk gescand wordt: de
 * decoder is bijna een halve megabyte, en de meeste paginabezoeken (zeker
 * op mobiel netwerk tijdens een evenement) scannen nooit.
 */
export function BarcodeScanner({
  actief,
  onGevonden,
  onFout,
}: {
  actief: boolean;
  onGevonden: (code: string) => void;
  onFout?: (melding: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"start" | "bezig" | "fout">("start");
  const onGevondenRef = useRef(onGevonden);
  const onFoutRef = useRef(onFout);

  useEffect(() => {
    onGevondenRef.current = onGevonden;
    onFoutRef.current = onFout;
  });

  useEffect(() => {
    if (!actief) return;
    let gestopt = false;
    let controls: { stop: () => void } | undefined;

    setStatus("start");

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
            setStatus("bezig");
            onGevondenRef.current(resultaat.getText());
          }
        );

        if (gestopt) {
          c.stop();
          return;
        }
        controls = c;
        setStatus("bezig");
      } catch (err: unknown) {
        if (gestopt) return;
        setStatus("fout");
        const naam = err instanceof Error ? err.name : "";
        onFoutRef.current?.(
          naam === "NotAllowedError"
            ? "Geen toegang tot de camera. Sta cameragebruik toe in je browser en probeer opnieuw."
            : naam === "NotFoundError"
              ? "Geen camera gevonden op dit apparaat."
              : "De camera kon niet gestart worden. Gebruik zo nodig het handmatige invoerveld."
        );
      }
    })();

    return () => {
      gestopt = true;
      controls?.stop();
    };
  }, [actief]);

  if (!actief) return null;

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" muted playsInline />
      <div className="scanner__kader" aria-hidden="true" />
      <p className="scanner__status">
        {status === "fout"
          ? "Camera niet beschikbaar."
          : status === "start"
            ? "Camera starten…"
            : "Richt de camera op de streepjescode."}
      </p>
    </div>
  );
}

/**
 * Invoerveld dat zowel handmatig typen als een fysieke scanner ondersteunt.
 * De meeste USB/Bluetooth-scanners gedragen zich als een toetsenbord: ze
 * "typen" de code razendsnel en sluiten af met Enter. Enter bevestigt hier
 * dus direct, waardoor zo'n scanner zonder extra koppeling werkt.
 */
export function BarcodeInvoer({
  waarde,
  onChange,
  onBevestig,
  placeholder = "Scan of typ een barcode",
}: {
  waarde: string;
  onChange: (waarde: string) => void;
  onBevestig: (waarde: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="input"
      value={waarde}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const code = waarde.trim();
        if (code) onBevestig(code);
      }}
    />
  );
}
