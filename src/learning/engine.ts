import { EventEmitter } from 'node:events';
import type { Provider } from '../providers/types';
import type { SidequestConfig } from '../config';
import type { TopicState, LessonUpdate } from './types';
import { loadTopic, saveTopic, slugify } from './store';
import { tutorSystemPrompt, FIRST_LESSON_PROMPT, NEXT_LESSON_PROMPT, DEEPER_PROMPT } from './prompts';

type DeliverKind = 'first' | 'next' | 'deeper' | { question: string };

/**
 * Owns the active topic and turns it into a stream of bite-sized lessons.
 * Emits:
 *   'topic'  (TopicState)    — active topic changed
 *   'lesson' (LessonUpdate)  — streaming + final lesson text
 *   'error'  (Error)
 */
export class LearningEngine extends EventEmitter {
  private provider: Provider;
  private cfg: SidequestConfig;
  private topic: TopicState | null = null;
  private generating = false;
  private abort: AbortController | null = null;

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
  startTopic(title: string): void {
    const slug = slugify(title);
    const existing = loadTopic(slug);
    if (existing) {
      this.topic = existing;
    } else {
      const now = new Date().toISOString();
      this.topic = {
        slug,
        title,
        createdAt: now,
        updatedAt: now,
        lessonsDelivered: 0,
        messages: [{ role: 'system', content: tutorSystemPrompt(title, this.cfg.lessonStyle) }],
      };
      saveTopic(this.topic);
    }
    this.emit('topic', this.topic);
  }

  /** Serve the first lesson if none yet, otherwise the next one. */
  advance(): Promise<void> {
    const topic = this.topic;
    if (!topic) return Promise.resolve();
    return this.deliver(topic.lessonsDelivered === 0 ? 'first' : 'next');
  }

  async deliver(kind: DeliverKind): Promise<void> {
    const topic = this.topic;
    if (!topic || this.generating) return;

    const prompt =
      typeof kind === 'object'
        ? kind.question
        : kind === 'first'
          ? FIRST_LESSON_PROMPT
          : kind === 'deeper'
            ? DEEPER_PROMPT
            : NEXT_LESSON_PROMPT;

    this.generating = true;
    this.abort = new AbortController();
    const lessonNo = topic.lessonsDelivered + 1;
    topic.messages.push({ role: 'user', content: prompt });

    let acc = '';
    try {
      const text = await this.provider.chat(topic.messages, {
        model: this.cfg.model,
        signal: this.abort.signal,
        onDelta: (d) => {
          acc += d;
          this.emit('lesson', { topic: topic.title, text: acc, done: false, lessonNo } satisfies LessonUpdate);
        },
      });
      topic.messages.push({ role: 'assistant', content: text });
      topic.lessonsDelivered = lessonNo;
      topic.updatedAt = new Date().toISOString();
      saveTopic(topic);
      this.emit('lesson', { topic: topic.title, text, done: true, lessonNo } satisfies LessonUpdate);
    } catch (err) {
      // Roll back the optimistic user turn so context stays clean.
      topic.messages.pop();
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.generating = false;
      this.abort = null;
    }
  }

  /** Cancel an in-flight lesson (e.g. user switched topics). */
  stop(): void {
    this.abort?.abort();
  }
}
