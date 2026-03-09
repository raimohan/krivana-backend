import type { FastifyInstance } from "fastify";
import type { SocketStream } from "@fastify/websocket";
import type WebSocket from "ws";

import { nanoid } from "nanoid";

import { connectRedis, redis } from "../config/redis";
import { env } from "../env";
import { logger } from "../utils/logger";
import type { BufferedWsEvent, WsMessage } from "./ws.types";

interface UserConnection {
  id: string;
  userId: string;
  socket: WebSocket;
  subscribedProjects: Set<string>;
  pingTimer: NodeJS.Timeout;
}

class WebsocketHub {
  private readonly userConnections = new Map<string, Map<string, UserConnection>>();
  private readonly previewConnections = new Map<string, Set<WebSocket>>();
  private readonly deploymentConnections = new Map<string, Set<WebSocket>>();

  async registerUserConnection(userId: string, connection: SocketStream, options?: { lastEventId?: string }) {
    const socket = connection.socket;
    const connectionId = nanoid();
    const pingTimer = setInterval(() => {
      this.send(socket, { type: "PING", payload: {} });
    }, 30000);

    const entry: UserConnection = {
      id: connectionId,
      userId,
      socket,
      subscribedProjects: new Set(),
      pingTimer
    };

    const existing = this.userConnections.get(userId) ?? new Map<string, UserConnection>();
    existing.set(connectionId, entry);
    this.userConnections.set(userId, existing);

    socket.on("message", (message: Buffer) => {
      this.handleUserMessage(entry, message.toString("utf8"));
    });

    socket.on("close", () => {
      clearInterval(pingTimer);
      const group = this.userConnections.get(userId);
      group?.delete(connectionId);
      if (group && group.size === 0) {
        this.userConnections.delete(userId);
      }
    });

    await this.replayBufferedEvents(userId, socket, options?.lastEventId);
    this.send(socket, {
      type: "CONNECTED",
      payload: {
        userId,
        serverVersion: env.APP_VERSION
      }
    });
  }

  registerPreviewConnection(projectId: string, socket: WebSocket) {
    const set = this.previewConnections.get(projectId) ?? new Set<WebSocket>();
    set.add(socket);
    this.previewConnections.set(projectId, set);

    socket.on("close", () => {
      set.delete(socket);
      if (set.size === 0) {
        this.previewConnections.delete(projectId);
      }
    });
  }

  registerDeploymentConnection(deploymentId: string, socket: WebSocket) {
    const set = this.deploymentConnections.get(deploymentId) ?? new Set<WebSocket>();
    set.add(socket);
    this.deploymentConnections.set(deploymentId, set);

    socket.on("close", () => {
      set.delete(socket);
      if (set.size === 0) {
        this.deploymentConnections.delete(deploymentId);
      }
    });
  }

  async broadcastToUser(userId: string, message: WsMessage) {
    await this.storeBufferedEvent(userId, message);
    const connections = this.userConnections.get(userId);
    if (!connections) {
      return;
    }

    for (const connection of connections.values()) {
      this.send(connection.socket, message);
    }
  }

  async broadcastToProject(userId: string, projectId: string, message: WsMessage) {
    await this.storeBufferedEvent(userId, message);
    const connections = this.userConnections.get(userId);
    if (!connections) {
      return;
    }

    for (const connection of connections.values()) {
      if (connection.subscribedProjects.size === 0 || connection.subscribedProjects.has(projectId)) {
        this.send(connection.socket, message);
      }
    }
  }

  broadcastPreview(projectId: string, message: WsMessage) {
    const sockets = this.previewConnections.get(projectId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets.values()) {
      this.send(socket, message);
    }
  }

  broadcastDeployment(deploymentId: string, message: WsMessage) {
    const sockets = this.deploymentConnections.get(deploymentId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets.values()) {
      this.send(socket, message);
    }
  }

  private handleUserMessage(connection: UserConnection, rawMessage: string) {
    try {
      const message = JSON.parse(rawMessage) as WsMessage<{ projectId?: string }>;

      switch (message.type) {
        case "PONG":
          return;
        case "SUBSCRIBE_PROJECT":
          if (message.payload.projectId) {
            connection.subscribedProjects.add(message.payload.projectId);
          }
          return;
        case "UNSUBSCRIBE_PROJECT":
          if (message.payload.projectId) {
            connection.subscribedProjects.delete(message.payload.projectId);
          }
          return;
        default:
          logger.debug({ message }, "Unhandled websocket client message");
      }
    } catch (error) {
      logger.warn({ error }, "Failed to parse websocket message");
    }
  }

  private send(socket: WebSocket, message: WsMessage) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private async storeBufferedEvent(userId: string, message: WsMessage) {
    try {
      await connectRedis();
      const event: BufferedWsEvent = {
        id: String(Date.now()),
        userId,
        message,
        createdAt: new Date().toISOString()
      };
      const key = `ws:events:${userId}`;
      await redis.lPush(key, JSON.stringify(event));
      await redis.lTrim(key, 0, 100);
      await redis.expire(key, 300);
    } catch (error) {
      logger.warn({ error }, "Failed to buffer websocket event");
    }
  }

  private async replayBufferedEvents(userId: string, socket: WebSocket, lastEventId?: string) {
    if (!lastEventId) {
      return;
    }

    try {
      await connectRedis();
      const key = `ws:events:${userId}`;
      const items = await redis.lRange(key, 0, 100);
      const events = items
        .map((item) => JSON.parse(item) as BufferedWsEvent)
        .reverse()
        .filter((event) => Number(event.id) > Number(lastEventId));

      for (const event of events) {
        this.send(socket, {
          ...event.message,
          id: event.id
        });
      }
    } catch (error) {
      logger.warn({ error }, "Failed to replay websocket events");
    }
  }
}

export const wsHub = new WebsocketHub();

export async function registerGlobalWebsocketRoute(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (connection, request) => {
    const query = request.query as { token?: string; lastEventId?: string };

    if (!query.token) {
      connection.socket.close(1008, "Missing token");
      return;
    }

    try {
      const decoded = await app.jwt.verify<{ userId: string; email: string }>(query.token);
      await wsHub.registerUserConnection(decoded.userId, connection, {
        lastEventId: query.lastEventId
      });
    } catch (error) {
      logger.warn({ error }, "Websocket authentication failed");
      connection.socket.close(1008, "Unauthorized");
    }
  });
}
