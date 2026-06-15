import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ChatOptions, Provider } from './types';

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-haiku-4-5-20251001';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = this.client.messages.stream(
      {
        model: opts.model ?? this.defaultModel,
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.7,
        system: system || undefined,
        messages: turns,
      },
      { signal: opts.signal },
    );

    if (opts.onDelta) {
      const onDelta = opts.onDelta;
      stream.on('text', (t) => onDelta(t));
    }

    const final = await stream.finalMessage();
    return final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
}
