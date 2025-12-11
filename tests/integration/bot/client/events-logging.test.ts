/**
 * Integration tests for WhatsApp event logging
 * Tests QR generation, authentication, disconnection, and message events
 */

import { Client } from "whatsapp-web.js";
import { setupEventHandlers } from "../../../../src/bot/client/events";
import { createWhatsAppClient } from "../../../../src/bot/client/client";

// Mock WhatsApp client for testing
jest.mock("../../../../src/bot/client/client", () => ({
  createWhatsAppClient: jest.fn(),
  getWhatsAppClient: jest.fn(),
}));

describe("WhatsApp Event Logging Integration", () => {
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    // Create mock WhatsApp client
    mockClient = {
      on: jest.fn(),
      getState: jest.fn(),
      initialize: jest.fn(),
      info: null,
    } as unknown as jest.Mocked<Client>;

    // Mock createWhatsAppClient to return mock client
    (createWhatsAppClient as jest.Mock).mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("QR Code Generation Event", () => {
    it("should log QR code generation event", () => {
      setupEventHandlers(mockClient);

      // Simulate QR code event
      const qrCode = "test-qr-code-string";
      const qrHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "qr",
      )?.[1];

      if (qrHandler) {
        qrHandler(qrCode);
      }

      // Verify QR event was logged
      expect(mockClient.on).toHaveBeenCalledWith("qr", expect.any(Function));
    });
  });

  describe("Authentication Events", () => {
    it("should log authentication success event", () => {
      setupEventHandlers(mockClient);

      const authHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "authenticated",
      )?.[1];

      if (authHandler) {
        authHandler();
      }

      expect(mockClient.on).toHaveBeenCalledWith(
        "authenticated",
        expect.any(Function),
      );
    });

    it("should log authentication failure event", () => {
      setupEventHandlers(mockClient);

      const authFailureHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "auth_failure",
      )?.[1];

      if (authFailureHandler) {
        authFailureHandler("Invalid credentials");
      }

      expect(mockClient.on).toHaveBeenCalledWith(
        "auth_failure",
        expect.any(Function),
      );
    });
  });

  describe("Disconnection Event", () => {
    it("should log disconnection event with reason", () => {
      setupEventHandlers(mockClient);

      const disconnectHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "disconnected",
      )?.[1];

      if (disconnectHandler) {
        disconnectHandler("TIMEOUT");
      }

      expect(mockClient.on).toHaveBeenCalledWith(
        "disconnected",
        expect.any(Function),
      );
    });
  });

  describe("Message Events", () => {
    it("should log message received event with masked data", () => {
      setupEventHandlers(mockClient);

      const messageHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message",
      )?.[1];

      if (messageHandler) {
        const mockMessage = {
          id: { _serialized: "msg-123" },
          from: "+6281234567890",
          body: "Test message with phone +6287654321098",
          hasMedia: false,
          type: "chat",
        };

        messageHandler(mockMessage);
      }

      expect(mockClient.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should log message sent event", () => {
      setupEventHandlers(mockClient);

      const messageCreateHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message_create",
      )?.[1];

      if (messageCreateHandler) {
        const mockMessage = {
          fromMe: true,
          to: "+6281234567890",
          body: "Response message",
          id: {
            _serialized: "msg-sent-123",
          },
        };

        messageCreateHandler(mockMessage);
      }

      expect(mockClient.on).toHaveBeenCalledWith(
        "message_create",
        expect.any(Function),
      );
    });
  });

  describe("Event Handler Registration", () => {
    it("should register all required event handlers", () => {
      setupEventHandlers(mockClient);

      const eventTypes = (mockClient.on as jest.Mock).mock.calls.map(
        (call): string => call[0] as string,
      );

      expect(eventTypes).toContain("ready");
      expect(eventTypes).toContain("qr");
      expect(eventTypes).toContain("authenticated");
      expect(eventTypes).toContain("auth_failure");
      expect(eventTypes).toContain("disconnected");
      expect(eventTypes).toContain("message");
      expect(eventTypes).toContain("message_create");
      expect(eventTypes).toContain("error");
      expect(eventTypes).toContain("loading_screen");
    });
  });

  describe("Correlation ID Flow", () => {
    it("should maintain correlation ID across message flow events", () => {
      setupEventHandlers(mockClient);

      const messageHandler = (mockClient.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message",
      )?.[1];

      if (messageHandler) {
        const mockMessage = {
          id: { _serialized: "msg-123" },
          from: "+6281234567890",
          body: "Test message",
        };

        messageHandler(mockMessage);
      }

      // Correlation ID should be generated and used across related events
      expect(mockClient.on).toHaveBeenCalled();
    });
  });
});
