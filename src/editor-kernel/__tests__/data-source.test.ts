import { LexicalEditor } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataSource from '../data-source';

// Mock LexicalEditor
const mockEditor = {
  update: vi.fn(),
  read: vi.fn(),
  getEditorState: vi.fn(),
  setEditorState: vi.fn(),
} as unknown as LexicalEditor;

describe('DataSource', () => {
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = new DataSource('test-type');
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a DataSource with the correct type', () => {
      expect(dataSource.type).toBe('test-type');
    });

    it('should store the data type correctly', () => {
      const customDataSource = new DataSource('custom');
      expect(customDataSource.type).toBe('custom');
    });
  });

  describe('Type getter', () => {
    it('should return the correct data type', () => {
      expect(dataSource.type).toBe('test-type');
    });

    it('should be immutable', () => {
      const originalType = dataSource.type;
      // TypeScript should prevent this, but let's test runtime behavior
      expect(() => {
        // @ts-ignore
        dataSource.type = 'modified';
      }).toThrow('Cannot set property type');
      expect(dataSource.type).toBe(originalType);
    });
  });

  describe('Read method', () => {
    it('should be callable without throwing', () => {
      expect(() => dataSource.read(mockEditor, { test: 'data' })).not.toThrow();
    });

    it('should accept any data type', () => {
      expect(() => dataSource.read(mockEditor, 'string data')).not.toThrow();
      expect(() => dataSource.read(mockEditor, { object: 'data' })).not.toThrow();
      expect(() => dataSource.read(mockEditor, [1, 2, 3])).not.toThrow();
      expect(() => dataSource.read(mockEditor, null)).not.toThrow();
      expect(() => dataSource.read(mockEditor, undefined)).not.toThrow();
    });

    it('should be a no-op in base implementation', () => {
      // Base implementation should do nothing
      dataSource.read(mockEditor, { test: 'data' });
      expect(mockEditor.update).not.toHaveBeenCalled();
      expect(mockEditor.setEditorState).not.toHaveBeenCalled();
    });
  });

  describe('Write method', () => {
    it('should return null by default', () => {
      const result = dataSource.write(mockEditor);
      expect(result).toBeNull();
    });

    it('should be callable without throwing', () => {
      expect(() => dataSource.write(mockEditor)).not.toThrow();
    });

    it('should be a no-op in base implementation', () => {
      dataSource.write(mockEditor);
      expect(mockEditor.read).not.toHaveBeenCalled();
      expect(mockEditor.getEditorState).not.toHaveBeenCalled();
    });
  });

  describe('Inheritance', () => {
    class CustomDataSource extends DataSource {
      constructor() {
        super('custom');
      }

      read(editor: LexicalEditor, data: any) {
        // Custom implementation
        editor.update(() => {
          // Mock implementation
        });
      }

      write(editor: LexicalEditor): any {
        return { type: this.type, content: 'custom data' };
      }
    }

    it('should allow inheritance and method overriding', () => {
      const customSource = new CustomDataSource();

      expect(customSource.type).toBe('custom');
      expect(customSource).toBeInstanceOf(DataSource);
    });

    it('should call overridden read method', () => {
      const customSource = new CustomDataSource();

      customSource.read(mockEditor, { test: 'data' });
      expect(mockEditor.update).toHaveBeenCalled();
    });

    it('should call overridden write method', () => {
      const customSource = new CustomDataSource();

      const result = customSource.write(mockEditor);
      expect(result).toEqual({ type: 'custom', content: 'custom data' });
    });
  });

  describe('Multiple DataSource instances', () => {
    it('should create independent instances', () => {
      const source1 = new DataSource('type1');
      const source2 = new DataSource('type2');

      expect(source1.type).toBe('type1');
      expect(source2.type).toBe('type2');
      expect(source1).not.toBe(source2);
    });

    it('should maintain separate state', () => {
      class StatefulDataSource extends DataSource {
        private state: any = null;

        setState(state: any) {
          this.state = state;
        }

        getState() {
          return this.state;
        }
      }

      const source1 = new StatefulDataSource('state1');
      const source2 = new StatefulDataSource('state2');

      source1.setState({ value: 'first' });
      source2.setState({ value: 'second' });

      expect(source1.getState()).toEqual({ value: 'first' });
      expect(source2.getState()).toEqual({ value: 'second' });
    });
  });
});
