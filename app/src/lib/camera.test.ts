import { describe, expect, it } from "vitest";
import { kiesHoofdcamera } from "./camera";

describe("hoofdcamera kiezen", () => {
  it("kiest op een Samsung met meerdere lenzen de achtercamera met het laagste nummer", () => {
    expect(
      kiesHoofdcamera([
        { deviceId: "voor", label: "camera2 1, facing front" },
        { deviceId: "groothoek", label: "camera2 2, facing back" },
        { deviceId: "hoofd", label: "camera2 0, facing back" },
        { deviceId: "tele", label: "camera2 3, facing back" },
      ])
    ).toBe("hoofd");
  });

  it("laat de keuze aan de browser bij één achtercamera", () => {
    expect(
      kiesHoofdcamera([
        { deviceId: "voor", label: "camera2 1, facing front" },
        { deviceId: "achter", label: "camera2 0, facing back" },
      ])
    ).toBeUndefined();
  });

  it("laat de keuze aan de browser als de namen onbekend zijn, zoals op een iPhone", () => {
    expect(
      kiesHoofdcamera([
        { deviceId: "a", label: "Back Camera" },
        { deviceId: "b", label: "Back Ultra Wide Camera" },
        { deviceId: "c", label: "Front Camera" },
      ])
    ).toBeUndefined();
  });

  it("laat de keuze aan de browser zonder namen (nog geen toestemming)", () => {
    expect(kiesHoofdcamera([{ deviceId: "", label: "" }, { deviceId: "", label: "" }])).toBeUndefined();
  });
});
