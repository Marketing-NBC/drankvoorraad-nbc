/**
 * Terugzetten — de voorraad terug naar een moment (migratie 032).
 *
 * Het moment kiest de beheerder als datum en tijd in de eigen tijdzone: "gisteren
 * om 7 uur". De database krijgt één tijdstip; wat er vanaf dat tijdstip
 * geboekt is, gaat eruit.
 */

/** "2026-10-29" + "07:00" → het tijdstip in de tijdzone van het apparaat. Leeg of onzin → null. */
export function terugzetMoment(datum: string, tijd: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const t = /^(\d{1,2}):(\d{2})$/.exec(tijd || "00:00");
  if (!d || !t) return null;
  const [jaar, maand, dag] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [uur, minuut] = [Number(t[1]), Number(t[2])];
  if (uur > 23 || minuut > 59) return null;
  const moment = new Date(jaar, maand - 1, dag, uur, minuut);
  // new Date rekent 31 februari stilletjes door naar maart.
  if (moment.getFullYear() !== jaar || moment.getMonth() !== maand - 1 || moment.getDate() !== dag) return null;
  return moment;
}

/** De datum van gisteren als "jjjj-mm-dd": het gewone geval is "gisteren ging het mis". */
export function gisteren(nu: Date = new Date()): string {
  const d = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 1);
  const tweeCijfers = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${tweeCijfers(d.getMonth() + 1)}-${tweeCijfers(d.getDate())}`;
}
