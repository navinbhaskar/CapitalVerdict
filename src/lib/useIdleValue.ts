import { useEffect, useState } from 'preact/hooks';

/**
 * Work the page can show a moment later (scenario ranges, "what would flip the answer" sweeps):
 * computed when the browser is idle, after the answer has painted. Typing again before it runs
 * cancels the pending run, so only the latest inputs are computed.
 */
export function useIdleValue<T>(compute: () => T, deps: readonly unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setValue(compute());
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 400 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const id = setTimeout(run, 30);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // The caller's deps decide when to recompute.
  }, deps);

  return value;
}
