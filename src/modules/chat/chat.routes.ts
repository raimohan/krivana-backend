import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { chatIdSchema, chatListQuerySchema, createChatSchema, createMessageSchema, messageListSchema, projectChatParamSchema, updateChatSchema } from "./chat.schema";
import { createChat, createMessage, deleteChat, getChat, listChats, listMessages, listProjectChats, updateChat } from "./chat.service";

export async function chatRoutes(app: FastifyInstance) {
  app.get("/chat", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(chatListQuerySchema, request.query);
    return listChats(request.user.userId, query);
  });

  app.get("/chat/project/:projectId", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectChatParamSchema, request.params);
    return listProjectChats(request.user.userId, params.projectId);
  });

  app.post("/chat", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(createChatSchema, request.body);
    return createChat(request.user.userId, body);
  });

  app.get("/chat/:chatId", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(chatIdSchema, request.params);
    const query = parseWithSchema(messageListSchema, request.query);
    return getChat(request.user.userId, params.chatId, query.page, query.limit);
  });

  app.patch("/chat/:chatId", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(chatIdSchema, request.params);
    const body = parseWithSchema(updateChatSchema, request.body);
    return updateChat(request.user.userId, params.chatId, body);
  });

  app.delete("/chat/:chatId", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(chatIdSchema, request.params);
    return deleteChat(request.user.userId, params.chatId);
  });

  app.get("/chat/:chatId/messages", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(chatIdSchema, request.params);
    const query = parseWithSchema(messageListSchema, request.query);
    return listMessages(request.user.userId, params.chatId, query.page, query.limit);
  });

  app.post("/chat/:chatId/messages", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(chatIdSchema, request.params);
    const body = parseWithSchema(createMessageSchema, request.body);
    return createMessage(request.user.userId, params.chatId, body);
  });
}
