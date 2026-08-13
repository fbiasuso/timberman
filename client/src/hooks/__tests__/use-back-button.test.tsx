import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useBackButton } from '../use-back-button';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  addListener: vi.fn(),
  exitApp: vi.fn(),
}));

const registeredHandlers: Array<(event: { canGoBack: boolean }) => void> = [];

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.addListener,
    exitApp: mocks.exitApp,
  },
}));

function renderAndPressBack(canGoBack = false) {
  renderHook(() => useBackButton());
  const [eventName, handler] = mocks.addListener.mock.calls.at(-1) ?? [];
  expect(eventName).toBe('backButton');
  handler({ canGoBack });
}

beforeEach(() => {
  mocks.isNativePlatform.mockReset().mockReturnValue(true);
  mocks.addListener.mockReset().mockImplementation((_event: string, handler: (e: { canGoBack: boolean }) => void) => {
    registeredHandlers.push(handler);
    return Promise.resolve({ remove: vi.fn() });
  });
  mocks.exitApp.mockReset().mockResolvedValue(undefined);
  registeredHandlers.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBackButton', () => {
  it('does not register a listener on non-native platforms', () => {
    mocks.isNativePlatform.mockReturnValue(false);
    renderHook(() => useBackButton());
    expect(mocks.addListener).not.toHaveBeenCalled();
  });

  it('registers the backButton listener on native platforms', () => {
    renderHook(() => useBackButton());
    expect(mocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('exits the app when the back button is pressed at the root route', () => {
    window.history.pushState({}, '', '/');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderAndPressBack();
    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('navigates history back on inner routes', () => {
    window.history.pushState({}, '', '/tickets');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderAndPressBack();
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(mocks.exitApp).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('removes the listener on unmount', async () => {
    const remove = vi.fn();
    mocks.addListener.mockResolvedValue({ remove });
    const { unmount } = renderHook(() => useBackButton());
    unmount();
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });
});
