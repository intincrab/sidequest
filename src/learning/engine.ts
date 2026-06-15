import { EventEmitter } from 'node:events';
import type { Provider } from '../providers/types';
import type { SidequestConfig } from '../config';
import type { TopicState, LessonUpdate, LessonKind } from './types';
import { loadTopic, saveTopic, slugify } from './store';
import { tutorSystemPrompt, FIRST_LESSON_PROMPT, NEXT_LESSON_PROMPT, DEEPER_PROMPT, QUIZ_PROMPT } from './prompts';

type DeliverKind = 'first' | 'next' | 'deeper' | 'quiz' | { question: string };

/** Interleave a retrieval-practice quiz after this many consecutive lessons. */
const LESSONS_PER_QUIZ = 3;

/**
 * Owns the active topic and turns it into a stream of bite-sized lessons and
 * spaced retrieval-practice quizzes.
 * Emits:
 *   'topic'  (TopicState)    — active topic changed
 *   'lesson' (LessonUpdate)  — streaming + final turn text
 *   'error'  (Error)
 */
export class LearningEngine extends EventEmitter {
  private provider: Provider;
  private cfg: SidequestConfig;
  private topic: TopicState | null = null;
  private generating = false;
  private abort: AbortController | null = null;
  private lessonsSinceQuiz = 0;

  constructor(provider: Provider, cfg: SidequestConfig) {
    super();
    this.provider = provider;
    this.cfg = cfg;
  }

  get currentTopic(): TopicState | null {
    return this.topic;
  }

  get isGenerating(): boolean {
    return this.generating;
  }

  /** Start a fresh topic or resume an existing one from disk. */
  startTopic(title: string, mission?: string): void {
    const slug = slugify(title);
    const existing = loadTopic(slug);
    if (existing) {
      this.topic = existing;
    } else {
      const now = new Date().toISOString();
      const why = mission?.trim() || undefined;
      this.topic = {
        slug,
        title,
        createdAt: now,
        updatedAt: now,
        lessonsDelivered: 0,
        mission: why,
        messages: [{ role: 'system', content: tutorSystemPrompt(title, this.cfg.lessonStyle, why) }],
      };
      saveTopic(this.topic);
    }
    this.lessonsSinceQuiz = 0;
    this.emit('topic', this.topic);
  }

  /** Record why the learner cares about this topic; re-grounds future lessons. */
  setMission(why: string): void {
    const topic = this.topic;
    if (!topic) return;
    topic.mission = why.trim();
    if (topic.messages[0]?.role === 'system') {
      topic.messages[0] = {
        role: 'system',
        content: tutorSystemPrompt(topic.title, this.cfg.lessonStyle, topic.mission),
      };
    }
    topic.updatedAt = new Date().toISOString();
    saveTopic(topic);
    this.emit('topic', topic);
  }

  /** First lesson, next lesson, or — every few lessons — a spaced recall quiz. */
  advance(): Promise<void> {
    const topic = this.topic;
    if (!topic) return Promise.resolve();
    if (topic.lessonsDelivered === 0) return this.deliver('first');
    if (this.lessonsSinceQuiz >= LESSONS_PER_QUIZ) return this.deliver('quiz');
    return this.deliver('next');
  }

  async deliver(kind: DeliverKind): Promise<void> {
    const topic = this.topic;
    if (!topic || this.generating) return;

    const isQuestion = typeof kind === 'object';
    const lessonKind: LessonKind = isQuestion
      ? 'answer'
      : kind === 'quiz'
        ? 'quiz'
        : kind === 'deeper'
          ? 'deeper'
          : 'lesson';
    // Only teaching turns advance the lesson counter / spacing clock.
    const counts = lessonKind === 'lesson' || lessonKind === 'deeper';

    const prompt = isQuestion
      ? kind.question
      : kind === 'first'
        ? FIRST_LESSON_PROMPT
        : kind === 'deeper'
          ? DEEPER_PROMPT
          : kind === 'quiz'
            ? QUIZ_PROMPT
            : NEXT_LESSON_PROMPT;

    this.generating = true;
    this.abort = new AbortController();
    const lessonNo = counts ? topic.lessonsDelivered + 1 : topic.lessonsDelivered;
    topic.messages.push({ role: 'user', content: prompt });

    let acc = '';
    try {
      const text = await this.provider.chat(topic.messages, {
        model: this.cfg.model,
        signal: this.abort.signal,
        onDelta: (d) => {
          acc += d;
          this.emit('lesson', {
            topic: topic.title,
            text: acc,
            done: false,
            lessonNo,
            kind: lessonKind,
          } satisfies LessonUpdate);
        },
      });
      topic.messages.push({ role: 'assistant', content: text });
      if (counts) {
        topic.lessonsDelivered = lessonNo;
        this.lessonsSinceQuiz += 1;
      }
      if (lessonKind === 'quiz') this.lessonsSinceQuiz = 0;
      topic.updatedAt = new Date().toISOString();
      saveTopic(topic);
      this.emit('lesson', { topic: topic.title, text, done: true, lessonNo, kind: lessonKind } satisfies LessonUpdate);
    } catch (err) {
      // Roll back the optimistic user turn so context stays clean.
      topic.messages.pop();
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.generating = false;
      this.abort = null;
    }
  }

  /** Cancel an in-flight turn (e.g. user switched topics). */
  stop(): void {
    this.abort?.abort();
  }
}
