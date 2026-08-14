/**
 * Haalt de foutmelding uit wat een aanroep ook teruggeeft.
 *
 * Supabase gooit bij een mislukte query of RPC géén Error-object maar een
 * PostgrestError: een gewoon object met een `message`-veld. Een controle als
 * `err instanceof Error` levert daar dus niets op, waardoor specifieke
 * databasemeldingen ("Er loopt al een telling…") stilletjes verloren gaan.
 */
export function foutBericht(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const bericht = (err as { message?: unknown }).message;
    if (typeof bericht === "string") return bericht;
  }
  return "";
}
