import Groq from "groq-sdk";

import type { AIProvider, StreamEvent, StreamParams } from "./base";

export class GroqProvider implements AIProvider {
  name = "groq";

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    const client = new Groq({ apiKey: params.apiKey });
    const stream = await client.chat.completions.create({
      model: params.model,
      temperature: params.temperature ?? 0.3,
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
