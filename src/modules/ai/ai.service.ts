import type { FastifyReply } from "fastify";

import { MemoryType, MessageRole } from "@prisma/client";

import { prisma } from "../../config/database";
import { decryptSecret } from "../../utils/crypto";
import { badRequest, notFound } from "../../utils/errors";
import { buildFileTree, readTextFile } from "../../utils/fileSystem";
import { beginSse, closeSse, sendSse } from "../../utils/sse";
import { wsHub } from "../../websocket/ws.server";
import { createFile, deleteEntry, updateFile } from "../files/files.service";
import { AnthropicProvider } from "./providers/anthropic";
import type { AIProvider, ChatLikeMessage } from "./providers/base";
import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { OpenAIProvider } from "./providers/openai";
import { OpenRouterProvider } from "./providers/openrouter";

const FILE_OP_REGEX = /```file:(create|update|delete):([^\n]+)\n([\s\S]*?)```/g;

const PROVIDERS: Record<string, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  gemini: new GeminiProvider(),
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider()
};

const MODEL_CATALOG: Record<string, Array<{ id: string; name: string; contextWindow: number }>> = {
  openai: [
    { id: "gpt-4.1-mini", name: "GPT-4.1 mini", contextWindow: 1048576 },
    { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000 }
  ],
  anthropic: [{ id: "claude-3-7-sonnet-latest", name: "Claude 3.7 Sonnet", contextWindow: 200000 }],
  gemini: [{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1000000 }],
  groq: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 131072 }],
  openrouter: [{ id: "openai/gpt-4o-mini", name: "OpenRouter GPT-4o mini", contextWindow: 128000 }]
};

function parseFileOperations(content: string) {
  const operations: Array<{ op: "create" | "update" | "delete"; path: string; content?: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = FILE_OP_REGEX.exec(content)) !== null) {
    operations.push({
      op: match[1] as "create" | "update" | "delete",
      path: match[2].trim(),
      content: match[3]
    });
  }

  return operations;
}

function serializeFileTree(node: Awaited<ReturnType<typeof buildFileTree>>, depth = 0): string {
  const indent = "  ".repeat(depth);
  const current = `${indent}- ${node.path} (${node.type})`;
  const children = node.children?.map((child) => serializeFileTree(child, depth + 1)) ?? [];
  return [current, ...children].join("\n");
}

async function resolveProvider(userId: string, providerName?: string) {
  const record = providerName
    ? await prisma.apiKey.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: providerName
          }
        }
      })
    : await prisma.apiKey.findFirst({
        where: { userId, isDefault: true },
        orderBy: { updatedAt: "desc" }
      });

  if (!record) {
    throw badRequest("AI_NO_KEY_CONFIGURED", "No AI provider key configured");
  }

  const provider = PROVIDERS[record.provider];
  if (!provider) {
    throw badRequest("AI_PROVIDER_ERROR", `Unsupported AI provider: ${record.provider}`);
  }

  return {
    provider,
    config: record,
    apiKey: decryptSecret(record.keyEncrypted)
  };
}

async function buildSystemPrompt(params: {
  userId: string;
  projectId?: string;
  chatType: string;
  includeFiles?: string[];
}) {
  const memories = await prisma.memory.findMany({
    where: {
      userId: params.userId,
      OR: [{ projectId: null }, { projectId: params.projectId ?? null }]
    }
  });

  const userMemory = memories.find((memory) => memory.memoryType === MemoryType.USER_PROFILE && memory.projectId === null);
  const aiMemoryGlobal = memories.find((memory) => memory.memoryType === MemoryType.AI_BEHAVIOUR && memory.projectId === null);
  const aiMemoryProject = memories.find((memory) => memory.memoryType === MemoryType.AI_BEHAVIOUR && memory.projectId === params.projectId);

  const parts: string[] = [];
  parts.push("You are Krivana AI, an expert full-stack developer assistant.");
  parts.push("You help users plan, build, and modify apps from a mobile client.");
  parts.push("You can create and modify files using fenced file operation blocks.");

  if (userMemory) {
    parts.push(`\n## About the User\n${userMemory.content}`);
  }

  const behavior = aiMemoryProject?.content ?? aiMemoryGlobal?.content;
  if (behavior) {
    parts.push(`\n## Behaviour\n${behavior}`);
  }

  if (params.projectId) {
    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    if (project) {
      const tree = await buildFileTree(project.folderPath);
      parts.push(`\n## Project Files\n${serializeFileTree(tree)}`);

      if (params.includeFiles?.length) {
        const includedContent = await Promise.all(
          params.includeFiles.map(async (filePath) => {
            try {
              const content = await readTextFile(project.folderPath, filePath);
              return `### ${filePath}\n${content}`;
            } catch {
              return `### ${filePath}\n<unavailable>`;
            }
          })
        );
        parts.push(`\n## Included Files\n${includedContent.join("\n\n")}`);
      }
    }
  }

  parts.push(`
## File Operations
To create or modify files, use this exact format:
\`\`\`file:create:/path/to/file.ts
// file content here
\`\`\`
\`\`\`file:update:/path/to/file.ts
// updated content here
\`\`\`
\`\`\`file:delete:/path/to/file.ts
\`\`\``);

  if (params.chatType === "PLANNING") {
    parts.push("You are in PLANNING mode. Do not create files unless explicitly requested.");
  }

  return parts.join("\n");
}

