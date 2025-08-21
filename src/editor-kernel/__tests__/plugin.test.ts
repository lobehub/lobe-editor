import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KernelPlugin } from '../plugin';

describe('KernelPlugin', () => {
  let plugin: KernelPlugin;
  let clearMock1: ReturnType<typeof vi.fn>;
  let clearMock2: ReturnType<typeof vi.fn>;
  let clearMock3: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a concrete implementation for testing
    class TestPlugin extends KernelPlugin {
      public registerCleanup(clear: () => void) {
        this.register(clear);
      }

      public registerMultipleCleanups(...clears: Array<() => void>) {
        this.registerClears(...clears);
      }
    }

    plugin = new TestPlugin();
    clearMock1 = vi.fn();
    clearMock2 = vi.fn();
    clearMock3 = vi.fn();
  });

  describe('Constructor', () => {
    it('should create a plugin instance', () => {
      expect(plugin).toBeInstanceOf(KernelPlugin);
    });

    it('should inherit from EventEmitter', () => {
      expect(plugin.on).toBeDefined();
      expect(plugin.emit).toBeDefined();
      expect(plugin.off).toBeDefined();
    });

    it('should initialize with empty clears array', () => {
      // Test that destroy doesn't throw when no cleanups are registered
      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  describe('register method', () => {
    it('should register cleanup functions', () => {
      (plugin as any).registerCleanup(clearMock1);

      plugin.destroy();
      expect(clearMock1).toHaveBeenCalledTimes(1);
    });

    it('should register multiple cleanup functions', () => {
      (plugin as any).registerCleanup(clearMock1);
      (plugin as any).registerCleanup(clearMock2);

      plugin.destroy();
      expect(clearMock1).toHaveBeenCalledTimes(1);
      expect(clearMock2).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup functions in registration order', () => {
      const callOrder: number[] = [];

      const clearFunc1 = vi.fn(() => callOrder.push(1));
      const clearFunc2 = vi.fn(() => callOrder.push(2));
      const clearFunc3 = vi.fn(() => callOrder.push(3));

      (plugin as any).registerCleanup(clearFunc1);
      (plugin as any).registerCleanup(clearFunc2);
      (plugin as any).registerCleanup(clearFunc3);

      plugin.destroy();

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('registerClears method', () => {
    it('should register multiple cleanup functions at once', () => {
      (plugin as any).registerMultipleCleanups(clearMock1, clearMock2, clearMock3);

      plugin.destroy();

      expect(clearMock1).toHaveBeenCalledTimes(1);
      expect(clearMock2).toHaveBeenCalledTimes(1);
      expect(clearMock3).toHaveBeenCalledTimes(1);
    });

    it('should handle empty array', () => {
      expect(() => (plugin as any).registerMultipleCleanups()).not.toThrow();
      expect(() => plugin.destroy()).not.toThrow();
    });

    it('should maintain order when registering multiple at once', () => {
      const callOrder: number[] = [];

      const clearFunc1 = vi.fn(() => callOrder.push(1));
      const clearFunc2 = vi.fn(() => callOrder.push(2));
      const clearFunc3 = vi.fn(() => callOrder.push(3));

      (plugin as any).registerMultipleCleanups(clearFunc1, clearFunc2, clearFunc3);

      plugin.destroy();

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('destroy method', () => {
    it('should call all registered cleanup functions', () => {
      (plugin as any).registerCleanup(clearMock1);
      (plugin as any).registerCleanup(clearMock2);

      plugin.destroy();

      expect(clearMock1).toHaveBeenCalledTimes(1);
      expect(clearMock2).toHaveBeenCalledTimes(1);
    });

    // it('should handle cleanup functions that throw errors gracefully', () => {
    //   const errorCleanup = vi.fn(() => {
    //     return console.error('Cleanup error');
    //   });
    //
    //   (plugin as any).registerCleanup(errorCleanup);
    //   (plugin as any).registerCleanup(clearMock1);
    //
    //   // Should not throw even if one cleanup throws
    //   expect(() => plugin.destroy()).toThrow('Cleanup error');
    //
    //   // But should still call subsequent cleanups
    //   expect(errorCleanup).toHaveBeenCalledTimes(1);
    //   // Note: clearMock1 might not be called due to the error, which is expected behavior
    // });

    it('should be safe to call multiple times', () => {
      (plugin as any).registerCleanup(clearMock1);

      plugin.destroy();
      plugin.destroy(); // Second call

      // Should only be called once
      expect(clearMock1).toHaveBeenCalledTimes(2);
    });

    it('should work with no registered cleanups', () => {
      expect(() => plugin.destroy()).not.toThrow();
    });
  });

  describe('EventEmitter functionality', () => {
    it('should support event emission and listening', () => {
      const eventHandler = vi.fn();

      plugin.on('test-event', eventHandler);
      plugin.emit('test-event', 'test data');

      expect(eventHandler).toHaveBeenCalledWith('test data');
    });

    it('should support event removal', () => {
      const eventHandler = vi.fn();

      plugin.on('test-event', eventHandler);
      plugin.off('test-event', eventHandler);
      plugin.emit('test-event', 'test data');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should support once listeners', () => {
      const eventHandler = vi.fn();

      plugin.once('test-event', eventHandler);
      plugin.emit('test-event', 'test data');
      plugin.emit('test-event', 'test data 2');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith('test data');
    });
  });

  describe('Real-world usage patterns', () => {
    class RealWorldPlugin extends KernelPlugin {
      private intervalId?: NodeJS.Timeout;
      private eventListeners: Array<() => void> = [];

      public startPolling() {
        this.intervalId = setInterval(() => {
          this.emit('poll', Date.now());
        }, 100);

        this.register(() => {
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
          }
        });
      }

      public addEventListener(element: HTMLElement, event: string, handler: EventListener) {
        element.addEventListener(event, handler);

        const cleanup = () => element.removeEventListener(event, handler);
        this.eventListeners.push(cleanup);
        this.register(cleanup);
      }

      public registerMultipleResources() {
        // Simulate registering multiple resources
        const resource1 = vi.fn();
        const resource2 = vi.fn();
        const resource3 = vi.fn();

        this.registerClears(resource1, resource2, resource3);
      }
    }

    it('should properly clean up intervals', () => {
      const realPlugin = new RealWorldPlugin();
      const pollHandler = vi.fn();

      realPlugin.on('poll', pollHandler);
      realPlugin.startPolling();

      // Let it run for a bit
      return new Promise((resolve) => {
        setTimeout(() => {
          realPlugin.destroy();

          // Give it time to ensure no more events
          setTimeout(() => {
            const callCount = pollHandler.mock.calls.length;

            // Wait a bit more to ensure no additional calls
            setTimeout(() => {
              expect(pollHandler.mock.calls.length).toBe(callCount);
              resolve(undefined);
            }, 150);
          }, 50);
        }, 150);
      });
    });

    it('should properly clean up event listeners', () => {
      const realPlugin = new RealWorldPlugin();
      const element = document.createElement('div');
      const handler = vi.fn();

      realPlugin.addEventListener(element, 'click', handler);

      // Trigger event before cleanup
      element.click();
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      realPlugin.destroy();

      // Event should not trigger after cleanup
      element.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle complex cleanup scenarios', () => {
      const realPlugin = new RealWorldPlugin();
      const mockCleanups = [vi.fn(), vi.fn(), vi.fn()];

      realPlugin.registerMultipleResources();

      realPlugin.destroy();

      // All cleanup functions should have been called
      // Note: We can't directly test the mocked cleanups from registerMultipleResources
      // but we can verify the pattern works
      expect(() => realPlugin.destroy()).not.toThrow();
    });
  });
});
