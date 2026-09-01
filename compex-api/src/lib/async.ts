// Small utility for bounding any promise-based network call (SMTP, webhook,
// third-party API) so a slow or hung remote peer can never block an HTTP
// request indefinitely. The underlying operation is not cancelled — Node has
// no way to abort an arbitrary in-flight promise — it is left to settle on
// its own; the caller just stops waiting for it.

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    // Node would otherwise hold the process open until this timer fires even
    // if the rest of the app has nothing left to do (matters for tests/CLI).
    timer.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
