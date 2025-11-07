import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { authService, AuthenticatedClient } from './auth.js';
import { messageHandler, WebSocketMessage } from './messageHandler.js';
import { wsLogger as logger } from '../utils/logger.js';
import { metricsService } from '../metrics/metrics.js';

export interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  auth: AuthenticatedClient;
  isAlive: boolean;
  channels: Set<string>;
}

class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ExtendedWebSocket>;
  private subscriptions: Map<string, Set<ExtendedWebSocket>>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL: number;
  private readonly MAX_CONNECTIONS: number;

  constructor() {
    this.clients = new Map();
    this.subscriptions = new Map();
    this.HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || '30000');
    this.MAX_CONNECTIONS = parseInt(process.env.WS_MAX_CONNECTIONS || '10000');
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws as ExtendedWebSocket, request);
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket server error', error);
    });

    // Start heartbeat mechanism
    this.startHeartbeat();

    logger.info('WebSocket server initialized', {
      path: '/ws',
      heartbeatInterval: this.HEARTBEAT_INTERVAL,
      maxConnections: this.MAX_CONNECTIONS
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: ExtendedWebSocket, request: IncomingMessage): void {
    // Check connection limit
    if (this.clients.size >= this.MAX_CONNECTIONS) {
      logger.warn('Connection rejected: max connections reached', {
        currentConnections: this.clients.size,
        maxConnections: this.MAX_CONNECTIONS
      });
      ws.close(1008, 'Server at capacity');
      return;
    }

    // Extract and verify token
    const url = `ws://${request.headers.host}${request.url}`;
    const authHeader = request.headers.authorization;
    const token = authService.extractToken(url, authHeader);

    if (!token) {
      logger.warn('Connection rejected: no token provided');
      metricsService.incrementAuthFailures('no_token');
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      // Verify token
      const tokenPayload = authService.verifyToken(token);

      // Create authenticated client
      const clientId = uuidv4();
      const auth: AuthenticatedClient = {
        ...tokenPayload,
        clientId,
        connectedAt: new Date()
      };

      // Initialize extended WebSocket
      ws.clientId = clientId;
      ws.auth = auth;
      ws.isAlive = true;
      ws.channels = new Set();

      // Store client
      this.clients.set(clientId, ws);

      // Update metrics
      metricsService.incrementConnectionsTotal();
      metricsService.setActiveConnections(this.clients.size);

      logger.info('Client connected', {
        clientId,
        userId: auth.userId,
        role: auth.role,
        region: auth.region,
        totalConnections: this.clients.size
      });

      // Subscribe to default channels
      const defaultChannels = authService.getDefaultChannels(auth);
      this.subscribeToChannels(ws, defaultChannels);

      // Send welcome message
      messageHandler.sendWelcome(ws, Array.from(ws.channels));

      // Setup event handlers
      this.setupClientHandlers(ws);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Connection rejected: authentication failed', { error: errorMessage });

      if (errorMessage === 'TOKEN_EXPIRED') {
        metricsService.incrementAuthFailures('token_expired');
        ws.close(4001, 'Token expired');
      } else if (errorMessage === 'TOKEN_INVALID') {
        metricsService.incrementAuthFailures('token_invalid');
        ws.close(4001, 'Invalid token');
      } else {
        metricsService.incrementAuthFailures('verification_failed');
        ws.close(4001, 'Authentication failed');
      }
    }
  }

  /**
   * Setup event handlers for a client
   */
  private setupClientHandlers(ws: ExtendedWebSocket): void {
    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        messageHandler.handleClientMessage(ws, message);

        // Parse for subscription/unsubscription actions
        const parsed = JSON.parse(message);
        if (parsed.action === 'subscribe' && parsed.channels) {
          this.subscribeToChannels(ws, parsed.channels);
          messageHandler.sendSubscriptionConfirmation(ws, parsed.channels);
        } else if (parsed.action === 'unsubscribe' && parsed.channels) {
          this.unsubscribeFromChannels(ws, parsed.channels);
          messageHandler.sendUnsubscriptionConfirmation(ws, parsed.channels);
        }
      } catch (error) {
        logger.error('Error handling message', {
          clientId: ws.clientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle connection close
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(ws, code, reason.toString());
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', {
        clientId: ws.clientId,
        error: error.message
      });
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: ExtendedWebSocket, code: number, reason: string): void {
    logger.info('Client disconnected', {
      clientId: ws.clientId,
      userId: ws.auth?.userId,
      code,
      reason,
      duration: Date.now() - ws.auth?.connectedAt.getTime()
    });

    // Remove from all subscriptions
    for (const channel of ws.channels) {
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        } else {
          metricsService.updateChannelSubscribers(channel, subscribers.size);
        }
      }
    }

    // Remove client
    this.clients.delete(ws.clientId);

    // Update metrics
    metricsService.setActiveConnections(this.clients.size);

    logger.debug('Cleanup completed', {
      clientId: ws.clientId,
      remainingConnections: this.clients.size
    });
  }

  /**
   * Subscribe client to channels
   */
  private subscribeToChannels(ws: ExtendedWebSocket, channels: string[]): void {
    for (const channel of channels) {
      // Check permission
      if (!authService.canAccessChannel(ws.auth, channel)) {
        logger.warn('Channel access denied', {
          clientId: ws.clientId,
          userId: ws.auth.userId,
          role: ws.auth.role,
          channel
        });
        messageHandler.sendError(ws, 'ACCESS_DENIED', `Access denied to channel: ${channel}`);
        continue;
      }

      // Add to subscription map
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(ws);
      ws.channels.add(channel);

      // Update metrics
      metricsService.updateChannelSubscribers(channel, this.subscriptions.get(channel)!.size);

      logger.debug('Client subscribed to channel', {
        clientId: ws.clientId,
        channel,
        subscriberCount: this.subscriptions.get(channel)!.size
      });

      // Replay last message if available
      messageHandler.replayLastMessage(ws, channel);
    }
  }

  /**
   * Unsubscribe client from channels
   */
  private unsubscribeFromChannels(ws: ExtendedWebSocket, channels: string[]): void {
    for (const channel of channels) {
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(ws);
        ws.channels.delete(channel);

        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        } else {
          metricsService.updateChannelSubscribers(channel, subscribers.size);
        }

        logger.debug('Client unsubscribed from channel', {
          clientId: ws.clientId,
          channel,
          remainingSubscribers: subscribers.size
        });
      }
    }
  }

  /**
   * Broadcast message to a channel
   */
  broadcast(channel: string, message: WebSocketMessage, topic?: string): number {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) {
      logger.debug('No subscribers for channel', { channel });
      return 0;
    }

    return messageHandler.broadcast(subscribers, message, channel, topic);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, ws] of this.clients.entries()) {
        if (!ws.isAlive) {
          logger.debug('Terminating inactive connection', { clientId });
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, this.HEARTBEAT_INTERVAL);

    logger.info('Heartbeat mechanism started', {
      interval: this.HEARTBEAT_INTERVAL
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeChannels: number;
    channelStats: { channel: string; subscribers: number }[];
  } {
    const channelStats = Array.from(this.subscriptions.entries()).map(([channel, subscribers]) => ({
      channel,
      subscribers: subscribers.size
    }));

    return {
      totalConnections: this.clients.size,
      activeChannels: this.subscriptions.size,
      channelStats
    };
  }

  /**
   * Shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const [clientId, ws] of this.clients.entries()) {
      logger.debug('Closing connection', { clientId });
      ws.close(1001, 'Server shutting down');
    }

    // Close server
    if (this.wss) {
      await new Promise<void>((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            logger.error('Error closing WebSocket server', error);
            reject(error);
          } else {
            logger.info('WebSocket server closed');
            resolve();
          }
        });
      });
    }

    this.clients.clear();
    this.subscriptions.clear();
  }
}

export const wsServer = new WebSocketServerManager();
