# Konfigurasi Cursor untuk Cloud Agent

Panduan lengkap untuk mengkonfigurasi Cursor IDE agar dapat menjalankan cloud agent, termasuk Azure MCP dan cloud-based AI agents.

## Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Konfigurasi MCP (Model Context Protocol)](#konfigurasi-mcp)
3. [Konfigurasi Azure Cloud Agent](#konfigurasi-azure-cloud-agent)
4. [Konfigurasi Cursor Settings](#konfigurasi-cursor-settings)
5. [Verifikasi Konfigurasi](#verifikasi-konfigurasi)
6. [Troubleshooting](#troubleshooting)

## Prasyarat

Sebelum memulai, pastikan Anda memiliki:

- **Cursor IDE** versi terbaru (v0.40+)
- **Node.js** 20.0.0 atau lebih tinggi
- **Azure Account** (untuk Azure cloud agent)
- **Azure CLI** terinstall (opsional, untuk autentikasi)
- **Git** terinstall

### Cek Versi

```bash
# Cek versi Cursor
cursor --version

# Cek versi Node.js
node --version

# Cek versi Azure CLI (jika terinstall)
az --version
```

## Konfigurasi MCP (Model Context Protocol)

MCP memungkinkan Cursor untuk terhubung dengan berbagai cloud services dan tools.

### 1. Lokasi File Konfigurasi

File konfigurasi MCP untuk Cursor biasanya berada di:

- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

### 2. Buat File Konfigurasi MCP

Buat file konfigurasi MCP dengan struktur berikut:

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp-server-azure"
      ],
      "env": {
        "AZURE_SUBSCRIPTION_ID": "your-subscription-id",
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_CLIENT_ID": "your-client-id",
        "AZURE_CLIENT_SECRET": "your-client-secret"
      }
    },
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@context7/mcp-server"
      ],
      "env": {
        "CONTEXT7_API_KEY": "your-context7-api-key"
      }
    }
  }
}
```

### 3. Konfigurasi Azure MCP Server

Untuk menggunakan Azure cloud agent, Anda perlu:

#### a. Dapatkan Azure Credentials

```bash
# Login ke Azure
az login

# Dapatkan subscription ID
az account show --query id -o tsv

# Dapatkan tenant ID
az account show --query tenantId -o tsv

# Buat Service Principal (untuk aplikasi)
az ad sp create-for-rbac --name "cursor-mcp-agent" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}
```

Output akan memberikan:
- `appId` (Client ID)
- `password` (Client Secret)
- `tenant` (Tenant ID)

#### b. Update File Konfigurasi

Update file MCP dengan credentials yang didapat:

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp-server-azure"
      ],
      "env": {
        "AZURE_SUBSCRIPTION_ID": "12345678-1234-1234-1234-123456789012",
        "AZURE_TENANT_ID": "87654321-4321-4321-4321-210987654321",
        "AZURE_CLIENT_ID": "your-app-id-from-service-principal",
        "AZURE_CLIENT_SECRET": "your-password-from-service-principal"
      }
    }
  }
}
```

## Konfigurasi Azure Cloud Agent

### 1. Install Azure MCP Server

```bash
# Install Azure MCP Server secara global
npm install -g @azure/mcp-server-azure

# Atau gunakan npx (tidak perlu install)
npx -y @azure/mcp-server-azure
```

### 2. Konfigurasi Environment Variables

Buat file `.env` di root project atau tambahkan ke `.env` yang sudah ada:

```bash
# Azure Configuration untuk Cloud Agent
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure Resource Configuration
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_REGION=eastus

# Optional: Azure Storage
AZURE_STORAGE_ACCOUNT=your-storage-account
AZURE_STORAGE_KEY=your-storage-key
```

### 3. Autentikasi Azure

#### Opsi 1: Azure CLI (Recommended untuk Development)

```bash
# Login
az login

# Set default subscription
az account set --subscription "your-subscription-id"

# Verify
az account show
```

#### Opsi 2: Service Principal (Recommended untuk Production)

```bash
# Buat service principal
az ad sp create-for-rbac --name "cursor-cloud-agent" \
  --role "Contributor" \
  --scopes /subscriptions/{subscription-id}

# Export sebagai environment variables
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-app-id"
export AZURE_CLIENT_SECRET="your-password"
```

#### Opsi 3: Managed Identity (untuk Azure-hosted resources)

Jika menjalankan dari Azure VM atau App Service, gunakan Managed Identity:

```bash
# Enable Managed Identity di Azure VM
az vm identity assign --name your-vm-name --resource-group your-rg

# Tidak perlu credentials tambahan, Azure akan otomatis menggunakan Managed Identity
```

## Konfigurasi Cursor Settings

### 1. Buka Cursor Settings

1. Buka Cursor IDE
2. Tekan `Cmd/Ctrl + ,` untuk membuka Settings
3. Atau klik `File > Preferences > Settings`

### 2. Aktifkan Cloud Agent Features

Tambahkan konfigurasi berikut di `settings.json`:

