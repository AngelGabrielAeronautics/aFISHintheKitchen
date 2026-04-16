import { describe, it, expect } from "vitest";
import { formatTime, getCategoryBySlug, CATEGORIES } from "../types";

describe("formatTime", () => {
  it("returns minutes only when under an hour", () => {
    expect(formatTime(0)).toBe("0 min");
    expect(formatTime(1)).toBe("1 min");
    expect(formatTime(59)).toBe("59 min");
  });

  it("returns whole hours with no trailing minutes", () => {
    expect(formatTime(60)).toBe("1 hr");
    expect(formatTime(120)).toBe("2 hr");
    expect(formatTime(180)).toBe("3 hr");
  });

  it("returns hours and minutes when there is a remainder", () => {
    expect(formatTime(61)).toBe("1 hr 1 min");
    expect(formatTime(90)).toBe("1 hr 30 min");
    expect(formatTime(125)).toBe("2 hr 5 min");
  });
});

describe("getCategoryBySlug", () => {
  it("returns the matching category info", () => {
    const mains = getCategoryBySlug("mains");
    expect(mains).toBeDefined();
    expect(mains?.slug).toBe("mains");
    expect(mains?.name).toBe("Mains");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getCategoryBySlug("not-a-category")).toBeUndefined();
    expect(getCategoryBySlug("")).toBeUndefined();
  });

  it("resolves every slug in the CATEGORIES table", () => {
    for (const c of CATEGORIES) {
      expect(getCategoryBySlug(c.slug)).toEqual(c);
    }
  });
});
