/**
 * Application constants
 */

export const APP_NAME = 'WhatsApp Cashflow Bot';
export const APP_VERSION = '1.0.0';

// User Roles
export const USER_ROLES = {
  DEV: 'dev',
  BOSS: 'boss',
  EMPLOYEE: 'employee',
  INVESTOR: 'investor',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Transaction Types
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// Approval Status
export const APPROVAL_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const;

export type ApprovalStatus = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS];

// Report Types
export const REPORT_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

// Recommendation Types
export const RECOMMENDATION_TYPES = {
  EXPENSE_SPIKE: 'expense_spike',
  REVENUE_DECLINE: 'revenue_decline',
  CASHFLOW_WARNING: 'cashflow_warning',
  EMPLOYEE_INACTIVITY: 'employee_inactivity',
  TARGET_VARIANCE: 'target_variance',
} as const;

export type RecommendationType = typeof RECOMMENDATION_TYPES[keyof typeof RECOMMENDATION_TYPES];

// Recommendation Priority
export const RECOMMENDATION_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type RecommendationPriority = typeof RECOMMENDATION_PRIORITY[keyof typeof RECOMMENDATION_PRIORITY];

// Timezone
export const TIMEZONE = 'Asia/Makassar'; // WITA (UTC+8)

// Session Management
export const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Button Interface
export const MAX_BUTTONS_PER_ROW = 3;
export const MAX_BUTTON_LABEL_LENGTH = 20;
export const MAX_LIST_ITEMS = 100;

// Transaction Limits
export const MIN_TRANSACTION_AMOUNT = 0.01;
export const MAX_TRANSACTION_AMOUNT = 500_000_000; // Rp 500M

// Rate Limiting
export const DEFAULT_RATE_LIMIT_MESSAGES_PER_MINUTE = 15;
export const DEFAULT_BUTTON_DEBOUNCE_MS = 3000;

// Report Generation
export const REPORT_GENERATION_TIME = '23:55'; // 5 minutes before delivery
export const REPORT_DELIVERY_TIME = '24:00';
export const REPORT_RETRY_ATTEMPTS = 3;
export const REPORT_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Recommendation Thresholds
export const EXPENSE_SPIKE_THRESHOLD = 0.3; // 30%
export const REVENUE_DECLINE_THRESHOLD = 0.15; // 15%
export const NEGATIVE_CASHFLOW_DAYS = 3;
export const CONFIDENCE_SCORE_THRESHOLD = 80; // 80% for proactive alerts

// Data Retention (in days)
export const TRANSACTION_RETENTION_DAYS = 7 * 365; // 7 years
export const REPORT_RETENTION_DAYS = 7 * 365; // 7 years
export const AUDIT_LOG_RETENTION_DAYS = 7 * 365; // 7 years
export const RECOMMENDATION_RETENTION_DAYS = 90; // 90 days

// Phone Number Format (Indonesian)
export const PHONE_NUMBER_REGEX = /^(\+62|0)[0-9]{9,12}$/;

// Amount Format Patterns
export const AMOUNT_INPUT_PATTERNS = [
  /^\d+$/, // 500000
  /^\d{1,3}(\.\d{3})+$/, // 500.000
  /^\d{1,3}(,\d{3})+$/, // 500,000
];

// Menu States
export const MENU_STATES = {
  MAIN: 'main',
  TRANSACTION: 'transaction',
  CATEGORY: 'category',
  AMOUNT: 'amount',
  CONFIRM: 'confirm',
  REPORT: 'report',
  ADMIN: 'admin',
} as const;

export type MenuState = typeof MENU_STATES[keyof typeof MENU_STATES];

// Error Messages (Indonesian)
export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Input tidak valid. Silakan coba lagi.',
  UNAUTHORIZED: 'Anda tidak memiliki izin untuk melakukan aksi ini.',
  NOT_FOUND: 'Data tidak ditemukan.',
  DUPLICATE_TRANSACTION: 'Transaksi serupa sudah ada dalam 1 menit terakhir.',
  INVALID_AMOUNT: 'Jumlah harus lebih dari 0 dan kurang dari Rp 500.000.000.',
  SESSION_EXPIRED: 'Sesi Anda telah berakhir. Silakan mulai lagi.',
  RATE_LIMIT_EXCEEDED: 'Terlalu banyak permintaan. Silakan tunggu sebentar.',
} as const;

