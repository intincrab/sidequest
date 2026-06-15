#!/usr/bin/env node
// Claude Code SessionStart hook: open the sidequest learning panel if it isn't already running.
// Never blocks the agent: short health check, detached launch, always exits 0.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sidequestDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.sidequest', 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

function readPort(cfg) {
  if (cfg.port) return cfg.port;
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.sidequest', 'runtime.json'), 'utf8')).port || 4317;
  } catch {
    return Number(process.env.SIDEQUEST_PORT) || 4317;
  }
}

const cfg = readConfig();
if (cfg.autoLaunch === false) process.exit(0);

const port = readPort(cfg);
let launched = false;

// If something answers /health, sidequest is already up — do nothing.
const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 300 }, (res) => {
  res.resume();
  process.exit(0);
});
req.on('error', () => launch());
req.on('timeout', () => {
  req.destroy();
  launch();
});

const RUN = ['powershell', '-NoExit', '-Command', 'npm start'];

function launch() {
  if (launched) return;
  launched = true;
  // Hooks run with a stripped PATH, so `wt.exe` often isn't resolvable by name.
  const local = process.env.LOCALAPPDATA;
  const exes = [local ? path.join(local, 'Microsoft', 'WindowsApps', 'wt.exe') : null, 'wt.exe'].filter(
    (c) => typeof c === 'string',
  );

  // If Claude Code is running inside Windows Terminal, dock sidequest as a side
  // pane in that same window. Otherwise open our own window.
  const args = process.env.WT_SESSION
    ? ['-w', '0', 'split-pane', '-V', '-s', '0.4', '-d', sidequestDir, ...RUN]
    : ['-d', sidequestDir, ...RUN];

  trySpawn(exes, args);
  setTimeout(() => process.exit(0), 900).unref();
}

function trySpawn(candidates, args) {
  if (candidates.length === 0) return fallback();
  const [exe, ...rest] = candidates;
  try {
    const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => trySpawn(rest, args));
    child.unref();
  } catch {
    trySpawn(rest, args);
  }
}

// No Windows Terminal at all? Open a plain console window so the panel still appears.
function fallback() {
  try {
    const child = spawn('cmd', ['/c', 'start', 'sidequest', 'powershell', '-NoExit', '-Command', 'npm start'], {
      cwd: sidequestDir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    /* give up silently — never break the agent */
  }
}
