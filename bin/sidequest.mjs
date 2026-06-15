#!/usr/bin/env node
// Thin launcher so `sidequest` works after `npm link` / global install.
// Runs the TypeScript CLI through the tsx loader.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src', 'cli.ts');

// Run with cwd = install root so `--import tsx`, the tsconfig, and .env all resolve
// from OUR install no matter where the user invoked `sidequest`. The caller's real
// directory is passed through so commands like `pair` can still target it.
const result = spawnSync(process.execPath, ['--import', 'tsx', cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json'),
    SIDEQUEST_INVOCATION_DIR: process.cwd(),
  },
});

process.exit(result.status ?? 0);
