// Verifies the teaching-method upgrade against live GLM:
// mission grounding, lessons, and a spaced retrieval-practice quiz.
import { createProvider } from '../src/providers';
import { LearningEngine } from '../src/learning/engine';
import type { LessonUpdate } from '../src/learning/types';
import type { SidequestConfig } from '../src/config';

const cfg: SidequestConfig = {
  provider: 'glm',
  model: 'glm-4.5-flash',
  port: 4317,
  lessonStyle: 'concise, ~100 words, plain language',
  autoAdvanceOnBusy: true,
  autoLaunch: false,
};

function lastText(engine: LearningEngine): string {
  const msgs = engine.currentTopic?.messages ?? [];
  return [...msgs].reverse().find((m) => m.role === 'assistant')?.content ?? '';
}

async function main() {
  const engine = new LearningEngine(createProvider(cfg), cfg);
  const kinds: string[] = [];
  engine.on('lesson', (u: LessonUpdate) => {
    if (u.done) kinds.push(u.kind);
  });

  // Fresh topic with a mission (the "why").
  const topic = 'the basics of stock options';
  engine.startTopic(topic, 'I want to hedge the equity in my startup');

  await engine.advance(); // first lesson
  console.log(`\n[LESSON 1]\n${lastText(engine)}`);

  await engine.advance(); // lesson 2
  console.log(`\n[LESSON 2]\n${lastText(engine).slice(0, 200)}…`);

  await engine.deliver('quiz'); // spaced retrieval practice
  const quiz = lastText(engine);
  console.log(`\n[QUIZ]\n${quiz}`);

  // Simulate the learner answering — expect tight feedback.
  await engine.deliver({ question: 'A call option is the right to buy at a set price?' });
  console.log(`\n[FEEDBACK]\n${lastText(engine).slice(0, 220)}…`);

  const t = engine.currentTopic;
  const missionOk = t?.mission === 'I want to hedge the equity in my startup';
  const quizIsQuestion = quiz.includes('?');
  const flowOk = kinds.join(',') === 'lesson,lesson,quiz,answer';
  console.log(`\nmission stored: ${missionOk} | quiz asks a question: ${quizIsQuestion} | turn kinds: ${kinds.join(' → ')}`);
  console.log(missionOk && quizIsQuestion && flowOk ? 'TEACH-METHOD TEST PASSED ✓' : 'TEACH-METHOD TEST FAILED ✗');
  process.exit(missionOk && quizIsQuestion && flowOk ? 0 : 1);
}

main();
