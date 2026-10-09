import { useRef, useState } from "react";
import { Button } from "../../design-system";
import { useAppState } from "../../context/AppStateContext";
import type { GelezenBon } from "../../data/bon";
import { verkleinFoto } from "../../lib/foto";
import { foutBericht } from "../../utils/fouten";

/** Een bon heeft er zelden meer; de functie weigert er meer dan vier. */
const MAX_FOTOS = 4;

/**
 * Foto van de afleverbon → bonnummer, leverancier en regels.
 *
 * Neem een foto van elke pagina met artikelen (bij Swinkels meestal alleen
 * pagina 1). Het lezen gebeurt op de server (supabase/functions/lees-bon) en
 * duurt een paar tellen tot een halve minuut. Lukt het niet, dan gaat de
 * levering gewoon met de hand verder: niets hiervan is nodig om te boeken.
 */
export function BonLezen({ onGelezen }: { onGelezen: (bon: GelezenBon) => void }) {
  const { leesBon } = useAppState();
  const invoer = useRef<HTMLInputElement>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verwerk(bestanden: FileList | null) {
    if (!bestanden || bestanden.length === 0) return;
    if (bestanden.length > MAX_FOTOS) {
      setFout(`Hooguit ${MAX_FOTOS} foto's tegelijk.`);
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const fotos = await Promise.all(Array.from(bestanden).map(verkleinFoto));
      onGelezen(await leesBon(fotos));
    } catch (err) {
      setFout(foutBericht(err) || "Bon lezen lukt nu niet. Vul hem met de hand in.");
    } finally {
      setBezig(false);
      if (invoer.current) invoer.current.value = "";
    }
  }

  return (
    <div className="bon-lezen">
      <input
        ref={invoer}
        className="visueel-verborgen"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        aria-label="Foto van de afleverbon"
        onChange={(e) => void verwerk(e.target.files)}
      />
      <Button icon={null} disabled={bezig} onClick={() => invoer.current?.click()}>
        {bezig ? "Bon wordt gelezen…" : "Foto van de bon"}
      </Button>
      <span className="veld-toelichting">
        {bezig
          ? "Dit kan een halve minuut duren."
          : "Bonnummer, leverancier en de regels worden ingevuld. Wat er werkelijk staat, tel je daarna zelf."}
      </span>
      {fout ? <p className="form-error">{fout}</p> : null}
    </div>
  );
}
