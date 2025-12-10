# Azure Deployment Guide

## Overview

This directory contains Azure infrastructure as code (IaC) using Bicep templates for deploying the WhatsApp Cashflow Bot to Azure Container Apps.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Container Apps                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WhatsApp Cashflow Bot Container                    │   │
│  │  - Node.js 20 LTS                                    │   │
│  │  - TypeScript application                            │   │
│  │  - Auto-scaling (1-5 replicas)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
              │           │            │
              ▼           ▼            ▼
    ┌──────────────┐ ┌─────────┐ ┌─────────────┐
    │  PostgreSQL  │ │  Redis  │ │   Storage   │
    │   Flexible   │ │  Cache  │ │   Account   │
    │    Server    │ │         │ │  (Sessions) │
    └──────────────┘ └─────────┘ └─────────────┘
              │
              ▼
    ┌──────────────────────────┐
    │   Application Insights   │
    │   + Log Analytics        │
    └──────────────────────────┘
```

## Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   az account set --subscription <subscription-id>
   ```

2. **Azure Container Registry** created:
   ```bash
   az acr create \
     --resource-group <resource-group> \
     --name cashflowbotacr \
     --sku Standard \
     --location eastus
   ```

3. **Docker image** built and pushed to ACR:
   ```bash
   # Build image
   docker build -f docker/Dockerfile -t cashflowbotacr.azurecr.io/whatsapp-cashflow-bot:latest .
   
   # Login to ACR
   az acr login --name cashflowbotacr
   
   # Push image
   docker push cashflowbotacr.azurecr.io/whatsapp-cashflow-bot:latest
   ```

4. **Key Vault** with database password secret:
   ```bash
   az keyvault create \
     --name cashflowbot-kv \
     --resource-group <resource-group> \
     --location eastus
   
   az keyvault secret set \
     --vault-name cashflowbot-kv \
     --name db-admin-password \
     --value "<secure-password>"
   ```

## Deployment Steps

### 1. Create Resource Group

```bash
az group create \
  --name whatsapp-cashflow-bot-prod \
  --location eastus
```

### 2. Update Parameters

Edit `container-apps.parameters.json` and update:
- `{subscription-id}`: Your Azure subscription ID
- `{resource-group}`: Resource group name
- `{keyvault-name}`: Key Vault name
- Container registry name
- Database server name
- Redis cache name
- Storage account name (must be globally unique, 3-24 lowercase alphanumeric characters)

### 3. Deploy Infrastructure

```bash
az deployment group create \
  --resource-group whatsapp-cashflow-bot-prod \
  --template-file container-apps.bicep \
  --parameters container-apps.parameters.json \
  --name cashflowbot-deployment
```

### 4. Configure Container Registry Access

Grant Container App managed identity access to ACR:

```bash
# Get Container App principal ID
PRINCIPAL_ID=$(az containerapp show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --query identity.principalId \
  --output tsv)

# Grant AcrPull role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role AcrPull \
  --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.ContainerRegistry/registries/cashflowbotacr
```

### 5. Run Database Migrations

Migrations run automatically on container startup via `CMD` in Dockerfile:
```bash
npx prisma migrate deploy && node dist/index.js
```

To manually run migrations:
```bash
az containerapp exec \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --command "npx prisma migrate deploy"
```

### 6. Verify Deployment

Check deployment status:
```bash
az containerapp show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --query properties.runningStatus
```

