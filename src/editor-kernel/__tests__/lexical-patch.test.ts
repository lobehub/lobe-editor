// @vitest-environment node
import type { EditorState, LexicalNode } from 'lexical';
import { createEditor, resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

describe('lexical patch regressions', () => {
  beforeEach(() => {
    resetRandomKey();
  });

  it('should pass editorState to parseEditorState update callback', () => {
    let callbackState: (EditorState & { _nodeMap: Map<string, LexicalNode> }) | undefined;

    const parsedState = createEditor().parseEditorState(
      {
        root: {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
      (state) => {
        callbackState = state;
      },
    );

    expect(callbackState).toBe(parsedState);
    expect(callbackState).toBeDefined();
    expect(callbackState!._nodeMap.get('root')).toBeDefined();
  });
});
