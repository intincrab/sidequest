import fs from 'node:fs';
import { CONFIG_PATH, ensureDirs } from './paths';

export type ProviderName = 'anthropic' | 'openai' | 'glm';

export interface SidequestConfig {
  /** Which model vendor powers the lessons. */
  provider: ProviderName;
  /** Optional model id override; falls back to the provider's cheap default. */
  model?: string;
  /** Localhost port the TUI listens on for agent events. */
  port: number;
  /** Topic to auto-resume on launch. */
  defaultTopic?: string;
  /** Style guidance handed to the tutor model. */
  lessonStyle: string;
  /** When the agent goes busy, automatically serve the next lesson chunk. */
  autoAdvanceOnBusy: boolean;
  /** Auto-open the panel via the SessionStart hook when Claude Code launches. */
  autoLaunch: boolean;
}

const DEFAULT_CONFIG: SidequestConfig = {
  provider: 'anthropic',
  port: 4317,
  lessonStyle:
    'concise and vivid, around 150 words, plain conversational language, one memorable concrete detail per lesson',
  autoAdvanceOnBusy: true,
  autoLaunch: true,
};

export function loadConfig(): SidequestConfig {
  ensureDirs();
  let fileCfg: Partial<SidequestConfig> = {};
  try {
    fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<SidequestConfig>;
  } catch {
    /* no config file yet — defaults are fine */
  }
  const cfg: SidequestConfig = { ...DEFAULT_CONFIG, ...fileCfg };
  if (process.env.SIDEQUEST_PORT) cfg.port = Number(process.env.SIDEQUEST_PORT);
  if (process.env.SIDEQUEST_PROVIDER) cfg.provider = process.env.SIDEQUEST_PROVIDER as ProviderName;
  if (process.env.SIDEQUEST_MODEL) cfg.model = process.env.SIDEQUEST_MODEL;
  return cfg;
}

export function saveConfig(cfg: SidequestConfig): void {
  ensureDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}
