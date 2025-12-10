import { Message } from "whatsapp-web.js";
import { logger } from "../../lib/logger";
import { UserService } from "../../services/user/service";
import { HealthMonitoringService } from "../../services/system/health";
import { AuditLogModel } from "../../models/audit";
import { AuditLogger } from "../../services/audit/logger";
import { UserRole } from "@prisma/client";

/**
 * Admin handler for Dev role
 * Provides system health monitoring, user management, audit logs, and configuration
 */
export class AdminHandler {
  /**
   * Handle admin menu command
   */
  static async handleAdminMenu(
    message: Message,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    try {
      // Only Dev role can access admin menu
      if (userRole !== "dev") {
        await message.reply(
          "⛔ *AKSES DITOLAK*\n\nAnda tidak memiliki izin untuk mengakses menu admin.",
        );

        await AuditLogger.logPermissionDenied(
          userId,
          "access_admin_menu",
          "admin_menu",
        );

        return;
      }

      const menuText = `
🔧 *MENU ADMIN (DEV)*

📊 *Monitoring*
1️⃣ \`health\` - System Health Dashboard
2️⃣ \`metrics\` - System Metrics

👥 *User Management*
3️⃣ \`users\` - List All Users
4️⃣ \`user add\` - Add New User
5️⃣ \`user edit [phone]\` - Edit User
6️⃣ \`user deactivate [phone]\` - Deactivate User
7️⃣ \`user activate [phone]\` - Activate User
8️⃣ \`user reset [phone]\` - Reset User Session

📝 *Audit Logs*
9️⃣ \`audit recent\` - Recent Audit Logs (last 50)
🔟 \`audit user [phone]\` - User Audit Logs
1️⃣1️⃣ \`audit action [action]\` - Logs by Action

⚙️ *System*
1️⃣2️⃣ \`config\` - View Configuration
1️⃣3️⃣ \`stats\` - Detailed Statistics

Ketik perintah untuk melanjutkan.
`.trim();

      await message.reply(menuText);

      logger.info("Admin menu displayed", { userId, userRole });
    } catch (error) {
      logger.error("Error handling admin menu", { error, userId });
      await message.reply("❌ Terjadi kesalahan saat menampilkan menu admin.");
    }
  }

  /**
   * Handle health dashboard command
   */
  static async handleHealthDashboard(
    message: Message,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply(
          "⛔ Akses ditolak. Hanya Dev yang dapat melihat health dashboard.",
        );
        return;
      }

      await message.reply("🔍 Memeriksa system health...");

      const health = await HealthMonitoringService.getSystemHealth();

      // Log audit
      await AuditLogger.logHealthCheck(userId, {
        overall: health.overall,
        timestamp: health.timestamp.toISOString(),
      });

      const statusEmoji = {
        healthy: "✅",
        degraded: "⚠️",
        unhealthy: "❌",
      };

      const healthText = `
🏥 *SYSTEM HEALTH DASHBOARD*
📅 ${health.timestamp.toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
⏱️ Uptime: ${HealthMonitoringService.getUptimeFormatted()}

🎯 *Overall Status*: ${statusEmoji[health.overall]} *${health.overall.toUpperCase()}*

📊 *Components*

🗄️ *Database*: ${statusEmoji[health.components.database.status]} ${health.components.database.status}
  └─ ${health.components.database.message}
  └─ Response: ${health.components.database.responseTime}ms

🔴 *Redis*: ${statusEmoji[health.components.redis.status]} ${health.components.redis.status}
  └─ ${health.components.redis.message}
  └─ Response: ${health.components.redis.responseTime}ms

💬 *WhatsApp*: ${statusEmoji[health.components.whatsapp.status]} ${health.components.whatsapp.status}
  └─ ${health.components.whatsapp.message}
  └─ Response: ${health.components.whatsapp.responseTime}ms

💾 *Memory*: ${statusEmoji[health.components.memory.status]} ${health.components.memory.status}
  └─ ${health.components.memory.message}
${health.components.memory.details ? `  └─ Used: ${String(health.components.memory.details.usedMemory)}MB / ${String(health.components.memory.details.totalMemory)}MB (${String(health.components.memory.details.usagePercent)}%)` : ""}

⚙️ *CPU*: ${statusEmoji[health.components.cpu.status]} ${health.components.cpu.status}
  └─ ${health.components.cpu.message}
${health.components.cpu.details ? `  └─ Usage: ${String(health.components.cpu.details.usage)}% (${String(health.components.cpu.details.cpuCount)} cores)` : ""}

📈 *Metrics*
👥 Users: ${health.metrics.activeUsers}/${health.metrics.totalUsers} active
💳 Transactions: ${health.metrics.todayTransactions} today (${health.metrics.totalTransactions} total)
❌ Error Rate: ${health.metrics.errorRate}%
⏱️ Avg Response Time: ${health.metrics.avgResponseTime}ms
`.trim();

