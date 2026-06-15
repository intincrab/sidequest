import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { render } from 'ink';
import { loadConfig } from './config';
import { createProvider } from './providers';
import { AgentMonitor } from './core/state';
import { startEventServer } from './core/server';
import { LearningEngine } from './learning/engine';
import { listTopics } from './learning/store';
import { installClaudeHooks } from './install/claude';
import { App } from './tui/App';
import { RUNTIME_PATH } from './paths';

/** Minimal .env loader (no dependency): only fills keys not already set. */
function loadDotEnv(): void {
  try {
    const txt = fs.readFileSync('.env', 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2] ?? '';
      if (key && !process.env[key]) {
        process.env[key] = val.replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    /* no .env file */
  }
}

function cmdInstall(sub: string | undefined): void {
  if (sub !== 'claude') {
    console.log('Usage: sidequest install claude [--global]');
    return;
  }
  const global = process.argv.includes('--global');
  const p = installClaudeHooks({ global });
  console.log(`✓ Installed sidequest hooks into ${p}`);
  console.log('  Run `claude` there (or anywhere with --global), and `sidequest` in another pane.');
}

function cmdDoctor(): void {
  const cfg = loadConfig();
  let runtime = 'not running';
  try {
    runtime = fs.readFileSync(RUNTIME_PATH, 'utf8').trim();
  } catch {
    /* not running */
  }
  console.log('sidequest doctor');
  console.log('  provider        :', cfg.provider);
  console.log('  port            :', cfg.port);
  console.log('  GLM_API_KEY      :', process.env.GLM_API_KEY ?? process.env.ZHIPU_API_KEY ? 'set' : 'missing');
  console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'set' : 'missing');
  console.log('  OPENAI_API_KEY   :', process.env.OPENAI_API_KEY ? 'set' : 'missing');
  console.log('  runtime         :', runtime);
  console.log('  topics          :', listTopics().map((t) => t.title).join(', ') || 'none');
}

/** Open Claude Code + sidequest side by side as two panes in one Windows Terminal window. */
function cmdPair(): void {
  const arg = process.argv[3];
  // The bin runs us with cwd=install-root, so the user's real dir comes via env.
  const invocationDir = process.env.SIDEQUEST_INVOCATION_DIR ?? process.cwd();
  const claudeDir = arg && !arg.startsWith('-') ? arg : invocationDir;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  // Hooks/this process may have a stripped PATH, so use the explicit wt alias path.
  const local = process.env.LOCALAPPDATA;
  const wt = local ? path.join(local, 'Microsoft', 'WindowsApps', 'wt.exe') : 'wt.exe';

  const args = [
    '-d', claudeDir, 'powershell', '-NoExit', '-Command', 'claude',
    ';',
    'split-pane', '-V', '-s', '0.4', '-d', root, 'powershell', '-NoExit', '-Command', 'npm start',
  ];

  const child = spawn(wt, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    console.error('Could not launch Windows Terminal (wt.exe).');
    console.error('Install it from the Microsoft Store, or run `claude` and `npm start` in two panes manually.');
    process.exit(1);
  });
  child.unref();
  console.log(`Opened Claude Code (${claudeDir}) + sidequest side by side in Windows Terminal.`);
}

function cmdRun(): void {
  if (!process.stdin.isTTY) {
    console.error('sidequest needs an interactive terminal (TTY) for its input box.');
    console.error('Run `sidequest` / `npm start` directly in your terminal — not piped or backgrounded.');
    process.exit(1);
  }

  const cfg = loadConfig();

  const provider = (() => {
    try {
      return createProvider(cfg);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  })();

  const monitor = new AgentMonitor();
  const engine = new LearningEngine(provider, cfg);
  const server = startEventServer(cfg.port, monitor);

  if (cfg.defaultTopic) {
    engine.startTopic(cfg.defaultTopic);
    void engine.advance(); // serve a lesson right away so there's something to read
  }

  monitor.on('status', (s) => {
    if (s === 'busy' && cfg.autoAdvanceOnBusy && engine.currentTopic && !engine.isGenerating) {
      void engine.advance();
    }
  });

  const { waitUntilExit } = render(createElement(App, { monitor, engine }));
  waitUntilExit().then(() => server.close());
}

function main(): void {
  loadDotEnv();
  const [cmd, sub] = process.argv.slice(2);

  switch (cmd) {
    case 'install':
      cmdInstall(sub);
      return;
    case 'doctor':
      cmdDoctor();
      return;
    case 'pair':
      cmdPair();
      return;
    default:
      cmdRun();
  }
}

main();
