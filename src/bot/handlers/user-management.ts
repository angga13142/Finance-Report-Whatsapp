/**
 * User Management Handler
 * Handles user management commands via WhatsApp (/user add, /user list, /user update, /user delete, /user activate, /user deactivate)
 */

import { Message } from "whatsapp-web.js";
import { UserRole } from "@prisma/client";
import { logger, maskSensitiveData } from "../../lib/logger";
import { UserManagerService } from "../../services/user/manager";
import { FontFormatter, FontStyle } from "../../lib/font-formatter";

/**
 * User Management Handler
 * Provides user management operations via WhatsApp commands
 */
export class UserManagementHandler {
  /**
   * Apply message length limit with truncation
   */
  private static applyLengthLimit(
    message: string,
    maxLength: number = 4096,
  ): string {
    if (message.length <= maxLength) {
      return message;
    }

    const truncated = message.substring(0, maxLength - 3);
    const lastNewline = truncated.lastIndexOf("\n");

    if (lastNewline > maxLength * 0.8) {
      return truncated.substring(0, lastNewline) + "\n...";
    }

    return truncated + "...";
  }

  /**
   * Mask phone number for display
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 8) {
      return phoneNumber;
    }
    const masked = maskSensitiveData(phoneNumber) as string;
    return masked;
  }

  /**
   * Handle /user add command
   */
  static async handleAddUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
    name: string,
    role: string,
  ): Promise<void> {
    try {
      // Validate role
      const validRoles: UserRole[] = ["dev", "boss", "employee", "investor"];
      if (!validRoles.includes(role as UserRole)) {
        await message.reply(
          "❌ Invalid role. Must be: dev, boss, employee, investor",
        );
        return;
      }

      const newUser = await UserManagerService.createUser(
        {
          phoneNumber,
          name,
          role: role as UserRole,
        },
        userId,
        userRole,
      );

      const header = FontFormatter.convert(
        "✅ User created successfully",
        FontStyle.BOLD,
      );
      const phoneMonospace = FontFormatter.convert(
        this.maskPhoneNumber(newUser.phoneNumber),
        FontStyle.MONOSPACE,
      );
      const nameFormatted = FontFormatter.convert(
        newUser.name || "Unknown",
        FontStyle.BOLD,
      );
      const roleFormatted = FontFormatter.convert(
        newUser.role,
        FontStyle.MONOSPACE,
      );

      const responseText = this.applyLengthLimit(
        `${header}\n\n` +
          `Phone: ${phoneMonospace}\n` +
          `Name: ${nameFormatted}\n` +
          `Role: ${roleFormatted}\n` +
          `Status: ${newUser.isActive ? "Active" : "Inactive"}\n`,
      );

      await message.reply(responseText);

      logger.info("User added via WhatsApp command", {
        userId,
        newUserId: newUser.id,
        phoneNumber: this.maskPhoneNumber(newUser.phoneNumber),
        role: newUser.role,
      });
    } catch (error) {
      logger.error("Error adding user via WhatsApp command", {
        error,
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can manage users",
        );
      } else if (errorMessage.includes("already exists")) {
        await message.reply(
          `❌ User with phone number ${this.maskPhoneNumber(phoneNumber)} already exists`,
        );
      } else if (errorMessage.includes("Invalid")) {
        await message.reply(`❌ ${errorMessage}`);
      } else {
        await message.reply(`❌ Failed to create user: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle /user list command
   */
  static async handleListUsers(
    message: Message,
    userId: string,
    _userRole: UserRole,
    roleFilter?: string,
  ): Promise<void> {
    try {
      const filter = roleFilter ? { role: roleFilter as UserRole } : undefined;

      const result = await UserManagerService.listUsers(filter, userId);

      const header = FontFormatter.convert(
        roleFilter ? `👥 Users (${roleFilter} role)` : "👥 All Users",
        FontStyle.BOLD,
      );

      let usersText = `${header}\n\n`;

      if (result.users.length === 0) {
        usersText += "No users found.\n";
      } else {
        result.users.forEach((user, index) => {
          const statusText = user.isActive ? "Active" : "Inactive";
          const phoneMonospace = FontFormatter.convert(
            this.maskPhoneNumber(user.phoneNumber),
            FontStyle.MONOSPACE,
          );
          const nameFormatted = FontFormatter.convert(
            user.name || "Unknown",
            FontStyle.BOLD,
          );

          if (roleFilter) {
            usersText += `${index + 1}. ${phoneMonospace} - ${nameFormatted} (${statusText})\n`;
          } else {
            const roleFormatted = FontFormatter.convert(
              user.role,
              FontStyle.MONOSPACE,
            );
            usersText += `${index + 1}. ${phoneMonospace} - ${nameFormatted} (${roleFormatted}, ${statusText})\n`;
          }
        });
      }

      usersText += `\nTotal: ${result.totalUsers} users`;

      const responseText = this.applyLengthLimit(usersText);

      // Split message if too long
      if (responseText.length > 4000) {
        const chunks = responseText.match(/.{1,4000}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(responseText);
      }

      logger.info("Users listed via WhatsApp command", {
        userId,
        count: result.totalUsers,
        filter,
      });
    } catch (error) {
      logger.error("Error listing users via WhatsApp command", {
        error,
        userId,
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can view users",
        );
      } else if (errorMessage.includes("Invalid role")) {
        await message.reply(
          "❌ Invalid role filter. Must be: dev, boss, employee, investor",
        );
      } else {
        await message.reply(`❌ Failed to list users: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle /user update command
   */
  static async handleUpdateUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
    field: string,
    value: string,
  ): Promise<void> {
    try {
      // Validate field
      const validFields = ["name", "role", "isActive"];
      if (!validFields.includes(field)) {
        await message.reply("❌ Invalid field. Must be: name, role, isActive");
        return;
      }

      // Parse update data
      const updateData: { name?: string; role?: UserRole; isActive?: boolean } =
        {};

      if (field === "name") {
        updateData.name = value;
      } else if (field === "role") {
        const validRoles: UserRole[] = ["dev", "boss", "employee", "investor"];
        if (!validRoles.includes(value as UserRole)) {
          await message.reply(
            `❌ Invalid value for field 'role'. Must be: dev, boss, employee, investor`,
          );
          return;
        }
        updateData.role = value as UserRole;
      } else if (field === "isActive") {
        if (value.toLowerCase() !== "true" && value.toLowerCase() !== "false") {
          await message.reply(
            `❌ Invalid value for field 'isActive'. Must be: true, false`,
          );
          return;
        }
        updateData.isActive = value.toLowerCase() === "true";
      }

      const user = await UserManagerService.updateUser(
        phoneNumber,
        updateData,
        userId,
        userRole,
      );

      const header = FontFormatter.convert(
        "✅ User updated successfully",
        FontStyle.BOLD,
      );
      const phoneMonospace = FontFormatter.convert(
        this.maskPhoneNumber(user.phoneNumber),
        FontStyle.MONOSPACE,
      );
      const fieldFormatted = FontFormatter.convert(field, FontStyle.BOLD);

      const responseText = this.applyLengthLimit(
        `${header}\n\n` +
          `Phone: ${phoneMonospace}\n` +
          `Field: ${fieldFormatted}\n` +
          `New value: ${value}\n`,
      );

      await message.reply(responseText);

      logger.info("User updated via WhatsApp command", {
        userId,
        targetPhone: this.maskPhoneNumber(phoneNumber),
        field,
        value,
      });
    } catch (error) {
      logger.error("Error updating user via WhatsApp command", {
        error,
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        field,
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can update users",
        );
      } else if (errorMessage.includes("not found")) {
        await message.reply(
          `❌ User with phone number ${this.maskPhoneNumber(phoneNumber)} not found`,
        );
      } else if (errorMessage.includes("Invalid")) {
        await message.reply(`❌ ${errorMessage}`);
      } else {
        await message.reply(`❌ Failed to update user: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle /user delete command
   */
  static async handleDeleteUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
  ): Promise<void> {
    try {
      await UserManagerService.deleteUser(phoneNumber, userId, userRole);

      const header = FontFormatter.convert(
        "✅ User deleted successfully",
        FontStyle.BOLD,
      );
      const phoneMonospace = FontFormatter.convert(
        this.maskPhoneNumber(phoneNumber),
        FontStyle.MONOSPACE,
      );

      const responseText = this.applyLengthLimit(
        `${header}\n\n` + `Phone: ${phoneMonospace}\n`,
      );

      await message.reply(responseText);

      logger.info("User deleted via WhatsApp command", {
        userId,
        targetPhone: this.maskPhoneNumber(phoneNumber),
      });
    } catch (error) {
      logger.error("Error deleting user via WhatsApp command", {
        error,
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can delete users",
        );
      } else if (errorMessage.includes("not found")) {
        await message.reply(
          `❌ User with phone number ${this.maskPhoneNumber(phoneNumber)} not found`,
        );
      } else if (errorMessage.includes("Cannot delete dev")) {
        await message.reply("❌ Cannot delete dev role user");
      } else {
        await message.reply(`❌ Failed to delete user: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle /user activate command
   */
  static async handleActivateUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
  ): Promise<void> {
    try {
      const user = await UserManagerService.activateUser(
        phoneNumber,
        userId,
        userRole,
      );

      const header = FontFormatter.convert(
        "✅ User activated successfully",
        FontStyle.BOLD,
      );
      const phoneMonospace = FontFormatter.convert(
        this.maskPhoneNumber(user.phoneNumber),
        FontStyle.MONOSPACE,
      );
      const nameFormatted = FontFormatter.convert(
        user.name || "Unknown",
        FontStyle.BOLD,
      );

      const responseText = this.applyLengthLimit(
        `${header}\n\n` +
          `Phone: ${phoneMonospace}\n` +
          `Name: ${nameFormatted}\n` +
          `Status: Active\n`,
      );

      await message.reply(responseText);

      logger.info("User activated via WhatsApp command", {
        userId,
        targetPhone: this.maskPhoneNumber(phoneNumber),
      });
    } catch (error) {
      logger.error("Error activating user via WhatsApp command", {
        error,
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can activate users",
        );
      } else if (errorMessage.includes("not found")) {
        await message.reply(
          `❌ User with phone number ${this.maskPhoneNumber(phoneNumber)} not found`,
        );
      } else if (errorMessage.includes("already active")) {
        await message.reply("ℹ️ User is already active");
      } else {
        await message.reply(`❌ Failed to activate user: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle /user deactivate command
   */
  static async handleDeactivateUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
  ): Promise<void> {
    try {
      const user = await UserManagerService.deactivateUser(
        phoneNumber,
        userId,
        userRole,
      );

      const header = FontFormatter.convert(
        "✅ User deactivated successfully",
        FontStyle.BOLD,
      );
      const phoneMonospace = FontFormatter.convert(
        this.maskPhoneNumber(user.phoneNumber),
        FontStyle.MONOSPACE,
      );
      const nameFormatted = FontFormatter.convert(
        user.name || "Unknown",
        FontStyle.BOLD,
      );

      const responseText = this.applyLengthLimit(
        `${header}\n\n` +
          `Phone: ${phoneMonospace}\n` +
          `Name: ${nameFormatted}\n` +
          `Status: Inactive\n`,
      );

      await message.reply(responseText);

      logger.info("User deactivated via WhatsApp command", {
        userId,
        targetPhone: this.maskPhoneNumber(phoneNumber),
      });
    } catch (error) {
      logger.error("Error deactivating user via WhatsApp command", {
        error,
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Permission denied")) {
        await message.reply(
          "❌ Permission denied. Only boss and dev roles can deactivate users",
        );
      } else if (errorMessage.includes("not found")) {
        await message.reply(
          `❌ User with phone number ${this.maskPhoneNumber(phoneNumber)} not found`,
        );
      } else if (errorMessage.includes("already inactive")) {
        await message.reply("ℹ️ User is already inactive");
      } else if (errorMessage.includes("Cannot deactivate dev")) {
        await message.reply("❌ Cannot deactivate dev role user");
      } else {
        await message.reply(`❌ Failed to deactivate user: ${errorMessage}`);
      }
    }
  }
}

export default UserManagementHandler;
