import Anthropic from "@anthropic-ai/sdk";

import type { AIProvider, StreamEvent, StreamParams } from "./base";

export class AnthropicProvider implements AIProvider {
  name = "anthropic";

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    const client = new Anthropic({ apiKey: params.apiKey });
    const stream = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.4,
      system: params.systemPrompt,
      stream: true,
      messages: params.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }))
    } as any);

    for await (const event of stream as any) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        yield { type: "token", content: event.delta.text };
      }
    }

    yield { type: "done" };
  }

  async isAvailable(apiKey?: string) {
    return Boolean(apiKey);
  }
}
