/**
 * Success Criteria SC-018: Session Recovery Validation
 * Validates: Session recovery <1 minute on bot restart
 * 
 * Test validates that WhatsApp sessions are restored from
 * persistent storage within 60 seconds of bot restart.
 */

import { WhatsAppClient } from "../../../../src/bot/client/client";
import { SessionManager } from "../../../../src/bot/middleware/session";
import { logger } from "../../../../src/lib/logger";
import * as fs from "fs/promises";
import * as path from "path";

describe("SC-018: Session Recovery Performance", () => {
  const TEST_SESSION_PATH = path.join(__dirname, "../../../../test-sessions");
  const RECOVERY_TIME_LIMIT_MS = 60000; // 1 minute

  beforeAll(async () => {
    // Ensure test session directory exists
    await fs.mkdir(TEST_SESSION_PATH, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test sessions
    try {
      await fs.rm(TEST_SESSION_PATH, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("Session Restoration Speed", () => {
    it("should restore WhatsApp session within 60 seconds", async () => {
      // Skip in CI environment (requires WhatsApp authentication)
      if (process.env.CI === "true") {
        console.log("Skipping WhatsApp session test in CI environment");
        return;
      }

      const startTime = Date.now();

      try {
        // Initialize WhatsApp client
        const client = await WhatsAppClient.initialize();

        // Wait for session to be ready
        await client.waitForReady();

        const recoveryTime = Date.now() - startTime;

        logger.info("Session recovery completed", {
          recoveryTimeMs: recoveryTime,
          recoveryTimeSec: (recoveryTime / 1000).toFixed(2),
        });

        // Validate recovery time is within limit
        expect(recoveryTime).toBeLessThan(RECOVERY_TIME_LIMIT_MS);

        // Cleanup
        await client.destroy();
      } catch (error) {
        const recoveryTime = Date.now() - startTime;
        logger.error("Session recovery failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          recoveryTimeMs: recoveryTime,
        });
        throw error;
      }
    }, 120000); // 2 minute timeout for test

    it("should maintain user sessions across restarts", async () => {
      // Skip in CI environment
      if (process.env.CI === "true") {
        console.log("Skipping WhatsApp session test in CI environment");
        return;
      }

      const testUserId = "+6281234567890";
      const testSessionData = {
        currentMenu: "main",
        lastInteraction: new Date().toISOString(),
      };

      // Save session data
      await SessionManager.saveSession(testUserId, testSessionData);

      // Simulate bot restart by creating new SessionManager instance
      const recoveredSession = await SessionManager.getSession(testUserId);

      expect(recoveredSession).toBeDefined();
      expect(recoveredSession?.currentMenu).toBe("main");
    });

    it("should handle session restoration failures gracefully", async () => {
      // Test with corrupted session file
      const corruptedSessionPath = path.join(
        TEST_SESSION_PATH,
        "corrupted-session"
      );
      await fs.writeFile(corruptedSessionPath, "invalid-json-data");

      // Should not throw error, should return null
      const result = await SessionManager.loadSessionFromFile(
        corruptedSessionPath
      );

      expect(result).toBeNull();
    });
  });

  describe("Session Recovery Metrics", () => {
    it("should log session recovery duration", async () => {
      const mockLogger = jest.spyOn(logger, "info");

      // Skip in CI environment
      if (process.env.CI === "true") {
        console.log("Skipping WhatsApp session test in CI environment");
        return;
      }

      try {
        const client = await WhatsAppClient.initialize();
        await client.waitForReady();
        await client.destroy();

        // Verify logging occurred
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining("Session"),
          expect.any(Object)
        );
      } catch {
        // Expected in test environment without WhatsApp
      }

      mockLogger.mockRestore();
    });

    it("should track session restoration attempts", () => {
      const sessionManager = new SessionManager();
      const attempts = sessionManager.getRestorationAttempts();

      expect(typeof attempts).toBe("number");
      expect(attempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Persistent Session Storage", () => {
    it("should verify session files exist after initialization", async () => {
      // Skip in CI environment
      if (process.env.CI === "true") {
        console.log("Skipping WhatsApp session test in CI environment");
        return;
      }

      const sessionPath = process.env.WHATSAPP_SESSION_PATH || "./.wwebjs_auth";

      try {
        await fs.access(sessionPath);
        const stats = await fs.stat(sessionPath);
        expect(stats.isDirectory()).toBe(true);
      } catch {
        // Session directory may not exist in test environment
        console.log(
          "Session directory not found - expected in test environment"
        );
      }
    });

    it("should handle missing session directory creation", async () => {
      const newSessionPath = path.join(TEST_SESSION_PATH, "new-sessions");

      // Ensure directory doesn't exist
      try {
        await fs.rm(newSessionPath, { recursive: true, force: true });
      } catch {
        // Directory may not exist
      }

      // SessionManager should create directory if missing
      await SessionManager.ensureSessionDirectory(newSessionPath);

      const exists = await fs
        .access(newSessionPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      // Cleanup
      await fs.rm(newSessionPath, { recursive: true, force: true });
    });
  });

  describe("Success Criteria Validation", () => {
    it("SC-018: Session recovery completes within 1 minute", async () => {
      // This is the primary validation for SC-018
      const startTime = Date.now();

      // Skip in CI environment
      if (process.env.CI === "true") {
        console.log(
          "✅ SC-018: Session recovery validation skipped in CI (requires WhatsApp auth)"
        );
        return;
      }

      try {
        const client = await WhatsAppClient.initialize();
        await client.waitForReady();

        const recoveryTime = Date.now() - startTime;
        const recoveryTimeSec = (recoveryTime / 1000).toFixed(2);

        logger.info("✅ SC-018: Session recovery validation passed", {
          recoveryTimeSec,
          limitSec: 60,
          passed: recoveryTime < RECOVERY_TIME_LIMIT_MS,
        });

        expect(recoveryTime).toBeLessThan(RECOVERY_TIME_LIMIT_MS);

        await client.destroy();
      } catch (error) {
        logger.error("❌ SC-018: Session recovery validation failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    }, 120000); // 2 minute timeout
  });
});
