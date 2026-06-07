import { describe, it, expect } from "vitest";
import { en } from "./en";
import { es } from "./es";

// Walks an object and yields every leaf key path.
function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? leafPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n/help", () => {
  it("en and es expose the same help key paths", () => {
    const enPaths = leafPaths(en.help as unknown as Record<string, unknown>, "help").sort();
    const esPaths = leafPaths(es.help as unknown as Record<string, unknown>, "help").sort();
    expect(esPaths).toEqual(enPaths);
  });

  it("no help string is empty", () => {
    const enPaths = leafPaths(en.help as unknown as Record<string, unknown>);
    for (const value of Object.values(flatten(en.help))) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
    expect(enPaths.length).toBeGreaterThan(0);
  });
});

// Flattens nested string objects into a single-level record of leaf values.
function flatten(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      Object.assign(out, flatten(value as Record<string, unknown>));
    } else {
      out[key] = value;
    }
  }
  return out;
}
