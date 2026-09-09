import { describe, expect, it } from "vitest";
import { formatDateTime, loginHref, plural, safeNext, timeAgo } from "./format";

describe("timeAgo", () => {
  const base = Date.UTC(2024, 0, 10, 12, 0, 0); // 2024-01-10 12:00:00 UTC

  it("returns 'à l'instant' for less than a minute", () => {
    const value = "2024-01-10 11:59:30";
    expect(timeAgo(value, base)).toBe("à l'instant");
  });

  it("returns minutes for less than an hour", () => {
    const value = "2024-01-10 11:55:00";
    expect(timeAgo(value, base)).toBe("5 min");
  });

  it("returns hours for less than a day", () => {
    const value = "2024-01-10 09:00:00";
    expect(timeAgo(value, base)).toBe("3 h");
  });

  it("returns 'hier' for exactly one day", () => {
    const value = "2024-01-09 12:00:00";
    expect(timeAgo(value, base)).toBe("hier");
  });

  it("returns days for less than a week", () => {
    const value = "2024-01-06 12:00:00";
    expect(timeAgo(value, base)).toBe("4 j");
  });

  it("falls back to a formatted date after a week", () => {
    const value = "2023-12-01 12:00:00";
    expect(timeAgo(value, base)).toBe("1 déc. 2023");
  });

  it("never returns a negative duration for a future date", () => {
    const value = "2024-01-10 12:05:00";
    expect(timeAgo(value, base)).toBe("à l'instant");
  });
});

describe("formatDateTime", () => {
  it("formats a SQL-style UTC timestamp in French, tagged UTC", () => {
    expect(formatDateTime("2024-03-05 08:30:00")).toBe("5 mars 2024 à 08:30 (UTC)");
  });
});

describe("plural", () => {
  it("uses the singular form for 1", () => {
    expect(plural(1, "idée")).toBe("1 idée");
  });

  it("uses the singular form for 0 as well (only n > 1 pluralizes)", () => {
    expect(plural(0, "idée")).toBe("0 idée");
  });

  it("uses the default pluralization (adds 's') above 1", () => {
    expect(plural(5, "idée")).toBe("5 idées");
  });

  it("uses a custom plural form when provided", () => {
    expect(plural(3, "cheval", "chevaux")).toBe("3 chevaux");
    expect(plural(1, "cheval", "chevaux")).toBe("1 cheval");
  });
});

describe("loginHref", () => {
  it("returns the bare login path when there is no next", () => {
    expect(loginHref()).toBe("/login");
  });

  it("returns the bare login path when next is the home page", () => {
    expect(loginHref("/")).toBe("/login");
  });

  it("appends an encoded next param otherwise", () => {
    expect(loginHref("/ideas/12")).toBe("/login?next=%2Fideas%2F12");
  });
});

describe("safeNext", () => {
  it("rejects non-string values", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(42)).toBe("/");
  });

  it("rejects values that don't start with a slash", () => {
    expect(safeNext("evil.com")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.com")).toBe("/");
  });

  it("rejects paths containing a backslash", () => {
    expect(safeNext("/foo\\bar")).toBe("/");
  });

  it("accepts a plain internal path", () => {
    expect(safeNext("/ideas/12")).toBe("/ideas/12");
  });

  it("honors a custom fallback", () => {
    expect(safeNext("//evil.com", "/home")).toBe("/home");
  });
});
