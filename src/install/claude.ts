import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/** Events forwarded to a running sidequest (busy/idle detection). */
const FORWARD_EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop'] as const;

/** Substring used to recognize (and replace) our own hook entries idempotently. */
const MARKER = 'sidequest/hooks/';

interface HookCommand {
  type: 'command';
  command: string;
}
interface HookGroup {
  matcher?: string;
  hooks: HookCommand[];
}
interface ClaudeSettings {
  hooks?: Record<string, HookGroup[]>;
  [k: string]: unknown;
}

function scriptPath(name: string): string {
  // src/install/claude.ts -> repo root -> hooks/<name>
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'hooks', name).replace(/\\/g, '/');
}

export function installClaudeHooks(opts: { global?: boolean; cwd?: string }): string {
  const settingsPath = opts.global
    ? path.join(os.homedir(), '.claude', 'settings.json')
    : path.join(opts.cwd ?? process.cwd(), '.claude', 'settings.json');

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  let settings: ClaudeSettings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
  } catch {
    /* new settings file */
  }
  settings.hooks ??= {};

  const forward = scriptPath('forward.mjs');
  const autostart = scriptPath('autostart.mjs');

  // event -> command. SessionStart auto-opens the panel; the rest forward activity.
  const wiring: Array<[string, string]> = [
    ...FORWARD_EVENTS.map((e): [string, string] => [e, `node "${forward}" ${e}`]),
    ['SessionStart', `node "${autostart}"`],
  ];

  for (const [event, command] of wiring) {
    const groups = settings.hooks[event] ?? [];
    // Strip any prior sidequest command, then drop groups left empty.
    const cleaned = groups
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !h.command.includes(MARKER)) }))
      .filter((g) => g.hooks.length > 0);
    cleaned.push({ hooks: [{ type: 'command', command }] });
    settings.hooks[event] = cleaned;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settingsPath;
}
