import { describe, expect, it, vi } from "vitest";
import {
  DAYS,
  dayKeyForDate,
  formatDateRange,
  getMondayOfWeek,
  getTodayDayKey,
  getWeekId,
  normalizeMeals,
  planDocId,
  type MealAssignment,
} from "../meal-planner";

describe("DAYS", () => {
  it("lists 7 days in Monday-first order", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS.map((d) => d.key)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]);
  });
});

describe("getWeekId", () => {
  // Reference cases: dates chosen against ISO 8601 week definitions.
  it("uses ISO-8601 week numbering (week 1 contains Jan 4)", () => {
    // 2026-01-01 is a Thursday, part of week 1 by ISO rules.
    expect(getWeekId(new Date(2026, 0, 1))).toBe("2026-W01");
    expect(getWeekId(new Date(2026, 0, 4))).toBe("2026-W01");
  });

  it("returns the same id for every day of the same ISO week", () => {
    const monday = new Date(2026, 3, 13); // Mon 13 Apr 2026, week 16
    const sunday = new Date(2026, 3, 19);
    expect(getWeekId(monday)).toBe(getWeekId(sunday));
    expect(getWeekId(monday)).toBe("2026-W16");
  });

  it("increments the week on the following Monday", () => {
    const sunday = new Date(2026, 3, 19); // Sun 19 Apr, W16
    const nextMonday = new Date(2026, 3, 20); // Mon 20 Apr, W17
    expect(getWeekId(sunday)).toBe("2026-W16");
    expect(getWeekId(nextMonday)).toBe("2026-W17");
  });

  it("zero-pads the week number", () => {
    expect(getWeekId(new Date(2026, 0, 5))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("handles the ISO year boundary (late-December days can belong to next year's W01)", () => {
    // 2025 has 52 ISO weeks. Sun 28 Dec 2025 is the last day of 2025-W52;
    // Mon 29 Dec 2025 begins 2026-W01 because that week contains Jan 1 2026
    // (a Thursday), and ISO week 1 is the week containing the year's first
    // Thursday.
    expect(getWeekId(new Date(2025, 11, 28))).toBe("2025-W52");
    expect(getWeekId(new Date(2025, 11, 29))).toBe("2026-W01");
  });
});

describe("getMondayOfWeek", () => {
  it("returns the Monday for any weekday input", () => {
    for (let day = 0; day <= 6; day++) {
      const d = new Date(2026, 3, 13 + day); // Mon 13 Apr 2026 + offset
      const mon = getMondayOfWeek(d);
      expect(mon.getFullYear()).toBe(2026);
      expect(mon.getMonth()).toBe(3);
      expect(mon.getDate()).toBe(13);
      expect(mon.getHours()).toBe(0);
      expect(mon.getMinutes()).toBe(0);
    }
  });

  it("wraps Sunday back to the PREVIOUS Monday, not forward to the next", () => {
    const sunday = new Date(2026, 3, 19);
    const mon = getMondayOfWeek(sunday);
    expect(mon.getDate()).toBe(13);
  });

  it("does not mutate the input date", () => {
    const original = new Date(2026, 3, 15, 10, 30);
    const originalTime = original.getTime();
    getMondayOfWeek(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe("formatDateRange", () => {
  it("renders 'd MMM - d MMM' from Monday through Sunday", () => {
    const monday = new Date(2026, 3, 13);
    expect(formatDateRange(monday)).toBe("13 Apr - 19 Apr");
  });

  it("crosses month boundaries", () => {
    const monday = new Date(2026, 3, 27); // Mon 27 Apr → Sun 3 May
    expect(formatDateRange(monday)).toBe("27 Apr - 3 May");
  });
});

describe("dayKeyForDate + getTodayDayKey", () => {
  it("maps every weekday to the correct DayKey", () => {
    const monday = new Date(2026, 3, 13); // Mon
    expect(dayKeyForDate(monday)).toBe("monday");
    expect(dayKeyForDate(new Date(2026, 3, 14))).toBe("tuesday");
    expect(dayKeyForDate(new Date(2026, 3, 15))).toBe("wednesday");
    expect(dayKeyForDate(new Date(2026, 3, 16))).toBe("thursday");
    expect(dayKeyForDate(new Date(2026, 3, 17))).toBe("friday");
    expect(dayKeyForDate(new Date(2026, 3, 18))).toBe("saturday");
    expect(dayKeyForDate(new Date(2026, 3, 19))).toBe("sunday");
  });

  it("getTodayDayKey delegates to dayKeyForDate(new Date())", () => {
    vi.useFakeTimers();
    try {
      // Wed 15 Apr 2026 local
      vi.setSystemTime(new Date(2026, 3, 15, 12, 0));
      expect(getTodayDayKey()).toBe("wednesday");
    } finally {
      // Always restore, even if the assertion throws, so faked timers
      // can't leak into the tests that follow.
      vi.useRealTimers();
    }
  });
});

describe("planDocId", () => {
  it("joins uid and weekId with a '_'", () => {
    expect(planDocId("alice", "2026-W16")).toBe("alice_2026-W16");
  });
});

describe("normalizeMeals", () => {
  const assignment: MealAssignment = {
    recipeId: "r1",
    title: "Bread",
    slug: "bread",
  };

  it("returns {} for null / undefined / non-object input", () => {
    expect(normalizeMeals(null)).toEqual({});
    expect(normalizeMeals(undefined)).toEqual({});
    expect(normalizeMeals("string")).toEqual({});
    expect(normalizeMeals(42)).toEqual({});
  });

  it("passes through per-day arrays untouched", () => {
    const raw = { monday: [assignment], friday: [assignment, assignment] };
    expect(normalizeMeals(raw)).toEqual(raw);
  });

  it("wraps a legacy single-object meal into an array (data migration)", () => {
    const raw = { monday: assignment };
    expect(normalizeMeals(raw)).toEqual({ monday: [assignment] });
  });

  it("drops values that are neither arrays nor recipeId-shaped objects", () => {
    const raw = {
      monday: null,
      tuesday: undefined,
      wednesday: "junk",
      thursday: { unrelated: true },
      friday: [assignment],
    };
    expect(normalizeMeals(raw)).toEqual({ friday: [assignment] });
  });

  it("ignores keys that aren't valid DayKeys", () => {
    const raw = {
      monday: [assignment],
      funday: [assignment],
      "": [assignment],
    };
    expect(normalizeMeals(raw)).toEqual({ monday: [assignment] });
  });

  it("does not preserve the raw object identity", () => {
    const raw = { monday: [assignment] };
    const out = normalizeMeals(raw);
    expect(out).not.toBe(raw);
  });
});
