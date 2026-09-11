const currencyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const numberFormatter = new Intl.NumberFormat("nl-NL");
const dateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/** "15 sep 2026" — voor lijsten, waar de volledige maandnaam de regel laat afbreken. */
export function formatDateKort(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

const dagMaandTijdFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

/**
 * "14 mei 09:12" — voor tabellen waar de datumkolom anders over twee regels
 * afbreekt. Het jaartal komt er alleen bij als het níét dit jaar is, zodat
 * een oude regel nooit verwarrend kort wordt.
 */
export function formatDateTimeKort(iso: string): string {
  const datum = new Date(iso);
  const kort = dagMaandTijdFormatter.format(datum);
  const ditJaar = datum.getFullYear() === new Date().getFullYear();
  return ditJaar ? kort : `${kort} (${datum.getFullYear()})`;
}

/** "nog niet beschikbaar" per spec when brutomarge could not be computed (omzet 0/leeg). */
export function formatBrutomarge(value: number | null): string {
  if (value === null) return "nog niet beschikbaar";
  return `${numberFormatter.format(Math.round(value * 10) / 10)}%`;
}
