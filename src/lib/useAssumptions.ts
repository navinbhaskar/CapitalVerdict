import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  ASSUMPTIONS_EVENT,
  DEFAULT_ASSUMPTIONS,
  STORAGE_KEY,
  browserStorage,
  loadAssumptions,
  saveAssumptions,
  type GlobalAssumptions,
} from './assumptions';

/**
 * Global assumptions for an island, kept in sync across islands on the page and across tabs.
 * Renders with defaults first (matching the static HTML), then switches to stored values.
 * `update` returns false when the browser would not store the values; they still apply in this page.
 */
export function useGlobalAssumptions(): {
  assumptions: GlobalAssumptions;
  update: (next: GlobalAssumptions) => boolean;
  reset: () => boolean;
} {
  const [assumptions, setAssumptions] = useState<GlobalAssumptions>(DEFAULT_ASSUMPTIONS);

  useEffect(() => {
    setAssumptions(loadAssumptions(browserStorage()));

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<GlobalAssumptions>).detail;
      if (detail) setAssumptions(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setAssumptions(loadAssumptions(browserStorage()));
      }
    };
    window.addEventListener(ASSUMPTIONS_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ASSUMPTIONS_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((next: GlobalAssumptions) => {
    const saved = saveAssumptions(browserStorage(), next);
    window.dispatchEvent(new CustomEvent(ASSUMPTIONS_EVENT, { detail: next }));
    return saved;
  }, []);

  const reset = useCallback(() => update({ ...DEFAULT_ASSUMPTIONS }), [update]);

  return { assumptions, update, reset };
}
