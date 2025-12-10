# WhatsApp Cashflow Bot - Workflow Documentation

## Project Detection

**Project Type:** Node.js / TypeScript  
**Framework:** NestJS (partial patterns) + Express + WhatsApp Web.js  
**Runtime:** Node.js 20 LTS  
**Language:** TypeScript 5.x (ES2022)  
**Architecture Pattern:** Layered (Handlers → Services → Models → Database)  
**Entry Point:** WhatsApp Message Events (Message Consumer)  
**Persistence Type:** PostgreSQL 15+ with TimescaleDB  
**Database ORM:** Prisma  

---

## End-to-End Workflows

### Workflow 1: Transaction Recording Flow

**Purpose:** Core financial workflow for recording income/expense transactions with approval workflow.

**Triggering Action:** User sends WhatsApp message to initiate transaction recording.

**Files Involved:**
- `src/bot/handlers/message.ts` - Message routing
- `src/bot/handlers/transaction.ts` - Transaction handler
- `src/bot/handlers/button.ts` - Button interaction
- `src/bot/middleware/auth.ts` - Authentication
- `src/bot/middleware/session.ts` - Session management
- `src/services/transaction/processor.ts` - Business logic
- `src/services/transaction/validator.ts` - Data validation
- `src/services/transaction/approval.ts` - Approval logic
- `src/services/audit/logger.ts` - Audit trail
- `src/models/transaction.ts` - Data model
- `src/models/user.ts` - User model
- `prisma/schema.prisma` - Database schema

#### 1. Entry Point Implementation

**WhatsApp Message Event Handler:**

```typescript
// src/bot/handlers/message.ts
export class MessageHandler {
  /**
   * Route incoming message from WhatsApp
   */
  static async routeMessage(message: Message): Promise<void> {
    try {
      // Ignore messages from bot itself
      if (message.fromMe) {
        return;
      }

      // Ignore media messages
      if (message.hasMedia) {
        await this.handleMediaMessage(message);
        return;
      }

      // 1. AUTHENTICATION: Authenticate user from WhatsApp phone number
      const authMessage = await AuthMiddleware.attachUser(message);
      if (!authMessage.user) {
        await this.handleUnauthorized(message);
        return;
      }

      const user = authMessage.user; // User now attached to message
      const body = message.body?.trim().toLowerCase() || "";

      // 2. ROUTING: Check if response is from button or text command
      if (this.isButtonResponse(message, user)) {
        await ButtonHandler.handleButton(message);
        return;
      }

      // Handle text commands (e.g., /record, /mulai)
      if (body.startsWith("/")) {
        await this.handleCommand(user, body, message);
        return;
      }

      // 3. SESSION CHECK: Handle recovery context if exists
      const hasRecoverable = await SessionManager.hasRecoverableContext(
        user.id,
      );
      if (hasRecoverable) {
        const handled = await TransactionHandler.handleRecoveryDecision(
          user,
          body,
          message,
        );
        if (handled) {
          return;
        }
      }

      // 4. STATE MACHINE: Route to appropriate handler based on session state
      const session = await SessionManager.getSession(user.id);

      if (session?.isEditing) {
        await TransactionHandler.handleEditInput(user, body, message);
        return;
      }

      if (session?.menu === MENU_STATES.AMOUNT) {
        await TransactionHandler.handleAmountInput(user, body, message);
        return;
      }

      if (session?.menu === MENU_STATES.CATEGORY) {
        await TransactionHandler.handleCategoryInput(user, body, message);
        return;
      }

      if (session?.menu === MENU_STATES.DESCRIPTION) {
        await TransactionHandler.handleDescriptionInput(user, body, message);
        return;
      }

      // If no session context, show help
      await this.showHelpMenu(user, message);
    } catch (error) {
      logger.error("Error routing message", { error });
    }
  }

  private static isButtonResponse(message: Message, user: User): boolean {
    // Check if message contains button response patterns
    return !!message.selectedButtonId || !!message.selectedListItem;
  }

  private static async handleUnauthorized(message: Message): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    await client.sendMessage(
      message.from,
      "❌ Anda belum terdaftar. Hubungi admin untuk registrasi.",
    );
  }
}
```

**Authentication Middleware:**

```typescript
// src/bot/middleware/auth.ts
export class AuthMiddleware {
  /**
   * Authenticate user from WhatsApp phone number
   * Extracts phone from message and looks up user in database
   */
  static async authenticate(message: Message): Promise<User | null> {
    try {
      // Extract phone number from WhatsApp message ID
      const phoneNumber = message.from.replace("@c.us", "");
      const normalized = normalizePhoneNumber(phoneNumber);

      // Query user by normalized phone number
      const user = await AuthService.authenticateByPhoneNumber(normalized);

      if (!user) {
        logger.warn("User not found or inactive", { phoneNumber: normalized });
        return null;
      }

      // Update user's last active timestamp
      await UserModel.updateLastActive(user.id);

      return user;
    } catch (error) {
      logger.error("Authentication error", { error, from: message.from });
      return null;
    }
  }

  /**
   * Attach user to message object for downstream handlers
   */
  static async attachUser(message: Message): Promise<AuthenticatedMessage> {
    const user = await this.authenticate(message);
    return { ...message, user: user || undefined } as AuthenticatedMessage;
  }
}
```

#### 2. Handler Layer Implementation

**Transaction Handler - State Machine:**

