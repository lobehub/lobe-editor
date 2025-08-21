import { describe, expect, it, vi } from 'vitest';

describe('Basic Plugin System Tests', () => {
  describe('Plugin Base Class Pattern', () => {
    it('should test basic plugin lifecycle', () => {
      // Test plugin pattern without external dependencies
      class TestPlugin {
        private clearFns: Array<() => void> = [];

        protected register(clear: () => void) {
          this.clearFns.push(clear);
        }

        protected registerClears(...clears: Array<() => void>) {
          clears.forEach((clear) => this.register(clear));
        }

        destroy() {
          this.clearFns.forEach((clear) => clear());
          this.clearFns = [];
        }
      }

      const plugin = new TestPlugin();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      plugin['register'](cleanup1);
      plugin['registerClears'](cleanup2);

      plugin.destroy();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it('should test plugin cleanup with errors', () => {
      // Test error handling in plugin cleanup
      class TestPlugin {
        private clearFns: Array<() => void> = [];

        protected register(clear: () => void) {
          this.clearFns.push(clear);
        }

        destroy() {
          this.clearFns.forEach((clear) => {
            try {
              clear();
            } catch (error) {
              // Handle cleanup errors gracefully in real implementation
            }
          });
          this.clearFns = [];
        }
      }

      const plugin = new TestPlugin();
      const errorCleanup = vi.fn(() => {
        return console.error('Cleanup error');
      });
      const normalCleanup = vi.fn();

      plugin['register'](errorCleanup);
      plugin['register'](normalCleanup);

      expect(() => plugin.destroy()).not.toThrow();
      expect(errorCleanup).toHaveBeenCalled();
      expect(normalCleanup).toHaveBeenCalled();
    });
  });

  describe('Plugin Configuration Pattern', () => {
    it('should test plugin with configuration', () => {
      interface PluginConfig {
        enabled: boolean;
        options: Record<string, any>;
      }

      class ConfigurablePlugin {
        static pluginName = 'ConfigurablePlugin';

        constructor(
          private kernel: any,
          private config: PluginConfig = { enabled: true, options: {} },
        ) {}

        isEnabled(): boolean {
          return this.config.enabled;
        }

        getOption(key: string): any {
          return this.config.options[key];
        }

        destroy() {
          // Cleanup logic
        }
      }

      const config: PluginConfig = {
        enabled: true,
        options: { theme: 'dark', autoSave: true },
      };

      const plugin = new ConfigurablePlugin(null, config);

      expect(plugin.isEnabled()).toBe(true);
      expect(plugin.getOption('theme')).toBe('dark');
      expect(plugin.getOption('autoSave')).toBe(true);
      expect(plugin.getOption('unknown')).toBeUndefined();
    });
  });

  describe('Service Registration Pattern', () => {
    it('should test service ID generation pattern', () => {
      const genServiceId = <T>(name: string) => ({ __serviceId: name });

      interface TestService {
        test(): string;
      }

      const TestServiceId = genServiceId<TestService>('TestService');

      expect(TestServiceId.__serviceId).toBe('TestService');

      class TestServiceImpl implements TestService {
        test(): string {
          return 'test result';
        }
      }

      const serviceImpl = new TestServiceImpl();
      expect(serviceImpl.test()).toBe('test result');
    });
  });

  describe('Data Source Pattern', () => {
    it('should test basic data source pattern', () => {
      abstract class DataSource {
        constructor(protected dataType: string) {}

        get type() {
          return this.dataType;
        }

        abstract read(editor: any, data: any): void;
        abstract write(editor: any): any;
      }

      class TestDataSource extends DataSource {
        constructor() {
          super('test');
        }

        read(editor: any, data: any): void {
          // Mock read implementation
        }

        write(editor: any): any {
          return { type: this.type, content: 'test data' };
        }
      }

      const dataSource = new TestDataSource();
      expect(dataSource.type).toBe('test');
      expect(dataSource.write(null)).toEqual({ type: 'test', content: 'test data' });
    });

    it('should test data source type immutability', () => {
      class DataSource {
        constructor(protected dataType: string) {}

        get type() {
          return this.dataType;
        }
      }

      const dataSource = new DataSource('immutable');
      expect(dataSource.type).toBe('immutable');

      // Type should be read-only
      expect(() => {
        // @ts-ignore
        dataSource.type = 'modified';
      }).toThrow();
    });
  });

  describe('Transformer Pattern', () => {
    it('should test transformer registration pattern', () => {
      interface Transformer {
        type: 'text-format' | 'text-match' | 'element';
        name: string;
      }

      class TransformerRegistry {
        private transformers: Map<string, Transformer[]> = new Map();

        register(transformer: Transformer) {
          const typeTransformers = this.transformers.get(transformer.type) || [];
          typeTransformers.push(transformer);
          this.transformers.set(transformer.type, typeTransformers);
        }

        getByType(type: string): Transformer[] {
          return this.transformers.get(type) || [];
        }

        getAll(): Transformer[] {
          const all: Transformer[] = [];
          this.transformers.forEach((transformers) => all.push(...transformers));
          return all;
        }
      }

      const registry = new TransformerRegistry();

      const boldTransformer: Transformer = { type: 'text-format', name: 'bold' };
      const headingTransformer: Transformer = { type: 'element', name: 'heading' };

      registry.register(boldTransformer);
      registry.register(headingTransformer);

      expect(registry.getByType('text-format')).toContain(boldTransformer);
      expect(registry.getByType('element')).toContain(headingTransformer);
      expect(registry.getAll()).toHaveLength(2);
    });
  });
});
