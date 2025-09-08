import { DecoratorNode, LexicalEditor } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Kernel } from '../kernel';

describe('Decorator Registration Tests', () => {
  let kernel: Kernel;
  let mockDecorator: (node: DecoratorNode<any>, editor: LexicalEditor) => any;

  beforeEach(() => {
    kernel = new Kernel();
    mockDecorator = vi.fn().mockReturnValue(null);
  });

  describe('registerDecorator', () => {
    it('should register a decorator successfully', () => {
      const result = kernel.registerDecorator('test-decorator', mockDecorator);

      expect(result).toBe(kernel);
      expect(kernel.getDecorator('test-decorator')).toBe(mockDecorator);
      expect(kernel.getRegisteredDecorators()).toContain('test-decorator');
    });

    it('should prevent duplicate registration in production mode', () => {
      kernel.setHotReloadMode(false);
      kernel.registerDecorator('test-decorator', mockDecorator);

      expect(() => {
        kernel.registerDecorator('test-decorator', vi.fn());
      }).toThrow('Decorator with name "test-decorator" is already registered.');
    });

    it('should allow duplicate registration with same function', () => {
      kernel.setHotReloadMode(false);
      kernel.registerDecorator('test-decorator', mockDecorator);

      // Should not throw when registering the same function
      expect(() => {
        kernel.registerDecorator('test-decorator', mockDecorator);
      }).not.toThrow();
    });

    it('should allow override in hot reload mode', () => {
      kernel.setHotReloadMode(true);
      const newDecorator = vi.fn().mockReturnValue(null);

      kernel.registerDecorator('test-decorator', mockDecorator);
      kernel.registerDecorator('test-decorator', newDecorator);

      expect(kernel.getDecorator('test-decorator')).toBe(newDecorator);
    });
  });

  describe('unregisterDecorator', () => {
    it('should unregister a decorator successfully', () => {
      kernel.registerDecorator('test-decorator', mockDecorator);

      const result = kernel.unregisterDecorator('test-decorator');

      expect(result).toBe(true);
      expect(kernel.getDecorator('test-decorator')).toBeUndefined();
      expect(kernel.getRegisteredDecorators()).not.toContain('test-decorator');
    });

    it('should return false when unregistering non-existent decorator', () => {
      const result = kernel.unregisterDecorator('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getRegisteredDecorators', () => {
    it('should return all registered decorator names', () => {
      kernel.registerDecorator('decorator-1', mockDecorator);
      kernel.registerDecorator('decorator-2', mockDecorator);

      const decorators = kernel.getRegisteredDecorators();

      expect(decorators).toHaveLength(2);
      expect(decorators).toContain('decorator-1');
      expect(decorators).toContain('decorator-2');
    });

    it('should return empty array when no decorators registered', () => {
      const decorators = kernel.getRegisteredDecorators();

      expect(decorators).toHaveLength(0);
    });
  });

  describe('destroy', () => {
    it('should clear all decorators on destroy', () => {
      kernel.registerDecorator('decorator-1', mockDecorator);
      kernel.registerDecorator('decorator-2', mockDecorator);

      kernel.destroy();

      expect(kernel.getRegisteredDecorators()).toHaveLength(0);
      expect(kernel.getDecorator('decorator-1')).toBeUndefined();
      expect(kernel.getDecorator('decorator-2')).toBeUndefined();
    });
  });
});
