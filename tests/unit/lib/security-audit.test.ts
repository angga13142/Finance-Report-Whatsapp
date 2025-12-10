/**
 * Unit tests for security audit utilities
 * Tests SQL injection prevention verification and security policy documentation
 */

import { verifySQLInjectionPrevention } from "../../../src/lib/security-audit";

describe("Security Audit Utilities", () => {
  describe("verifySQLInjectionPrevention", () => {
    it("should verify SQL injection prevention measures", async () => {
      const result = await verifySQLInjectionPrevention();

      expect(result.status).toBe("secure");
      expect(result.message).toContain("SQL injection prevention verified");
      expect(result.details).toBeInstanceOf(Array);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it("should include security verification details", async () => {
      const result = await verifySQLInjectionPrevention();

      expect(
        result.details.some((detail: string) => detail.includes("Prisma ORM")),
      ).toBe(true);
      expect(
        result.details.some((detail: string) =>
          detail.includes("parameterized"),
        ),
      ).toBe(true);
      expect(
        result.details.some((detail: string) => detail.includes("SSL/TLS")),
      ).toBe(true);
    });

    it("should return secure status", async () => {
      const result = await verifySQLInjectionPrevention();

      expect(result.status).toBe("secure");
      expect(result.status).not.toBe("warning");
      expect(result.status).not.toBe("critical");
    });

    it("should provide detailed security information", async () => {
      const result = await verifySQLInjectionPrevention();

      expect(result.details).toEqual(
        expect.arrayContaining([expect.stringContaining("✓")]),
      );
    });
  });
});
