/** How long a granted position fix may hang before we treat it as unavailable. */
export const HOST_LOCATION_FIX_TIMEOUT_MS = 10_000;

/**
 * Settle `work` once. A timeout rejects, and a later resolution is ignored,
 * so a stuck GPS fix cannot overwrite the unavailable state.
 */
export function withPositionDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("position-fix-timeout"));
    }, timeoutMs);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
