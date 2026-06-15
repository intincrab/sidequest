// End-to-end test of the real forward.mjs hook script against a running listener.
// Verifies: runtime.json port discovery, stdin JSON parsing, HTTP POST, busy flip.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentMonitor, type AgentEvent } from '../src/core/state';
import { startEventServer } from '../src/core/server';

const PORT = 4317;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forward = path.join(root, 'hooks', 'forward.mjs');

async function main() {
  const monitor = new AgentMonitor();
  const server = startEventServer(PORT, monitor); // writes ~/.sidequest/runtime.json with PORT
  await new Promise((r) => setTimeout(r, 150));

  let received: AgentEvent | null = null;
  monitor.on('event', (e: AgentEvent) => {
    received = e;
  });

  await new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [forward, 'UserPromptSubmit'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.stdin.write(JSON.stringify({ tool_name: 'Edit', cwd: 'C:/tmp/project' }));
    child.stdin.end();
    child.on('exit', () => resolve());
  });

  await new Promise((r) => setTimeout(r, 100));
  server.close();

  const ev = received as AgentEvent | null;
  const ok = !!ev && ev.type === 'UserPromptSubmit' && ev.tool === 'Edit' && monitor.current === 'busy';
  console.log('received event:', JSON.stringify(ev));
  console.log('monitor status:', monitor.current);
  console.log(ok ? 'HOOK E2E PASSED ✓' : 'HOOK E2E FAILED ✗');
  process.exit(ok ? 0 : 1);
}

main();
