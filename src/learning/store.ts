import fs from 'node:fs';
import path from 'node:path';
import { TOPICS_DIR, ensureDirs } from '../paths';
import type { TopicState } from './types';

export function slugify(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'topic'
  );
}

function topicPath(slug: string): string {
  return path.join(TOPICS_DIR, `${slug}.json`);
}

export function loadTopic(slug: string): TopicState | null {
  try {
    return JSON.parse(fs.readFileSync(topicPath(slug), 'utf8')) as TopicState;
  } catch {
    return null;
  }
}

export function saveTopic(topic: TopicState): void {
  ensureDirs();
  fs.writeFileSync(topicPath(topic.slug), JSON.stringify(topic, null, 2), 'utf8');
}

export function listTopics(): TopicState[] {
  ensureDirs();
  return fs
    .readdirSync(TOPICS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(TOPICS_DIR, f), 'utf8')) as TopicState;
      } catch {
        return null;
      }
    })
    .filter((t): t is TopicState => t !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