```typescript
// src/bot/handlers/transaction.ts
export class TransactionHandler {
  /**
   * Step 1: Start transaction recording
   * Shows menu to select transaction type (income/expense)
   */
  static async handleTransactionStart(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    // Create transaction type menu (buttons)
    const menu = ButtonMenu.generateTransactionTypeMenu();

    // Initialize session with transaction state
    await SessionManager.updateSession(user.id, {
      menu: MENU_STATES.TRANSACTION,
    });

    try {
      await client.sendMessage(message.from, menu);
    } catch (error) {
      logger.error("Error sending transaction type menu", { error });
      // Fallback to text menu
      await client.sendMessage(
        message.from,
        "Pilih jenis transaksi:\n1. 💰 Penjualan\n2. 💸 Pengeluaran\n3. 🔙 Kembali",
      );
    }
  }

  /**
   * Step 2: Handle transaction type selection
   * User selects income or expense, move to category selection
   */
  static async handleTransactionTypeSelected(
    user: User,
    transactionType: "income" | "expense",
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    // Store selected type in session
    await SessionManager.updateSession(user.id, {
      transactionType,
      menu: MENU_STATES.CATEGORY,
    });

    // Get categories for the selected type
    const categories = await CategoryModel.findByType(transactionType);

    // Generate category selection menu
    const categoryMenu = ButtonMenu.generateCategoryMenu(categories);

    try {
      await client.sendMessage(message.from, categoryMenu);
    } catch (error) {
      logger.error("Error sending category menu", { error });
    }
  }

  /**
   * Step 3: Handle category selection
   * User selects category, move to amount input
   */
  static async handleCategoryInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    // Allow user to cancel
    if (input === "batal" || input === "cancel") {
      await SessionManager.clearSession(user.id);
      await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
      return;
    }

    // Find category by name and validate against transaction type
    const category = await CategoryModel.findByName(input);
    if (!category || category.type !== session.transactionType) {
      await client.sendMessage(
        message.from,
        `❌ Kategori "${input}" tidak ditemukan atau tidak cocok dengan tipe transaksi.`,
      );
      return;
    }

    // Store category in session and move to amount input
    await SessionManager.updateSession(user.id, {
      category: category.name,
      menu: MENU_STATES.AMOUNT,
    });

    await client.sendMessage(message.from, "💵 Berapa jumlahnya?");
  }

  /**
   * Step 4: Handle amount input
   * User enters amount, validate and move to confirmation
   */
  static async handleAmountInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    // Allow cancellation
    if (input === "batal" || input === "cancel") {
      await SessionManager.clearSession(user.id);
      await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
      return;
    }

    // Validate amount format and value range
    const validation = TransactionValidator.validateAmount(input);
    if (!validation.valid) {
      await client.sendMessage(
        message.from,
        MessageFormatter.formatInvalidInputMessage("Jumlah", [
          "500000",
          "500.000",
          "500,000",
        ]),
      );
      return;
    }

    // Store amount in session
    await SessionManager.updateSession(user.id, {
      amount: input,
      menu: MENU_STATES.DESCRIPTION,
    });

    await client.sendMessage(
      message.from,
      "📝 Keterangan? (optional, ketik '-' untuk skip)",
    );
  }

  /**
   * Step 5: Handle description input
   * User enters optional description, move to confirmation
   */
  static async handleDescriptionInput(
    user: User,
    input: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category || !session?.amount) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    // Store description (skip if -)
    const description = input === "-" ? undefined : input;

    await SessionManager.updateSession(user.id, {
      description,
      menu: MENU_STATES.CONFIRM,
    });

    // Show confirmation message
    const validation = TransactionValidator.validateAmount(session.amount);
    if (!validation.parsed) {
      throw new Error("Invalid amount");
    }

    const confirmMsg = MessageFormatter.formatConfirmationMessage({
      type: session.transactionType,
      category: session.category,
      amount: validation.parsed,
      description,
      userName: user.name,
    });

    const confirmButtons = ButtonMenu.generateConfirmationButtons();

    try {
      await client.sendMessage(message.from, confirmMsg);
      await client.sendMessage(message.from, confirmButtons);
    } catch (error) {
      logger.error("Error sending confirmation", { error });
    }
  }

  /**
   * Step 6: Handle confirmation
   * User confirms transaction, process and save to database
   */
  static async handleConfirmation(
    user: User,
    confirmed: boolean,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    const session = await SessionManager.getSession(user.id);
    if (!session?.transactionType || !session?.category || !session?.amount) {
      await client.sendMessage(
        message.from,
        "❌ Sesi tidak valid. Silakan mulai lagi.",
      );
      return;
    }

    if (!confirmed) {
      await SessionManager.clearSession(user.id);
      await client.sendMessage(message.from, "❌ Transaksi dibatalkan.");
      return;
    }

    // Process transaction
    const result = await TransactionProcessor.processTransaction({
      userId: user.id,
      type: session.transactionType,
      category: session.category,
      amount: session.amount,
      description: session.description,
    });

    // Clear session
    await SessionManager.clearSession(user.id);

    if (!result.success) {
      await client.sendMessage(
        message.from,
        `❌ Gagal menyimpan transaksi: ${result.error}`,
      );
      return;
    }

    // Show success message
    const successMsg = TransactionProcessor.getSuccessMessage(
      result.transaction!,
    );
    await client.sendMessage(message.from, successMsg);

    // Append daily total
    const dailyMsg =
      await TransactionProcessor.getDailyTotalMessage(user.id);
    if (dailyMsg) {
      await client.sendMessage(message.from, dailyMsg);
    }
  }
}
```

#### 3. Service Layer Implementation

**Transaction Processor - Business Logic:**

