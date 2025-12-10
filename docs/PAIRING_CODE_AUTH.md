# WhatsApp Pairing Code Authentication

Alternative authentication method using phone number pairing code instead of QR code scanning.

## Overview

The pairing code authentication allows you to link WhatsApp Web without scanning a QR code. Instead, you enter a pairing code on your phone.

## Basic Usage

### Method 1: Using Helper Functions

```typescript
import { LocalAuth } from "whatsapp-web.js";
import { createPairingClient } from "./src/bot/client/pairing";

// Create client with pairing code authentication
const client = createPairingClient("6281234567890", {
  authStrategy: new LocalAuth({
    dataPath: ".wwebjs_auth",
  }),
  puppeteer: {
    headless: true,
  },
});

// Initialize
await client.initialize();
```

### Method 2: Manual Configuration

```typescript
import { Client, LocalAuth } from "whatsapp-web.js";
import {
  setupPairingAuthentication,
  setupPairingCodeHandler,
} from "./src/bot/client/pairing";

const client = new Client({
  authStrategy: new LocalAuth(),
  ...setupPairingAuthentication("6281234567890", {
    showNotification: true,
    intervalMs: 180000, // 3 minutes
  }),
});

// Setup pairing code event handler
setupPairingCodeHandler(client);

await client.initialize();
```

### Method 3: Using Client Options Directly

```typescript
import { Client, LocalAuth } from "whatsapp-web.js";

const client = new Client({
  authStrategy: new LocalAuth(),
  pairWithPhoneNumber: {
    phoneNumber: "6281234567890", // International format, no symbols
    showNotification: true,
    intervalMs: 180000,
  },
});

client.on("code", (code) => {
  console.log(`Pairing code: ${code}`);
});

await client.initialize();
```

## Phone Number Format

Phone numbers must be in **international format without symbols**:

### ✅ Correct Format

```typescript
"6281234567890"; // Indonesia
"12025550108"; // United States
"551155501234"; // Brazil
"441234567890"; // United Kingdom
"61412345678"; // Australia
```

### ❌ Incorrect Format

```typescript
"+62 812-3456-7890"; // Has symbols
"0812-3456-7890"; // Missing country code
"(202) 555-0108"; // Has symbols and parentheses
```

### Phone Number Utilities

```typescript
import {
  formatPhoneNumber,
  validatePhoneNumber,
} from "./src/bot/client/pairing";

// Format phone number (removes symbols)
const formatted = formatPhoneNumber("+62 812-3456-7890");
console.log(formatted); // "6281234567890"

// Validate phone number
const isValid = validatePhoneNumber("6281234567890");
console.log(isValid); // true
```

## Pairing Code Events

The client emits a `code` event when a pairing code is received:

```typescript
client.on("code", (code: string) => {
  console.log(`Your pairing code: ${code}`);
  // Code format: "ABCDEFGH" (8 characters)
});

client.on("authenticated", () => {
  console.log("Successfully authenticated!");
});

client.on("auth_failure", (error) => {
  console.error("Authentication failed:", error);
});
```

## Complete Example

```typescript
import { Client, LocalAuth } from "whatsapp-web.js";
import {
  createPairingClient,
  formatPhoneNumber,
  validatePhoneNumber,
  maskPhoneNumber,
} from "./src/bot/client/pairing";
import { logger } from "./src/lib/logger";

async function main() {
  const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER || "6281234567890";

  // Validate phone number
  if (!validatePhoneNumber(phoneNumber)) {
    throw new Error(`Invalid phone number: ${phoneNumber}`);
  }

  logger.info("Starting WhatsApp client with pairing code", {
    phoneNumber: maskPhoneNumber(phoneNumber),
  });

  // Create client with pairing authentication
  const client = createPairingClient(phoneNumber, {
    authStrategy: new LocalAuth({
      dataPath: ".wwebjs_auth",
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  // Handle ready event
  client.on("ready", () => {
    logger.info("WhatsApp client is ready!");
  });

  // Handle messages
  client.on("message", async (msg) => {
    if (msg.body === "!ping") {
      await msg.reply("pong");
    }
  });

  // Initialize client
  await client.initialize();
}

main().catch(console.error);
```

## Pairing Code Configuration

### Options

