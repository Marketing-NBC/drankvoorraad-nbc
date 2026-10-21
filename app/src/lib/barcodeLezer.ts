/**
 * Leest streepjescodes uit het camerabeeld.
 *
 * Waar de browser zelf een barcodelezer heeft (`BarcodeDetector`: Chrome en
 * Samsung Internet op Android) gebruiken we die. Die is snel en vergeeft een
 * wazig of scheef beeld veel beter dan een lezer in JavaScript. Elders (iPhone)
 * en als die ingebouwde lezer weigert, doet ZXing het.
 *
 * ZXing wordt pas ingeladen als hij nodig is: de decoder is bijna een halve
 * megabyte, en de meeste paginabezoeken scannen nooit.
 */

/** Hoe vaak we een beeld proberen. ZXing doet standaard maar eens per 500 ms. */
const PROBEER_ELKE_MS = 100;

/** Flesje en tray (EAN/UPC), krat of doos (ITF-14, Code 128) en QR. */
const NATIEVE_FORMATEN = ["ean_13", "ean_8", "upc_a", "upc_e", "itf", "code_128", "qr_code"];

type Detector = { detect: (bron: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorKlasse = {
  new (opties: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

export type Lezer = { stop: () => void };

async function maakNatieveDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: DetectorKlasse }).BarcodeDetector;
  if (!BD) return null;
  try {
    const ondersteund = await BD.getSupportedFormats();
    const formats = NATIEVE_FORMATEN.filter((f) => ondersteund.includes(f));
    // Op Windows bestaat de klasse wel, maar kan hij niets.
    if (!formats.includes("ean_13")) return null;
    return new BD({ formats });
  } catch {
    return null;
  }
}

/** Geeft de ingebouwde lezer de voorkeur? Bepaalt ook welke resolutie we vragen. */
export async function heeftNatieveLezer(): Promise<boolean> {
  return (await maakNatieveDetector()) !== null;
}

function natief(detector: Detector, video: HTMLVideoElement, onCode: (code: string) => void, onFout: () => void): Lezer {
  let gestopt = false;
  let gelukt = false;
  let timer = 0;

  async function ronde() {
    if (gestopt) return;
    if (video.readyState >= 2) {
      try {
        const gevonden = await detector.detect(video);
        gelukt = true;
        if (!gestopt && gevonden[0]?.rawValue) onCode(gevonden[0].rawValue);
      } catch {
        // Weigert hij meteen (geen Play-services, zoals op sommige telefoons
        // zonder Google), dan neemt ZXing het over. Later een keer missen is
        // niet erg: dan proberen we het volgende beeld.
        if (!gelukt) {
          gestopt = true;
          onFout();
          return;
        }
      }
    }
    if (!gestopt) timer = window.setTimeout(ronde, PROBEER_ELKE_MS);
  }
  void ronde();

  return {
    stop: () => {
      gestopt = true;
      window.clearTimeout(timer);
    },
  };
}

async function zxing(stream: MediaStream, video: HTMLVideoElement, onCode: (code: string) => void): Promise<Lezer> {
  const [{ BrowserMultiFormatReader, BarcodeFormat }, { DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map<unknown, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
      ],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints as never, {
    delayBetweenScanAttempts: PROBEER_ELKE_MS,
  });
  // stop() van ZXing stopt ook de camera; dat doet het scanscherm al zelf,
  // maar dubbel stoppen kan geen kwaad.
  return reader.decodeFromStream(stream, video, (resultaat) => {
    if (resultaat) onCode(resultaat.getText());
  });
}

/**
 * Begint met lezen op een camerastroom die al in `video` speelt. `onCode`
 * kan vaker dan eens per code komen; het scanscherm negeert de herhalingen.
 */
export async function startLezer(
  stream: MediaStream,
  video: HTMLVideoElement,
  onCode: (code: string) => void
): Promise<Lezer> {
  const detector = await maakNatieveDetector();
  if (!detector) return zxing(stream, video, onCode);

  let huidige: Lezer;
  let gestopt = false;
  huidige = natief(detector, video, onCode, () => {
    void zxing(stream, video, onCode).then((l) => {
      if (gestopt) l.stop();
      else huidige = l;
    });
  });
  return {
    stop: () => {
      gestopt = true;
      huidige.stop();
    },
  };
}
