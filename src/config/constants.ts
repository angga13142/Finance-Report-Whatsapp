/**
 * Command constants and configuration
 * Defines canonical command names, synonyms, abbreviations, and confidence thresholds
 */

import { env } from "./env";

// User roles (with uppercase accessors for backward compatibility)
export const USER_ROLES = {
  EMPLOYEE: "employee",
  BOSS: "boss",
  INVESTOR: "investor",
  DEV: "dev",
} as const;

// Type helper for UserRole
export type UserRoleType = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Menu states for session management
export const MENU_STATES = {
  MAIN: "main",
  TRANSACTION_TYPE: "transaction_type",
  TRANSACTION: "transaction",
  CATEGORY_SELECTION: "category_selection",
  CATEGORY: "category",
  AMOUNT_INPUT: "amount_input",
  AMOUNT: "amount",
  DESCRIPTION_INPUT: "description_input",
  CONFIRMATION: "confirmation",
  CONFIRM: "confirm",
  REPORT_VIEW: "report_view",
  PROFILE: "profile",
  SETTINGS: "settings",
  ADMIN: "admin",
} as const;

// UI constraints
export const MAX_BUTTON_LABEL_LENGTH = 20;
export const MAX_LIST_ITEMS = 100;

// Timezone
export const TIMEZONE = env.TZ || "Asia/Makassar";

// Session timeout (from env)
export const SESSION_TIMEOUT_MS = env.SESSION_TIMEOUT_MS;

// Phone number validation regex (Indonesian format)
export const PHONE_NUMBER_REGEX = /^(\+62|0)[0-9]{9,12}$/;

// Amount input patterns for parsing
export const AMOUNT_INPUT_PATTERNS = [
  /^Rp\s*([\d.,]+)$/i,
  /^([\d.,]+)\s*rupiah$/i,
  /^([\d.,]+)$/,
] as const;

// Transaction amount limits
export const MIN_TRANSACTION_AMOUNT = 1;
export const MAX_TRANSACTION_AMOUNT = 999999999999;

export const COMMANDS = {
  // Transaction commands
  RECORD_SALE: "catat_penjualan",
  RECORD_EXPENSE: "catat_pengeluaran",

  // Report commands
  VIEW_REPORT_TODAY: "lihat_laporan_hari_ini",
  VIEW_REPORT_WEEK: "lihat_laporan_minggu_ini",
  VIEW_REPORT_MONTH: "lihat_laporan_bulan_ini",

  // Balance commands
  VIEW_BALANCE: "lihat_saldo",
  CHECK_BALANCE: "cek_saldo",

  // Help commands
  HELP: "bantu",
  MENU: "menu",
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

/**
 * Command synonyms mapping
 * Maps alternative command text to canonical command names
 */
export const COMMAND_SYNONYMS: Record<string, CommandName> = {
  // Record sale synonyms
  tambah: COMMANDS.RECORD_SALE,
  input: COMMANDS.RECORD_SALE,
  masukkan: COMMANDS.RECORD_SALE,
  "record sale": COMMANDS.RECORD_SALE,
  "tambah penjualan": COMMANDS.RECORD_SALE,
  "input penjualan": COMMANDS.RECORD_SALE,

  // Record expense synonyms
  "catat pengeluaran": COMMANDS.RECORD_EXPENSE,
  "tambah pengeluaran": COMMANDS.RECORD_EXPENSE,
  "input pengeluaran": COMMANDS.RECORD_EXPENSE,
  "record expense": COMMANDS.RECORD_EXPENSE,

  // Report synonyms
  laporan: COMMANDS.VIEW_REPORT_TODAY,
  report: COMMANDS.VIEW_REPORT_TODAY,
  "lihat report": COMMANDS.VIEW_REPORT_TODAY,
  "view report": COMMANDS.VIEW_REPORT_TODAY,

  // Balance synonyms
  saldo: COMMANDS.VIEW_BALANCE,
  balance: COMMANDS.VIEW_BALANCE,
  "cek saldo": COMMANDS.CHECK_BALANCE,
  "check balance": COMMANDS.CHECK_BALANCE,

  // Help synonyms
  bantuan: COMMANDS.HELP,
  tolong: COMMANDS.HELP,
  help: COMMANDS.HELP,
} as const;

/**
 * Command abbreviations mapping
 * Maps short abbreviations to canonical command names (per FR-009)
 */
export const COMMAND_ABBREVIATIONS: Record<string, CommandName> = {
  cp: COMMANDS.RECORD_SALE, // "catat penjualan"
  ll: COMMANDS.VIEW_REPORT_TODAY, // "lihat laporan"
} as const;

/**
 * Confidence threshold for command recognition (per FR-041)
 * Commands with confidence ≥70% are auto-executed
 * Commands with confidence <70% require user confirmation or show suggestions
 */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Role-based command availability mapping
 * Defines which commands are available to each role
 */
export const ROLE_COMMANDS: Record<string, CommandName[]> = {
  employee: [
    COMMANDS.RECORD_SALE,
    COMMANDS.RECORD_EXPENSE,
    COMMANDS.VIEW_REPORT_TODAY,
    COMMANDS.VIEW_REPORT_WEEK,
    COMMANDS.VIEW_REPORT_MONTH,
    COMMANDS.VIEW_BALANCE,
    COMMANDS.CHECK_BALANCE,
    COMMANDS.HELP,
    COMMANDS.MENU,
  ],
  boss: [
    COMMANDS.RECORD_SALE,
    COMMANDS.RECORD_EXPENSE,
    COMMANDS.VIEW_REPORT_TODAY,
    COMMANDS.VIEW_REPORT_WEEK,
    COMMANDS.VIEW_REPORT_MONTH,
    COMMANDS.VIEW_BALANCE,
    COMMANDS.CHECK_BALANCE,
    COMMANDS.HELP,
    COMMANDS.MENU,
  ],
  investor: [
    COMMANDS.VIEW_REPORT_TODAY,
    COMMANDS.VIEW_REPORT_WEEK,
    COMMANDS.VIEW_REPORT_MONTH,
    COMMANDS.VIEW_BALANCE,
    COMMANDS.HELP,
    COMMANDS.MENU,
  ],
  dev: [
    COMMANDS.RECORD_SALE,
    COMMANDS.RECORD_EXPENSE,
    COMMANDS.VIEW_REPORT_TODAY,
    COMMANDS.VIEW_REPORT_WEEK,
    COMMANDS.VIEW_REPORT_MONTH,
    COMMANDS.VIEW_BALANCE,
    COMMANDS.CHECK_BALANCE,
    COMMANDS.HELP,
    COMMANDS.MENU,
  ],
} as const;
