import http from 'node:http';
import fs from 'node:fs';
import { RUNTIME_PATH, ensureDirs } from '../paths';
import type { AgentMonitor, AgentEvent } from './state';

interface RawHookPayload {
  type?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool?: string;
  cwd?: string;
  source?: string;
}

/** Starts the localhost listener that agent hook scripts POST events to. */
export function startEventServer(port: number, monitor: AgentMonitor): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/event') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        try {
          const p = JSON.parse(body || '{}') as RawHookPayload;
          const ev: AgentEvent = {
            type: p.type ?? p.hook_event_name ?? 'unknown',
            tool: p.tool ?? p.tool_name,
            cwd: p.cwd,
            source: p.source ?? 'claude',
            at: Date.now(),
          };
          monitor.ingest(ev);
          res.writeHead(204).end();
        } catch {
          res.writeHead(400).end();
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, status: monitor.current }));
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, '127.0.0.1', () => {
    ensureDirs();
    fs.writeFileSync(
      RUNTIME_PATH,
      JSON.stringify({ port, pid: process.pid, startedAt: new Date().toISOString() }, null, 2),
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    // Another sidequest already owns the port — keep this TUI usable for manual
    // learning instead of crashing; it just won't receive live agent events.
    if (err.code !== 'EADDRINUSE') throw err;
  });

  server.on('close', () => {
    try {
      fs.unlinkSync(RUNTIME_PATH);
    } catch {
      /* already gone */
    }
  });

  return server;
}
