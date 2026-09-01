import { describe, expect, it } from "vitest";
import { hasPermission, canPriceOverride } from "./permissions";

describe("permissions", () => {
  it("staff cannot cancel bills", () => {
    expect(hasPermission("staff", "bill:cancel")).toBe(false);
  });

  it("admin can cancel and refund", () => {
    expect(hasPermission("admin", "bill:cancel")).toBe(true);
    expect(hasPermission("admin", "bill:refund")).toBe(true);
  });

  it("staff cannot override prices by default", () => {
    expect(canPriceOverride("staff", false)).toBe(false);
  });

  it("owner can override prices", () => {
    expect(canPriceOverride("owner", false)).toBe(true);
  });
});
