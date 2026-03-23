// @vitest-environment node
import type { EditorState, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  resetRandomKey,
} from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import { CommonPlugin } from '@/plugins/common';

import Editor from '../';

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

  it('should preserve imported ids and advance random key after keepId json import', () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin]);
    editor.initNodeEditor();

    editor.setDocument(
      'json',
      {
        keepId: true,
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  id: '5',
                  mode: 'normal',
                  style: '',
                  text: 'first paragraph',
                  type: 'text',
                  version: 1,
                },
              ],
              direction: null,
              format: '',
              id: '4',
              indent: 0,
              textFormat: 0,
              textStyle: '',
              type: 'paragraph',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          id: 'root',
          indent: 0,
          type: 'root',
          version: 1,
        },
      },
      { keepId: true },
    );

    const imported = editor.getDocument('json') as any;

    expect(imported.root.children[0].id).toBe('4');
    expect(imported.root.children[0].children[0].id).toBe('5');

    const lexicalEditor = editor.getLexicalEditor();

    if (!lexicalEditor) {
      throw new Error('Editor not initialized');
    }

    lexicalEditor.update(() => {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      const text = $createTextNode('second paragraph');

      paragraph.append(text);
      root.append(paragraph);
    });

    const updated = editor.getDocument('json') as any;
    const appendedParagraph = updated.root.children[1];

    expect(appendedParagraph.id).toBe('6');
    expect(appendedParagraph.children[0].id).toBe('7');
  });
});