      await message.reply(healthText);

      logger.info("Health dashboard displayed", {
        userId,
        overall: health.overall,
      });
    } catch (error) {
      logger.error("Error displaying health dashboard", { error, userId });
      await message.reply("❌ Terjadi kesalahan saat memeriksa system health.");
    }
  }

  /**
   * Handle list users command
   */
  static async handleListUsers(
    message: Message,
    userId: string,
    userRole: UserRole,
    filter?: { role?: UserRole; isActive?: boolean },
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      await message.reply("📋 Mengambil daftar users...");

      const result = await UserService.listUsers(filter);

      let usersText = `
👥 *DAFTAR USERS*

📊 *Summary*
Total: ${result.totalUsers} users
Active: ${result.activeUsers} users
Inactive: ${result.inactiveUsers} users

📈 *By Role*
Dev: ${result.usersByRole.dev}
Boss: ${result.usersByRole.boss}
Employee: ${result.usersByRole.employee}
Investor: ${result.usersByRole.investor}

👤 *Users*
`.trim();

      result.users.forEach((user, index) => {
        const roleEmoji = {
          dev: "🔧",
          boss: "👔",
          employee: "👤",
          investor: "💰",
        };

        const statusEmoji = user.isActive ? "✅" : "❌";
        const lastActive = user.lastActive
          ? new Date(user.lastActive).toLocaleDateString("id-ID")
          : "Never";

        usersText += `\n\n${index + 1}. ${roleEmoji[user.role]} *${user.name || "Unknown"}* ${statusEmoji}
   📞 ${user.phoneNumber}
   👔 ${user.role}
   📊 ${user.transactionCount} transactions
   🕒 Last active: ${lastActive}`;
      });

      // Split message if too long
      if (usersText.length > 4000) {
        const chunks = this.splitMessage(usersText, 4000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(usersText);
      }

      logger.info("Users listed", { userId, count: result.totalUsers });
    } catch (error) {
      logger.error("Error listing users", { error, userId });
      await message.reply("❌ Terjadi kesalahan saat mengambil daftar users.");
    }
  }

  /**
   * Handle add user command
   */
  static async handleAddUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    phoneNumber: string,
    name: string,
    role: UserRole,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      await message.reply("➕ Menambahkan user baru...");

      const newUser = await UserService.createUser(
        {
          phoneNumber,
          name,
          role,
        },
        userId,
      );

      const roleEmoji = {
        dev: "🔧",
        boss: "👔",
        employee: "👤",
        investor: "💰",
      };

      const responseText = `
✅ *USER BERHASIL DITAMBAHKAN*

${roleEmoji[newUser.role]} *${newUser.name}*
📞 ${newUser.phoneNumber}
👔 Role: ${newUser.role}
🆔 ID: \`${newUser.id}\`
📅 Created: ${newUser.createdAt.toLocaleDateString("id-ID")}

User dapat langsung menggunakan bot dengan nomor tersebut.
`.trim();

      await message.reply(responseText);

      logger.info("User added", {
        userId,
        newUserId: newUser.id,
        role: newUser.role,
      });
    } catch (error) {
      logger.error("Error adding user", { error, userId });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ Gagal menambahkan user: ${errorMessage}`);
    }
  }

  /**
   * Handle edit user command
   */
  static async handleEditUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    targetPhoneNumber: string,
    updates: { name?: string; role?: UserRole },
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      // Get target user
      const targetUser =
        await UserService.getUserByPhoneNumber(targetPhoneNumber);
      if (!targetUser) {
        await message.reply(
          `❌ User dengan nomor ${targetPhoneNumber} tidak ditemukan.`,
        );
        return;
      }

      await message.reply("✏️ Mengupdate user...");

      const updatedUser = await UserService.updateUser(
        targetUser.id,
        updates,
        userId,
      );

      const responseText = `
✅ *USER BERHASIL DIUPDATE*

👤 *${updatedUser.name}*
📞 ${updatedUser.phoneNumber}
👔 Role: ${updatedUser.role}
${updates.role ? `   (changed from ${targetUser.role})` : ""}
`.trim();

      await message.reply(responseText);

      logger.info("User updated", {
        userId,
        targetUserId: targetUser.id,
        updates,
      });
    } catch (error) {
      logger.error("Error editing user", { error, userId });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ Gagal mengupdate user: ${errorMessage}`);
    }
  }

  /**
   * Handle deactivate user command
   */
  static async handleDeactivateUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    targetPhoneNumber: string,
    reason?: string,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      const targetUser =
        await UserService.getUserByPhoneNumber(targetPhoneNumber);
      if (!targetUser) {
        await message.reply(
          `❌ User dengan nomor ${targetPhoneNumber} tidak ditemukan.`,
        );
        return;
      }

      if (!targetUser.isActive) {
        await message.reply("ℹ️ User sudah dalam status inactive.");
        return;
      }

      await message.reply("⏸️ Menonaktifkan user...");

      await UserService.deactivateUser(targetUser.id, userId, reason);

      const responseText = `
✅ *USER BERHASIL DINONAKTIFKAN*

👤 *${targetUser.name}*
📞 ${targetUser.phoneNumber}
${reason ? `📝 Reason: ${reason}` : ""}

User tidak dapat lagi mengakses bot.
`.trim();

      await message.reply(responseText);

      logger.info("User deactivated", {
        userId,
        targetUserId: targetUser.id,
        reason,
      });
    } catch (error) {
      logger.error("Error deactivating user", { error, userId });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ Gagal menonaktifkan user: ${errorMessage}`);
    }
  }

  /**
   * Handle activate user command
   */
  static async handleActivateUser(
    message: Message,
    userId: string,
    userRole: UserRole,
    targetPhoneNumber: string,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      const targetUser =
        await UserService.getUserByPhoneNumber(targetPhoneNumber);
      if (!targetUser) {
        await message.reply(
          `❌ User dengan nomor ${targetPhoneNumber} tidak ditemukan.`,
        );
        return;
      }

      if (targetUser.isActive) {
        await message.reply("ℹ️ User sudah dalam status active.");
        return;
      }

      await message.reply("▶️ Mengaktifkan user...");

      await UserService.activateUser(targetUser.id, userId);

      const responseText = `
✅ *USER BERHASIL DIAKTIFKAN*

👤 *${targetUser.name}*
📞 ${targetUser.phoneNumber}

User dapat kembali mengakses bot.
`.trim();

      await message.reply(responseText);

      logger.info("User activated", { userId, targetUserId: targetUser.id });
    } catch (error) {
      logger.error("Error activating user", { error, userId });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ Gagal mengaktifkan user: ${errorMessage}`);
    }
  }

  /**
   * Handle reset user session command
   */
  static async handleResetUserSession(
    message: Message,
    userId: string,
    userRole: UserRole,
    targetPhoneNumber: string,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      const targetUser =
        await UserService.getUserByPhoneNumber(targetPhoneNumber);
      if (!targetUser) {
        await message.reply(
          `❌ User dengan nomor ${targetPhoneNumber} tidak ditemukan.`,
        );
        return;
      }

      await message.reply("🔄 Mereset session user...");

      await UserService.resetUserSession(targetUser.id, userId);

      const responseText = `
✅ *SESSION BERHASIL DIRESET*

👤 *${targetUser.name}*
📞 ${targetUser.phoneNumber}

Session user telah dihapus. User perlu login ulang.
`.trim();

      await message.reply(responseText);

      logger.info("User session reset", {
        userId,
        targetUserId: targetUser.id,
      });
    } catch (error) {
      logger.error("Error resetting user session", { error, userId });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`❌ Gagal mereset session: ${errorMessage}`);
    }
  }

  /**
   * Handle recent audit logs command
   */
  static async handleRecentAuditLogs(
    message: Message,
    userId: string,
    userRole: UserRole,
    limit: number = 50,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      await message.reply(`📝 Mengambil ${limit} audit logs terbaru...`);

      const auditLogs = await AuditLogModel.findMany({ limit });

      let logsText = `
📝 *RECENT AUDIT LOGS*
Total: ${auditLogs.length} logs

`.trim();

      auditLogs.forEach((log, index) => {
        const timestamp = new Date(log.timestamp).toLocaleString("id-ID", {
          timeZone: "Asia/Makassar",
        });
        const logWithUser = log as typeof log & {
          user: { name: string | null } | null;
        };
        const userName = logWithUser.user?.name || "System";

        logsText += `\n\n${index + 1}. *${log.action}*
   👤 ${userName}
   🕒 ${timestamp}
   ${log.affectedEntityType ? `📦 ${log.affectedEntityType}` : ""}`;
      });

      // Split message if too long
      if (logsText.length > 4000) {
        const chunks = this.splitMessage(logsText, 4000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(logsText);
      }

      logger.info("Recent audit logs displayed", {
        userId,
        count: auditLogs.length,
      });
    } catch (error) {
      logger.error("Error displaying recent audit logs", { error, userId });
      await message.reply("❌ Terjadi kesalahan saat mengambil audit logs.");
    }
  }

  /**
   * Handle user audit logs command
   */
  static async handleUserAuditLogs(
    message: Message,
    userId: string,
    userRole: UserRole,
    targetPhoneNumber: string,
    limit: number = 50,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      const targetUser =
        await UserService.getUserByPhoneNumber(targetPhoneNumber);
      if (!targetUser) {
        await message.reply(
          `❌ User dengan nomor ${targetPhoneNumber} tidak ditemukan.`,
        );
        return;
      }

      await message.reply(
        `📝 Mengambil audit logs untuk ${targetUser.name}...`,
      );

      const auditLogs = await AuditLogModel.findByUser(targetUser.id, limit);

      let logsText = `
📝 *AUDIT LOGS*
User: ${targetUser.name} (${targetUser.phoneNumber})
Total: ${auditLogs.length} logs

`.trim();

      auditLogs.forEach((log, index) => {
        const timestamp = new Date(log.timestamp).toLocaleString("id-ID", {
          timeZone: "Asia/Makassar",
        });

        logsText += `\n\n${index + 1}. *${log.action}*
   🕒 ${timestamp}
   ${log.affectedEntityType ? `📦 ${log.affectedEntityType}` : ""}`;
      });

      // Split message if too long
      if (logsText.length > 4000) {
        const chunks = this.splitMessage(logsText, 4000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(logsText);
      }

      logger.info("User audit logs displayed", {
        userId,
        targetUserId: targetUser.id,
        count: auditLogs.length,
      });
    } catch (error) {
      logger.error("Error displaying user audit logs", { error, userId });
      await message.reply(
        "❌ Terjadi kesalahan saat mengambil user audit logs.",
      );
    }
  }

  /**
   * Handle action audit logs command
   */
  static async handleActionAuditLogs(
    message: Message,
    userId: string,
    userRole: UserRole,
    action: string,
    limit: number = 100,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      await message.reply(`📝 Mengambil audit logs untuk action: ${action}...`);

      const auditLogs = await AuditLogModel.findByAction(action, limit);

      let logsText = `
📝 *AUDIT LOGS*
Action: ${action}
Total: ${auditLogs.length} logs

`.trim();

      auditLogs.forEach((log, index) => {
        const timestamp = new Date(log.timestamp).toLocaleString("id-ID", {
          timeZone: "Asia/Makassar",
        });
        const logWithUser = log as typeof log & {
          user: { name: string | null } | null;
        };
        const userName = logWithUser.user?.name || "System";

        logsText += `\n\n${index + 1}. ${userName}
   🕒 ${timestamp}
   ${log.affectedEntityType ? `📦 ${log.affectedEntityType}` : ""}`;
      });

      // Split message if too long
      if (logsText.length > 4000) {
        const chunks = this.splitMessage(logsText, 4000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(logsText);
      }

      logger.info("Action audit logs displayed", {
        userId,
        action,
        count: auditLogs.length,
      });
    } catch (error) {
      logger.error("Error displaying action audit logs", { error, userId });
      await message.reply(
        "❌ Terjadi kesalahan saat mengambil action audit logs.",
      );
    }
  }

  /**
   * Handle system metrics command
   */
  static async handleSystemMetrics(
    message: Message,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    try {
      if (userRole !== "dev") {
        await message.reply("⛔ Akses ditolak.");
        return;
      }

      await message.reply("📊 Mengambil system metrics...");

      const health = await HealthMonitoringService.getSystemHealth();
      const auditStats = await AuditLogModel.getStatistics();

      const metricsText = `
📊 *SYSTEM METRICS*

⏱️ *Uptime*: ${HealthMonitoringService.getUptimeFormatted()}

👥 *Users*
Active: ${health.metrics.activeUsers}/${health.metrics.totalUsers}
Dev: ${(await UserService.listUsers({ role: "dev" })).totalUsers}
Boss: ${(await UserService.listUsers({ role: "boss" })).totalUsers}
Employee: ${(await UserService.listUsers({ role: "employee" })).totalUsers}
Investor: ${(await UserService.listUsers({ role: "investor" })).totalUsers}

💳 *Transactions*
Total: ${health.metrics.totalTransactions}
Today: ${health.metrics.todayTransactions}

📝 *Audit Logs*
Total: ${auditStats.totalLogs}
Top Actions:
${Object.entries(auditStats.logsByAction)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .map(([action, count]) => `  • ${action}: ${count}`)
  .join("\n")}

⚡ *Performance*
Error Rate: ${health.metrics.errorRate}%
Avg Response Time: ${health.metrics.avgResponseTime}ms

💾 *Resources*
Memory: ${health.components.memory.details ? String(health.components.memory.details.usagePercent) : "N/A"}%
CPU: ${health.components.cpu.details ? String(health.components.cpu.details.usage) : "N/A"}%
`.trim();

      await message.reply(metricsText);

      logger.info("System metrics displayed", { userId });
    } catch (error) {
      logger.error("Error displaying system metrics", { error, userId });
      await message.reply(
        "❌ Terjadi kesalahan saat mengambil system metrics.",
      );
    }
  }

  /**
   * Split long message into chunks
   */
  private static splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = text.split("\n");

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

export default AdminHandler;
