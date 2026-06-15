// Headless smoke test for the core (no TTY, no API key needed).
// Verifies: event server boots, hook events flip busy/idle, auto-advance fires.
import http from 'node:http';
import { AgentMonitor } from '../src/core/state';
import { startEventServer } from '../src/core/server';

const PORT = 4399;

function post(type: string): Promise<void> {
  return new Promise((resolve) => {
    const data = JSON.stringify({ hook_event_name: type, tool_name: 'Edit' });
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve());
      },
    );
    req.write(data);
    req.end();
  });
}

async function main() {
  const monitor = new AgentMonitor();
  const transitions: string[] = [];
  let autoAdvances = 0;

  monitor.on('status', (s: string) => {
    transitions.push(s);
    // Simulate the cli.ts auto-advance wiring.
    if (s === 'busy') autoAdvances++;
  });

  const server = startEventServer(PORT, monitor);
  await new Promise((r) => setTimeout(r, 100));

  console.log('start status:', monitor.current);
  await post('UserPromptSubmit');
  console.log('after UserPromptSubmit:', monitor.current);
  await post('PreToolUse');
  await post('PostToolUse');
  console.log('after tool events:', monitor.current);
  await post('Stop');
  console.log('after Stop:', monitor.current);

  server.close();

  const ok =
    transitions.join(',') === 'busy,idle' && autoAdvances === 1 && monitor.current === 'idle';
  console.log('transitions:', transitions.join(' -> '));
  console.log(ok ? 'SMOKE TEST PASSED ✓' : 'SMOKE TEST FAILED ✗');
  process.exit(ok ? 0 : 1);
}

main();
