import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { deviceTokenSchema, notificationIdSchema, notificationListQuerySchema } from "./notifications.schema";
import {
  deleteNotification,
  listNotifications,
  markNotificationRead,
  readAllNotifications,
  registerDeviceToken,
  unreadNotificationCount
} from "./notifications.service";

export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(notificationListQuerySchema, request.query);
    return listNotifications(request.user.userId, query.page, query.limit);
  });

  app.patch("/notifications/:id/read", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(notificationIdSchema, request.params);
    return markNotificationRead(request.user.userId, params.id);
  });

  app.post("/notifications/read-all", { preHandler: [app.authenticate] }, async (request) => {
    return readAllNotifications(request.user.userId);
  });

  app.delete("/notifications/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(notificationIdSchema, request.params);
    return deleteNotification(request.user.userId, params.id);
  });

  app.get("/notifications/unread-count", { preHandler: [app.authenticate] }, async (request) => {
    return unreadNotificationCount(request.user.userId);
  });

  app.post("/notifications/device-token", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(deviceTokenSchema, request.body);
    return registerDeviceToken(request.user.userId, body.token, body.platform);
  });
}
