import { ChatType, MessageRole, type Prisma } from "@prisma/client";

import { prisma } from "../../config/database";
import { wsHub } from "../../websocket/ws.server";
import { getPagination } from "../../utils/pagination";
import { notFound } from "../../utils/errors";

function autoTitle(content: string) {
  return content
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

async function getOwnedChat(userId: string, chatId: string) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId }
  });

  if (!chat) {
    throw notFound("CHAT_NOT_FOUND", "Chat not found");
  }

  return chat;
}

export async function listChats(
  userId: string,
  input: { type?: "PLANNING" | "PROJECT" | "COMBINED" | "ALL"; page?: number; limit?: number }
) {
  const { skip, take, page, limit } = getPagination(input.page, input.limit);
  const where: Prisma.ChatWhereInput = {
    userId,
    ...(input.type && input.type !== "ALL" ? { chatType: input.type as ChatType } : {})
  };

  const [items, total] = await Promise.all([
    prisma.chat.findMany({
      where,
      skip,
      take,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.chat.count({ where })
  ]);

  return {
    items,
    page,
    limit,
    total
  };
}

export async function listProjectChats(userId: string, projectId: string) {
  return prisma.chat.findMany({
    where: { userId, projectId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]
  });
}

export async function createChat(
  userId: string,
  input: { projectId?: string; chatType: "PLANNING" | "PROJECT" | "COMBINED"; title?: string }
) {
  const chat = await prisma.chat.create({
    data: {
      userId,
      projectId: input.projectId,
      chatType: input.chatType as ChatType,
      title: input.title
    }
  });

  await wsHub.broadcastToUser(userId, {
    type: "CHAT_CREATED",
    payload: { chat }
  });

  return { chat };
}

export async function getChat(userId: string, chatId: string, page = 1, limit = 50) {
  const chat = await getOwnedChat(userId, chatId);
  const { skip, take } = getPagination(page, limit);
  const messages = await prisma.message.findMany({
    where: { chatId },
    skip,
    take,
    orderBy: { createdAt: "asc" }
  });

  return { chat, messages };
}

export async function updateChat(userId: string, chatId: string, input: { title?: string; isPinned?: boolean }) {
  await getOwnedChat(userId, chatId);
  const chat = await prisma.chat.update({
    where: { id: chatId },
    data: {
      title: input.title,
      isPinned: input.isPinned
    }
  });

  await wsHub.broadcastToUser(userId, {
    type: "CHAT_UPDATED",
    payload: { chat }
  });

  return { chat };
}

export async function deleteChat(userId: string, chatId: string) {
  await getOwnedChat(userId, chatId);
  await prisma.chat.delete({ where: { id: chatId } });
  return { success: true };
}

export async function listMessages(userId: string, chatId: string, page = 1, limit = 50) {
  await getOwnedChat(userId, chatId);
  const { skip, take } = getPagination(page, limit);
  return prisma.message.findMany({
    where: { chatId },
    skip,
    take,
    orderBy: { createdAt: "asc" }
  });
}

export async function createMessage(userId: string, chatId: string, input: { role: "user" | "assistant"; content: string }) {
  const chat = await getOwnedChat(userId, chatId);

  const message = await prisma.message.create({
    data: {
      chatId,
      role: input.role as MessageRole,
      content: input.content,
      tokenCount: input.content.length
    }
  });

  if (!chat.title && input.role === "user") {
    const title = autoTitle(input.content);
    if (title) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { title }
      });
    }
  }

  return { message };
}
