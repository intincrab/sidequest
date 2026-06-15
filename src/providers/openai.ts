import OpenAI from 'openai';
import type { ChatMessage, ChatOptions, Provider } from './types';

export interface OpenAICompatOptions {
  /** Override the API base URL (for OpenAI-compatible vendors like GLM). */
  baseURL?: string;
  /** Provider name reported to the UI. */
  name?: string;
  /** Default model id when none is configured. */
  defaultModel?: string;
  /** Vendor-specific fields merged into every request body (e.g. GLM's `thinking`). */
  extraBody?: Record<string, unknown>;
}

/** Works with OpenAI and any OpenAI-compatible endpoint (e.g. Zhipu GLM via z.ai). */
export class OpenAIProvider implements Provider {
  readonly name: string;
  readonly defaultModel: string;
  private client: OpenAI;
  private extraBody?: Record<string, unknown>;

  constructor(apiKey: string, opts: OpenAICompatOptions = {}) {
    this.client = new OpenAI({ apiKey, baseURL: opts.baseURL });
    this.name = opts.name ?? 'openai';
    this.defaultModel = opts.defaultModel ?? 'gpt-4o-mini';
    this.extraBody = opts.extraBody;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const body: Record<string, unknown> = {
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(this.extraBody ?? {}),
    };

    const stream = await this.client.chat.completions.create(
      body as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
      { signal: opts.signal },
    );

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        opts.onDelta?.(delta);
      }
    }
    return full;
  }
}
