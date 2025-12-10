import { Message } from "whatsapp-web.js";
import { User } from "@prisma/client";
import { logger } from "../../lib/logger";
import { getWhatsAppClient } from "../client/client";
import { MessageFormatter } from "../ui/messages";
import { formatDateWITA } from "../../lib/date";

/**
 * User profile handler
 * Handles profile viewing and management
 */
export class ProfileHandler {
  /**
   * Handle profile view request
   */
  static async handleProfileView(user: User, message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    logger.info("User requesting profile view", { userId: user.id });

    try {
      // Format profile information
      const roleLabel = this.formatRole(user.role);
      const statusIcon = user.isActive ? "✅" : "❌";
      const statusLabel = user.isActive ? "Aktif" : "Non-aktif";

      let msg = `👤 *Profil Pengguna*\n\n`;
      msg += `*Informasi Akun:*\n`;
      msg += `Nama: ${user.name || "-"}\n`;
      msg += `Nomor Telepon: ${user.phoneNumber}\n`;
      msg += `Role: ${roleLabel}\n`;
      msg += `Status: ${statusIcon} ${statusLabel}\n\n`;

      msg += `*Tanggal Penting:*\n`;
      msg += `Terdaftar: ${formatDateWITA(user.createdAt)}\n`;
      if (user.lastActive) {
        msg += `Terakhir Aktif: ${formatDateWITA(user.lastActive)}\n`;
      }
      msg += `\n`;

      // Role-specific info
      msg += `*Akses Role:*\n`;
      switch (user.role) {
        case "employee":
          msg += `• Catat transaksi pribadi\n`;
          msg += `• Lihat laporan pribadi\n`;
          msg += `• Notifikasi harian\n`;
          break;
        case "boss":
          msg += `• Lihat semua transaksi\n`;
          msg += `• Approval transaksi\n`;
          msg += `• Kelola kategori\n`;
          msg += `• Laporan komprehensif\n`;
          msg += `• Rekomendasi keuangan\n`;
          break;
        case "investor":
          msg += `• Laporan agregat\n`;
          msg += `• Analisis trend\n`;
          msg += `• Investment insights\n`;
          msg += `• (Tanpa akses transaksi individual)\n`;
          break;
        case "dev":
          msg += `• Semua akses Boss\n`;
          msg += `• Kelola user & role\n`;
          msg += `• System health monitoring\n`;
          msg += `• Audit log access\n`;
          msg += `• System configuration\n`;
          break;
      }

      msg += `\n_Gunakan /menu untuk kembali ke menu utama_`;

      await client.sendMessage(message.from, msg);
    } catch (error) {
      logger.error("Error viewing profile", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle account deletion request
   */
  static async handleAccountDeletionRequest(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    logger.info("User requesting account deletion", { userId: user.id });

    try {
      // Check if user is Boss or Dev (cannot delete own account)
      if (user.role === "boss" || user.role === "dev") {
        await client.sendMessage(
          message.from,
          `⚠️ *Permintaan Tidak Dapat Diproses*\n\n` +
            `Akun dengan role ${this.formatRole(user.role)} tidak dapat dihapus secara self-service.\n\n` +
            `Silakan hubungi administrator sistem untuk penghapusan akun.`,
        );
        return;
      }

      // Send deletion request confirmation
      let msg = `⚠️ *Konfirmasi Penghapusan Akun*\n\n`;
      msg += `Anda akan menghapus akun:\n`;
      msg += `• Nama: ${user.name || "-"}\n`;
      msg += `• Phone: ${user.phoneNumber}\n`;
      msg += `• Role: ${this.formatRole(user.role)}\n\n`;

      msg += `*Konsekuensi Penghapusan:*\n`;
      msg += `❌ Semua data transaksi pribadi akan dihapus\n`;
      msg += `❌ Akses ke sistem akan dicabut\n`;
      msg += `❌ Tidak dapat login kembali\n`;
      msg += `❌ Proses ini TIDAK DAPAT DIBATALKAN\n\n`;

      msg += `*Untuk melanjutkan penghapusan:*\n`;
      msg += `Ketik: \`/delete-account CONFIRM\`\n\n`;
      msg += `_Untuk membatalkan, abaikan pesan ini_`;

      await client.sendMessage(message.from, msg);
    } catch (error) {
      logger.error("Error handling account deletion request", {
        error,
        userId: user.id,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle account deletion confirmation
   */
  static async handleAccountDeletionConfirm(
    user: User,
    confirmText: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) {
      return;
    }

    // Verify confirmation text
    if (confirmText !== "CONFIRM") {
      await client.sendMessage(
        message.from,
        `❌ *Konfirmasi Tidak Valid*\n\n` +
          `Ketik: \`/delete-account CONFIRM\` untuk melanjutkan penghapusan.\n\n` +
          `_Pastikan menggunakan huruf besar: CONFIRM_`,
      );
      return;
    }

    // Check if user is Boss or Dev
    if (user.role === "boss" || user.role === "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.warn("User confirming account deletion", {
      userId: user.id,
      role: user.role,
    });

    try {
      // Import UserModel
      const { UserModel } = await import("../../models/user");
      const { AuditLogger } = await import("../../services/audit/logger");

      // Log audit trail before deletion
      await AuditLogger.log(
        "account_deletion_requested",
        {
          userId: user.id,
          userName: user.name || "Unknown",
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
        user.id,
        user.id,
        "User",
      );

      // Soft delete user (deactivate)
      await UserModel.update(user.id, {
        isActive: false,
        name: `[DELETED] ${user.name || user.phoneNumber}`,
      });

      // Send goodbye message
      await client.sendMessage(
        message.from,
        `👋 *Akun Berhasil Dihapus*\n\n` +
          `Akun Anda telah dihapus dari sistem.\n` +
          `Terima kasih telah menggunakan layanan kami.\n\n` +
          `_Bot tidak akan merespon pesan dari nomor ini lagi._`,
      );

      logger.info("User account deleted successfully", { userId: user.id });
    } catch (error) {
      logger.error("Error deleting account", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Format role to Indonesian label
   */
  private static formatRole(role: string): string {
    const roleMap: Record<string, string> = {
      employee: "Karyawan",
      boss: "Boss",
      investor: "Investor",
      dev: "Developer",
    };
    return roleMap[role] || role;
  }
}

export default ProfileHandler;
