import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";
import { env } from "../config/env";

/**
 * Database connection pool configuration
 * Optimized for concurrent transactions (50 concurrent users)
 */
const DATABASE_POOL_CONFIG = {
  // Minimum connections kept open
  connection_limit_min: 5,
  // Maximum connections in pool
  connection_limit_max: 50,
  // Connection timeout in seconds
  connect_timeout: 10,
  // Pool timeout in seconds
  pool_timeout: 10,
  // Statement timeout in milliseconds
  statement_timeout: 30000, // 30 seconds
};

/**
 * Prisma client instance with connection pooling
 */
let prismaClient: PrismaClient | null = null;

/**
 * Get or create Prisma client with connection pool
 */
export function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  // Build connection string with pool parameters
  const connectionString = buildConnectionString();

  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Middleware for query logging
  prismaClient.$use(async (params, next) => {
    const before = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await next(params);
    const after = Date.now();

    logger.debug("Database query executed", {
      model: params.model,
      action: params.action,
      duration: after - before,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  });

  logger.info("Prisma client initialized with connection pool", {
    minConnections: DATABASE_POOL_CONFIG.connection_limit_min,
    maxConnections: DATABASE_POOL_CONFIG.connection_limit_max,
  });

  return prismaClient;
}

/**
 * Build connection string with pool parameters
 */
function buildConnectionString(): string {
  const baseUrl = env.DATABASE_URL;

  // Parse existing URL
  const url = new URL(baseUrl);

  // Add/update pool parameters
  url.searchParams.set(
    "connection_limit",
    DATABASE_POOL_CONFIG.connection_limit_max.toString(),
  );
  url.searchParams.set(
    "pool_timeout",
    DATABASE_POOL_CONFIG.pool_timeout.toString(),
  );
  url.searchParams.set(
    "connect_timeout",
    DATABASE_POOL_CONFIG.connect_timeout.toString(),
  );
  url.searchParams.set(
    "statement_timeout",
    DATABASE_POOL_CONFIG.statement_timeout.toString(),
  );

  // Add pgbouncer mode if not already set
  if (!url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  return url.toString();
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    await client.$connect();
    logger.info("Database connection established");

    // Test query
    await client.$queryRaw`SELECT 1`;
    logger.info("Database health check passed");
  } catch (error) {
    logger.error("Failed to connect to database", { error });
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    logger.info("Database connection closed");
    prismaClient = null;
  }
}

/**
 * Get database connection pool stats
 */
export async function getDatabaseStats(): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
}> {
  const client = getPrismaClient();

  try {
    // Query PostgreSQL connection stats
    const result = await client.$queryRaw<
      Array<{
        state: string;
        count: bigint;
      }>
    >`
      SELECT state, COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `;

    let activeConnections = 0;
    let idleConnections = 0;

    for (const row of result) {
      const count = Number(row.count);
      if (row.state === "active") {
        activeConnections = count;
      } else if (row.state === "idle") {
        idleConnections = count;
      }
    }

    const totalConnections = activeConnections + idleConnections;

    return {
      activeConnections,
      idleConnections,
      totalConnections,
    };
  } catch (error) {
    logger.error("Error getting database stats", { error });
    return {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
    };
  }
}

/**
 * Health check for database connection
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database health check failed", { error });
    return false;
  }
}

/**
 * Execute transaction with retry logic
 */
export async function executeTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const client = getPrismaClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.$transaction(async (tx) => {
        return await fn(tx as PrismaClient);
      });
    } catch (error) {
      lastError = error as Error;
      logger.warn("Transaction failed, retrying", {
        attempt,
        maxRetries,
        error: lastError.message,
      });

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error("Transaction failed after max retries", {
    maxRetries,
    error: lastError,
  });
  throw new Error(
    `Transaction failed: ${lastError?.message || "Unknown error"}`,
  );
}

export const database = {
  getClient: getPrismaClient,
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  getStats: getDatabaseStats,
  isHealthy: isDatabaseHealthy,
  executeTransaction,
};

export default database;
