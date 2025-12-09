import { Client, Message } from 'whatsapp-web.js';
import { logger } from '../../lib/logger';
import { getWhatsAppClient } from './client';

/**
 * Setup WhatsApp client event handlers
 */
export function setupEventHandlers(client: Client): void {
  // Ready event - client is ready to use
  client.on('ready', () => {
    logger.info('WhatsApp client is ready', {
      wid: client.info?.wid.user,
      platform: client.info?.platform,
    });
  });

  // QR code event - display QR code for authentication
  client.on('qr', (qr) => {
    logger.info('QR code received, scan with WhatsApp mobile app');
    console.log('\n=== WhatsApp QR Code ===');
    console.log('Scan this QR code with your WhatsApp mobile app:');
    console.log(qr);
    console.log('========================\n');
  });

  // Authenticated event
  client.on('authenticated', () => {
    logger.info('WhatsApp client authenticated');
  });

  // Authentication failure event
  client.on('auth_failure', (msg) => {
    logger.error('WhatsApp authentication failed', { error: msg });
  });

  // Disconnect event
  client.on('disconnected', (reason) => {
    logger.warn('WhatsApp client disconnected', { reason });
  });

  // Message event - handle incoming messages
  client.on('message', async (message: Message) => {
    try {
      logger.debug('Message received', {
        from: message.from,
        body: message.body.substring(0, 100), // Log first 100 chars
        hasMedia: message.hasMedia,
        type: message.type,
      });

      // TODO: Route message to appropriate handler
      // This will be implemented in Phase 3
    } catch (error) {
      logger.error('Error handling message', { error, messageId: message.id._serialized });
    }
  });

  // Message create event - handle sent messages
  client.on('message_create', async (message: Message) => {
    // Only log if message is from us
    if (message.fromMe) {
      logger.debug('Message sent', {
        to: message.to,
        body: message.body?.substring(0, 100),
      });
    }
  });

  // Error event
  client.on('error', (error) => {
    logger.error('WhatsApp client error', { error: error.message, stack: error.stack });
  });

  // Loading screen event
  client.on('loading_screen', (percent, message) => {
    logger.debug('WhatsApp loading screen', { percent, message });
  });

  logger.info('WhatsApp event handlers registered');
}

/**
 * Setup event handlers for the current client
 */
export function initializeEventHandlers(): void {
  const client = getWhatsAppClient();
  if (!client) {
    logger.warn('WhatsApp client not initialized, cannot setup event handlers');
    return;
  }

  setupEventHandlers(client);
}

/**
 * Message routing function (to be implemented in Phase 3)
 */
export async function routeMessage(message: Message): Promise<void> {
  // This will be implemented in Phase 3 with proper message routing
  logger.debug('Message routing not yet implemented', {
    from: message.from,
    body: message.body?.substring(0, 50),
  });
}

export default setupEventHandlers;

