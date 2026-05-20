/**
 * 세션별 FIFO 큐. 동일 sessionId의 처리는 직렬화한다.
 */
export class SessionQueueManager {
  private readonly queues = new Map<string, Promise<unknown>>();

  enqueue<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(sessionId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.queues.set(
      sessionId,
      next.catch(() => undefined),
    );
    return next;
  }
}