```json
{
  "cursor.ai.enableCloudAgents": true,
  "cursor.ai.cloudAgentProvider": "azure",
  "cursor.mcp.enabled": true,
  "cursor.mcp.autoStart": true,
  "cursor.mcp.logLevel": "info",
  
  // Azure-specific settings
  "cursor.azure.enabled": true,
  "cursor.azure.subscriptionId": "your-subscription-id",
  "cursor.azure.region": "eastus",
  
  // MCP Server settings
  "cursor.mcp.servers": {
    "azure": {
      "enabled": true,
      "autoStart": true
    }
  }
}
```

### 3. Konfigurasi Workspace Settings

Buat file `.vscode/settings.json` di root project:

```json
{
  "cursor.ai.enableCloudAgents": true,
  "cursor.mcp.enabled": true,
  
  // Project-specific Azure settings
  "cursor.azure.resourceGroup": "finance-bot-rg",
  "cursor.azure.region": "southeastasia"
}
```

## Verifikasi Konfigurasi

### 1. Test MCP Connection

```bash
# Test Azure MCP Server
npx -y @azure/mcp-server-azure --test

# Atau gunakan MCP Inspector
npx -y @modelcontextprotocol/inspector
```

### 2. Test dari Cursor

1. Buka Command Palette (`Cmd/Ctrl + Shift + P`)
2. Ketik: `MCP: List Servers`
3. Pastikan Azure server terlihat dan statusnya "Connected"

### 3. Test Azure Connection

Di Cursor, coba perintah berikut:

```
@azure list resource groups
@azure get subscription info
```

Jika berhasil, Anda akan melihat output dari Azure.

### 4. Test Cloud Agent

Coba gunakan cloud agent dengan prompt:

```
@cloud-agent deploy this application to Azure
@cloud-agent create Azure resources for this project
```

## Troubleshooting

### Issue: MCP Server Tidak Terhubung

**Gejala**: MCP server tidak muncul di daftar atau status "Disconnected"

**Solusi**:

1. **Cek file konfigurasi MCP**:
   ```bash
   # macOS/Linux
   cat ~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
   
   # Windows
   type %APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
   ```

2. **Restart Cursor** setelah mengubah konfigurasi

3. **Cek log MCP**:
   - Buka Developer Tools: `Help > Toggle Developer Tools`
   - Lihat tab Console untuk error messages

4. **Test MCP Server secara manual**:
   ```bash
   npx -y @azure/mcp-server-azure
   ```

### Issue: Azure Authentication Failed

**Gejala**: Error "Authentication failed" atau "Invalid credentials"

**Solusi**:

1. **Verifikasi credentials**:
   ```bash
   az account show
   az account list
   ```

2. **Refresh token**:
   ```bash
   az login --refresh
   ```

3. **Cek Service Principal**:
   ```bash
   az ad sp show --id {client-id}
   ```

4. **Regenerate credentials** jika perlu:
   ```bash
   az ad sp credential reset --name "cursor-cloud-agent"
   ```

### Issue: Cloud Agent Tidak Merespons

**Gejala**: Cloud agent tidak menjawab atau timeout

**Solusi**:

1. **Cek koneksi internet**

2. **Cek firewall/proxy settings**

3. **Enable verbose logging**:
   ```json
   {
     "cursor.mcp.logLevel": "debug"
   }
   ```

4. **Restart MCP servers**:
   - Command Palette: `MCP: Restart All Servers`

### Issue: Permission Denied

**Gejala**: Error "Permission denied" saat mengakses Azure resources

**Solusi**:

1. **Cek role assignment**:
   ```bash
   az role assignment list --assignee {client-id}
   ```

2. **Tambahkan role yang diperlukan**:
   ```bash
   az role assignment create \
     --assignee {client-id} \
     --role "Contributor" \
     --scope /subscriptions/{subscription-id}
   ```

3. **Cek subscription access**:
   ```bash
   az account show --subscription {subscription-id}
   ```

## Best Practices

### 1. Security

- **Jangan commit credentials** ke git
- Gunakan **environment variables** atau **Azure Key Vault**
- Gunakan **Service Principal** dengan **least privilege**
- **Rotate credentials** secara berkala

### 2. Performance

- **Cache credentials** untuk mengurangi authentication calls
- Gunakan **regional endpoints** yang dekat
- **Monitor usage** untuk menghindari rate limits

### 3. Development

- Gunakan **separate subscriptions** untuk dev/staging/prod
- **Test di development** sebelum production
- **Document changes** ke konfigurasi

## Referensi

- [Cursor MCP Documentation](https://docs.cursor.com/mcp)
- [Azure MCP Server](https://github.com/Azure/mcp-server-azure)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Azure CLI Documentation](https://learn.microsoft.com/en-us/cli/azure/)

## Support

Jika mengalami masalah:

1. Cek [Troubleshooting](#troubleshooting) section
2. Lihat log di Cursor Developer Tools
3. Buat issue di GitHub repository
4. Hubungi tim development

---

**Last Updated**: December 2024  
**Maintained By**: Finance Engineering Team