async function buildMessageHistory(chatId: string) {
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  return messages.map<ChatLikeMessage>((message) => ({
    role: message.role === MessageRole.assistant ? "assistant" : "user",
    content: message.content
  }));
}

async function persistAssistantArtifacts(
  userId: string,
  chatId: string,
  projectId: string | undefined,
  assistantContent: string
) {
  const assistantMessage = await prisma.message.create({
    data: {
      chatId,
      role: MessageRole.assistant,
      content: assistantContent,
      tokenCount: assistantContent.length
    }
  });

  const operations = projectId ? parseFileOperations(assistantContent) : [];
  for (const operation of operations) {
    if (!projectId) {
      continue;
    }

    if (operation.op === "create") {
      await createFile(userId, projectId, { path: operation.path, content: operation.content ?? "" });
    } else if (operation.op === "update") {
      await updateFile(userId, projectId, { path: operation.path, content: operation.content ?? "" });
    } else if (operation.op === "delete") {
      await deleteEntry(userId, projectId, operation.path);
    }

    await prisma.fileChange.create({
      data: {
        messageId: assistantMessage.id,
        projectId,
        filePath: operation.path,
        operation: operation.op
      }
    });
  }

  return { assistantMessage, operations };
}

async function updateChatTitleIfNeeded(chatId: string, title: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat?.title) {
    await prisma.chat.update({
      where: { id: chatId },
      data: { title }
    });
  }
}

async function ensureOwnedChat(userId: string, chatId: string) {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) {
    throw notFound("CHAT_NOT_FOUND", "Chat not found");
  }
  return chat;
}

