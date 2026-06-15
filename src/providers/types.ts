export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Called with each streamed text delta. */
  onDelta?: (text: string) => void;
}

/** A minimal streaming chat interface every model vendor implements. */
export interface Provider {
  readonly name: string;
  readonly defaultModel: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}
