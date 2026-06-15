// Renders the real Ink <App> with ink-testing-library (no TTY needed) and drives it via events.
import { createElement } from 'react';
import { render } from 'ink-testing-library';
import { AgentMonitor } from '../src/core/state';
import { LearningEngine } from '../src/learning/engine';
import { App } from '../src/tui/App';
import type { SidequestConfig } from '../src/config';
import type { Provider } from '../src/providers/types';

const cfg: SidequestConfig = {
  provider: 'glm',
  port: 4317,
  lessonStyle: 'concise',
  autoAdvanceOnBusy: true,
};

// Stub provider — this test drives the UI via emitted events, never hits the network.
const stubProvider: Provider = { name: 'stub', defaultModel: 'stub', chat: async () => '' };

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const monitor = new AgentMonitor();
  const engine = new LearningEngine(stubProvider, cfg);

  const { lastFrame } = render(createElement(App, { monitor, engine }));
  await tick();
  const f0 = lastFrame() ?? '';
  console.log('--- initial frame ---\n' + f0);

  // Simulate: agent goes busy, then a lesson streams in and finalizes.
  monitor.emit('status', 'busy');
  engine.emit('lesson', { topic: 'World War II', text: 'WWII began in 1939…', done: false, lessonNo: 1 });
  await tick();
  engine.emit('lesson', {
    topic: 'World War II',
    text: 'WWII began in 1939 when Germany invaded Poland, dragging the world into six years of conflict.',
    done: true,
    lessonNo: 1,
  });
  await tick();
  const f1 = lastFrame() ?? '';
  console.log('\n--- after busy + lesson ---\n' + f1);

  // Simulate the agent finishing.
  monitor.emit('status', 'idle');
  await tick();
  const f2 = lastFrame() ?? '';
  console.log('\n--- after agent idle ---\n' + f2);

  const ok =
    f0.includes('sidequest') &&
    f0.toLowerCase().includes('type a topic') &&
    f1.includes('busy') &&
    f1.includes('World War II') &&
    f1.includes('WWII began in 1939 when Germany') &&
    f2.toLowerCase().includes('jump back');

  console.log('\n' + (ok ? 'TUI RENDER PASSED ✓' : 'TUI RENDER FAILED ✗'));
  process.exit(ok ? 0 : 1);
}

main();
