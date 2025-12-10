import { LocalAuth } from "whatsapp-web.js";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

/**
 * LocalAuth session management for WhatsApp Web.js
 * Persists session across bot restarts
 */
export function createLocalAuth(): LocalAuth {
  const auth = new LocalAuth({
    dataPath: env.WHATSAPP_SESSION_PATH,
    clientId: "cashflow-bot",
  });

  logger.info("LocalAuth configured", {
    dataPath: env.WHATSAPP_SESSION_PATH,
  });

  return auth;
}

export default createLocalAuth;
