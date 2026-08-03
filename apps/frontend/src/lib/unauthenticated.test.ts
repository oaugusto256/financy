import { describe, expect, it, vi } from 'vitest';
import { notifyUnauthenticated, onUnauthenticated } from './unauthenticated';

describe('the unauthenticated notifier', () => {
  it('calls a subscribed listener', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthenticated(listener);

    notifyUnauthenticated();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    onUnauthenticated(listener)();

    notifyUnauthenticated();

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls every subscribed listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = onUnauthenticated(first);
    const unsubscribeSecond = onUnauthenticated(second);

    notifyUnauthenticated();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('does not throw with no listeners registered', () => {
    // This happens on the very first request of a page load, before the
    // session provider has mounted its subscription.
    expect(() => notifyUnauthenticated()).not.toThrow();
  });
});
