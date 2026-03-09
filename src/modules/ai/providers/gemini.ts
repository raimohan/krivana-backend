import { GoogleGenerativeAI } from "@google/generative-ai";

import type { AIProvider, StreamEvent, StreamParams } from "./base";

export class GeminiProvider implements AIProvider {
  name = "gemini";

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    const client = new GoogleGenerativeAI(params.apiKey);
    const model = client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt
    } as any);

    const result = await model.generateContentStream({
      contents: params.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      generationConfig: {
        maxOutputTokens: params.maxTokens,
        temperature: params.temperature ?? 0.4
      }
    } as any);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: "token", content: text };
      }
    }

    yield { type: "done" };
  }

  async isAvailable(apiKey?: string) {
    return Boolean(apiKey);
  }
}