Get application URL:
```bash
az containerapp show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

Health check:
```bash
FQDN=$(az containerapp show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

curl https://$FQDN/health
```

## Monitoring

### View Logs

```bash
az containerapp logs show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --follow
```

### Application Insights

1. Navigate to Azure Portal
2. Find Application Insights resource: `whatsapp-cashflow-bot-prod-insights`
3. View:
   - Live Metrics
   - Performance
   - Failures
   - Logs (Kusto queries)

### Metrics

```bash
az monitor metrics list \
  --resource /subscriptions/<subscription-id>/resourceGroups/whatsapp-cashflow-bot-prod/providers/Microsoft.App/containerApps/whatsapp-cashflow-bot-prod-app \
  --metric-names "Requests" "RequestDuration" "CpuUsage" "MemoryUsage"
```

## Scaling

### Manual Scaling

```bash
az containerapp update \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --min-replicas 2 \
  --max-replicas 10
```

### Auto-scaling Rules

Auto-scaling is configured in the Bicep template:
- **HTTP Scaling**: Scale up when concurrent requests exceed 50
- **Min Replicas**: 1 (prod), can be increased for high availability
- **Max Replicas**: 5 (prod), can be increased for peak loads

## Backup and Disaster Recovery

### Database Backups

PostgreSQL Flexible Server automated backups:
- **Retention**: 7 days (configurable up to 35 days)
- **Frequency**: Daily automatic backups
- **Point-in-time restore**: Available

Manual backup:
```bash
az postgres flexible-server backup create \
  --resource-group whatsapp-cashflow-bot-prod \
  --name cashflowbot-prod-db \
  --backup-name manual-backup-$(date +%Y%m%d)
```

### WhatsApp Session Backup

Sessions stored in Azure Files (mounted to container):
- Automatically persisted across container restarts
- Replicated within Azure region (LRS)

## Security

### Network Security

- PostgreSQL: Firewall rules allow Container App subnet only
- Redis: TLS 1.2 enforced, non-SSL port disabled
- Container App: HTTPS only, HTTP redirects to HTTPS

### Secrets Management

All secrets stored in:
1. **Azure Key Vault**: Database passwords
2. **Container App Secrets**: Connection strings, API keys

Never store secrets in:
- Environment variables in Bicep
- Source code
- Container images

### Managed Identity

Container App uses **System-Assigned Managed Identity** for:
- Container Registry access (AcrPull role)
- Key Vault access (get secrets)
- Storage Account access (read/write sessions)

## Cost Optimization

### Environment-Based Sizing

**Development**:
```json
{
  "cpuCores": "0.5",
  "memorySize": "1.0Gi",
  "minReplicas": 1,
  "maxReplicas": 2,
  "postgresqlSku": "Standard_B1ms",
  "redisSku": "Basic C0"
}
```

**Production**:
```json
{
  "cpuCores": "1.0",
  "memorySize": "2.0Gi",
  "minReplicas": 1,
  "maxReplicas": 5,
  "postgresqlSku": "Standard_B2s",
  "redisSku": "Standard C1"
}
```

### Estimated Monthly Costs (USD)

**Development**:
- Container App: ~$15/month
- PostgreSQL: ~$30/month
- Redis: ~$15/month
- Storage: ~$5/month
- **Total: ~$65/month**

**Production**:
- Container App: ~$50/month (with auto-scaling)
- PostgreSQL: ~$60/month
- Redis: ~$75/month
- Storage: ~$10/month
- Application Insights: ~$10/month
- **Total: ~$205/month**

## Troubleshooting

### Container Won't Start

Check logs:
```bash
az containerapp logs show \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --tail 100
```

Common issues:
- Database connection failure: Check firewall rules
- Image pull failure: Verify ACR access and image tag
- Migration failure: Check database schema and connectivity

### High Memory Usage

Increase container memory:
```bash
az containerapp update \
  --name whatsapp-cashflow-bot-prod-app \
  --resource-group whatsapp-cashflow-bot-prod \
  --memory 3.0Gi
```

### Slow Response Times

1. Check database query performance in Application Insights
2. Verify Redis cache hit rate
3. Scale up replicas if CPU usage > 70%

## Cleanup

Remove all resources:
```bash
az group delete \
  --name whatsapp-cashflow-bot-prod \
  --yes --no-wait
```

## References

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/)
- [Azure Redis Cache](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/)
