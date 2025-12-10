/**
 * Unit tests for CategoryModel
 * Tests category CRUD operations, type filtering, and activation/deactivation
 */

import type { TransactionType } from "@prisma/client";

// Create shared mock Prisma instance
const mockPrismaInstance = {
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $use: jest.fn(),
  $on: jest.fn(),
  $extends: jest.fn(),
};

// Mock Prisma before importing CategoryModel
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    TransactionType: {
      INCOME: "income",
      EXPENSE: "expense",
    },
  };
});

// Import after mock setup
import { CategoryModel } from "../../../src/models/category";

// Mock logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock validation
jest.mock("../../../src/lib/validation", () => ({
  validateStringLength: jest.fn(),
}));

describe("CategoryModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should find category by ID", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        icon: "🍔",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.findUnique.mockResolvedValue(mockCategory);

      const result = await CategoryModel.findById("cat123");

      expect(result).toEqual(mockCategory);
      expect(mockPrismaInstance.category.findUnique).toHaveBeenCalledWith({
        where: { id: "cat123" },
      });
    });

    it("should return null when category not found", async () => {
      mockPrismaInstance.category.findUnique.mockResolvedValue(null);

      const result = await CategoryModel.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByName", () => {
    it("should find category by name", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        icon: "🍔",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.findUnique.mockResolvedValue(mockCategory);

      const result = await CategoryModel.findByName("Food");

      expect(result).toEqual(mockCategory);
      expect(mockPrismaInstance.category.findUnique).toHaveBeenCalledWith({
        where: { name: "Food" },
      });
    });
  });

  describe("findActiveCategories", () => {
    it("should find all active categories", async () => {
      const mockCategories = [
        {
          id: "cat1",
          name: "Food",
          type: "expense" as TransactionType,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cat2",
          name: "Transport",
          type: "expense" as TransactionType,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaInstance.category.findMany.mockResolvedValue(mockCategories);

      const result = await CategoryModel.findActiveCategories();

      expect(result).toEqual(mockCategories);
      expect(mockPrismaInstance.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findByType", () => {
    it("should find categories by type", async () => {
      const mockCategories = [
        {
          id: "cat1",
          name: "Food",
          type: "expense" as TransactionType,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaInstance.category.findMany.mockResolvedValue(mockCategories);

      const result = await CategoryModel.findByType("expense");

      expect(result).toEqual(mockCategories);
      expect(mockPrismaInstance.category.findMany).toHaveBeenCalledWith({
        where: {
          type: "expense",
          isActive: true,
        },
        orderBy: { name: "asc" },
      });
    });

    it("should include inactive categories when activeOnly is false", async () => {
      mockPrismaInstance.category.findMany.mockResolvedValue([]);

      await CategoryModel.findByType("expense", false);

      expect(mockPrismaInstance.category.findMany).toHaveBeenCalledWith({
        where: {
          type: "expense",
        },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("create", () => {
    it("should create new category", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        icon: "🍔",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.findUnique.mockResolvedValue(null); // Category doesn't exist
      mockPrismaInstance.category.create.mockResolvedValue(mockCategory);

      const result = await CategoryModel.create({
        name: "Food",
        type: "expense",
        icon: "🍔",
      });

      expect(result).toEqual(mockCategory);
      expect(mockPrismaInstance.category.create).toHaveBeenCalled();
    });

    it("should throw error when category already exists", async () => {
      const existingCategory = {
        id: "cat123",
        name: "Food",
      };

      mockPrismaInstance.category.findUnique.mockResolvedValue(
        existingCategory,
      );

      await expect(
        CategoryModel.create({
          name: "Food",
          type: "expense",
        }),
      ).rejects.toThrow("Category with this name already exists");
    });

    it("should default isActive to true", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.findUnique.mockResolvedValue(null);
      mockPrismaInstance.category.create.mockResolvedValue(mockCategory);

      await CategoryModel.create({
        name: "Food",
        type: "expense",
      });

      expect(mockPrismaInstance.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
        }),
      });
    });
  });

  describe("update", () => {
    it("should update category", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Updated Food",
        type: "expense" as TransactionType,
        icon: "🍕",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.update.mockResolvedValue(mockCategory);

      const result = await CategoryModel.update("cat123", {
        name: "Updated Food",
        icon: "🍕",
      });

      expect(result).toEqual(mockCategory);
      expect(mockPrismaInstance.category.update).toHaveBeenCalledWith({
        where: { id: "cat123" },
        data: {
          name: "Updated Food",
          icon: "🍕",
        },
      });
    });
  });

  describe("deactivate", () => {
    it("should deactivate category", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.update.mockResolvedValue(mockCategory);

      const result = await CategoryModel.deactivate("cat123");

      expect(result).toEqual(mockCategory);
      expect(result.isActive).toBe(false);
      expect(mockPrismaInstance.category.update).toHaveBeenCalledWith({
        where: { id: "cat123" },
        data: { isActive: false },
      });
    });
  });

  describe("activate", () => {
    it("should activate category", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.update.mockResolvedValue(mockCategory);

      const result = await CategoryModel.activate("cat123");

      expect(result).toEqual(mockCategory);
      expect(result.isActive).toBe(true);
      expect(mockPrismaInstance.category.update).toHaveBeenCalledWith({
        where: { id: "cat123" },
        data: { isActive: true },
      });
    });
  });

  describe("delete", () => {
    it("should soft delete category by deactivating", async () => {
      const mockCategory = {
        id: "cat123",
        name: "Food",
        type: "expense" as TransactionType,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaInstance.category.update.mockResolvedValue(mockCategory);

      const result = await CategoryModel.delete("cat123");

      expect(result).toEqual(mockCategory);
      expect(result.isActive).toBe(false);
    });
  });
});
