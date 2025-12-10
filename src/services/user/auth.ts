import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { UserModel } from "../../models/user";
import { normalizePhoneNumber } from "../../lib/validation";
import { User, UserRole } from "@prisma/client";

export interface JWTPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
}

/**
 * User authentication service
 */
export class AuthService {
  /**
   * Generate JWT token for user
   */
  static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as SignOptions);
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error("Token verification failed", { error });
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Authenticate user by phone number
   * Returns user if exists and active, null otherwise
   */
  static async authenticateByPhoneNumber(
    phoneNumber: string,
  ): Promise<User | null> {
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      const user = await UserModel.findByPhoneNumber(normalized);

      if (!user) {
        logger.warn("User not found", { phoneNumber: normalized });
        return null;
      }

      if (!user.isActive) {
        logger.warn("User account is deactivated", { userId: user.id });
        return null;
      }

      // Update last active timestamp
      await UserModel.updateLastActive(user.id);

      return user;
    } catch (error) {
      logger.error("Authentication error", { error, phoneNumber });
      throw error;
    }
  }

  /**
   * Create session token for user
   */
  static createSession(user: User): { token: string; user: User } {
    try {
      const token = this.generateToken(user);

      // Store token hash in user record (optional, for session invalidation)
      // For now, we'll rely on JWT expiration

      return { token, user };
    } catch (error) {
      logger.error("Error creating session", { error, userId: user.id });
      throw error;
    }
  }

  /**
   * Validate user from token
   */
  static async validateUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = this.verifyToken(token);
      const user = await UserModel.findById(payload.userId);

      if (!user || !user.isActive) {
        return null;
      }

      // Check if role changed (token might be stale)
      if (user.role !== payload.role) {
        logger.warn("User role changed, token invalid", {
          userId: user.id,
          tokenRole: payload.role,
          currentRole: user.role,
        });
        return null;
      }

      return user;
    } catch (error) {
      logger.error("Error validating user from token", { error });
      return null;
    }
  }
}

export default AuthService;
