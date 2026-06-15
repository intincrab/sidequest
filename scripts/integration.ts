// Full-pipeline integration test against the real GLM API.
// Simulates the exact runtime path the TUI uses (minus Ink rendering):
//   hook event -> AgentMonitor busy -> auto-advance -> LearningEngine -> GLM -> streamed lesson.
import http from 'node:http';
import { createProvider } from '../src/providers';
import { AgentMonitor } from '../src/core/state';
import { startEventServer } from '../src/core/server';
import { LearningEngine } from '../src/learning/engine';
import type { LessonUpdate } from '../src/learning/types';
import type { SidequestConfig } from '../src/config';

const PORT = 4318;

function postEvent(type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ hook_event_name: type, tool_name: 'Bash' });
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
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const cfg: SidequestConfig = {
    provider: 'glm',
    model: 'glm-4.5-flash',
    port: PORT,
    lessonStyle: 'concise and vivid, around 120 words, plain language, one memorable concrete detail',
    autoAdvanceOnBusy: true,
  };

  const provider = createProvider(cfg);
  const monitor = new AgentMonitor();
  const engine = new LearningEngine(provider, cfg);
  const server = startEventServer(PORT, monitor);

  // Mirror cli.ts auto-advance wiring: agent busy => serve next lesson.
  monitor.on('status', (s: string) => {
    if (s === 'busy' && cfg.autoAdvanceOnBusy && engine.currentTopic && !engine.isGenerating) {
      void engine.advance();
    }
  });

  let streamed = false;
  const done = new Promise<LessonUpdate>((resolve) => {
    engine.on('lesson', (u: LessonUpdate) => {
      if (!u.done) {
        streamed = true;
        process.stdout.write('.');
      } else {
        resolve(u);
      }
    });
    engine.on('error', (e: Error) => {
      console.error('\nENGINE ERROR:', e.message);
      process.exit(1);
    });
  });

  setTimeout(() => {
    console.error('\nTIMEOUT waiting for lesson');
    process.exit(1);
  }, 60000).unref();

  engine.startTopic('the fall of the Roman Empire');
  console.log(`provider=${provider.name} model=${cfg.model}`);
  console.log('Simulating agent going busy (UserPromptSubmit)…');
  await postEvent('UserPromptSubmit');

  const final = await done;
  server.close();

  console.log(`\n\n--- LESSON #${final.lessonNo} (${final.text.length} chars, streamed=${streamed}) ---`);
  console.log(final.text);
  console.log('---');

  const ok = final.text.length > 60 && streamed;
  console.log(ok ? 'INTEGRATION PASSED ✓' : 'INTEGRATION FAILED ✗');
  process.exit(ok ? 0 : 1);
}

main();
