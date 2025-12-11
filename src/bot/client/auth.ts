import { LocalAuth } from "whatsapp-web.js";
import { existsSync, statSync, chmodSync, chownSync, rmSync } from "fs";
import { join } from "path";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { setCorrelationId } from "../../lib/correlation";

/**
 * LocalAuth session management for WhatsApp Web.js
 * Persists session across bot restarts with Docker volume support
 */
export function createLocalAuth(): LocalAuth {
  const sessionPath = env.WHATSAPP_SESSION_PATH;
  const clientId = "session-cashflow-bot";
  const fullSessionPath = join(sessionPath, clientId);

  // Ensure session directory exists
  if (!existsSync(sessionPath)) {
    logger.warn("Session directory does not exist, creating", {
      path: sessionPath,
    });
    // Directory will be created by LocalAuth
  }

  // Check and fix permissions for Docker volume (UID 1000, GID 1000, mode 755)
  try {
    if (existsSync(sessionPath)) {
      const stats = statSync(sessionPath);
      const requiredUid = 1000;
      const requiredGid = 1000;
      const requiredMode = 0o755;

      // Check if permissions need fixing
      const needsFix =
        stats.uid !== requiredUid ||
        stats.gid !== requiredGid ||
        (stats.mode & 0o777) !== requiredMode;

      if (needsFix) {
        logger.warn("Fixing session directory permissions", {
          path: sessionPath,
          currentUid: stats.uid,
          currentGid: stats.gid,
          currentMode: stats.mode.toString(8),
          requiredUid,
          requiredGid,
          requiredMode: requiredMode.toString(8),
        });

        try {
          chmodSync(sessionPath, requiredMode);
          chownSync(sessionPath, requiredUid, requiredGid);
          logger.info("Session directory permissions fixed", {
            path: sessionPath,
          });
        } catch (error) {
          logger.error(
            "Failed to fix session directory permissions, will fall back to QR authentication",
            {
              error,
              path: sessionPath,
            },
          );
          // Continue - LocalAuth will handle missing permissions
        }
      }
    }
  } catch (error) {
    logger.warn("Could not check session directory permissions", {
      error,
      path: sessionPath,
    });
    // Continue - LocalAuth will handle errors
  }

  const auth = new LocalAuth({
    dataPath: sessionPath,
    clientId,
  });

  logger.info("LocalAuth configured", {
    dataPath: sessionPath,
    clientId,
    fullPath: fullSessionPath,
  });

  return auth;
}

/**
 * Detect and handle session corruption
 * @param sessionPath - Path to session directory
 * @returns true if session is valid, false if corrupted
 */
export function detectSessionCorruption(sessionPath: string): boolean {
  const correlationId = setCorrelationId("session-check");
  const clientId = "session-cashflow-bot";
  const fullSessionPath = join(sessionPath, clientId);

  try {
    if (!existsSync(fullSessionPath)) {
      logger.debug("Session directory does not exist (first run)", {
        correlationId,
        path: fullSessionPath,
      });
      return false; // Not corrupted, just doesn't exist
    }

    // Check for critical session files
    const criticalFiles = [
      join(fullSessionPath, "Default", "Local Storage", "leveldb"),
      join(fullSessionPath, "Default", "Session Storage"),
    ];

    let hasValidFiles = false;
    for (const file of criticalFiles) {
      if (existsSync(file)) {
        try {
          const stats = statSync(file);
          if (stats.isDirectory() || stats.size > 0) {
            hasValidFiles = true;
            break;
          }
        } catch {
          // File exists but can't be read - might be corrupted
        }
      }
    }

    if (!hasValidFiles) {
      logger.warn("Session corruption detected - no valid session files", {
        correlationId,
        path: fullSessionPath,
      });
      return true; // Corrupted
    }

    logger.debug("Session appears valid", {
      correlationId,
      path: fullSessionPath,
    });
    return false; // Not corrupted
  } catch (error) {
    logger.error("Error detecting session corruption", {
      correlationId,
      error,
      path: fullSessionPath,
    });
    // Assume corrupted on error
    return true;
  }
}

/**
 * Recover from session corruption by deleting corrupted files
 * @param sessionPath - Path to session directory
 */
export function recoverFromSessionCorruption(sessionPath: string): void {
  const correlationId = setCorrelationId("session-recovery");
  const clientId = "session-cashflow-bot";
  const fullSessionPath = join(sessionPath, clientId);

  try {
    if (existsSync(fullSessionPath)) {
      logger.warn("Deleting corrupted session files", {
        correlationId,
        path: fullSessionPath,
      });

      // Delete session directory
      rmSync(fullSessionPath, { recursive: true, force: true });

      logger.info(
        "Corrupted session files deleted, will trigger QR authentication",
        {
          correlationId,
          path: fullSessionPath,
        },
      );
    }
  } catch (error) {
    logger.error("Error recovering from session corruption", {
      correlationId,
      error,
      path: fullSessionPath,
    });
    // Continue - QR authentication will be triggered
  }
}

export default createLocalAuth;
