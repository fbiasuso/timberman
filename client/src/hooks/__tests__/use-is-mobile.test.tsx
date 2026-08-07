import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useIsMobile } from '../use-is-mobile';

function mockMatchMedia(matches: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const mql = {
    matches,
    addEventListener: (_type: string, cb: (event: { matches: boolean }) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_type: string, cb: unknown) => {
      const index = listeners.indexOf(cb as (event: { matches: boolean }) => void);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  const dispatch = (next: boolean) => {
    mql.matches = next;
    listeners.forEach((cb) => cb({ matches: next }));
  };
  return { mql, dispatch };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('returns true when the viewport matches the mobile query', () => {
    const { mql } = mockMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false on desktop viewports', () => {
    const { mql } = mockMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('re-renders when the media query match changes', () => {
    const { mql, dispatch } = mockMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => dispatch(true));
    expect(result.current).toBe(true);

    act(() => dispatch(false));
    expect(result.current).toBe(false);
  });

  it('falls back to desktop when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
