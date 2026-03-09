import { getMessaging } from "firebase-admin/messaging";

import { NotificationType } from "@prisma/client";

import { prisma } from "../../config/database";
import { getFirebaseApp } from "../../config/firebase";
import { wsHub } from "../../websocket/ws.server";
import { getPagination } from "../../utils/pagination";

export async function sendNotification(
  userId: string,
  input: { type: NotificationType | keyof typeof NotificationType; title: string; body: string; metadata?: Record<string, unknown> }
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type as NotificationType,
      title: input.title,
      body: input.body,
      metadata: input.metadata
    }
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false }
  });

  await wsHub.broadcastToUser(userId, {
    type: "NOTIFICATION",
    payload: { notification }
  });
  await wsHub.broadcastToUser(userId, {
    type: "UNREAD_COUNT",
    payload: { count: unreadCount }
  });

  const app = getFirebaseApp();
  if (app) {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true }
    });

    if (tokens.length > 0) {
      await getMessaging(app).sendEachForMulticast({
        tokens: tokens.map((item) => item.token),
        notification: {
          title: input.title,
          body: input.body
        },
        data: {
          type: String(input.type),
          metadata: JSON.stringify(input.metadata ?? {})
        }
      });
    }
  }

  return notification;
}

export async function listNotifications(userId: string, page?: number, limit?: number) {
  const { skip, take, page: resolvedPage, limit: resolvedLimit } = getPagination(page, limit);
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    }),
    prisma.notification.count({ where: { userId } })
  ]);

  return {
    items,
    page: resolvedPage,
    limit: resolvedLimit,
    total
  };
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true }
  });
  return { success: true };
}

export async function readAllNotifications(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  return { success: true };
}

export async function deleteNotification(userId: string, id: string) {
  await prisma.notification.deleteMany({
    where: { id, userId }
  });
  return { success: true };
}

export async function unreadNotificationCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false }
  });
  return { count };
}

export async function registerDeviceToken(userId: string, token: string, platform: "ios" | "android") {
  return prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform }
  });
}