```typescript
// src/services/transaction/processor.ts
export class TransactionProcessor {
  /**
   * Main transaction processing orchestrator
   * Coordinates validation, approval analysis, and persistence
   */
  static async processTransaction(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: string | number;
    description?: string;
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      // Step 1: Validate transaction data
      const validation = await TransactionValidator.validateTransaction(data);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(", "),
        };
      }

      // Step 2: Parse and normalize amount
      const amount = parseAmount(String(data.amount));

      // Step 3: Analyze transaction for suspicious patterns and determine approval
      const approvalDecision = await ApprovalService.analyzeTransaction(
        data.userId,
        data.type,
        amount,
        data.category,
        data.description,
      );

      logger.info("Transaction approval decision", {
        userId: data.userId,
        status: approvalDecision.status,
        requiresManualApproval: approvalDecision.requiresManualApproval,
        confidenceScore: approvalDecision.confidenceScore,
      });

      // Step 4: Create transaction in database with approval status
      const transaction = await TransactionModel.create({
        userId: data.userId,
        type: data.type,
        category: data.category,
        amount,
        description: data.description,
        approvalStatus: approvalDecision.status,
      });

      // Step 5: Log to audit trail
      await AuditLogger.logTransactionCreated(data.userId, transaction.id, {
        type: data.type,
        category: data.category,
        amount: transaction.amount.toNumber(),
        description: data.description,
        approvalStatus: approvalDecision.status,
      });

      logger.info("Transaction created successfully", {
        transactionId: transaction.id,
        userId: data.userId,
        type: data.type,
        amount: transaction.amount.toString(),
        approvalStatus: approvalDecision.status,
      });

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      logger.error("Error processing transaction", { error, data });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process transaction",
      };
    }
  }

  /**
   * Format success message for user
   */
  static getSuccessMessage(transaction: {
    amount: string | number | Decimal;
    type: string;
    category: string;
    timestamp: Date | string;
  }): string {
    const amount = formatCurrency(transaction.amount);
    const timestamp =
      transaction.timestamp instanceof Date
        ? transaction.timestamp
        : new Date(transaction.timestamp);
    const date = formatDateWITA(timestamp);
    const typeLabel =
      transaction.type === "income" ? "Pemasukan" : "Pengeluaran";

    return (
      `✅ Transaksi berhasil disimpan!\n\n` +
      `${typeLabel}: ${transaction.category}\n` +
      `Jumlah: ${amount}\n` +
      `Tanggal: ${date}\n` +
      `\nTerima kasih!`
    );
  }
}
```

**Transaction Validator:**

```typescript
// src/services/transaction/validator.ts
export class TransactionValidator {
  /**
   * Validate amount format and value range
   */
  static validateAmount(amount: string | number): {
    valid: boolean;
    error?: string;
    parsed?: number;
  } {
    try {
      const parsed = parseAmount(String(amount));
      validateAmountRange(
        parsed,
        MIN_TRANSACTION_AMOUNT,
        MAX_TRANSACTION_AMOUNT,
      );
      return { valid: true, parsed: parsed.toNumber() };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid amount format",
      };
    }
  }

  /**
   * Validate category exists and matches transaction type
   */
  static async validateCategory(
    categoryName: string,
    transactionType: TransactionType,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const category = await CategoryModel.findByName(categoryName);

      if (!category) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak ditemukan`,
        };
      }

      if (!category.isActive) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak aktif`,
        };
      }

      if (category.type !== transactionType) {
        return {
          valid: false,
          error: `Category "${categoryName}" tidak cocok dengan tipe transaksi`,
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error("Error validating category", {
        error,
        categoryName,
        transactionType,
      });
      return {
        valid: false,
        error: "Error memvalidasi category",
      };
    }
  }

  /**
   * Validate complete transaction data
   */
  static async validateTransaction(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: string | number;
    description?: string;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate amount
    const amountValidation = this.validateAmount(data.amount);
    if (!amountValidation.valid) {
      errors.push(amountValidation.error || "Invalid amount");
    }

    // Validate category
    const categoryValidation = await this.validateCategory(
      data.category,
      data.type,
    );
    if (!categoryValidation.valid) {
      errors.push(categoryValidation.error || "Invalid category");
    }

    // Validate description if provided
    const descriptionValidation = this.validateDescription(data.description);
    if (!descriptionValidation.valid) {
      errors.push(descriptionValidation.error || "Invalid description");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

**Approval Service - Decision Logic:**

```typescript
// src/services/transaction/approval.ts
export class ApprovalService {
  /**
   * Analyze transaction for suspicious patterns
   * Determines automatic approval, manual approval, or rejection
   */
  static async analyzeTransaction(
    userId: string,
    type: TransactionType,
    amount: Decimal,
    category: string,
    description?: string,
  ): Promise<ApprovalDecision> {
    logger.info("Analyzing transaction for approval", {
      userId,
      type,
      amount: amount.toString(),
      category,
    });

    const flags: SuspiciousFlags = {
      isDuplicate: false,
      isUnrealisticAmount: false,
      exceedsDailyLimit: false,
      exceedsDailyAmountLimit: false,
      hasSuspiciousKeywords: false,
      lacksDescription: false,
      rapidSuccessiveTransactions: false,
    };

    let suspicionScore = 0;

    // Check 1: Unrealistic amounts (>100 juta)
    if (amount.greaterThan(APPROVAL_CONFIG.UNREALISTIC_AMOUNT_THRESHOLD)) {
      flags.isUnrealisticAmount = true;
      suspicionScore += 40;
      logger.warn("Unrealistic amount detected", {
        amount: amount.toString(),
      });
    }

    // Check 2: Duplicate detection (same amount, category within 30 min)
    const duplicate = await this.checkForDuplicates(
      userId,
      type,
      amount,
      category,
    );
    if (duplicate) {
      flags.isDuplicate = true;
      suspicionScore += 30;
      logger.warn("Potential duplicate transaction detected", { userId });
    }

    // Check 3: Daily transaction count limit (max 50 per user per day)
    const dailyStats = await this.getDailyUserStats(userId);
    if (
      dailyStats.transactionCount >=
      APPROVAL_CONFIG.MAX_DAILY_TRANSACTIONS_PER_USER
    ) {
      flags.exceedsDailyLimit = true;
      suspicionScore += 20;
    }

    // Check 4: Daily amount limit (max 50 juta per user per day)
    if (
      dailyStats.totalAmount.greaterThanOrEqualTo(
        APPROVAL_CONFIG.MAX_DAILY_AMOUNT_PER_USER,
      )
    ) {
      flags.exceedsDailyAmountLimit = true;
      suspicionScore += 25;
    }

    // Check 5: Rapid successive transactions (3+ within 5 minutes)
    const recentCount = await this.getRecentTransactionCount(userId, 5);
    if (recentCount >= 3) {
      flags.rapidSuccessiveTransactions = true;
      suspicionScore += 15;
    }

    // Check 6: Suspicious keywords in description
    if (
      description &&
      APPROVAL_CONFIG.SUSPICIOUS_KEYWORDS.some((kw) =>
        description.toLowerCase().includes(kw),
      )
    ) {
      flags.hasSuspiciousKeywords = true;
      suspicionScore += 20;
    }

    // Check 7: Missing description for large amounts
    if (amount.greaterThan(new Decimal(50_000_000)) && !description) {
      flags.lacksDescription = true;
      suspicionScore += 10;
    }

    // Determine approval status based on suspicion score
    let status: ApprovalStatus = "approved";
    let requiresManualApproval = false;

    if (suspicionScore >= 50) {
      status = "pending";
      requiresManualApproval = true;
    } else if (
      amount.greaterThan(APPROVAL_CONFIG.MAX_AUTO_APPROVE_AMOUNT)
    ) {
      status = "pending";
      requiresManualApproval = true;
    }

    const reason = this.generateApprovalReason(flags, suspicionScore);

    return {
      status,
      requiresManualApproval,
      flags,
      reason,
      confidenceScore: suspicionScore,
    };
  }