export async function streamAiResponse(
  userId: string,
  input: {
    chatId: string;
    projectId?: string;
    message: string;
    mode: "thinking" | "fast";
    provider?: string;
    model?: string;
    includeFiles?: string[];
  },
  reply: FastifyReply,
  options?: { persistUserMessage?: boolean }
) {
  const chat = await ensureOwnedChat(userId, input.chatId);
  beginSse(reply);

  try {
    if (options?.persistUserMessage !== false) {
      await prisma.message.create({
        data: {
          chatId: input.chatId,
          role: MessageRole.user,
          content: input.message,
          tokenCount: input.message.length
        }
      });
      await updateChatTitleIfNeeded(input.chatId, input.message.split(/\s+/).slice(0, 4).join(" "));
    }

    const { provider, config, apiKey } = await resolveProvider(userId, input.provider);
    const history = await buildMessageHistory(input.chatId);
    const systemPromptBase = await buildSystemPrompt({
      userId,
      projectId: input.projectId,
      chatType: chat.chatType,
      includeFiles: input.includeFiles
    });
    const systemPrompt =
      input.mode === "thinking"
        ? `${systemPromptBase}\n\nReturn only a JSON array of feature suggestions. Do not build files yet.`
        : systemPromptBase;

    let assistantContent = "";
    const model = input.model ?? config.model;

    for await (const event of provider.stream({
      apiKey,
      model,
      baseUrl: config.baseUrl ?? undefined,
      systemPrompt,
      messages: history,
      maxTokens: input.mode === "thinking" ? 1200 : 4096,
      temperature: input.mode === "thinking" ? 0.2 : 0.45
    })) {
      if (event.type === "token" && event.content) {
        assistantContent += event.content;
        const type = input.mode === "thinking" ? "thinking" : "token";
        sendSse(reply, { type, content: event.content });
        await wsHub.broadcastToUser(userId, {
          type: type === "thinking" ? "AI_THINKING" : "AI_TOKEN",
          payload: { chatId: input.chatId, content: event.content }
        });
      }
    }

    const { assistantMessage, operations } = await persistAssistantArtifacts(userId, input.chatId, input.projectId, assistantContent);

    for (const operation of operations) {
      sendSse(reply, {
        type: "file_op",
        op: operation.op,
        path: operation.path,
        content: operation.content
      });
      await wsHub.broadcastToUser(userId, {
        type: "AI_FILE_OP",
        payload: {
          chatId: input.chatId,
          projectId: input.projectId,
          op: operation.op,
          path: operation.path
        }
      });
    }

    sendSse(reply, {
      type: "done",
      messageId: assistantMessage.id,
      usage: { tokens: assistantContent.length }
    });
    await wsHub.broadcastToUser(userId, {
      type: "AI_DONE",
      payload: { chatId: input.chatId, messageId: assistantMessage.id }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider error";
    sendSse(reply, {
      type: "error",
      message
    });
    return;
  } finally {
    closeSse(reply);
  }
}

export async function regenerateAiResponse(userId: string, messageId: string, reply: FastifyReply) {
  const assistantMessage = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      chat: true
    }
  });

  if (!assistantMessage || assistantMessage.chat.userId !== userId) {
    throw notFound("MESSAGE_NOT_FOUND", "Message not found");
  }

  const previousUserMessage = await prisma.message.findFirst({
    where: {
      chatId: assistantMessage.chatId,
      role: MessageRole.user,
      createdAt: { lt: assistantMessage.createdAt }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!previousUserMessage) {
    throw notFound("MESSAGE_NOT_FOUND", "No user message available to regenerate from");
  }

  await prisma.fileChange.deleteMany({ where: { messageId } });
  await prisma.message.delete({ where: { id: messageId } });

  return streamAiResponse(
    userId,
    {
      chatId: assistantMessage.chatId,
      projectId: assistantMessage.chat.projectId ?? undefined,
      message: previousUserMessage.content,
      mode: "fast"
    },
    reply,
    { persistUserMessage: false }
  );
}

export async function updateAiMemoryPreference(userId: string, input: { reaction: "like" | "dislike"; messageId: string }) {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    include: { chat: true }
  });

  if (!message || message.chat.userId !== userId) {
    throw notFound("MESSAGE_NOT_FOUND", "Message not found");
  }

  await prisma.message.update({
    where: { id: input.messageId },
    data: {
      liked: input.reaction === "like"
    }
  });

  const existing = await prisma.memory.findFirst({
    where: {
      userId,
      projectId: null,
      memoryType: MemoryType.STYLE_PREFERENCES
    }
  });

  let content: { likes: string[]; dislikes: string[] } = { likes: [], dislikes: [] };
  if (existing) {
    try {
      content = JSON.parse(existing.content) as { likes: string[]; dislikes: string[] };
    } catch {
      content = { likes: [], dislikes: [] };
    }
  }

  if (input.reaction === "like") {
    content.likes = [...new Set([...content.likes, message.content])].slice(-20);
  } else {
    content.dislikes = [...new Set([...content.dislikes, message.content])].slice(-20);
  }

  await prisma.memory.upsert({
    where: {
      userId_projectId_memoryType: {
        userId,
        projectId: null,
        memoryType: MemoryType.STYLE_PREFERENCES
      }
    },
    update: {
      content: JSON.stringify(content, null, 2)
    },
    create: {
      userId,
      projectId: null,
      memoryType: MemoryType.STYLE_PREFERENCES,
      content: JSON.stringify(content, null, 2)
    }
  });

  return { saved: true };
}

export async function listAvailableModels(userId: string) {
  const keys = await prisma.apiKey.findMany({ where: { userId } });
  return keys.map((key) => ({
    provider: key.provider,
    models: (MODEL_CATALOG[key.provider] ?? [{ id: key.model, name: key.model, contextWindow: 0 }]).map((model) => ({
      ...model,
      isDefault: model.id === key.model || key.isDefault
    }))
  }));
}

