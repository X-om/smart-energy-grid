import WebSocket from 'ws';
import { wsLogger as logger } from '../utils/logger.js';
import { AuthenticatedClient } from './auth.js';
import { metricsService } from '../metrics/metrics.js';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp?: string;
  channel?: string;
}

export interface ClientMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  channels?: string[];
  channel?: string;
}

class MessageHandler {
  private lastMessages: Map<string, WebSocketMessage>;
  private readonly MAX_STORED_MESSAGES = 10;

  constructor() {
    this.lastMessages = new Map();
  }

  /**
   * Handle incoming message from client
   */
  handleClientMessage(
    ws: WebSocket & { clientId?: string; auth?: AuthenticatedClient },
    message: string
  ): void {
    try {
      const data: ClientMessage = JSON.parse(message);
      metricsService.incrementMessagesReceived(data.action);

      logger.debug('Received message from client', {
        clientId: ws.clientId,
        action: data.action,
        channels: data.channels || data.channel
      });

      switch (data.action) {
        case 'ping':
          this.handlePing(ws);
          break;

        case 'subscribe':
          // Handled by WebSocket server
          logger.debug('Subscribe request received', {
            clientId: ws.clientId,
            channels: data.channels
          });
          break;

        case 'unsubscribe':
          // Handled by WebSocket server
          logger.debug('Unsubscribe request received', {
            clientId: ws.clientId,
            channels: data.channels
          });
          break;

        default:
          logger.warn('Unknown action received', {
            clientId: ws.clientId,
            action: data.action
          });
          this.sendError(ws, 'UNKNOWN_ACTION', `Unknown action: ${data.action}`);
      }
    } catch (error) {
      logger.error('Failed to handle client message', {
        clientId: ws.clientId,
        error: error instanceof Error ? error.message : String(error),
        message: message.substring(0, 100)
      });
      this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(ws: WebSocket & { clientId?: string }): void {
    this.sendMessage(ws, {
      type: 'PONG',
      payload: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Send message to a single client
   */
  sendMessage(
    ws: WebSocket & { clientId?: string },
    message: WebSocketMessage
  ): void {
    if (ws.readyState !== WebSocket.OPEN) {
      logger.debug('Cannot send message to closed connection', {
        clientId: ws.clientId
      });
      return;
    }

    try {
      const messageWithTimestamp: WebSocketMessage = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };

      ws.send(JSON.stringify(messageWithTimestamp));

      logger.debug('Message sent to client', {
        clientId: ws.clientId,
        type: message.type,
        channel: message.channel
      });
    } catch (error) {
      logger.error('Failed to send message to client', {
        clientId: ws.clientId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Broadcast message to multiple clients
   */
  broadcast(
    clients: Set<WebSocket & { clientId?: string }>,
    message: WebSocketMessage,
    channel: string,
    topic?: string
  ): number {
    const startTime = Date.now();
    let sentCount = 0;

    const messageWithChannel: WebSocketMessage = {
      ...message,
      channel,
      timestamp: message.timestamp || new Date().toISOString()
    };

    // Store last message for this channel
    this.storeLastMessage(channel, messageWithChannel);

    const messageStr = JSON.stringify(messageWithChannel);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;

          if (topic) {
            metricsService.incrementMessagesSent(topic, channel);
          }
        } catch (error) {
          logger.error('Failed to send message to client during broadcast', {
            clientId: client.clientId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    metricsService.recordBroadcastLatency(channel, duration);

    logger.info('Broadcast completed', {
      channel,
      recipientCount: clients.size,
      sentCount,
      durationMs: duration
    });

    return sentCount;
  }

  /**
   * Send error message to client
   */
  sendError(
    ws: WebSocket & { clientId?: string },
    code: string,
    message: string
  ): void {
    this.sendMessage(ws, {
      type: 'ERROR',
      payload: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send welcome message to newly connected client
   */
  sendWelcome(
    ws: WebSocket & { clientId?: string; auth?: AuthenticatedClient },
    channels: string[]
  ): void {
    this.sendMessage(ws, {
      type: 'WELCOME',
      payload: {
        clientId: ws.clientId,
        userId: ws.auth?.userId,
        role: ws.auth?.role,
        subscribedChannels: channels,
        connectedAt: ws.auth?.connectedAt?.toISOString()
      }
    });
  }

  /**
   * Send subscription confirmation
   */
  sendSubscriptionConfirmation(
    ws: WebSocket & { clientId?: string },
    channels: string[]
  ): void {
    this.sendMessage(ws, {
      type: 'SUBSCRIBED',
      payload: {
        channels,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send unsubscription confirmation
   */
  sendUnsubscriptionConfirmation(
    ws: WebSocket & { clientId?: string },
    channels: string[]
  ): void {
    this.sendMessage(ws, {
      type: 'UNSUBSCRIBED',
      payload: {
        channels,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Store last message for replay functionality
   */
  private storeLastMessage(channel: string, message: WebSocketMessage): void {
    // Store last message per channel
    this.lastMessages.set(channel, message);

    // Cleanup old channels if too many stored
    if (this.lastMessages.size > this.MAX_STORED_MESSAGES * 10) {
      const oldestKey = this.lastMessages.keys().next().value;
      if (oldestKey) {
        this.lastMessages.delete(oldestKey);
      }
    }
  }

  /**
   * Get last message for a channel (replay functionality)
   */
  getLastMessage(channel: string): WebSocketMessage | undefined {
    return this.lastMessages.get(channel);
  }

  /**
   * Send last message to client (replay functionality)
   */
  replayLastMessage(
    ws: WebSocket & { clientId?: string },
    channel: string
  ): void {
    const lastMessage = this.getLastMessage(channel);
    if (lastMessage) {
      this.sendMessage(ws, {
        type: 'REPLAY',
        payload: lastMessage.payload,
        channel: lastMessage.channel
      });

      logger.debug('Replayed last message', {
        clientId: ws.clientId,
        channel,
        messageType: lastMessage.type
      });
    }
  }

  /**
   * Clear stored messages
   */
  clearStoredMessages(): void {
    this.lastMessages.clear();
    logger.info('Cleared all stored messages');
  }
}

export const messageHandler = new MessageHandler();