  private static generateApprovalReason(
    flags: SuspiciousFlags,
    score: number,
  ): string {
    if (score === 0) return "Auto-approved: No suspicious patterns detected";

    const reasons: string[] = [];
    if (flags.isDuplicate) reasons.push("Potential duplicate detected");
    if (flags.isUnrealisticAmount) reasons.push("Unrealistic amount");
    if (flags.exceedsDailyLimit) reasons.push("Daily transaction count exceeded");
    if (flags.exceedsDailyAmountLimit) reasons.push("Daily amount limit exceeded");
    if (flags.hasSuspiciousKeywords) reasons.push("Suspicious keywords found");
    if (flags.lacksDescription) reasons.push("Large amount without description");
    if (flags.rapidSuccessiveTransactions)
      reasons.push("Rapid successive transactions");

    return `Requires review: ${reasons.join(", ")}`;
  }
}
```

#### 4. Data Model Layer

**Transaction Model - Data Access:**

```typescript
// src/models/transaction.ts
export class TransactionModel {
  /**
   * Create new transaction
   */
  static async create(data: {
    userId: string;
    type: TransactionType;
    category: string;
    amount: Decimal | number | string;
    description?: string;
    approvalStatus?: ApprovalStatus;
  }): Promise<Transaction> {
    try {
      // Validate and parse amount
      const amountDecimal =
        typeof data.amount === "string" || typeof data.amount === "number"
          ? parseAmount(String(data.amount))
          : data.amount;

      validateAmountRange(amountDecimal);

      // Check for duplicate (same user, category, amount within 1 minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const duplicate = await prisma.transaction.findFirst({
        where: {
          userId: data.userId,
          category: data.category,
          amount: amountDecimal,
          timestamp: {
            gte: oneMinuteAgo,
          },
        },
      });

      if (duplicate) {
        throw new Error("Duplicate transaction detected");
      }

