import { getJobState } from '@server/jobs/jobStore';
import type { JobEvent } from '@server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encode(ev: JobEvent): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getJobState(id);
  if (!state) return new Response('not found', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const ev of state.history) controller.enqueue(encoder.encode(encode(ev)));
      if (state.status !== 'running') { controller.close(); return; }
      const onEvent = (ev: JobEvent) => {
        try { controller.enqueue(encoder.encode(encode(ev))); } catch { /* stream cerrado */ }
        if (ev.type === 'done' || ev.type === 'cancelled') {
          state.emitter.off('event', onEvent);
          try { controller.close(); } catch { /* ya cerrado */ }
        }
      };
      state.emitter.on('event', onEvent);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
