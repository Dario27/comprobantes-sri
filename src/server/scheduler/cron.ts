import cron, { type ScheduledTask } from 'node-cron';
import { childLogger } from '../logging';
import { runTick } from './engine';

const log = childLogger('scheduler:cron');

const globalAny = globalThis as unknown as {
  __sriScheduler?: { task: ScheduledTask; expression: string; running: boolean };
};

export function startScheduler(): void {
  const expression = process.env.SCHEDULER_CRON ?? '0 3 * * *';

  if (globalAny.__sriScheduler) {
    if (globalAny.__sriScheduler.expression === expression) {
      log.info({ expression }, 'scheduler_already_running');
      return;
    }
    globalAny.__sriScheduler.task.stop();
  }

  if (!cron.validate(expression)) {
    log.error({ expression }, 'scheduler_invalid_cron_expression');
    return;
  }

  const task = cron.schedule(expression, async () => {
    if (globalAny.__sriScheduler?.running) {
      log.warn('scheduler_tick_skipped_overlap');
      return;
    }
    if (globalAny.__sriScheduler) globalAny.__sriScheduler.running = true;
    try {
      await runTick();
    } catch (err) {
      log.error({ err: (err as Error).message }, 'scheduler_tick_error');
    } finally {
      if (globalAny.__sriScheduler) globalAny.__sriScheduler.running = false;
    }
  });

  globalAny.__sriScheduler = { task, expression, running: false };
  log.info({ expression }, 'scheduler_started');
}

export function stopScheduler(): void {
  if (globalAny.__sriScheduler) {
    globalAny.__sriScheduler.task.stop();
    globalAny.__sriScheduler = undefined;
    log.info('scheduler_stopped');
  }
}
