import type { GelezenBon } from "../data/bon";
import { leesBonTekst } from "../data/bonTekst";

/**
 * Tekstherkenning op de telefoon zelf.
 *
 * De foto van de afleverbon verlaat het toestel niet: Tesseract leest hem in
 * de browser, gratis en zonder account. De eerste keer haalt de browser de
 * herkenning op (een paar MB, van cdn.jsdelivr.net) en bewaart die; daarna gaat
 * het sneller. Het lezen zelf duurt op een telefoon tien à twintig seconden.
 *
 * Tesseract is niet foutloos op een gekreukte bon. Daarom wordt de foto eerst
 * grijs en wat contrastrijker gemaakt, leest de app de pagina als één blok
 * tekst met de spaties ertussen intact, en markeert de omzetting
 * (src/data/bonTekst.ts) wat twijfelachtig is. Die instellingen zijn getest op
 * een echte foto van de bon van Swinkels; zie bonTekst.test.ts.
 */

/** Groot genoeg voor de kleine letters van een bon, klein genoeg voor een telefoon. */
const MAX_ZIJDE = 2400;
/** Zoals contrast(0.4) in een fotobewerker: grijs wordt grijzer, tekst donkerder. */
const CONTRAST = (1 + 0.4) / (1 - 0.4);

async function bereidVoor(bestand: File): Promise<HTMLCanvasElement> {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, MAX_ZIJDE / Math.max(beeld.width, beeld.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(beeld.width * schaal);
  canvas.height = Math.round(beeld.height * schaal);
  const vlak = canvas.getContext("2d", { willReadFrequently: true });
  if (!vlak) throw new Error("Deze browser kan de foto niet verwerken.");
  vlak.drawImage(beeld, 0, 0, canvas.width, canvas.height);
  beeld.close();

  const pixels = vlak.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const grijs = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const waarde = Math.max(0, Math.min(255, CONTRAST * (grijs - 128) + 128));
    d[i] = d[i + 1] = d[i + 2] = waarde;
  }
  vlak.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * Lees één of meer foto's van een afleverbon. `onVoortgang` krijgt een getal
 * van 0 tot 1, voor een balk op het scherm.
 */
export async function herkenBon(
  fotos: File[],
  onVoortgang?: (fractie: number) => void
): Promise<GelezenBon> {
  // Pas laden als iemand een foto maakt: het hoort niet in de eerste lading van de app.
  const { createWorker, PSM } = await import("tesseract.js");
  let foto = 0;
  const worker = await createWorker("eng", undefined, {
    logger: (bericht) => {
      if (bericht.status === "recognizing text") {
        onVoortgang?.((foto + bericht.progress) / fotos.length);
      }
    },
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    const teksten: string[] = [];
    for (; foto < fotos.length; foto++) {
      const { data } = await worker.recognize(await bereidVoor(fotos[foto]));
      teksten.push(data.text);
    }
    return leesBonTekst(teksten.join("\n"));
  } finally {
    await worker.terminate();
  }
}
