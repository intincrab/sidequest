import type { ChatMessage } from '../providers/types';

export interface TopicState {
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lessonsDelivered: number;
  /** Why the learner cares about this topic — grounds every lesson (optional). */
  mission?: string;
  /** The tutor's own running context for this topic (seeded system + lesson turns). */
  messages: ChatMessage[];
}

/** What kind of turn the tutor just produced. */
export type LessonKind = 'lesson' | 'deeper' | 'quiz' | 'answer';

export interface LessonUpdate {
  topic: string;
  /** Accumulated text of the in-flight turn (streams as it grows). */
  text: string;
  done: boolean;
  lessonNo: number;
  kind: LessonKind;
}
