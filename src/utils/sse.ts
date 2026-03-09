import type { FastifyReply } from "fastify";

export function beginSse(reply: FastifyReply) {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  reply.hijack();
}

export function sendSse(reply: FastifyReply, payload: Record<string, unknown>) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function closeSse(reply: FastifyReply) {
  reply.raw.end();
}
