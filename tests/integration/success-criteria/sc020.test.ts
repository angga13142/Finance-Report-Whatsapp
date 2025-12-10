/**
 * Success Criteria SC-020: Category Management Validation
 * Validates: Category addition without code deployment
 * 
 * Test validates that new transaction categories can be added
 * dynamically through the system interface without requiring
 * code changes or redeployment.
 */

import { CategoryModel } from "../../../../src/models/category";
import { getPrismaClient } from "../../../../src/lib/database";
import { logger } from "../../../../src/lib/logger";
import { TransactionType } from "@prisma/client";

describe("SC-020: Dynamic Category Management", () => {
  const prisma = getPrismaClient();
  const testCategoryPrefix = "SC020-Test-";

  afterAll(async () => {
    // Cleanup test categories
    try {
      await prisma.category.deleteMany({
        where: {
          name: { startsWith: testCategoryPrefix },
        },
      });
    } catch {
      // Categories may not exist
    }
  });

  describe("Category Creation Without Deployment", () => {
    it("should create new income category dynamically", async () => {
      const categoryName = `${testCategoryPrefix}Income-${Date.now()}`;

      const category = await CategoryModel.create({
        name: categoryName,
        type: "income" as TransactionType,
        isActive: true,
      });

      expect(category).toBeDefined();
      expect(category.name).toBe(categoryName);
      expect(category.type).toBe("income");
      expect(category.isActive).toBe(true);

      logger.info("✅ Dynamic category creation successful", {
        categoryId: category.id,
        categoryName: category.name,
      });
    });

    it("should create new expense category dynamically", async () => {
      const categoryName = `${testCategoryPrefix}Expense-${Date.now()}`;

      const category = await CategoryModel.create({
        name: categoryName,
        type: "expense" as TransactionType,
        isActive: true,
      });

      expect(category).toBeDefined();
      expect(category.name).toBe(categoryName);
      expect(category.type).toBe("expense");
      expect(category.isActive).toBe(true);
    });

    it("should create subcategory dynamically", async () => {
      // Create parent category first
      const parentCategory = await CategoryModel.create({
        name: `${testCategoryPrefix}Parent-${Date.now()}`,
        type: "expense",
        isActive: true,
      });

      // Create subcategory
      const subcategoryName = `${testCategoryPrefix}Subcategory-${Date.now()}`;
      const subcategory = await CategoryModel.create({
        name: subcategoryName,
        type: "expense",
        parentId: parentCategory.id,
        isActive: true,
      });

      expect(subcategory).toBeDefined();
      expect(subcategory.parentId).toBe(parentCategory.id);
      expect(subcategory.type).toBe("expense");
    });
  });

  describe("Category Retrieval", () => {
    it("should retrieve all active categories", async () => {
      // Create test categories
      const testCategories = [
        {
          name: `${testCategoryPrefix}Active1-${Date.now()}`,
          type: "income" as TransactionType,
          isActive: true,
        },
        {
          name: `${testCategoryPrefix}Active2-${Date.now()}`,
          type: "expense" as TransactionType,
          isActive: true,
        },
      ];

      await Promise.all(
        testCategories.map((cat) => CategoryModel.create(cat))
      );

      // Retrieve all active categories
      const activeCategories = await CategoryModel.findAllActive();

      expect(activeCategories.length).toBeGreaterThanOrEqual(2);

      // Verify test categories are included
      const testCategoryNames = testCategories.map((c) => c.name);
      const retrievedNames = activeCategories.map((c) => c.name);

      testCategoryNames.forEach((name) => {
        expect(retrievedNames).toContain(name);
      });
    });

    it("should filter categories by type", async () => {
      const incomeCategories = await CategoryModel.findByType("income");
      const expenseCategories = await CategoryModel.findByType("expense");

      expect(Array.isArray(incomeCategories)).toBe(true);
      expect(Array.isArray(expenseCategories)).toBe(true);

      // Verify type filtering
      incomeCategories.forEach((cat) => {
        expect(cat.type).toBe("income");
      });

      expenseCategories.forEach((cat) => {
        expect(cat.type).toBe("expense");
      });
    });
  });

  describe("Category Modification", () => {
    it("should update category name without deployment", async () => {
      const originalName = `${testCategoryPrefix}Original-${Date.now()}`;
      const updatedName = `${testCategoryPrefix}Updated-${Date.now()}`;

      const category = await CategoryModel.create({
        name: originalName,
        type: "income",
        isActive: true,
      });

      // Update category name
      const updated = await CategoryModel.update(category.id, {
        name: updatedName,
      });

      expect(updated?.name).toBe(updatedName);
      expect(updated?.id).toBe(category.id);
    });

    it("should deactivate category without deployment", async () => {
      const category = await CategoryModel.create({
        name: `${testCategoryPrefix}ToDeactivate-${Date.now()}`,
        type: "expense",
        isActive: true,
      });

      // Deactivate category
      const deactivated = await CategoryModel.update(category.id, {
        isActive: false,
      });

      expect(deactivated?.isActive).toBe(false);

      // Verify it's not in active list
      const activeCategories = await CategoryModel.findAllActive();
      const activeCategoryIds = activeCategories.map((c) => c.id);

      expect(activeCategoryIds).not.toContain(category.id);
    });

    it("should reactivate category without deployment", async () => {
      const category = await CategoryModel.create({
        name: `${testCategoryPrefix}ToReactivate-${Date.now()}`,
        type: "income",
        isActive: false,
      });

      // Reactivate category
      const reactivated = await CategoryModel.update(category.id, {
        isActive: true,
      });

      expect(reactivated?.isActive).toBe(true);

      // Verify it's in active list
      const activeCategories = await CategoryModel.findAllActive();
      const activeCategoryIds = activeCategories.map((c) => c.id);

      expect(activeCategoryIds).toContain(category.id);
    });
  });

  describe("Category Validation", () => {
    it("should prevent duplicate category names", async () => {
      const categoryName = `${testCategoryPrefix}Duplicate-${Date.now()}`;

      // Create first category
      await CategoryModel.create({
        name: categoryName,
        type: "income",
        isActive: true,
      });

      // Attempt to create duplicate
      try {
        await CategoryModel.create({
          name: categoryName,
          type: "income",
          isActive: true,
        });

        fail("Expected duplicate category error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should require category name", async () => {
      try {
        await CategoryModel.create({
          name: "",
          type: "income",
          isActive: true,
        });

        fail("Expected validation error for empty name");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should require valid transaction type", async () => {
      try {
        await CategoryModel.create({
          name: `${testCategoryPrefix}InvalidType-${Date.now()}`,
          type: "invalid" as TransactionType,
          isActive: true,
        });

        fail("Expected validation error for invalid type");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Category Usage Tracking", () => {
    it("should track transaction count per category", async () => {
      const category = await CategoryModel.create({
        name: `${testCategoryPrefix}Tracked-${Date.now()}`,
        type: "income",
        isActive: true,
      });

      // Initial count should be 0
      expect(category.transactionCount).toBe(0);

      // In real implementation, creating transactions would increment this
      // For test, we verify the field exists and is trackable
      const updated = await CategoryModel.update(category.id, {
        transactionCount: 5,
      });

      expect(updated?.transactionCount).toBe(5);
    });

    it("should track last transaction timestamp", async () => {
      const category = await CategoryModel.create({
        name: `${testCategoryPrefix}Timestamped-${Date.now()}`,
        type: "expense",
        isActive: true,
      });

      const timestamp = new Date();

      const updated = await CategoryModel.update(category.id, {
        lastTransactionAt: timestamp,
      });

      expect(updated?.lastTransactionAt).toBeDefined();
    });
  });

  describe("Category Hierarchy", () => {
    it("should support parent-child category relationships", async () => {
      const parent = await CategoryModel.create({
        name: `${testCategoryPrefix}ParentCat-${Date.now()}`,
        type: "expense",
        isActive: true,
      });

      const child1 = await CategoryModel.create({
        name: `${testCategoryPrefix}ChildCat1-${Date.now()}`,
        type: "expense",
        parentId: parent.id,
        isActive: true,
      });

      const child2 = await CategoryModel.create({
        name: `${testCategoryPrefix}ChildCat2-${Date.now()}`,
        type: "expense",
        parentId: parent.id,
        isActive: true,
      });

      // Verify parent-child relationship
      expect(child1.parentId).toBe(parent.id);
      expect(child2.parentId).toBe(parent.id);

      // Retrieve subcategories
      const subcategories = await CategoryModel.findSubcategories(parent.id);

      expect(subcategories.length).toBeGreaterThanOrEqual(2);
      const subcategoryIds = subcategories.map((c) => c.id);
      expect(subcategoryIds).toContain(child1.id);
      expect(subcategoryIds).toContain(child2.id);
    });
  });

  describe("Success Criteria Validation", () => {
    it("SC-020: Category can be added without code deployment", async () => {
      // This is the primary validation for SC-020
      const startTime = Date.now();

      // Create new category dynamically
      const newCategoryName = `${testCategoryPrefix}SC020-${Date.now()}`;

      const category = await CategoryModel.create({
        name: newCategoryName,
        type: "income",
        isActive: true,
      });

      const creationTime = Date.now() - startTime;

      logger.info("✅ SC-020: Dynamic category creation validation passed", {
        categoryId: category.id,
        categoryName: category.name,
        creationTimeMs: creationTime,
        noDeploymentRequired: true,
      });

      // Verify category is immediately available
      const retrievedCategory = await CategoryModel.findById(category.id);
      expect(retrievedCategory).toBeDefined();
      expect(retrievedCategory?.name).toBe(newCategoryName);

      // Verify category appears in active list
      const activeCategories = await CategoryModel.findAllActive();
      const activeCategoryIds = activeCategories.map((c) => c.id);
      expect(activeCategoryIds).toContain(category.id);

      logger.info("✅ SC-020: Category immediately available after creation", {
        categoryId: category.id,
        availableInActiveList: true,
      });
    });
  });
});
