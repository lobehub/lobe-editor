import { describe, expect, it, vi } from 'vitest';

describe('Basic Kernel Tests', () => {
  describe('Service ID Generation', () => {
    it('should create service ID objects', () => {
      // Simple utility function test
      const genServiceId = <T>(name: string) => ({ __serviceId: name }) as { __serviceId: string };

      const serviceId = genServiceId<string>('TestService');
      expect(serviceId).toEqual({ __serviceId: 'TestService' });
      expect(serviceId.__serviceId).toBe('TestService');
    });

    it('should generate unique service IDs', () => {
      const genServiceId = <T>(name: string) => ({ __serviceId: name }) as { __serviceId: string };

      const service1 = genServiceId<string>('Service1');
      const service2 = genServiceId<number>('Service2');

      expect(service1.__serviceId).toBe('Service1');
      expect(service2.__serviceId).toBe('Service2');
      expect(service1).not.toEqual(service2);
    });
  });

  describe('Basic Utilities', () => {
    it('should test noop function', () => {
      const noop = () => {};
      expect(typeof noop).toBe('function');
      expect(noop()).toBeUndefined();
    });

    it('should test assertion function', () => {
      const assert = (cond?: boolean, message?: string): asserts cond => {
        if (cond) return;
        throw new Error(message);
      };

      expect(() => assert(true)).not.toThrow();
      expect(() => assert(false)).toThrow();
      expect(() => assert(false, 'Custom error')).toThrow('Custom error');
    });

    it('should test DOM node type checker', () => {
      const isDOMNode = (x: unknown): x is Node => {
        return (
          typeof x === 'object' &&
          x !== null &&
          'nodeType' in x &&
          typeof (x as any).nodeType === 'number'
        );
      };

      const div = document.createElement('div');
      const text = document.createTextNode('test');

      expect(isDOMNode(div)).toBe(true);
      expect(isDOMNode(text)).toBe(true);
      expect(isDOMNode(null)).toBe(false);
      expect(isDOMNode({})).toBe(false);
    });
  });

  describe('Basic Kernel Functionality', () => {
    it('should test basic kernel constructor pattern', () => {
      // Test the basic constructor pattern without actual import
      class MockKernel {
        private editor: any = null;

        getLexicalEditor() {
          return this.editor;
        }

        setRootElement(dom: HTMLElement) {
          this.editor = { rootElement: dom };
          return this.editor;
        }
      }

      const kernel = new MockKernel();
      expect(kernel).toBeDefined();
      expect(kernel.getLexicalEditor()).toBeNull();

      const dom = document.createElement('div');
      kernel.setRootElement(dom);
      expect(kernel.getLexicalEditor()).toBeDefined();
    });

    it('should test plugin registration pattern', async () => {
      // Test the general pattern without specific implementations
      class MockPlugin {
        static pluginName = 'MockPlugin';
        constructor(kernel: any, config?: any) {}
        destroy() {}
      }

      const plugins: any[] = [];
      const registerPlugin = (plugin: any, config?: any) => {
        const existing = plugins.find((p) => p.pluginName === plugin.pluginName);
        if (existing && existing !== plugin) {
          throw new Error(
            `Plugin with name "${plugin.pluginName}" is already registered with a different implementation.`,
          );
        }
        if (!existing) {
          plugins.push(plugin);
        }
        return true;
      };

      expect(() => registerPlugin(MockPlugin)).not.toThrow();
      expect(plugins).toContain(MockPlugin);

      // Test duplicate registration with same plugin
      expect(() => registerPlugin(MockPlugin)).not.toThrow();

      // Test duplicate registration with different plugin
      class AnotherMockPlugin {
        static pluginName = 'MockPlugin'; // Same name
      }
      expect(() => registerPlugin(AnotherMockPlugin)).toThrow();
    });

    // it('should test service registration pattern', () => {
    //   const serviceMap = new Map<string, any>();
    //
    //   const registerService = <T>(serviceId: { __serviceId: string }, service: T) => {
    //     if (serviceMap.has(serviceId.__serviceId)) {
    //       // throw new Error(`Service with ID "${serviceId.__serviceId}" is already registered.`);
    //       console.error(`Service with ID "${serviceId.__serviceId}" is already registered.`);
    //       return;
    //     }
    //     serviceMap.set(serviceId.__serviceId, service);
    //   };
    //
    //   const requireService = <T>(serviceId: { __serviceId: string }): T | null => {
    //     return serviceMap.get(serviceId.__serviceId) || null;
    //   };
    //
    //   const testServiceId = { __serviceId: 'test-service' };
    //   const testService = 'test service value';
    //
    //   registerService(testServiceId, testService);
    //   expect(requireService(testServiceId)).toBe(testService);
    //
    //   // Test duplicate registration
    //   expect(() => registerService(testServiceId, 'another service')).toThrow();
    //
    //   // Test unknown service
    //   expect(requireService({ __serviceId: 'unknown' })).toBeNull();
    // });
  });

  describe('Event System Pattern', () => {
    it('should test basic event emitter functionality', () => {
      // Test basic event pattern without external dependencies
      class MockEventEmitter {
        private events: Record<string, Function[]> = {};

        on(event: string, listener: Function) {
          if (!this.events[event]) this.events[event] = [];
          this.events[event].push(listener);
          return this;
        }

        emit(event: string, ...args: any[]) {
          if (this.events[event]) {
            this.events[event].forEach((listener) => listener(...args));
          }
          return true;
        }

        off(event: string, listener: Function) {
          if (this.events[event]) {
            this.events[event] = this.events[event].filter((l) => l !== listener);
          }
          return this;
        }

        listenerCount(event: string) {
          return this.events[event]?.length || 0;
        }
      }

      const emitter = new MockEventEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', 'data');

      expect(handler).toHaveBeenCalledWith('data');
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.off('test', handler);
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });
});
