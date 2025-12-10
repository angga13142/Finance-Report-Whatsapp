import { List } from "whatsapp-web.js";
import { Category, TransactionType } from "@prisma/client";
import { CategoryModel } from "../../models/category";
import { logger } from "../../lib/logger";
import { MAX_LIST_ITEMS } from "../../config/constants";

/**
 * List message generation for category selection
 */
export class ListMenu {
  /**
   * Generate category list for transaction type
   */
  static async generateCategoryList(
    transactionType: TransactionType,
    title: string = "Pilih Kategori",
  ): Promise<List | null> {
    try {
      const categories = await CategoryModel.findByType(transactionType, true);

      if (categories.length === 0) {
        logger.warn("No active categories found", { transactionType });
        return null;
      }

      // Limit to MAX_LIST_ITEMS
      const limitedCategories = categories.slice(0, MAX_LIST_ITEMS);

      // Group categories into sections (optional, for better UX)
      const sections = [
        {
          title:
            transactionType === "income"
              ? "Kategori Penjualan"
              : "Kategori Pengeluaran",
          rows: limitedCategories.map((cat) => ({
            id: `category_${cat.id}`,
            title: cat.icon ? `${cat.icon} ${cat.name}` : cat.name,
            description: "",
          })),
        },
      ];

      return new List(
        "Pilih kategori transaksi:",
        "Pilih",
        sections as any,
        title,
      );
    } catch (error) {
      logger.error("Error generating category list", {
        error,
        transactionType,
      });
      return null;
    }
  }

  /**
   * Generate simple category list as text (fallback)
   */
  static async generateCategoryTextList(
    transactionType: TransactionType,
  ): Promise<string> {
    try {
      const categories = await CategoryModel.findByType(transactionType, true);

      if (categories.length === 0) {
        return "Tidak ada kategori yang tersedia.";
      }

      let text = "Pilih kategori:\n\n";
      categories.forEach((cat, index) => {
        const icon = cat.icon || "";
        text += `${index + 1}. ${icon} ${cat.name}\n`;
      });
      text += "\nKetik nomor atau nama kategori.";

      return text;
    } catch (error) {
      logger.error("Error generating category text list", {
        error,
        transactionType,
      });
      return "Error memuat kategori. Silakan coba lagi.";
    }
  }

  /**
   * Find category by selection (from list or text input)
   */
  static async findCategoryBySelection(
    selection: string,
    transactionType: TransactionType,
  ): Promise<Category | null> {
    try {
      const categories = await CategoryModel.findByType(transactionType, true);

      // Try to find by ID (if from list selection)
      if (selection.startsWith("category_")) {
        const categoryId = selection.replace("category_", "");
        return await CategoryModel.findById(categoryId);
      }

      // Try to find by name (case-insensitive)
      const category = categories.find(
        (cat) => cat.name.toLowerCase() === selection.toLowerCase(),
      );

      if (category) {
        return category;
      }

      // Try to find by index (if number input)
      const index = parseInt(selection, 10) - 1;
      if (!isNaN(index) && index >= 0 && index < categories.length) {
        return categories[index];
      }

      return null;
    } catch (error) {
      logger.error("Error finding category by selection", {
        error,
        selection,
        transactionType,
      });
      return null;
    }
  }
}

export default ListMenu;