```typescript
interface PairingCodeOptions {
  /**
   * Phone number in international format without symbols
   * @example "6281234567890"
   */
  phoneNumber: string;

  /**
   * Show notification on phone to pair
   * @default true
   */
  showNotification?: boolean;

  /**
   * Interval in milliseconds to regenerate pairing code
   * @default 180000 (3 minutes)
   */
  intervalMs?: number;
}
```

### Default Values

- `showNotification`: `true` - Shows notification on your phone
- `intervalMs`: `180000` (3 minutes) - WhatsApp default refresh interval

## How to Use Pairing Code on Phone

When the pairing code is displayed:

1. **Open WhatsApp** on your phone
2. Go to **Settings** → **Linked Devices**
3. Tap **"Link a Device"**
4. Tap **"Link with phone number instead"**
5. **Enter the pairing code** shown in the terminal
6. Wait for confirmation

The pairing code refreshes every 3 minutes if not used.

## Security Considerations

### Phone Number Privacy

The library provides a `maskPhoneNumber` function for logging:

```typescript
import { maskPhoneNumber } from "./src/bot/client/pairing";

const masked = maskPhoneNumber("6281234567890");
console.log(masked); // "62 ****7890"
```

### Environment Variables

Store phone numbers in environment variables:

```bash
# .env
WHATSAPP_PHONE_NUMBER=6281234567890
```

```typescript
const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
if (!phoneNumber) {
  throw new Error("WHATSAPP_PHONE_NUMBER is required");
}
```

## Error Handling

```typescript
import { createPairingClient } from "./src/bot/client/pairing";

try {
  const client = createPairingClient(phoneNumber);

  client.on("auth_failure", (error) => {
    console.error("Authentication failed:", error);
    // Handle authentication failure
  });

  client.on("disconnected", (reason) => {
    console.log("Client disconnected:", reason);
    // Handle disconnection
  });

  await client.initialize();
} catch (error) {
  console.error("Failed to initialize client:", error);
}
```

## Comparison: QR Code vs Pairing Code

| Feature       | QR Code                | Pairing Code              |
| ------------- | ---------------------- | ------------------------- |
| Setup         | Scan with phone camera | Enter code on phone       |
| Device needed | Camera required        | No camera needed          |
| Accessibility | Requires visual access | Works with screen readers |
| Use case      | Quick setup            | Remote/headless servers   |
| Code refresh  | ~20 seconds            | 3 minutes                 |

## Troubleshooting

### Pairing Code Not Appearing

```typescript
// Check if client is properly initialized
client.on("loading_screen", (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
});

client.on("code", (code) => {
  console.log(`Pairing code received: ${code}`);
});
```

### Invalid Phone Number

```typescript
import {
  validatePhoneNumber,
  formatPhoneNumber,
} from "./src/bot/client/pairing";

const raw = "+62 812-3456-7890";
const formatted = formatPhoneNumber(raw);

if (!validatePhoneNumber(formatted)) {
  throw new Error(`Invalid phone number: ${raw}`);
}
```

### Code Expired

The pairing code expires after 3 minutes. A new code will be automatically generated.

```typescript
client.on("code", (code) => {
  console.log(`New pairing code: ${code}`);
  // Code is valid for 3 minutes
});
```

## API Reference

### Functions

- `createPairingClient(phoneNumber, options)` - Create client with pairing authentication
- `requestPairingCode(client, options)` - Manually request pairing code
- `setupPairingAuthentication(phoneNumber, options)` - Get client configuration
- `setupPairingCodeHandler(client, callback)` - Setup pairing code event handler
- `formatPhoneNumber(phoneNumber)` - Format phone number (remove symbols)
- `validatePhoneNumber(phoneNumber)` - Validate phone number format
- `maskPhoneNumber(phoneNumber)` - Mask phone number for logging

### Events

- `code` - Emitted when pairing code is received
- `authenticated` - Emitted when authentication succeeds
- `auth_failure` - Emitted when authentication fails
- `ready` - Emitted when client is ready

## Additional Resources

- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [Authentication Guide](https://wwebjs.dev/guide/creating-your-bot/authentication.html)
- [GitHub Repository](https://github.com/pedroslopez/whatsapp-web.js)

## Support

For issues or questions:

- Check the [whatsapp-web.js GitHub Issues](https://github.com/pedroslopez/whatsapp-web.js/issues)
- Join the [Discord community](https://discord.gg/wyKybbF)
