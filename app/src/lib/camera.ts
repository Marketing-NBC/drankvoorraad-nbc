/**
 * De camera voor het scanscherm: welke lens, welke resolutie, scherpstellen.
 *
 * Vraag je de browser alleen om "een camera aan de achterkant", dan kiest hij
 * zelf. Op een iPhone gaat dat goed. Op een Android met drie of vier lenzen
 * (Samsung) krijg je soms de groothoek- of telelens, die van dichtbij niet
 * scherpstelt, en vaak maar 640×480. Het beeld ziet er dan prima uit, maar de
 * streepjes zijn te vaag om te lezen. Daarom vragen we hier zelf om de
 * hoofdcamera, een hogere resolutie en doorlopende autofocus.
 */

type Apparaat = Pick<MediaDeviceInfo, "deviceId" | "label">;

/** Android noemt zijn camera's "camera2 0, facing back", "camera2 2, facing back"… */
const ANDROID_ACHTER = /camera2?\s*(\d+),\s*facing back/i;

/**
 * De hoofdcamera aan de achterkant van een Android-telefoon: die met het
 * laagste nummer. Geeft niets terug als er niets te kiezen valt (één camera,
 * of labels die we niet herkennen, zoals op een iPhone); dan houden we wat de
 * browser zelf koos.
 */
export function kiesHoofdcamera(apparaten: Apparaat[]): string | undefined {
  const achter = apparaten
    .map((a) => ({ id: a.deviceId, nummer: Number(ANDROID_ACHTER.exec(a.label)?.[1]) }))
    .filter((a) => a.id && Number.isFinite(a.nummer));
  if (achter.length < 2) return undefined;
  return achter.reduce((laagste, a) => (a.nummer < laagste.nummer ? a : laagste)).id;
}

function vraag(video: MediaTrackConstraints) {
  return navigator.mediaDevices.getUserMedia({ audio: false, video });
}

/**
 * Start de camera aan de achterkant. Mislukt de voorkeurscamera, dan valt
 * dit terug op wat de browser zelf kiest; mislukt ook dat, dan gaat de fout
 * (NotAllowedError, NotFoundError…) door naar het scanscherm.
 */
export async function startAchtercamera(breedte: number, hoogte: number): Promise<MediaStream> {
  const basis: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: breedte },
    height: { ideal: hoogte },
  };
  let stream = await vraag(basis);

  // Pas na toestemming geeft de browser de namen van de camera's prijs.
  try {
    const apparaten = (await navigator.mediaDevices.enumerateDevices()).filter((a) => a.kind === "videoinput");
    const keuze = kiesHoofdcamera(apparaten);
    const huidige = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (keuze && keuze !== huidige) {
      // Veel Android-telefoons openen geen twee camera's tegelijk: eerst stoppen.
      stopStream(stream);
      try {
        stream = await vraag({ ...basis, facingMode: undefined, deviceId: { exact: keuze } });
      } catch {
        stream = await vraag(basis);
      }
    }
  } catch {
    // Geen lijst van camera's: dan blijft het de keuze van de browser.
  }

  const track = stream.getVideoTracks()[0];
  if (track && mogelijkheden(track).focusMode?.includes("continuous")) {
    await track
      .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
      .catch(() => undefined);
  }
  return stream;
}

export function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

/** Focus en zaklamp staan (nog) niet in de DOM-typen van TypeScript. */
function mogelijkheden(track: MediaStreamTrack): { focusMode?: string[]; torch?: boolean } {
  try {
    return (track.getCapabilities?.() ?? {}) as { focusMode?: string[]; torch?: boolean };
  } catch {
    return {};
  }
}

export function heeftZaklamp(track: MediaStreamTrack): boolean {
  return mogelijkheden(track).torch === true;
}

export function zetZaklamp(track: MediaStreamTrack, aan: boolean): Promise<void> {
  return track.applyConstraints({ advanced: [{ torch: aan } as MediaTrackConstraintSet] });
}
