/**
 * Piepje en trilling bij een scan, zodat je niet naar het scherm hoeft te
 * kijken.
 *
 * Het piepje is een korte toon via Web Audio — geen geluidsbestand om te
 * laden. iOS speelt Web Audio pas af als de AudioContext binnen een tik van
 * de gebruiker is aangezet; daarom roept het scanscherm `ontgrendelGeluid`
 * aan zodra het opent. Staat de iPhone op stil, dan blijft het stil: dat is
 * zo bedoeld, de stille modus overrulen zou ook andere audio onderbreken.
 *
 * Trillen kan alleen op Android: Safari kent `navigator.vibrate` niet.
 */

let context: AudioContext | null = null;

export function ontgrendelGeluid() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    context ??= new AC();
    if (context.state === "suspended") void context.resume();
  } catch {
    // Geen geluid is geen reden om het scannen te laten mislukken.
  }
}

function toon(frequentie: number, start: number, duur: number) {
  if (!context) return;
  const t = context.currentTime + start;
  const osc = context.createOscillator();
  const volume = context.createGain();
  osc.type = "sine";
  osc.frequency.value = frequentie;
  // Kort in- en uitfaden voorkomt een klik in de luidspreker.
  volume.gain.setValueAtTime(0, t);
  volume.gain.linearRampToValueAtTime(0.25, t + 0.01);
  volume.gain.linearRampToValueAtTime(0, t + duur);
  osc.connect(volume).connect(context.destination);
  osc.start(t);
  osc.stop(t + duur + 0.02);
}

function tril(patroon: number | number[]) {
  try {
    navigator.vibrate?.(patroon);
  } catch {
    // Niet ondersteund: niets aan de hand.
  }
}

/** Eén hoge piep: gevonden. Twee lage tonen: deze code kennen we niet. */
export function meldScan(soort: "goed" | "fout") {
  try {
    if (soort === "goed") {
      toon(1760, 0, 0.09);
      tril(60);
    } else {
      toon(440, 0, 0.12);
      toon(330, 0.16, 0.16);
      tril([80, 60, 80]);
    }
  } catch {
    // Zie ontgrendelGeluid.
  }
}
