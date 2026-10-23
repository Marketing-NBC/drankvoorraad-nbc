import { describe, expect, it } from "vitest";
import { emballageOverzicht, emballageTotaal } from "./emballage";
import type { EmballageSoort, EmballageStand } from "./types";

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
