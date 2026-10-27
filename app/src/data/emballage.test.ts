import { describe, expect, it } from "vitest";
import {
  emballageBeweging,
  emballageNotitie,
  emballageOverzicht,
  emballageTotaal,
  emballageVerschil,
} from "./emballage";
import type { EmballageMutatie, EmballageRetour, EmballageSoort, EmballageStand } from "./types";

const soort = (velden: Partial<EmballageSoort> & Pick<EmballageSoort, "id" | "naam">): EmballageSoort => ({
  actief: true,
  borg: 0,
  ...velden,
});

const stand = (emballageId: string, inHuis: number): EmballageStand => ({
  emballageId,
  binnen: inHuis,
  retour: 0,
  handmatig: 0,
  inHuis,
});

describe("emballageOverzicht", () => {
  it("rekent de borg van wat er in huis staat", () => {
    const [krat] = emballageOverzicht(
      [soort({ id: "e1", naam: "Krat fris", borg: 5 })],
      [stand("e1", 40)]
    );
    expect(krat.inHuis).toBe(40);
    expect(krat.waarde).toBe(200);
  });

  it("toont een actieve soort zonder stand als 0", () => {
    const [rol] = emballageOverzicht([soort({ id: "e7", naam: "Rolcontainer", borg: 150 })], []);
    expect(rol.inHuis).toBe(0);
    expect(rol.waarde).toBe(0);
  });

  it("laat een uitgezette soort alleen zien zolang er nog iets van staat", () => {
    const soorten = [
      soort({ id: "e3", naam: "Krat Spa", actief: false, borg: 5 }),
      soort({ id: "e4", naam: "Oud fust", actief: false, borg: 30 }),
    ];
    const regels = emballageOverzicht(soorten, [stand("e3", 2)]);
    expect(regels.map((r) => r.soort.id)).toEqual(["e3"]);
  });

  it("zet de soorten in de volgorde van de retourbon, zonder nummer achteraan", () => {
    const regels = emballageOverzicht(
      [
        soort({ id: "a", naam: "PET-fles" }),
        soort({ id: "b", naam: "Krat fris", artikelnummer: "800163" }),
        soort({ id: "c", naam: "Fust", artikelnummer: "800004" }),
      ],
      []
    );
    expect(regels.map((r) => r.soort.id)).toEqual(["c", "b", "a"]);
  });

  it("houdt een negatieve stand zichtbaar maar zonder negatieve waarde", () => {
    const [fust] = emballageOverzicht([soort({ id: "e5", naam: "Fust", borg: 30 })], [stand("e5", -3)]);
    expect(fust.inHuis).toBe(-3);
    expect(fust.waarde).toBe(0);
  });
});

const beweging = (velden: Partial<EmballageMutatie> & Pick<EmballageMutatie, "type">): EmballageMutatie => ({
  id: "m1",
  emballageId: "e1",
  aantal: 5,
  gebruikerId: "u1",
  datumTijd: "2026-10-27T10:00:00Z",
  ...velden,
});

describe("emballagemutaties", () => {
  it("herkent erbij en eraf met de hand, met de reden zonder voorvoegsel", () => {
    const erbij = beweging({ type: "erbij", notitie: "Handmatig: lege kratten achterin" });
    expect(emballageBeweging(erbij)).toBe("erbij");
    expect(emballageVerschil(erbij)).toBe(5);
    expect(emballageNotitie(erbij, undefined)).toBe("lege kratten achterin");

    const eraf = beweging({ type: "eraf", aantal: 3, notitie: "Handmatig: kapot" });
    expect(emballageBeweging(eraf)).toBe("eraf");
    expect(emballageVerschil(eraf)).toBe(-3);
  });

  it("herkent de telling en de beginstand aan de notitie van de database", () => {
    const telling = beweging({ type: "eraf", notitie: "Emballagetelling" });
    expect(emballageBeweging(telling)).toBe("telling");
    expect(emballageVerschil(telling)).toBe(-5);
    expect(emballageNotitie(telling, undefined)).toBe("");

    const begin = beweging({ type: "erbij", notitie: "Beginstand uit de drankvoorraad" });
    expect(emballageBeweging(begin)).toBe("beginstand");
  });

  it("noemt bij een retourbon de leverancier en het bonnummer", () => {
    const regel = beweging({ type: "naar-leverancier", retourId: "r1", notitie: "Retour naar leverancier" });
    const retour: EmballageRetour = {
      id: "r1", leverancier: "Swinkels", bonnummer: "800758649", gebruikerId: "u1", aangemaaktOp: "",
    };
    expect(emballageBeweging(regel)).toBe("retourbon");
    expect(emballageVerschil(regel)).toBe(-5);
    expect(emballageNotitie(regel, retour)).toBe("Swinkels, bon 800758649");
    expect(emballageNotitie(regel, { ...retour, bonnummer: undefined })).toBe("Swinkels");
  });
});

describe("emballageTotaal", () => {
  it("telt stuks en borg over alle soorten, negatief als 0", () => {
    const regels = emballageOverzicht(
      [
        soort({ id: "e1", naam: "Krat fris", borg: 5 }),
        soort({ id: "e2", naam: "PET-fles", borg: 0.25 }),
        soort({ id: "e5", naam: "Fust", borg: 30 }),
      ],
      [stand("e1", 40), stand("e2", 12), stand("e5", -2)]
    );
    expect(emballageTotaal(regels)).toEqual({ stuks: 52, waarde: 203 });
  });
});
