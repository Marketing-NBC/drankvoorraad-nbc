/**
 * Gele balk bovenaan zodra de app met een Supabase op deze computer praat
 * (de testomgeving, zie TESTOMGEVING.md). Zo verwar je een proefboeking
 * nooit met de echte voorraad. Op productie en in de preview staat hij er
 * niet: daar is het adres geen localhost.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? "";
export const isTestomgeving = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);

if (isTestomgeving && !document.title.startsWith("TEST")) {
  document.title = `TEST · ${document.title}`;
}

export function TestomgevingBalk() {
  if (!isTestomgeving) return null;
  return (
    <div className="testomgeving-balk" role="status">
      <strong>Testomgeving</strong> · raakt de echte voorraad niet
    </div>
  );
}
