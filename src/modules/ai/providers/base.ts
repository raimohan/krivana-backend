export interface ChatLikeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamParams {
  apiKey: string;
  model: string;
  messages: ChatLikeMessage[];
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
}

export interface StreamEvent {
  type: "token" | "thinking" | "done" | "error";
  content?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  name: string;
  stream(params: StreamParams): AsyncIterable<StreamEvent>;
  isAvailable(apiKey?: string): Promise<boolean>;
}
