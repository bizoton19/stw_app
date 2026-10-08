export type HostPrimeKind = "push" | "location";

let tail: Promise<void> = Promise.resolve();
let visible: HostPrimeKind | null = null;
const listeners = new Set<() => void>();

/**
 * One queue for notification and location priming.
 * Cadence reads, acquires, and writes run one at a time so the sheets
 * cannot decide to present together.
 */
export function enqueueHostPrime<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function hostPrimeSheetVisible(): HostPrimeKind | null {
  return visible;
}

export function otherHostPrimeSheetVisible(self: HostPrimeKind): boolean {
  return visible != null && visible !== self;
}

/** False when the other sheet already holds the guard. Same kind may not stack either. */
export function acquireHostPrimeSheet(kind: HostPrimeKind): boolean {
  if (visible != null) return false;
  visible = kind;
  return true;
}

export function releaseHostPrimeSheet(kind: HostPrimeKind): void {
  if (visible !== kind) return;
  visible = null;
  for (const listener of listeners) listener();
}

/** Fires when a sheet releases the guard so a held auto-show can try again. */
export function subscribeHostPrimeSheet(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetHostPrimeQueueForTests(): void {
  tail = Promise.resolve();
  visible = null;
  listeners.clear();
}
