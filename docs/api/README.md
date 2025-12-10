# API Documentation

## Overview

This directory contains OpenAPI/Swagger documentation for the WhatsApp Cashflow Bot service APIs.

## Available APIs

### Internal Service API

**File**: `internal-api.yaml`  
**Description**: Internal service API contracts for business logic services used by bot handlers.

**Endpoints**:
- Transaction management (create, retrieve, update, delete)
- Report generation (daily, custom, drill-down)
- User management (authentication, RBAC, profile)
- Recommendation engine (anomaly detection, insights)
- Audit logging
- System health checks

**Usage**: These APIs are not exposed directly to users. They are invoked by WhatsApp bot handlers to process user interactions.

### WhatsApp Message API

**File**: `whatsapp-messages.yaml`  
**Description**: WhatsApp message contracts defining message formats, button interfaces, and user interactions.

**Message Types**:
- Button messages (main menu, category selection, confirmation)
- List messages (category lists, report options)
- Text messages (transaction details, reports, error messages)
- Media messages (PDF reports, charts)

**Usage**: These contracts define the structure of messages sent to users via WhatsApp.

## Viewing Documentation

### Option 1: Swagger UI (Recommended)

Install Swagger UI locally:

```bash
npm install -g swagger-ui-watcher
swagger-ui-watcher docs/api/internal-api.yaml
```

Navigate to `http://localhost:8000` to view interactive documentation.

### Option 2: Swagger Editor

1. Visit [Swagger Editor](https://editor.swagger.io/)
2. Copy/paste YAML content from `internal-api.yaml` or `whatsapp-messages.yaml`
3. View rendered documentation

### Option 3: VS Code Extension

Install the "Swagger Viewer" extension:

```bash
code --install-extension Arjun.swagger-viewer
```

Open any `.yaml` file and press `Shift+Alt+P` to preview.

## Generating Client Libraries

Use OpenAPI Generator to create client libraries:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/api/internal-api.yaml \
  -g typescript-axios \
  -o generated/client
```

## Contract Testing

Validate API responses against OpenAPI schema:

```bash
# Install validator
npm install -D swagger-cli

# Validate schema
swagger-cli validate docs/api/internal-api.yaml
```

## Maintenance

- **Update contracts**: When adding new endpoints or modifying existing ones, update the corresponding `.yaml` file
- **Versioning**: Use semantic versioning in `info.version` field
- **Breaking changes**: Increment major version and document in CHANGELOG.md
- **Examples**: Include request/response examples for all endpoints

## References

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Tools](https://swagger.io/tools/)
- [OpenAPI Generator](https://openapi-generator.tech/)
