type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to expired-session events. Returns an unsubscribe function. */
export function onUnauthenticated(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUnauthenticated(): void {
  for (const listener of listeners) listener();
}
