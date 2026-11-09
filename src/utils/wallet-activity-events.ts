type Listener = () => void;

const listeners = new Set<Listener>();

/** Notify Activity (and any other subscribers) to refetch wallet ledger after a real settle. */
export function emitWalletActivityChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore listener errors so one bad subscriber cannot break others.
    }
  });
}

export function subscribeWalletActivityChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
