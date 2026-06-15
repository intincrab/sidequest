import { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { AgentMonitor, AgentStatus } from '../core/state';
import type { LearningEngine } from '../learning/engine';
import type { LessonUpdate, LessonKind } from '../learning/types';
import { listTopics } from '../learning/store';

interface AppProps {
  monitor: AgentMonitor;
  engine: LearningEngine;
}

export function App({ monitor, engine }: AppProps) {
  const app = useApp();
  const [status, setStatus] = useState<AgentStatus>(monitor.current);
  const [topic, setTopic] = useState<string | null>(engine.currentTopic?.title ?? null);
  const [lesson, setLesson] = useState('');
  const [lessonNo, setLessonNo] = useState(engine.currentTopic?.lessonsDelivered ?? 0);
  const [generating, setGenerating] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(false);
  const [kind, setKind] = useState<LessonKind>('lesson');

  useEffect(() => {
    const onStatus = (s: AgentStatus) => setStatus(s);
    const onLesson = (u: LessonUpdate) => {
      setTopic(u.topic);
      setLesson(u.text);
      setLessonNo(u.lessonNo);
      setKind(u.kind);
      setGenerating(!u.done);
      if (u.done) setError(null);
    };
    const onTopic = () => {
      const t = engine.currentTopic;
      setTopic(t?.title ?? null);
      setLessonNo(t?.lessonsDelivered ?? 0);
      const lastAssistant = [...(t?.messages ?? [])].reverse().find((m) => m.role === 'assistant');
      setLesson(lastAssistant?.content ?? '');
    };
    const onError = (e: Error) => {
      setError(e.message);
      setGenerating(false);
    };

    monitor.on('status', onStatus);
    engine.on('lesson', onLesson);
    engine.on('topic', onTopic);
    engine.on('error', onError);
    return () => {
      monitor.off('status', onStatus);
      engine.off('lesson', onLesson);
      engine.off('topic', onTopic);
      engine.off('error', onError);
    };
  }, [monitor, engine]);

  function submit(value: string) {
    const v = value.trim();
    setInput('');
    if (!v) return;

    if (v === '/quit' || v === '/exit') {
      app.exit();
      return;
    }
    if (v === '/topics') {
      setShowTopics((s) => !s);
      return;
    }
    setShowTopics(false);
    if (v === '/next' || v === '/n') {
      void engine.advance();
      return;
    }
    if (v === '/deeper' || v === '/d') {
      void engine.deliver('deeper');
      return;
    }
    if (v === '/quiz' || v === '/q') {
      void engine.deliver('quiz');
      return;
    }
    if (v.startsWith('/why ')) {
      const why = v.slice('/why '.length).trim();
      if (why) engine.setMission(why);
      return;
    }
    if (v.startsWith('/topic ')) {
      const t = v.slice('/topic '.length).trim();
      if (t) {
        engine.startTopic(t);
        void engine.advance();
      }
      return;
    }
    if (!engine.currentTopic) {
      engine.startTopic(v);
      void engine.advance();
      return;
    }
    void engine.deliver({ question: v });
  }

  const topics = showTopics ? listTopics() : [];
  const turnLabel =
    kind === 'quiz'
      ? 'recall quiz'
      : kind === 'answer'
        ? 'q&a'
        : kind === 'deeper'
          ? `lesson ${lessonNo} · deeper`
          : `lesson ${lessonNo}`;

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          sidequest
        </Text>
        <Text>
          agent{' '}
          {status === 'busy' ? (
            <Text color="yellow">● busy — learn while you wait</Text>
          ) : (
            <Text color="green">○ idle — jump back to your agent</Text>
          )}
        </Text>
      </Box>

      <Box marginTop={1}>
        {topic ? (
          <Text color="magenta">
            📚 {topic} <Text dimColor>· {turnLabel}</Text>
          </Text>
        ) : (
          <Text dimColor>Type a topic to start (e.g. "the fall of the Roman Empire").</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column" minHeight={6}>
        {error ? <Text color="red">⚠ {error}</Text> : <Text>{lesson}</Text>}
        {generating && (
          <Text color="yellow">
            <Spinner type="dots" /> thinking…
          </Text>
        )}
      </Box>

      {showTopics && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>Recent topics</Text>
          {topics.length === 0 ? (
            <Text dimColor>none yet</Text>
          ) : (
            topics.slice(0, 8).map((t) => (
              <Text key={t.slug}>
                · {t.title} <Text dimColor>({t.lessonsDelivered} lessons)</Text>
              </Text>
            ))
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="cyan">› </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={submit}
          placeholder="topic, an answer, a question, or /next /quiz /deeper /why …"
        />
      </Box>
      <Box>
        <Text dimColor>/next · /quiz · /deeper · /why &lt;reason&gt; · /topic &lt;name&gt; · /topics · /quit</Text>
      </Box>
    </Box>
  );
}
