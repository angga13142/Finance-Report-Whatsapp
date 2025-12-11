# Command Reference Guide

**Feature**: Button Deprecation & Command-Based UI Replacement  
**Last Updated**: December 17, 2025

## Overview

This document provides a comprehensive reference for all available text commands in the WhatsApp Cashflow Bot. Commands support fuzzy matching, abbreviations, and synonyms for user convenience.

## Command Format

Commands can be entered in natural language or using abbreviations. The system uses fuzzy matching to recognize commands even with typos.

**Examples:**

- `catat penjualan` or `cp` → Record sale
- `lihat laporan hari ini` or `ll` → View today's report
- `bantu` or `help` → Show help

## Available Commands

### Transaction Commands

#### Record Sale (`catat penjualan`, `cp`)

**Description**: Record a new income/sales transaction  
**Role Access**: Employee, Boss, Dev  
**Usage**: `catat penjualan` or `cp`

**Workflow**:

1. Enter command: `catat penjualan`
2. Enter amount (e.g., `500000` or `500.000`)
3. Select category from list
4. Confirm transaction

**Synonyms**: `tambah penjualan`, `input penjualan`, `jual`

#### Record Expense (`catat pengeluaran`, `ce`)

**Description**: Record a new expense transaction  
**Role Access**: Employee, Boss, Dev  
**Usage**: `catat pengeluaran` or `ce`

**Workflow**:

1. Enter command: `catat pengeluaran`
2. Enter amount (e.g., `250000`)
3. Select category from list
4. Confirm transaction

**Synonyms**: `tambah pengeluaran`, `input pengeluaran`, `keluar`

### Report Commands

#### View Today's Report (`lihat laporan hari ini`, `ll`)

**Description**: View financial report for today  
**Role Access**: All roles (filtered by role)  
**Usage**: `lihat laporan hari ini` or `ll`

**Synonyms**: `laporan`, `report today`, `laporan hari ini`

**Refresh Cache**: Add `refresh` or `update` to bypass cache:

- `lihat laporan hari ini refresh`

#### View Week's Report (`lihat laporan minggu ini`, `lm`)

**Description**: View financial report for current week  
**Role Access**: All roles (filtered by role)  
**Usage**: `lihat laporan minggu ini` or `lm`

**Synonyms**: `laporan minggu ini`, `report week`

#### View Month's Report (`lihat laporan bulan ini`, `lb`)

**Description**: View financial report for current month  
**Role Access**: All roles (filtered by role)  
**Usage**: `lihat laporan bulan ini` or `lb`

**Synonyms**: `laporan bulan ini`, `report month`

### Balance Commands

#### View Balance (`lihat saldo`, `ls`)

**Description**: View current account balance  
**Role Access**: All roles (filtered by role)  
**Usage**: `lihat saldo` or `ls`

**Synonyms**: `cek saldo`, `check balance`, `saldo`

### Help Commands

#### Help (`bantu`, `help`)

**Description**: Display available commands for your role  
**Role Access**: All roles  
**Usage**: `bantu` or `help`

**Synonyms**: `bantuan`, `help`, `?`

#### Menu (`menu`)

**Description**: Display main menu  
**Role Access**: All roles  
**Usage**: `menu`

## Command Parameters

### Amount Format

- Accepts: `500000`, `500.000`, `500,000`
- Must be positive number
- Maximum: 999,999,999

### Category

- Must be at least 2 characters
- Maximum: 50 characters
- Select from predefined list or enter custom

### Date Range

- `today`: Current day (00:00-23:59 WITA)
- `week`: Current week (Monday-Sunday)
- `month`: Current month (1st-last day)

## Role-Based Access

### Employee

- ✅ Record transactions (own)
- ✅ View own reports
- ✅ View own balance
- ❌ View other users' data
- ❌ Manage users

### Boss

- ✅ Record transactions (all)
- ✅ View all reports
- ✅ View all balances
- ✅ Manage users
- ✅ Approve transactions

### Investor

- ❌ Record transactions
- ✅ View aggregated reports only
- ✅ View aggregated balance
- ❌ View individual transactions
- ❌ Manage users

### Dev

- ✅ All permissions
- ✅ System configuration
- ✅ Debug commands

## Error Handling

### Unrecognized Commands

If a command is not recognized, the system will:

1. Show suggestions (top 3 similar commands)
2. Provide examples
3. Offer button fallback (if enabled)

**Example**:

```
⚠️ Perintah Tidak Dikenal

Tidak yakin dengan: 'catat penjual'

Saran perintah:
• catat penjualan - Catat penjualan baru
• catat pengeluaran - Catat pengeluaran baru
• lihat laporan - Lihat laporan keuangan
```

### Command Syntax Errors

If parameters are invalid:

- Amount errors: "Jumlah harus berupa angka positif"
- Category errors: "Kategori terlalu pendek (min 2 karakter)"
- Type errors: "Tipe transaksi harus 'income' atau 'expense'"

## Performance Targets

- **Command Parsing**: <100ms
- **Simple Commands**: <2s response time
- **Data Retrieval Commands**: <5s response time

## Context Expiration

Conversation context expires after 30 minutes of inactivity. If your session expires, you'll receive:

```
⏰ Sesi Anda berakhir.

Mulai ulang dengan perintah baru.
```

## Tips

1. **Use Abbreviations**: `cp` is faster than `catat penjualan`
2. **Fuzzy Matching**: Typos are tolerated (e.g., `catat penjualn` → `catat penjualan`)
3. **Refresh Reports**: Add `refresh` to get latest data bypassing cache
4. **Multi-step Workflows**: Follow prompts step-by-step for transaction entry

## Examples

### Recording a Sale

```
User: catat penjualan
Bot: Masukkan jumlah penjualan:
User: 500000
Bot: Pilih kategori:
User: [Selects from list]
Bot: ✅ Transaksi dicatat: Rp 500.000
```

### Viewing Today's Report

```
User: ll
Bot: 📊 Laporan Keuangan
     Periode: Hari ini
     ━━━━━━━━━━━━━━━━━━━━

     💰 Saldo: Rp 1.500.000
     📈 Pendapatan: Rp 2.000.000
     📉 Pengeluaran: Rp 500.000
     💵 Arus Kas: Rp 1.500.000
```

## Support

For issues or questions:

- Use `bantu` command for role-filtered help
- Contact system administrator for access issues
