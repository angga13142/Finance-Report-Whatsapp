import { PrismaClient, TransactionType } from "@prisma/client";
import { logger } from "../src/lib/logger";

const prisma = new PrismaClient();

/**
 * Seed initial categories
 */
async function seedCategories() {
  logger.info("Seeding categories...");

  const categories = [
    // Income categories
    { name: "Produk A", type: "income" as TransactionType, icon: "📦" },
    { name: "Produk B", type: "income" as TransactionType, icon: "📦" },
    { name: "Produk C", type: "income" as TransactionType, icon: "📦" },
    { name: "Jasa", type: "income" as TransactionType, icon: "💼" },
    {
      name: "Lainnya (Pemasukan)",
      type: "income" as TransactionType,
      icon: "💰",
    },

    // Expense categories
    { name: "Bahan Baku", type: "expense" as TransactionType, icon: "🏭" },
    { name: "Gaji Karyawan", type: "expense" as TransactionType, icon: "👥" },
    { name: "Utilities", type: "expense" as TransactionType, icon: "⚡" },
    { name: "Transportasi", type: "expense" as TransactionType, icon: "🚗" },
    { name: "Marketing", type: "expense" as TransactionType, icon: "📢" },
    { name: "Operasional", type: "expense" as TransactionType, icon: "⚙️" },
    {
      name: "Lainnya (Pengeluaran)",
      type: "expense" as TransactionType,
      icon: "💸",
    },
  ];

  for (const category of categories) {
    try {
      await prisma.category.upsert({
        where: { name: category.name },
        update: {
          type: category.type,
          icon: category.icon,
          isActive: true,
        },
        create: {
          name: category.name,
          type: category.type,
          icon: category.icon,
          isActive: true,
        },
      });
      logger.info(`Category created/updated: ${category.name}`);
    } catch (error) {
      logger.error(`Error seeding category ${category.name}`, { error });
    }
  }

  logger.info("Categories seeded successfully");
}

/**
 * Seed initial Dev user
 */
async function seedDevUser() {
  logger.info("Seeding Dev user...");

  try {
    const devPhoneNumber = "+6281234567890"; // Default Dev phone number
    const devUser = await prisma.user.upsert({
      where: { phoneNumber: devPhoneNumber },
      update: {
        role: "dev",
        isActive: true,
        name: "Developer",
      },
      create: {
        phoneNumber: devPhoneNumber,
        role: "dev",
        name: "Developer",
        isActive: true,
      },
    });

    logger.info("Dev user seeded successfully", {
      userId: devUser.id,
      phoneNumber: devUser.phoneNumber,
    });
    logger.warn("IMPORTANT: Update Dev phone number in production!", {
      currentPhone: devPhoneNumber,
    });
  } catch (error) {
    logger.error("Error seeding Dev user", { error });
    throw error;
  }
}

/**
 * Main seed function
 */
async function main() {
  try {
    logger.info("Starting database seed...");

    await seedCategories();
    await seedDevUser();

    logger.info("Database seed completed successfully");
  } catch (error) {
    logger.error("Error during database seed", { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error("Unhandled error in seed script", { error });
    process.exit(1);
  });
}

export { seedCategories, seedDevUser };
