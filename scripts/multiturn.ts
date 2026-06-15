// Verifies resume-from-disk, multi-turn continuity, /deeper, asking a question, and persistence.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createProvider } from '../src/providers';
import { LearningEngine } from '../src/learning/engine';
import type { SidequestConfig } from '../src/config';

const cfg: SidequestConfig = {
  provider: 'glm',
  model: 'glm-4.5-flash',
  port: 4317,
  lessonStyle: 'concise, ~90 words, plain language',
  autoAdvanceOnBusy: true,
};

function lastAssistant(engine: LearningEngine): string {
  const msgs = engine.currentTopic?.messages ?? [];
  return [...msgs].reverse().find((m) => m.role === 'assistant')?.content ?? '';
}

async function main() {
  const engine = new LearningEngine(createProvider(cfg), cfg);

  // Resume the topic the integration test created (proves "start learning from there").
  engine.startTopic('the fall of the Roman Empire');
  const startedAt = engine.currentTopic?.lessonsDelivered ?? 0;
  console.log(`resumed topic at lesson ${startedAt}`);

  await engine.advance();
  console.log(`\n[NEXT #${engine.currentTopic?.lessonsDelivered}] ${lastAssistant(engine).slice(0, 160)}…`);

  await engine.deliver('deeper');
  console.log(`\n[DEEPER #${engine.currentTopic?.lessonsDelivered}] ${lastAssistant(engine).slice(0, 160)}…`);

  await engine.deliver({ question: 'In one sentence: did Christianity cause the fall?' });
  console.log(`\n[ANSWER] ${lastAssistant(engine).slice(0, 220)}`);

  // Persistence check.
  const file = path.join(os.homedir(), '.sidequest', 'topics', 'the-fall-of-the-roman-empire.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const assistantTurns = saved.messages.filter((m: { role: string }) => m.role === 'assistant').length;

  console.log(`\npersisted: lessonsDelivered=${saved.lessonsDelivered}, assistantTurns=${assistantTurns}`);
  const ok =
    saved.lessonsDelivered > startedAt + 1 && assistantTurns === saved.lessonsDelivered && assistantTurns >= 3;
  console.log(ok ? 'MULTITURN PASSED ✓' : 'MULTITURN FAILED ✗');
  process.exit(ok ? 0 : 1);
}

main();
