import type { SidequestConfig } from '../config';
import type { Provider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';

/** Zhipu GLM's OpenAI-compatible endpoint (international). */
const GLM_BASE_URL = 'https://api.z.ai/api/paas/v4';

export function createProvider(cfg: SidequestConfig): Provider {
  if (cfg.provider === 'glm') {
    const key = process.env.GLM_API_KEY ?? process.env.ZHIPU_API_KEY;
    if (!key) throw new Error('GLM_API_KEY is not set. Add it to your shell or .env file.');
    return new OpenAIProvider(key, {
      name: 'glm',
      baseURL: process.env.GLM_BASE_URL ?? GLM_BASE_URL,
      defaultModel: 'glm-4.5-flash',
      // GLM-4.5 is a hybrid reasoning model; disable thinking to keep lessons fast and cheap.
      extraBody: { thinking: { type: 'disabled' } },
    });
  }

  if (cfg.provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set. Add it to your shell or .env file.');
    return new OpenAIProvider(key);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set. Add it to your shell or .env file.');
  return new AnthropicProvider(key);
}

export type { Provider, ChatMessage, ChatOptions } from './types';