      // Create transaction record
      return await prisma.transaction.create({
        data: {
          userId: data.userId,
          type: data.type,
          category: data.category,
          amount: amountDecimal,
          description: data.description,
          approvalStatus: data.approvalStatus || "approved",
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error creating transaction", { error, data });
      throw error;
    }
  }

  /**
   * Find transactions by user ID with filtering
   */
  static async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      type?: TransactionType;
    },
  ): Promise<Transaction[]> {
    try {
      const where: {
        userId: string;
        type?: TransactionType;
        timestamp?: { gte?: Date; lte?: Date };
      } = { userId };

      if (options?.type) {
        where.type = options.type;
      }

      if (options?.startDate || options?.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      return await prisma.transaction.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: options?.limit,
        skip: options?.offset,
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error("Error finding transactions by user ID", { error, userId });
      throw error;
    }
  }

  /**
   * Get daily totals for user
   */
  static async getDailyTotals(userId: string): Promise<{
    income: Decimal;
    expense: Decimal;
    net: Decimal;
    count: number;
  }> {
    try {
      const { start, end } = getDayRangeWITA();

      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          timestamp: { gte: start, lte: end },
          approvalStatus: "approved",
        },
      });

      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

      const expense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

      const net = income.sub(expense);

      return {
        income,
        expense,
        net,
        count: transactions.length,
      };
    } catch (error) {
      logger.error("Error getting daily totals", { error, userId });
      throw error;
    }
  }
}
```

#### 5. Database Schema

```prisma
// prisma/schema.prisma
model Transaction {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @map("user_id") @db.Uuid
  type            TransactionType
  category        String          @db.VarChar(100)
  amount          Decimal         @db.Decimal(15, 2)
  description     String?         @db.VarChar(255)
  approvalStatus  ApprovalStatus  @default(approved) @map("approval_status")
  approvalBy      String?         @map("approval_by") @db.Uuid
  timestamp       DateTime        @default(now()) @db.Timestamptz(6)
  deletedAt       DateTime?       @map("deleted_at") @db.Timestamptz(6)
  
  // Relations
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  approver        User?           @relation("TransactionApprover", fields: [approvalBy], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([userId, timestamp])
  @@index([approvalStatus])
  @@index([type])
  @@map("transactions")
}

enum TransactionType {
  income
  expense
}

enum ApprovalStatus {
  approved
  pending
  rejected
}
```

#### 6. Error Handling & Edge Cases

**Transaction Handler Error Handling:**

```typescript
// Error cases handled:
1. Session Validation
   - if (!session?.transactionType) -> Show error, offer restart
   - if (!session?.category) -> Show error, offer restart
   - if (!session?.amount) -> Show error, offer restart

2. Input Validation Errors
   - Invalid amount format -> Show examples of valid formats
   - Invalid category -> Show available categories
   - Category type mismatch -> Show categories for correct type

3. Database Errors
   - Duplicate transaction -> Log and retry or inform user
   - Approval service failure -> Default to "pending" status
   - Connection errors -> Retry 3x with exponential backoff

4. WhatsApp Client Errors
   - Client not initialized -> Log error, skip message
   - Send message fails -> Try fallback text format
   - Button delivery fails -> Fallback to text menu

5. User States
   - Unauthorized user -> Reject and show registration message
   - Inactive user -> Reject access
   - User editing -> Route to edit handler instead of normal flow
```

---

### Workflow 2: Transaction Approval Workflow

**Purpose:** Boss/Manager approval of pending transactions with role-based access control.

**Triggering Action:** Boss/Dev user requests pending approvals or directly approves/rejects transaction.

**Files Involved:**
- `src/bot/handlers/approval.ts` - Approval handler
- `src/services/transaction/approval.ts` - Approval service
- `src/services/user/rbac.ts` - Role-based access control
- `src/services/audit/logger.ts` - Audit logging
- `src/models/transaction.ts` - Transaction queries
- `src/lib/notifications.ts` - Notification service

#### 1. Entry Point - Pending Approvals Request

```typescript
// src/bot/handlers/approval.ts
export class ApprovalHandler {
  /**
   * Handle request for pending approvals list
   * Only Boss/Dev roles can access
   */
  static async handlePendingApprovals(
    user: User,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    // RBAC: Verify Boss or Dev role
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    logger.info("Boss requesting pending approvals", { userId: user.id });

    try {
      // Query pending transactions
      const pending = await ApprovalService.getPendingTransactions(10);

      if (pending.length === 0) {
        await client.sendMessage(
          message.from,
          "✅ *Tidak Ada Transaksi Pending*\n\nSemua transaksi sudah disetujui.",
        );
        return;
      }

      // Format pending list for display
      let msg = `⏳ *Transaksi Pending Approval*\n\n`;
      msg += `Total: ${pending.length} transaksi\n\n`;

      for (let i = 0; i < Math.min(pending.length, 10); i++) {
        const tx = pending[i];
        const icon = tx.type === "income" ? "💰" : "💸";
        msg += `${i + 1}. ${icon} *${formatCurrency(tx.amount)}*\n`;
        msg += `   Kategori: ${tx.category}\n`;
        msg += `   Oleh: ${tx.userName}\n`;
        if (tx.description) {
          msg += `   Keterangan: ${tx.description}\n`;
        }
        msg += `   ID: \`${tx.id.substring(0, 8)}\`\n\n`;
      }

      msg += `_Gunakan /approve <id> atau /reject <id> untuk memproses_`;

      await client.sendMessage(message.from, msg);

      // Send action buttons for first transaction
      if (pending.length > 0) {
        const firstTx = pending[0];
        const buttons = ButtonMenu.generateApprovalButtons(firstTx.id);
        await client.sendMessage(message.from, buttons);
      }
    } catch (error) {
      logger.error("Error handling pending approvals", { error, userId: user.id });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle transaction approval
   */
  static async handleApprove(
    user: User,
    transactionId: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    // RBAC Check
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    try {
      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        await client.sendMessage(
          message.from,
          "❌ Transaksi tidak ditemukan.",
        );
        return;
      }

      if (transaction.approvalStatus !== "pending") {
        await client.sendMessage(
          message.from,
          `❌ Transaksi sudah ${transaction.approvalStatus}.`,
        );
        return;
      }

      // Update approval status
      const updated = await TransactionModel.updateApproval(
        transactionId,
        "approved",
        user.id,
      );

      // Log to audit trail
      await AuditLogger.logTransactionApproved(
        user.id,
        transactionId,
        "approved",
      );

      // Notify original user
      const origUser = await UserModel.findById(transaction.userId);
      if (origUser) {
        await client.sendMessage(
          `${origUser.phoneNumber}@c.us`,
          `✅ Transaksi Anda sebesar ${formatCurrency(transaction.amount)} telah disetujui oleh ${user.name}.`,
        );
      }

      // Confirm to boss
      await client.sendMessage(
        message.from,
        `✅ Transaksi ${transactionId.substring(0, 8)} telah disetujui.`,
      );

      logger.info("Transaction approved", {
        transactionId,
        approvedBy: user.id,
      });
    } catch (error) {
      logger.error("Error approving transaction", {
        error,
        transactionId,
        userId: user.id,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }

  /**
   * Handle transaction rejection
   */
  static async handleReject(
    user: User,
    transactionId: string,
    reason: string,
    message: Message,
  ): Promise<void> {
    const client = getWhatsAppClient();
    if (!client) return;

    // RBAC Check
    if (user.role !== "boss" && user.role !== "dev") {
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unauthorized"),
      );
      return;
    }

    try {
      // Get transaction
      const transaction = await TransactionModel.findById(transactionId);
      if (!transaction) {
        await client.sendMessage(
          message.from,
          "❌ Transaksi tidak ditemukan.",
        );
        return;
      }

      if (transaction.approvalStatus !== "pending") {
        await client.sendMessage(
          message.from,
          `❌ Transaksi sudah ${transaction.approvalStatus}.`,
        );
        return;
      }

      // Update approval status
      await TransactionModel.updateApproval(
        transactionId,
        "rejected",
        user.id,
      );

      // Log to audit trail
      await AuditLogger.logTransactionRejected(
        user.id,
        transactionId,
        reason,
      );

      // Notify original user
      const origUser = await UserModel.findById(transaction.userId);
      if (origUser) {
        await client.sendMessage(
          `${origUser.phoneNumber}@c.us`,
          `❌ Transaksi Anda sebesar ${formatCurrency(transaction.amount)} telah ditolak.\n\n` +
          `Alasan: ${reason || "Tidak ada keterangan"}`,
        );
      }

      // Confirm to boss
      await client.sendMessage(
        message.from,
        `✅ Transaksi ${transactionId.substring(0, 8)} telah ditolak.`,
      );

      logger.info("Transaction rejected", {
        transactionId,
        rejectedBy: user.id,
        reason,
      });
    } catch (error) {
      logger.error("Error rejecting transaction", {
        error,
        transactionId,
        userId: user.id,
      });
      await client.sendMessage(
        message.from,
        MessageFormatter.getErrorMessage("unknown"),
      );
    }
  }
}
```

#### 2. Service Layer - Approval Logic

```typescript
export class ApprovalService {
  /**
   * Get pending transactions for review
   */
  static async getPendingTransactions(
    limit: number = 10,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      userName: string;
      type: TransactionType;
      category: string;
      amount: Decimal;
      description?: string;
      timestamp: Date;
    }>
  > {
    try {
      const pending = await prisma.transaction.findMany({
        where: {
          approvalStatus: "pending",
        },
        include: {
          user: true,
        },
        orderBy: {
          timestamp: "asc",
        },
        take: limit,
      });

      return pending.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        userName: tx.user.name || tx.user.phoneNumber,
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        description: tx.description,
        timestamp: tx.timestamp,
      }));
    } catch (error) {
      logger.error("Error getting pending transactions", { error });
      throw error;
    }
  }
}
```

#### 3. Error Handling

```typescript
// Approval Workflow Errors:
1. Authorization Errors
   - Only Boss/Dev can approve -> Check role, reject if unauthorized
   - User trying to approve own transaction -> Prevent (future)

2. Transaction State Errors
   - Transaction already approved -> Inform user, skip
   - Transaction already rejected -> Inform user, skip
   - Transaction not found -> Inform user, log error

3. Notification Errors
   - Original user offline -> Queue for delivery later
   - Client error sending message -> Log and retry

4. Database Errors
   - Update fails -> Rollback, inform user
   - Audit log fails -> Still save approval but alert
```

---

### Workflow 3: Report Generation Workflow

**Purpose:** Generate detailed financial reports with role-specific data visibility.

**Triggering Action:** User requests report (daily, weekly, monthly, custom).

**Files Involved:**
- `src/bot/handlers/report.ts` - Report handler
- `src/services/report/generator.ts` - Report logic
- `src/services/report/formatter.ts` - Report formatting
- `src/services/report/pdf.ts` - PDF generation
- `src/models/transaction.ts` - Transaction queries

#### 1. Entry Point

```typescript
// src/bot/handlers/report.ts
export class ReportDrillDownHandler {
  /**
   * Handle report request - routes to appropriate report type
   */
  static async handleReportRequest(message: Message): Promise<void> {
    try {
      // Authenticate user
      const phoneNumber = message.from.replace("@c.us", "");
      const user = await prisma.user.findFirst({
        where: { phoneNumber, isActive: true },
      });

      if (!user) {
        await message.reply(
          "❌ Anda belum terdaftar. Hubungi admin untuk registrasi.",
        );
        return;
      }

      const text = message.body.toLowerCase().trim();

      // Route to appropriate handler
      if (text === "detail" || text === "laporan detail") {
        await this.handleDetailRequest(message, user.id, user.role);
      } else if (text.startsWith("detail kategori")) {
        await this.handleCategoryDetailRequest(message, user.id, user.role);
      } else if (text.startsWith("bandingkan")) {
        await this.handleComparisonRequest(message, user.id, user.role);
      } else if (text === "laporan pdf" || text === "download pdf") {
        await this.handlePDFRequest(message, user.id, user.role);
      } else if (text === "laporan minggu ini") {
        await this.handleWeeklyRequest(message, user.id, user.role);
      } else if (text === "laporan bulan ini") {
        await this.handleMonthlyRequest(message, user.id, user.role);
      } else {
        // Show help
        await message.reply("ℹ️ *Perintah Laporan yang Tersedia:*\n...");
      }
    } catch (error) {
      logger.error("Error handling report request", { error });
      await message.reply("❌ Terjadi kesalahan saat memproses permintaan.");
    }
  }

  /**
   * Generate detailed daily report
   */
  private static async handleDetailRequest(
    message: Message,
    userId: string,
    role: string,
  ): Promise<void> {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    logger.info("Generating detailed report", {
      userId,
      role,
      startDate,
      endDate,
    });

    try {
      // Generate role-specific report (dev/boss see all, employee sees own)
      const reportData =
        await ReportGenerator.generateRoleSpecificReport(
          role as never,
          startDate,
          endDate,
          role === "employee" ? userId : undefined,
        );

      // Format for display
      const formattedReport =
        ReportFormatter.formatDetailedReport(reportData);

      await message.reply(formattedReport);
    } catch (error) {
      logger.error("Error generating detail report", { error, userId });
      await message.reply("❌ Gagal membuat laporan. Silakan coba lagi.");
    }
  }
}
```

#### 2. Service Layer - Report Generation

```typescript
// src/services/report/generator.ts
export class ReportGenerator {
  /**
   * Generate report with role-based filtering
   */
  static async generateRoleSpecificReport(
    role: UserRole,
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<ReportData> {
    try {
      let transactions: Transaction[] = [];

      // Role-based data access
      if (role === "dev" || role === "boss") {
        // Dev/Boss see all approved transactions
        transactions = await TransactionModel.findByDateRange(
          startDate,
          endDate,
        );
      } else if (role === "employee") {
        // Employee sees own transactions only
        transactions = await TransactionModel.findByUserId(userId || "", {
          startDate,
          endDate,
        });
      } else if (role === "investor") {
        // Investor sees summary only
        transactions = await TransactionModel.findByDateRange(
          startDate,
          endDate,
        );
      }

      // Aggregate data
      const income = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

      const expense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum.add(t.amount), new Decimal(0));

      const net = income.sub(expense);

      // Group by category
      const byCategory = this.groupByCategory(transactions);

      return {
        period: { start: startDate, end: endDate },
        summary: {
          totalIncome: income,
          totalExpense: expense,
          netCashFlow: net,
          transactionCount: transactions.length,
        },
        byCategory,
        transactions: role === "investor" ? [] : transactions,
      };
    } catch (error) {
      logger.error("Error generating role-specific report", {
        error,
        role,
        userId,
      });
      throw error;
    }
  }

  private static groupByCategory(
    transactions: Transaction[],
  ): Record<string, { count: number; total: Decimal; type: TransactionType }> {
    const grouped: Record<
      string,
      { count: number; total: Decimal; type: TransactionType }
    > = {};

    for (const tx of transactions) {
      if (!grouped[tx.category]) {
        grouped[tx.category] = {
          count: 0,
          total: new Decimal(0),
          type: tx.type,
        };
      }
      grouped[tx.category].count++;
      grouped[tx.category].total = grouped[tx.category].total.add(
        tx.amount,
      );
    }

    return grouped;
  }
}
```

#### 3. Report Formatting

```typescript
// src/services/report/formatter.ts
export class ReportFormatter {
  /**
   * Format detailed report for WhatsApp display
   */
  static formatDetailedReport(data: ReportData): string {
    const start = data.period.start.toLocaleDateString("id-ID");
    const end = data.period.end.toLocaleDateString("id-ID");

    let msg = `📊 *Laporan Detail*\n`;
    msg += `Periode: ${start} - ${end}\n\n`;

    msg += `💰 *Pemasukan:* ${formatCurrency(data.summary.totalIncome)}\n`;
    msg += `💸 *Pengeluaran:* ${formatCurrency(data.summary.totalExpense)}\n`;
    msg += `💵 *Net:* ${formatCurrency(data.summary.netCashFlow)}\n`;
    msg += `📝 *Total Transaksi:* ${data.summary.transactionCount}\n\n`;

    msg += `*Per Kategori:*\n`;
    for (const [category, stats] of Object.entries(data.byCategory)) {
      const icon = stats.type === "income" ? "📈" : "📉";
      msg += `${icon} ${category}: ${stats.count}x ${formatCurrency(stats.total)}\n`;
    }

    return msg;
  }
}
```

---

## Implementation Patterns & Best Practices

### 1. Naming Conventions

**Handler Naming:**
```
- {Feature}Handler (e.g., TransactionHandler, ApprovalHandler, ReportHandler)
- Method: handleX (e.g., handleTransactionStart, handleAmountInput)
```

**Service Naming:**
```
- {Feature}Service or {Feature}Processor (e.g., TransactionProcessor, ApprovalService)
- {Feature}Validator (e.g., TransactionValidator)
```

**Model Naming:**
```
- {Entity}Model (e.g., TransactionModel, UserModel, CategoryModel)
- Method: create, findById, findByX, update, delete
```

**DTO/Type Naming:**
```
- {Entity}Data or Create{Entity}Data (e.g., TransactionData, CreateUserData)
- {Entity}Decision or {Entity}Result (e.g., ApprovalDecision)
```

**Method Naming:**
```
- validate* → Validation methods
- analyze* → Analysis methods
- get* → Query methods
- handle* → Event/message handlers
- format* → Formatting methods
```

### 2. State Machine Pattern

```typescript
// Session-based state management
enum MenuState {
  START = "start",
  TRANSACTION = "transaction",
  CATEGORY = "category",
  AMOUNT = "amount",
  DESCRIPTION = "description",
  CONFIRM = "confirm",
}

// State transitions
START → TRANSACTION → CATEGORY → AMOUNT → DESCRIPTION → CONFIRM → (save or cancel)
```

### 3. Error Handling Pattern

```typescript
// Structured error response
{
  success: boolean;
  error?: string;
  data?: T;
}

// Validation pattern
{
  valid: boolean;
  error?: string;
  parsed?: T;
  errors?: string[];
}

// Decision pattern
{
  status: ApprovalStatus;
  requiresManualApproval: boolean;
  reason: string;
  confidenceScore: number;
}
```

### 4. Service Layer Dependencies

```
Handlers → Services → Models → Prisma → Database
     ↓
  Middleware (Auth, Session)
     ↓
  Utilities (Logger, Validators, Formatters)
```

### 5. Validation Pattern

```typescript
// Three-level validation
1. Input Validation (format, type)
2. Business Logic Validation (category match, amount range)
3. State Validation (session exists, user authorized)
```

### 6. Audit Logging Pattern

```typescript
// Log all state-changing operations
await AuditLogger.logTransactionCreated(userId, transactionId, details);
await AuditLogger.logTransactionApproved(userId, transactionId, status);
await AuditLogger.logTransactionRejected(userId, transactionId, reason);
```

---

## Creating Similar Features - Step-by-Step Template

### For a New Transaction-like Feature

1. **Create Handler** (`src/bot/handlers/feature.ts`)
   ```typescript
   export class FeatureHandler {
     static async handleFeatureStart(user: User, message: Message) {
       // 1. Check session/auth
       // 2. Initialize session state
       // 3. Send UI (buttons/text)
     }

     static async handleFeatureInput(user: User, input: string, message: Message) {
       // 1. Get session
       // 2. Validate input
       // 3. Update session state
       // 4. Move to next step or process
     }
   }
   ```

2. **Create Service** (`src/services/feature/`)
   ```typescript
   export class FeatureProcessor {
     static async processFeature(data): Promise<Result> {
       // 1. Validate
       // 2. Business logic
       // 3. Persist
       // 4. Log audit
     }
   }

   export class FeatureValidator {
     static async validate(data): Promise<ValidationResult> {
       // Input and business rule validation
     }
   }
   ```

3. **Create Model** (`src/models/feature.ts`)
   ```typescript
   export class FeatureModel {
     static async create(data) { }
     static async findById(id) { }
     static async findByUserId(userId) { }
   }
   ```

4. **Create Database Schema** (`prisma/schema.prisma`)
   ```prisma
   model Feature {
     id String @id @default(uuid())
     userId String
     // ... fields
     user User @relation(fields: [userId], references: [id])
   }
   ```

5. **Register Handler** in message router
   ```typescript
   if (session?.menu === MENU_STATES.FEATURE) {
     await FeatureHandler.handleFeatureInput(user, body, message);
   }
   ```

### Common Pitfalls to Avoid

1. **Session Management**
   - ❌ Not clearing session on error
   - ✅ Always clear session after completion or cancellation

2. **Authorization**
   - ❌ Checking role only at handler level
   - ✅ Verify role at multiple layers (handler, service, query level)

3. **Error Messages**
   - ❌ Generic error messages
   - ✅ Specific, actionable error messages with examples

4. **Transaction Validation**
   - ❌ Validating only at one level
   - ✅ Validate at input, business logic, and database levels

5. **Async Operations**
   - ❌ Not awaiting operations
   - ✅ Always await database/external calls

6. **Logging**
   - ❌ Logging only errors
   - ✅ Log important state transitions and decisions

---

## Performance Optimization

### Database Query Optimization

```typescript
// Use includes to avoid N+1 queries
const transactions = await prisma.transaction.findMany({
  include: {
    user: true,  // Join user data
    approver: true,
  },
  take: 10,  // Limit results
});

// Use indexes (defined in schema) for:
- userId (frequent filters)
- timestamp (range queries)
- approvalStatus (filtering)
- userId + timestamp (combined queries)
```

### Caching Strategy

```typescript
// Cache frequently accessed data
const categories = await cache.get('categories:active');
if (!categories) {
  const fetched = await CategoryModel.findActive();
  await cache.set('categories:active', fetched, 3600); // 1 hour TTL
}
```

### Session Management

```typescript
// Clean up old sessions to prevent memory bloat
SessionManager.startCleanupInterval(); // Runs every 5 minutes
```

---

## Testing Approach

### Unit Tests

```typescript
describe('TransactionValidator', () => {
  test('validates correct amount format', () => {
    const result = TransactionValidator.validateAmount('500000');
    expect(result.valid).toBe(true);
    expect(result.parsed).toBe(500000);
  });

  test('rejects invalid category', async () => {
    const result = await TransactionValidator.validateCategory(
      'invalid',
      'income',
    );
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('TransactionProcessor', () => {
  test('processes valid transaction end-to-end', async () => {
    const result = await TransactionProcessor.processTransaction({
      userId: testUser.id,
      type: 'income',
      category: 'Sales',
      amount: '500000',
    });
    expect(result.success).toBe(true);
    expect(result.transaction).toBeDefined();
  });
});
```

### E2E Tests

```typescript
test('user can record transaction via WhatsApp', async ({ page }) => {
  // Simulate WhatsApp message flow
  // 1. Send /record command
  // 2. Select transaction type
  // 3. Select category
  // 4. Enter amount
  // 5. Confirm
  // Verify transaction created in database
});
```

---

## Conclusion

This WhatsApp Cashflow Bot follows a layered architecture with clear separation of concerns:

- **Handlers** manage user interaction and routing
- **Services** implement business logic
- **Models** handle data access
- **Middleware** handles cross-cutting concerns

Key patterns include:
- State machine for multi-step workflows
- Role-based access control for authorization
- Approval scoring for risk assessment
- Audit logging for compliance

When implementing new features, follow the established patterns, validate at multiple levels, and ensure comprehensive error handling.
