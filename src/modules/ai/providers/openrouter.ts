import OpenAI from "openai";

import type { AIProvider, StreamEvent, StreamParams } from "./base";

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    const client = new OpenAI({
      apiKey: params.apiKey,
      baseURL: params.baseUrl ?? "https://openrouter.ai/api/v1"
    });

    const stream = await client.chat.completions.create({
      model: params.model,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens,
      stream: true,
      messages: [
        {
          role: "system",
          content: params.systemPrompt
        },
        ...params.messages.map((message) => ({ role: message.role, content: message.content }))
      ]
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: "token", content };
      }
    }

    yield { type: "done" };
  }

  async isAvailable(apiKey?: string) {
    return Boolean(apiKey);
  }
}
