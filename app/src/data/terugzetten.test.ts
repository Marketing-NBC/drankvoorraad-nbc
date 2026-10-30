import { describe, expect, it } from "vitest";
import { gisteren, terugzetMoment } from "./terugzetten";

describe("terugzetMoment", () => {
  it("maakt van datum en tijd een tijdstip in de eigen tijdzone", () => {
    const moment = terugzetMoment("2026-10-29", "07:30");
    expect(moment).toEqual(new Date(2026, 9, 29, 7, 30));
  });

  it("neemt middernacht als er geen tijd is", () => {
    expect(terugzetMoment("2026-10-29", "")).toEqual(new Date(2026, 9, 29, 0, 0));
  });

  it("weigert een lege of onmogelijke datum", () => {
    expect(terugzetMoment("", "07:00")).toBeNull();
    expect(terugzetMoment("2026-02-31", "07:00")).toBeNull();
    expect(terugzetMoment("2026-10-29", "25:00")).toBeNull();
  });
});

describe("gisteren", () => {
  it("geeft de dag ervoor, ook over de maandgrens", () => {
    expect(gisteren(new Date(2026, 10, 1, 9, 0))).toBe("2026-10-31");
    expect(gisteren(new Date(2026, 0, 1, 0, 5))).toBe("2025-12-31");
  });
});
