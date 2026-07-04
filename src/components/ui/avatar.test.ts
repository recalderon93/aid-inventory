import { describe, expect, it } from "vitest";
import { getInitials } from "@/components/ui/avatar";

describe("getInitials", () => {
  it("uses first and last name initials", () => {
    expect(getInitials("Rafael", "Calderon")).toBe("RC");
  });

  it("falls back to single name parts", () => {
    expect(getInitials("Rafael", null)).toBe("Ra");
    expect(getInitials(null, "Calderon")).toBe("Ca");
  });

  it("parses fallback display name", () => {
    expect(getInitials(null, null, "Rafael Calderon")).toBe("RC");
    expect(getInitials(null, null, "Admin")).toBe("Ad");
  });

  it("falls back to role then question mark", () => {
    expect(getInitials(null, null, null, "admin")).toBe("AD");
    expect(getInitials(null, null, null, null)).toBe("?");
  });
});
