# Quick Start: Setup Cloud Agent di Cursor

Panduan cepat untuk mengkonfigurasi cloud agent di Cursor dalam 5 menit.

## Langkah 1: Jalankan Setup Script

```bash
# Dari root project
./scripts/setup-cloud-agent.sh
```

Script ini akan:
- ✅ Mengecek prerequisites (Node.js, Azure CLI)
- ✅ Membuat file konfigurasi MCP
- ✅ Setup Azure authentication (jika Azure CLI terinstall)
- ✅ Test koneksi MCP servers

## Langkah 2: Konfigurasi Azure Credentials

### Opsi A: Menggunakan Azure CLI (Paling Mudah)

```bash
# Login ke Azure
az login

# Set subscription
az account set --subscription "your-subscription-id"

# Script akan otomatis mengambil subscription ID
```

### Opsi B: Manual Setup

Edit file `.env` dan tambahkan:

```bash
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

Untuk mendapatkan credentials:
1. Buka [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** > **App registrations**
3. Create new registration atau gunakan existing
4. Copy **Application (client) ID** dan **Directory (tenant) ID**
5. Create **Client secret** di **Certificates & secrets**

## Langkah 3: Restart Cursor

1. Tutup Cursor IDE sepenuhnya
2. Buka kembali Cursor
3. Buka Command Palette (`Cmd/Ctrl + Shift + P`)
4. Ketik: `MCP: List Servers`
5. Pastikan Azure server status "Connected"

## Langkah 4: Test Cloud Agent

Coba perintah berikut di Cursor chat:

```
@azure list resource groups
```

Atau gunakan cloud agent untuk deployment:

```
@cloud-agent help me deploy this app to Azure
```

## Troubleshooting Cepat

### MCP Server Tidak Terhubung

```bash
# Restart Cursor
# Atau restart MCP servers via Command Palette: MCP: Restart All Servers
```

### Azure Authentication Error

```bash
# Re-login Azure CLI
az login --refresh

# Verify subscription
az account show
```

### File Konfigurasi Tidak Ditemukan

```bash
# Jalankan setup script lagi
./scripts/setup-cloud-agent.sh
```

## Next Steps

- Baca [CURSOR_CLOUD_AGENT_SETUP.md](./CURSOR_CLOUD_AGENT_SETUP.md) untuk panduan lengkap
- Explore Azure MCP commands di Cursor
- Setup Context7 untuk dokumentasi library

## Support

Jika ada masalah, cek:
1. [Troubleshooting section](./CURSOR_CLOUD_AGENT_SETUP.md#troubleshooting)
2. Cursor Developer Tools (`Help > Toggle Developer Tools`)
3. MCP logs di Console tab

---

**Setup selesai!** 🎉
