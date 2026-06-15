import type { ChatMessage } from '../providers/types';

export interface TopicState {
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lessonsDelivered: number;
  /** The tutor's own running context for this topic (seeded system + lesson turns). */
  messages: ChatMessage[];
}

export interface LessonUpdate {
  topic: string;
  /** Accumulated text of the in-flight lesson (streams as it grows). */
  text: string;
  done: boolean;
  lessonNo: number;
}
