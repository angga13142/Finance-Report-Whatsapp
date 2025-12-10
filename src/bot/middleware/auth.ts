import { Message } from "whatsapp-web.js";
import { AuthService } from "../../services/user/auth";
import { UserModel } from "../../models/user";
import { logger } from "../../lib/logger";
import { normalizePhoneNumber } from "../../lib/validation";
import { User } from "@prisma/client";

export interface AuthenticatedMessage extends Message {
  user?: User;
}

/**
 * Authentication middleware
 * Extracts user from message and attaches to message object
 */
export class AuthMiddleware {
  /**
   * Authenticate user from WhatsApp message
   */
  static async authenticate(message: Message): Promise<User | null> {
    try {
      const phoneNumber = message.from.replace("@c.us", "");
      const normalized = normalizePhoneNumber(phoneNumber);

      const user = await AuthService.authenticateByPhoneNumber(normalized);

      if (!user) {
        logger.warn("User not found or inactive", { phoneNumber: normalized });
        return null;
      }

      // Update last active
      await UserModel.updateLastActive(user.id);

      return user;
    } catch (error) {
      logger.error("Authentication error", { error, from: message.from });
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static async requireAuth(message: Message): Promise<User> {
    const user = await this.authenticate(message);

    if (!user) {
      throw new Error("User not authenticated or account inactive");
    }

    return user;
  }

  /**
   * Attach user to message object
   */
  static async attachUser(message: Message): Promise<AuthenticatedMessage> {
    const user = await this.authenticate(message);
    return { ...message, user: user || undefined } as AuthenticatedMessage;
  }
}

export default AuthMiddleware;
