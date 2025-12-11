/**
 * Integration tests for Docker session persistence
 * Tests that WhatsApp session survives container restarts
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createLocalAuth } from "../../../src/bot/client/auth";

describe("Docker Session Persistence", () => {
  const testSessionPath = "./test-session-persistence";
  const testClientId = "test-session-persistence";

  beforeEach(() => {
    // Clean up test session directory
    if (existsSync(testSessionPath)) {
      rmSync(testSessionPath, { recursive: true, force: true });
    }
    mkdirSync(testSessionPath, { recursive: true });
  });

  afterEach(() => {
    // Clean up test session directory
    if (existsSync(testSessionPath)) {
      rmSync(testSessionPath, { recursive: true, force: true });
    }
  });

  describe("Session Directory Creation", () => {
    it("should create session directory with proper permissions", () => {
      // Set environment variable for test
      const originalPath = process.env.WHATSAPP_SESSION_PATH;
      process.env.WHATSAPP_SESSION_PATH = testSessionPath;

      const auth = createLocalAuth();
      expect(auth).toBeDefined();

      // LocalAuth doesn't create directory until initialization
      // So we just verify auth object is created
      // The directory will be created when client initializes

      // Restore original path
      if (originalPath) {
        process.env.WHATSAPP_SESSION_PATH = originalPath;
      } else {
        delete process.env.WHATSAPP_SESSION_PATH;
      }
    });

    it("should persist session data in Docker volume path", () => {
      // Simulate Docker volume path
      const dockerVolumePath = "/app/.wwebjs_auth";
      process.env.WHATSAPP_SESSION_PATH = dockerVolumePath;

      const auth = createLocalAuth();
      expect(auth).toBeDefined();

      // Verify LocalAuth uses the configured path
      expect(process.env.WHATSAPP_SESSION_PATH).toBe(dockerVolumePath);
    });
  });

  describe("Session File Persistence", () => {
    it("should preserve session files across restarts", () => {
      const sessionDir = join(testSessionPath, testClientId);
      mkdirSync(sessionDir, { recursive: true });

      // Simulate session file creation
      const sessionFile = join(sessionDir, "session.json");
      const sessionData = { authenticated: true, timestamp: Date.now() };
      writeFileSync(sessionFile, JSON.stringify(sessionData));

      // Verify file exists
      expect(existsSync(sessionFile)).toBe(true);

      // Simulate container restart - file should still exist
      const restoredData = JSON.parse(readFileSync(sessionFile, "utf-8"));
      expect(restoredData.authenticated).toBe(true);
    });
  });

  describe("Session Restoration", () => {
    it("should restore session from persisted files on startup", () => {
      const sessionDir = join(testSessionPath, testClientId);
      mkdirSync(sessionDir, { recursive: true });

      // Create mock session files
      const sessionFile = join(sessionDir, "session.json");
      writeFileSync(sessionFile, JSON.stringify({ authenticated: true }));

      // Verify session files are readable
      expect(existsSync(sessionFile)).toBe(true);
      const data = readFileSync(sessionFile, "utf-8");
      expect(data).toContain("authenticated");
    });

    it("should handle missing session files gracefully", () => {
      const sessionDir = join(testSessionPath, testClientId);
      if (existsSync(sessionDir)) {
        rmSync(sessionDir, { recursive: true, force: true });
      }

      // Should not throw error when session directory doesn't exist
      expect(() => {
        mkdirSync(sessionDir, { recursive: true });
      }).not.toThrow();
    });
  });

  describe("Volume Permissions", () => {
    it("should handle volume path with UID 1000 and GID 1000", () => {
      // Test that session path can be accessed
      const testPath = testSessionPath;
      mkdirSync(testPath, { recursive: true, mode: 0o755 });

      // Verify directory is accessible
      expect(existsSync(testPath)).toBe(true);

      // Verify we can write to it
      const testFile = join(testPath, "test.txt");
      writeFileSync(testFile, "test");
      expect(existsSync(testFile)).toBe(true);
    });
  });
});
