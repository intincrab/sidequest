#!/usr/bin/env node
// Forwards a Claude Code hook event to the running sidequest TUI.
// Hard rule: this must NEVER block or break the agent — short timeout, always exit 0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const type = process.argv[2] || 'unknown';
const runtimePath = path.join(os.homedir(), '.sidequest', 'runtime.json');

function readPort() {
  try {
    const rt = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    return rt.port || 4317;
  } catch {
    return Number(process.env.SIDEQUEST_PORT) || 4317;
  }
}

let stdin = '';
let sent = false;

process.stdin.on('data', (c) => {
  stdin += c;
});
process.stdin.on('end', () => send());
// If stdin never arrives, send anyway.
setTimeout(() => send(), 150).unref();
// Absolute backstop so we can't hang the agent.
setTimeout(() => process.exit(0), 500).unref();

function send() {
  if (sent) return;
  sent = true;

  let payload = {};
  try {
    payload = stdin ? JSON.parse(stdin) : {};
  } catch {
    /* non-JSON stdin — forward the type alone */
  }
  payload.type = type;

  const data = JSON.stringify(payload);
  const req = http.request(
    {
      host: '127.0.0.1',
      port: readPort(),
      path: '/event',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      timeout: 300,
    },
    (res) => {
      res.resume();
      res.on('end', () => process.exit(0));
    },
  );
  req.on('error', () => process.exit(0));
  req.on('timeout', () => {
    req.destroy();
    process.exit(0);
  });
  req.write(data);
  req.end();
}
