import { EventEmitter } from 'node:events';
import type { JobEvent, JobStatus } from '../types';

export interface JobState {
  id: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  skipped: number;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
  emitter: EventEmitter;
  abort: AbortController;
  history: JobEvent[];
}

const globalAny = globalThis as unknown as { __sriJobStore?: Map<string, JobState> };
if (!globalAny.__sriJobStore) globalAny.__sriJobStore = new Map<string, JobState>();
const map: Map<string, JobState> = globalAny.__sriJobStore;

export function createJobState(id: string): JobState {
  const state: JobState = {
    id, status: 'running', total: 0, done: 0, failed: 0, skipped: 0,
    startedAt: new Date(), emitter: new EventEmitter(),
    abort: new AbortController(), history: []
  };
  state.emitter.setMaxListeners(50);
  map.set(id, state);
  return state;
}

export function getJobState(id: string): JobState | undefined {
  return map.get(id);
}

export function emitJobEvent(state: JobState, ev: JobEvent) {
  state.history.push(ev);
  state.emitter.emit('event', ev);
  if (state.history.length > 5000) state.history.shift();
}
