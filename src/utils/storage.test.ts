import { afterEach, describe, expect, it, vi } from "vitest";
import { numberValidator, stringValidator, withStorageErrorBoundary } from "./storage";

describe("numberValidator", () => {
  it("accepts finite numbers by default", () => {
    const isNum = numberValidator();
    expect(isNum(0)).toBe(true);
    expect(isNum(-1.5)).toBe(true);
    expect(isNum(NaN)).toBe(false);
    expect(isNum(Infinity)).toBe(false);
    expect(isNum("1")).toBe(false);
  });
  it("supports an additional guard", () => {
    const isPositiveInt = numberValidator((n) => Number.isInteger(n) && n > 0);
    expect(isPositiveInt(3)).toBe(true);
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
  });
});

describe("stringValidator", () => {
  const isStr = stringValidator();
  it("accepts strings", () => expect(isStr("hello")).toBe(true));
  it("accepts empty strings", () => expect(isStr("")).toBe(true));
  it("rejects non-strings", () => {
    expect(isStr(1)).toBe(false);
    expect(isStr(null)).toBe(false);
    expect(isStr(undefined)).toBe(false);
    expect(isStr({})).toBe(false);
  });
  it("supports nullable variant", () => {
    const nullable = stringValidator({ nullable: true });
    expect(nullable(null)).toBe(true);
    expect(nullable("x")).toBe(true);
    expect(nullable(1)).toBe(false);
  });
});

describe("withStorageErrorBoundary", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the default value when the key is absent", () => {
    expect(withStorageErrorBoundary("missing", "fallback").get()).toBe("fallback");
  });

  it("reads and parses an existing string value", () => {
    localStorage.setItem("k1", "hello");
    expect(withStorageErrorBoundary("k1", "default").get()).toBe("hello");
  });

  it("uses schema.parse for typed deserialization", () => {
    localStorage.setItem("count", "42");
    const boundary = withStorageErrorBoundary<number>("count", 0, {
      parse: (raw) => Number(raw),
      serialize: (v) => String(v),
    });
    expect(boundary.get()).toBe(42);
  });

  it("falls back to the default when parse throws (corrupt JSON)", () => {
    localStorage.setItem("json", "{not valid json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boundary = withStorageErrorBoundary("json", { ok: true }, {
      parse: (raw) => JSON.parse(raw),
      serialize: (v) => JSON.stringify(v),
    });
    expect(boundary.get()).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith(
      "localStorage.getItem failed",
      expect.objectContaining({ key: "json" }),
    );
  });

  it("returns the default and warns when getItem throws (e.g. blocked storage)", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(withStorageErrorBoundary("k", "default").get()).toBe("default");
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("set serializes and persists a value", () => {
    const boundary = withStorageErrorBoundary<number>("n", 0, {
      serialize: (v) => String(v),
    });
    boundary.set(7);
    expect(localStorage.getItem("n")).toBe("7");
  });

  it("set warns and swallows quota errors", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => withStorageErrorBoundary("k", "x").set("y")).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      "localStorage.setItem failed",
      expect.objectContaining({ key: "k" }),
    );
    spy.mockRestore();
  });

  it("remove deletes the key", () => {
    localStorage.setItem("rm", "1");
    withStorageErrorBoundary("rm", null).remove();
    expect(localStorage.getItem("rm")).toBeNull();
  });

  it("remove warns and swallows errors", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("nope");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => withStorageErrorBoundary("rm", null).remove()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("getRaw returns the underlying string without parsing", () => {
    localStorage.setItem("raw", "literal");
    expect(withStorageErrorBoundary("raw", null).getRaw()).toBe("literal");
  });

  it("getRaw returns null on error", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("oops");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(withStorageErrorBoundary("k", null).getRaw()).toBeNull();
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
  });
});
