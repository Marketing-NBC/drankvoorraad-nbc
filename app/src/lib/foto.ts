import type { BonFoto } from "../data/bon";

/**
 * Een foto van de telefoon klein genoeg maken om te versturen.
 *
 * Een telefoonfoto is al snel 4000 pixels breed en meerdere megabytes. Voor
 * het lezen van een bon is 2000 pixels aan de lange kant ruim genoeg, en dan
 * blijft hij ver onder de 5 MB die Claude per afbeelding aanneemt. Het
 * resultaat is altijd JPEG, ook als de telefoon HEIC of PNG aanlevert.
 */
const MAX_ZIJDE = 2000;
const KWALITEIT = 0.85;

export async function verkleinFoto(bestand: File): Promise<BonFoto> {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, MAX_ZIJDE / Math.max(beeld.width, beeld.height));
  const breedte = Math.round(beeld.width * schaal);
  const hoogte = Math.round(beeld.height * schaal);

  const canvas = document.createElement("canvas");
  canvas.width = breedte;
  canvas.height = hoogte;
  const tekenvlak = canvas.getContext("2d");
  if (!tekenvlak) throw new Error("Deze browser kan de foto niet verwerken.");
  tekenvlak.drawImage(beeld, 0, 0, breedte, hoogte);
  beeld.close();

  const dataUrl = canvas.toDataURL("image/jpeg", KWALITEIT);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}
