import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger.js';
import { Config } from '../config/env.js';

const logger = createLogger('websocket');

export interface TokenPayload {
  userId: string;
  role: 'user' | 'operator' | 'admin';
  region?: string;
  meterId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedClient extends TokenPayload {
  clientId: string;
  connectedAt: Date;
}

export interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  auth: AuthenticatedClient;
  isAlive: boolean;
  channels: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ExtendedWebSocket>;
  private subscriptions: Map<string, Set<ExtendedWebSocket>>;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.clients = new Map();
    this.subscriptions = new Map();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: Config.websocket.path
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws as ExtendedWebSocket, request);
    });

    this.wss.on('error', (error: Error) => {
      logger.error({ error }, 'WebSocket server error');
    });

    this.startHeartbeat();

    logger.info({
      path: Config.websocket.path,
      heartbeatInterval: Config.websocket.heartbeatInterval,
      maxConnections: Config.websocket.maxConnections
    }, 'WebSocket server initialized');
  }

  private handleConnection(ws: ExtendedWebSocket, request: IncomingMessage): void {
    if (this.clients.size >= Config.websocket.maxConnections) {
      logger.warn({ currentConnections: this.clients.size }, 'Connection rejected: max connections reached');
      ws.close(1008, 'Server at capacity');
      return;
    }

    const url = `ws://${request.headers.host}${request.url}`;
    const authHeader = request.headers.authorization;
    const token = this.extractToken(url, authHeader);

    if (!token) {
      logger.warn('Connection rejected: no token provided');
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const tokenPayload = this.verifyToken(token);
      const clientId = uuidv4();

      const auth: AuthenticatedClient = {
        ...tokenPayload,
        clientId,
        connectedAt: new Date()
      };

      ws.clientId = clientId;
      ws.auth = auth;
      ws.isAlive = true;
      ws.channels = new Set();

      this.clients.set(clientId, ws);

      logger.info({
        clientId,
        userId: auth.userId,
        role: auth.role,
        region: auth.region,
        totalConnections: this.clients.size
      }, 'Client connected');

      const defaultChannels = this.getDefaultChannels(auth);
      this.subscribeToChannels(ws, defaultChannels);

      this.sendWelcome(ws, Array.from(ws.channels));
      this.setupClientHandlers(ws);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errorMessage }, 'Connection rejected: authentication failed');
      ws.close(4001, 'Authentication failed');
    }
  }

  private setupClientHandlers(ws: ExtendedWebSocket): void {
    ws.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        const parsed = JSON.parse(message);

        if (parsed.action === 'subscribe' && parsed.channels) {
          this.subscribeToChannels(ws, parsed.channels);
          this.sendMessage(ws, { type: 'SUBSCRIBED', payload: { channels: parsed.channels } });
        } else if (parsed.action === 'unsubscribe' && parsed.channels) {
          this.unsubscribeFromChannels(ws, parsed.channels);
          this.sendMessage(ws, { type: 'UNSUBSCRIBED', payload: { channels: parsed.channels } });
        }
      } catch (error) {
        logger.error({ clientId: ws.clientId, error }, 'Error handling message');
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(ws, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      logger.error({ clientId: ws.clientId, error: error.message }, 'WebSocket error');
    });
  }

  private handleDisconnection(ws: ExtendedWebSocket, code: number, reason: string): void {
    logger.info({
      clientId: ws.clientId,
      userId: ws.auth?.userId,
      code,
      reason,
      duration: Date.now() - ws.auth?.connectedAt.getTime()
    }, 'Client disconnected');

    for (const channel of ws.channels) {
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    this.clients.delete(ws.clientId);
  }

  private subscribeToChannels(ws: ExtendedWebSocket, channels: string[]): void {
    for (const channel of channels) {
      if (!this.canAccessChannel(ws.auth, channel)) {
        logger.warn({
          clientId: ws.clientId,
          userId: ws.auth.userId,
          role: ws.auth.role,
          channel
        }, 'Channel access denied');
        continue;
      }

      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(ws);
      ws.channels.add(channel);

      logger.debug({
        clientId: ws.clientId,
        channel,
        subscriberCount: this.subscriptions.get(channel)!.size
      }, 'Client subscribed to channel');
    }
  }

  private unsubscribeFromChannels(ws: ExtendedWebSocket, channels: string[]): void {
    for (const channel of channels) {
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(ws);
        ws.channels.delete(channel);

        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        }

        logger.debug({
          clientId: ws.clientId,
          channel,
          remainingSubscribers: subscribers.size
        }, 'Client unsubscribed from channel');
      }
    }
  }

  broadcast(channel: string, message: WebSocketMessage): number {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) {
      logger.debug({ channel }, 'No subscribers for channel');
      return 0;
    }

    let sentCount = 0;
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
        sentCount++;
      }
    }

    logger.debug({ channel, sentCount, totalSubscribers: subscribers.size }, 'Broadcast message');
    return sentCount;
  }

  private sendMessage(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error({ clientId: ws.clientId, error }, 'Failed to send message');
    }
  }

  private sendWelcome(ws: ExtendedWebSocket, channels: string[]): void {
    this.sendMessage(ws, {
      type: 'WELCOME',
      payload: {
        clientId: ws.clientId,
        userId: ws.auth.userId,
        role: ws.auth.role,
        channels,
        timestamp: new Date().toISOString()
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, ws] of this.clients.entries()) {
        if (!ws.isAlive) {
          logger.debug({ clientId }, 'Terminating inactive connection');
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, Config.websocket.heartbeatInterval);

    logger.info({ interval: Config.websocket.heartbeatInterval }, 'Heartbeat mechanism started');
  }

  private extractToken(url: string, authHeader?: string): string | null {
    const urlObj = new URL(url, 'ws://localhost');
    const tokenFromQuery = urlObj.searchParams.get('token');

    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, Config.websocket.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('TOKEN_INVALID');
      } else {
        throw new Error('TOKEN_VERIFICATION_FAILED');
      }
    }
  }

  private canAccessChannel(client: AuthenticatedClient, channel: string): boolean {
    if (client.role === 'admin') {
      return true;
    }

    if (client.role === 'operator') {
      if (channel === 'alerts' || channel === 'tariffs' || channel === 'alert_status_updates') {
        return true;
      }
      if (channel.startsWith('region:')) {
        return true;
      }
    }

    if (channel === 'tariffs') {
      return true;
    }

    if (channel.startsWith('region:') && client.region) {
      const channelRegion = channel.split(':')[1];
      return channelRegion === client.region;
    }

    if (channel.startsWith('meter:') && client.meterId) {
      const channelMeter = channel.split(':')[1];
      return channelMeter === client.meterId;
    }

    return false;
  }

  private getDefaultChannels(client: AuthenticatedClient): string[] {
    const channels: string[] = [];

    if (client.role === 'admin' || client.role === 'operator') {
      channels.push('alerts', 'tariffs', 'alert_status_updates');
    } else {
      channels.push('tariffs');
    }

    if (client.region) {
      channels.push(`region:${client.region}`);
    }

    if (client.meterId) {
      channels.push(`meter:${client.meterId}`);
    }

    return channels;
  }

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

  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const [clientId, ws] of this.clients.entries()) {
      logger.debug({ clientId }, 'Closing connection');
      ws.close(1001, 'Server shutting down');
    }

    if (this.wss) {
      await new Promise<void>((resolve, reject) => {
        this.wss!.close((error) => {
          if (error) {
            logger.error({ error }, 'Error closing WebSocket server');
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
