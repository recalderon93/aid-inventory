import { describe, expect, it } from "vitest";
import { formatAppVersion } from "./version";

describe("version", () => {
  it("formats semantic version with v prefix", () => {
    expect(formatAppVersion("1.2.3")).toBe("v1.2.3");
  });
});
