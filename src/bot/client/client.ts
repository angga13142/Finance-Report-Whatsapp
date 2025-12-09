import { Client } from 'whatsapp-web.js';
import { createLocalAuth } from './auth';
import { logger } from '../../lib/logger';

let whatsappClient: Client | null = null;

/**
 * Initialize WhatsApp client
 */
export function createWhatsAppClient(): Client {
  if (whatsappClient) {
    return whatsappClient;
  }

  const auth = createLocalAuth();

  whatsappClient = new Client({
    authStrategy: auth,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html',
    },
  });

  logger.info('WhatsApp client created');

  return whatsappClient;
}

/**
 * Get WhatsApp client instance
 */
export function getWhatsAppClient(): Client | null {
  return whatsappClient;
}

/**
 * Initialize and start WhatsApp client
 */
export async function initializeWhatsAppClient(): Promise<Client> {
  const client = createWhatsAppClient();

  if (client.info) {
    logger.info('WhatsApp client already initialized', {
      wid: client.info.wid.user,
    });
    return client;
  }

  await client.initialize();
  logger.info('WhatsApp client initialized');

  return client;
}

/**
 * Destroy WhatsApp client
 */
export async function destroyWhatsAppClient(): Promise<void> {
  if (whatsappClient) {
    await whatsappClient.destroy();
    whatsappClient = null;
    logger.info('WhatsApp client destroyed');
  }
}

export default createWhatsAppClient;

