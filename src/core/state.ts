import { EventEmitter } from 'node:events';

export type AgentStatus = 'idle' | 'busy';

export interface AgentEvent {
  /** Normalized hook/event name, e.g. UserPromptSubmit, PreToolUse, Stop. */
  type: string;
  tool?: string;
  cwd?: string;
  source?: string;
  at: number;
}

const BUSY_EVENTS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification']);
const IDLE_EVENTS = new Set(['Stop', 'SubagentStop', 'SessionEnd']);

/**
 * Translates raw agent hook events into a debounced busy/idle status.
 * Emits 'event' (AgentEvent) and 'status' (AgentStatus).
 */
export class AgentMonitor extends EventEmitter {
  private status: AgentStatus = 'idle';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEvent: AgentEvent | null = null;
  /** Fallback: if activity goes quiet for this long, assume the agent is idle. */
  private readonly idleAfterMs = 8000;

  get current(): AgentStatus {
    return this.status;
  }

  get last(): AgentEvent | null {
    return this.lastEvent;
  }

  ingest(ev: AgentEvent): void {
    this.lastEvent = ev;
    this.emit('event', ev);

    if (IDLE_EVENTS.has(ev.type)) {
      this.clearIdleTimer();
      this.setStatus('idle');
      return;
    }
    if (BUSY_EVENTS.has(ev.type)) {
      this.setStatus('busy');
      this.armIdleTimer();
    }
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.setStatus('idle'), this.idleAfterMs);
    this.idleTimer.unref?.();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setStatus(next: AgentStatus): void {
    if (next === this.status) return;
    this.status = next;
    this.emit('status', next);
  }
}
