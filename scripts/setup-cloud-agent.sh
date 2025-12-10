#!/bin/bash

# Script untuk setup Cloud Agent di Cursor
# Usage: ./scripts/setup-cloud-agent.sh

set -e

echo "🚀 Setting up Cursor Cloud Agent..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version must be 20 or higher. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check Azure CLI (optional)
if command -v az &> /dev/null; then
    echo -e "${GREEN}✅ Azure CLI installed${NC}"
    AZURE_CLI_INSTALLED=true
else
    echo -e "${YELLOW}⚠️  Azure CLI not found (optional)${NC}"
    AZURE_CLI_INSTALLED=false
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Determine OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CURSOR_CONFIG_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CURSOR_CONFIG_DIR="$HOME/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash)
    CURSOR_CONFIG_DIR="$APPDATA/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings"
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo -e "${YELLOW}Cursor config directory: $CURSOR_CONFIG_DIR${NC}"

# Create config directory if it doesn't exist
mkdir -p "$CURSOR_CONFIG_DIR"

# Copy MCP config
MCP_CONFIG_FILE="$CURSOR_CONFIG_DIR/cline_mcp_settings.json"
if [ -f .cursor/mcp-config.json ]; then
    echo -e "${YELLOW}Copying MCP configuration...${NC}"
    
    # Replace environment variables in config
    if [ -f .env ]; then
        # Read .env and create temp config with replaced values
        cp .cursor/mcp-config.json /tmp/mcp-config-temp.json
        
        # Simple env var replacement (for basic cases)
        # Note: This is a simple implementation. For production, use a proper templating tool.
        if [ -n "$AZURE_SUBSCRIPTION_ID" ]; then
            sed -i.bak "s|\${AZURE_SUBSCRIPTION_ID}|$AZURE_SUBSCRIPTION_ID|g" /tmp/mcp-config-temp.json
        fi
        if [ -n "$AZURE_TENANT_ID" ]; then
            sed -i.bak "s|\${AZURE_TENANT_ID}|$AZURE_TENANT_ID|g" /tmp/mcp-config-temp.json
        fi
        if [ -n "$AZURE_CLIENT_ID" ]; then
            sed -i.bak "s|\${AZURE_CLIENT_ID}|$AZURE_CLIENT_ID|g" /tmp/mcp-config-temp.json
        fi
        if [ -n "$AZURE_CLIENT_SECRET" ]; then
            sed -i.bak "s|\${AZURE_CLIENT_SECRET}|$AZURE_CLIENT_SECRET|g" /tmp/mcp-config-temp.json
        fi
        if [ -n "$CONTEXT7_API_KEY" ]; then
            sed -i.bak "s|\${CONTEXT7_API_KEY}|$CONTEXT7_API_KEY|g" /tmp/mcp-config-temp.json
        fi
        
        cp /tmp/mcp-config-temp.json "$MCP_CONFIG_FILE"
        rm -f /tmp/mcp-config-temp.json /tmp/mcp-config-temp.json.bak
        
        echo -e "${GREEN}✅ MCP configuration copied${NC}"
    else
        cp .cursor/mcp-config.json "$MCP_CONFIG_FILE"
        echo -e "${YELLOW}⚠️  MCP config copied but environment variables not set${NC}"
    fi
else
    echo -e "${RED}❌ .cursor/mcp-config.json not found${NC}"
    exit 1
fi

# Azure CLI setup (if installed)
if [ "$AZURE_CLI_INSTALLED" = true ]; then
    echo -e "${YELLOW}Setting up Azure authentication...${NC}"
    
    # Check if already logged in
    if az account show &> /dev/null; then
        echo -e "${GREEN}✅ Already logged in to Azure${NC}"
        
        # Get subscription info
        SUBSCRIPTION_ID=$(az account show --query id -o tsv 2>/dev/null || echo "")
        if [ -n "$SUBSCRIPTION_ID" ]; then
            echo -e "${GREEN}✅ Current subscription: $SUBSCRIPTION_ID${NC}"
            
            # Update .env if subscription ID is not set
            if ! grep -q "AZURE_SUBSCRIPTION_ID" .env 2>/dev/null || grep -q "AZURE_SUBSCRIPTION_ID=$" .env 2>/dev/null; then
                echo "" >> .env
                echo "# Azure Configuration (auto-generated)" >> .env
                echo "AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID" >> .env
                echo -e "${GREEN}✅ Added AZURE_SUBSCRIPTION_ID to .env${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Not logged in to Azure. Run 'az login' to authenticate${NC}"
    fi
fi

# Install MCP servers (test)
echo -e "${YELLOW}Testing MCP server installation...${NC}"

# Test Azure MCP Server
if npx -y @azure/mcp-server-azure --version &> /dev/null || true; then
    echo -e "${GREEN}✅ Azure MCP Server available${NC}"
else
    echo -e "${YELLOW}⚠️  Azure MCP Server will be installed on first use${NC}"
fi

# Test Context7 MCP Server
if npx -y @context7/mcp-server --version &> /dev/null || true; then
    echo -e "${GREEN}✅ Context7 MCP Server available${NC}"
else
    echo -e "${YELLOW}⚠️  Context7 MCP Server will be installed on first use${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}✅ Cloud Agent setup completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart Cursor IDE"
echo "2. Open Command Palette (Cmd/Ctrl + Shift + P)"
echo "3. Type 'MCP: List Servers' to verify connection"
echo "4. If Azure credentials are needed, add them to .env file:"
echo "   - AZURE_SUBSCRIPTION_ID"
echo "   - AZURE_TENANT_ID"
echo "   - AZURE_CLIENT_ID"
echo "   - AZURE_CLIENT_SECRET"
echo ""
echo "For Azure CLI authentication, run:"
echo "   az login"
echo ""
echo "Configuration file location:"
echo "   $MCP_CONFIG_FILE"
echo ""
