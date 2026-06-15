import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const HOME = os.homedir();
export const ROOT_DIR = path.join(HOME, '.sidequest');
export const TOPICS_DIR = path.join(ROOT_DIR, 'topics');
export const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
/** Written by the running TUI so hook scripts can find its port. */
export const RUNTIME_PATH = path.join(ROOT_DIR, 'runtime.json');

export function ensureDirs(): void {
  fs.mkdirSync(TOPICS_DIR, { recursive: true });
}
