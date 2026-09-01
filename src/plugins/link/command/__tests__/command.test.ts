import { $getRoot, $isElementNode } from 'lexical';
import type { LexicalNode } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LinkPlugin } from '@/plugins/link';

import { $isLinkNode } from '../../node/LinkNode';
import { UNLINK_LINK_COMMAND } from '../index';

const linkDocument = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Visit ',
            type: 'text',
            version: 1,
            id: 'text-before',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Lobe Editor',
                type: 'text',
                version: 1,
                id: 'link-text',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            rel: null,
            target: null,
            title: null,
            type: 'link',
            url: 'https://editor.lobehub.com',
            version: 1,
            id: 'link-node',
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: ' today',
            type: 'text',
            version: 1,
            id: 'text-after',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
        id: 'paragraph',
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
    id: 'root',
  },
};

function createLinkEditor() {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin, LinkPlugin]);
  editor.initNodeEditor();
  editor.setDocument('json', linkDocument, { keepId: true });
  return editor;
}

function getFirstLinkKey(editor: ReturnType<typeof createLinkEditor>) {
  let key = '';
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const visit = (node: LexicalNode) => {
        if ($isLinkNode(node)) {
          key = node.getKey();
          return;
        }
        if ($isElementNode(node)) {
          for (const child of node.getChildren()) {
            if (key) return;
            visit(child);
          }
        }
      };

      visit($getRoot());
    });
  return key;
}

describe('Link commands', () => {
  describe('UNLINK_LINK_COMMAND', () => {
    it('unwraps a link node by key and keeps its text content', async () => {
      const editor = createLinkEditor();
      const linkKey = getFirstLinkKey(editor);

      editor.dispatchCommand(UNLINK_LINK_COMMAND, { key: linkKey });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const json = editor.getDocument('json') as any;
      const paragraph = json.root.children[0];
      const textContent = paragraph.children.map((child: any) => child.text ?? '').join('');

      expect(paragraph.children.every((child: any) => child.type === 'text')).toBe(true);
      expect(textContent).toBe('Visit Lobe Editor today');
      expect(JSON.stringify(json)).not.toContain('"type":"link"');
      expect(JSON.stringify(json)).not.toContain('https://editor.lobehub.com');
    });

    it('ignores an unknown key without changing the document', async () => {
      const editor = createLinkEditor();
      const before = editor.getDocument('json');

      editor.dispatchCommand(UNLINK_LINK_COMMAND, { key: 'missing-link-node' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editor.getDocument('json')).toEqual(before);
    });
  });
});
