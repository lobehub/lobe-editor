import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sys detection utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects node environment and mac platform when running inside jsdom', async () => {
    const platformGetter = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    const sys = await import('../sys');

    expect(sys.nodeDetect()).toBe(true);
    expect(sys.browserDetect()).toBe(true);
    expect(sys.isNode).toBe(true);
    expect(sys.isBrowser).toBe(true);
    expect(sys.macOSDetect()).toBe(true);
    expect(sys.isMac).toBe(true);
    expect(sys.isOnServerSide).toBe(false);

    platformGetter.mockReturnValue('win32');
    expect(sys.macOSDetect()).toBe(false);

    platformGetter.mockRestore();
  });

  it('detects server-side execution when window is unavailable', async () => {
    vi.stubGlobal('window', undefined);

    const sys = await import('../sys');

    expect(sys.browserDetect()).toBe(false);
    expect(sys.isBrowser).toBe(false);
    expect(sys.isOnServerSide).toBe(true);
  });

  it('detects browser environment when window is provided', async () => {
    vi.stubGlobal('process', undefined);
    vi.stubGlobal('window', { document: {}, navigator: { platform: 'MacIntel' } } as unknown as Window);

    const sys = await import('../sys');

    expect(sys.nodeDetect()).toBe(false);
    expect(sys.browserDetect()).toBe(true);
    expect(sys.isNode).toBe(false);
    expect(sys.isBrowser).toBe(true);
    expect(sys.macOSDetect()).toBe(true);
    expect(sys.isMac).toBe(true);
  });

  it('returns false for macOS detection when platform is unknown', async () => {
    vi.stubGlobal('process', undefined);
    vi.stubGlobal('window', { document: {}, navigator: { platform: 'Other' } } as unknown as Window);

    const sys = await import('../sys');

    expect(sys.macOSDetect()).toBe(false);
  });
});
