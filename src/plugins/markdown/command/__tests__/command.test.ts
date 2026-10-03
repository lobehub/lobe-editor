import {
  CodeblockPlugin,
  CodePlugin,
  CommonPlugin,
  FilePlugin,
  HRPlugin,
  ImagePlugin,
  LinkHighlightPlugin,
  LinkPlugin,
  ListPlugin,
  MathPlugin,
  MentionPlugin,
  TablePlugin,
} from '@lobehub/editor';
import {
  $getRoot,
  $isElementNode,
  $isTextNode,
  COPY_COMMAND,
  type LexicalNode,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { LitexmlPlugin } from '@/plugins/litexml';
import { LITEXML_APPLY_COMMAND } from '@/plugins/litexml/command';

import { MarkdownPlugin } from '../../plugin';
import { GET_MARKDOWN_SELECTION_COMMAND, INSERT_MARKDOWN_COMMAND } from '../index';

function findLexicalNode(
  node: LexicalNode,
  predicate: (candidate: LexicalNode) => boolean,
): LexicalNode | null {
  if (predicate(node)) return node;
  if (!$isElementNode(node)) return null;
  for (const child of node.getChildren()) {
    const found = findLexicalNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function getTextNodeRuntimeKey(
  editor: ReturnType<typeof Editor.createEditor>,
  text: string,
): string {
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected the editor to be initialized.');

  return lexicalEditor.getEditorState().read(() => {
    const node = findLexicalNode(
      $getRoot(),
      (candidate) => $isTextNode(candidate) && candidate.getTextContent() === text,
    );
    if (!$isTextNode(node)) throw new Error(`Could not find text node ${JSON.stringify(text)}`);
    return node.getKey();
  });
}

function getFirstParagraphRuntimeKey(editor: ReturnType<typeof Editor.createEditor>): string {
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected the editor to be initialized.');

  return lexicalEditor.getEditorState().read(() => {
    const node = $getRoot().getFirstChild();
    if (!node || node.getType() !== 'paragraph') {
      throw new Error('Could not find the first paragraph.');
    }
    return node.getKey();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const json = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Welcome to the Lobe Editor Demo!',
            type: 'text',
            version: 1,
            id: '2',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
        tag: 'h1',
        id: '1',
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: "In case you were wondering what the black box at the bottom is – it's the debug view, showing the current state of the editor. You can disable it by pressing on the settings control in the bottom-left of your screen and toggling the debug view setting.",
            type: 'text',
            version: 1,
            id: '4',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'quote',
        version: 1,
        id: '3',
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'The playground is a demo environment built with ',
            type: 'text',
            version: 1,
            id: '6',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '﻿',
                type: 'cursor',
                version: 1,
                id: '8',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '﻿',
                type: 'cursor',
                version: 1,
                id: '9',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '﻿',
                type: 'cursor',
                version: 1,
                id: '10',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '﻿',
                type: 'cursor',
                version: 1,
                id: '11',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '@lobehub/editor',
                type: 'text',
                version: 1,
                id: '12',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'codeInline',
            version: 1,
            id: '7',
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '﻿',
            type: 'cursor',
            version: 1,
            id: '13',
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '. Try typing in ',
            type: 'text',
            version: 1,
            id: '14',
          },
          {
            detail: 0,
            format: 1,
            mode: 'normal',
            style: '',
            text: 'some text',
            type: 'text',
            version: 1,
            id: '15',
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: ' with ',
            type: 'text',
            version: 1,
            id: '16',
          },
          {
            detail: 0,
            format: 2,
            mode: 'normal',
            style: '',
            text: 'different formats',
            type: 'text',
            version: 1,
            id: '17',
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '.',
            type: 'text',
            version: 1,
            id: '18',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: '',
        id: '5',
      },
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Visit the ',
                type: 'text',
                version: 1,
                id: '21',
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Lobe Editor website',
                    type: 'text',
                    version: 1,
                    id: '23',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'link',
                version: 1,
                rel: 'noreferrer',
                target: null,
                title: null,
                url: 'https://editor.lobehub.com',
                id: '22',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: ' for documentation and more information.',
                type: 'text',
                version: 1,
                id: '24',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 1,
            id: '20',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Check out the code on our ',
                type: 'text',
                version: 1,
                id: '26',
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'GitHub repository',
                    type: 'text',
                    version: 1,
                    id: '28',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'link',
                version: 1,
                rel: null,
                target: null,
                title: 'https://github.com/lobehub/lobe-editor',
                url: 'https://github.com/lobehub/lobe-editor',
                id: '27',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: '.',
                type: 'text',
                version: 1,
                id: '29',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 2,
            id: '25',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Playground code ',
                type: 'text',
                version: 1,
                id: '31',
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Playground code',
                    type: 'text',
                    version: 1,
                    id: '33',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'link',
                version: 1,
                rel: 'noreferrer',
                target: null,
                title: null,
                url: 'https://github.com/lobehub/lobe-editor/blob/master/src/react/Editor/demos/index.tsx',
                id: '32',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: ' can be found here.',
                type: 'text',
                version: 1,
                id: '34',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 3,
            id: '30',
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Join our ',
                type: 'text',
                version: 1,
                id: '36',
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Discover Server',
                    type: 'text',
                    version: 1,
                    id: '38',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'link',
                version: 1,
                rel: null,
                target: null,
                title: 'https://discord.gg/AYFPHvv2jT',
                url: 'https://discord.gg/AYFPHvv2jT',
                id: '37',
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: ' and chat with the team.',
                type: 'text',
                version: 1,
                id: '39',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            version: 1,
            value: 4,
            id: '35',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        id: '19',
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: "Lastly, we're constantly adding cool new features to this playground. So make sure you check back here when you next get a chance 🙂.",
            type: 'text',
            version: 1,
            id: '41',
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: '',
        id: '40',
      },
      {
        type: 'code',
        version: 1,
        code: "import { Editor } from '@lobehub/editor';",
        codeTheme: 'default',
        language: 'typescript',
        options: {
          indentWithTabs: false,
          lineNumbers: false,
          tabSize: 2,
        },
        id: '42',
      },
      {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: '',
        id: '43',
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

describe('Markdown Commands', () => {
  describe('COPY_COMMAND', () => {
    const dispatchCopyCommand = (editor: ReturnType<typeof Editor.createEditor>) => {
      const clipboard = new Map<string, string>();
      const clipboardData = {
        clearData: (type?: string) => {
          if (type) {
            clipboard.delete(type);
          } else {
            clipboard.clear();
          }
        },
        getData: (type: string) => clipboard.get(type) || '',
        setData: (type: string, value: string) => {
          clipboard.set(type, value);
        },
        get types() {
          return Array.from(clipboard.keys());
        },
      } as unknown as DataTransfer;
      class MockClipboardEvent extends Event {
        clipboardData = clipboardData;
      }
      vi.stubGlobal('ClipboardEvent', MockClipboardEvent);

      const event = new MockClipboardEvent('copy') as ClipboardEvent;

      editor.dispatchCommand(COPY_COMMAND, event);

      return clipboard;
    };

    it('should write a partial paragraph selection without formatter-generated trailing line break', async () => {
      const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
      editor.initNodeEditor();

      editor.setDocument(
        'json',
        {
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    id: '2',
                    mode: 'normal',
                    style: '',
                    text: 'before js代码 after',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                id: '1',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                type: 'paragraph',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            id: 'root',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        { keepId: true },
      );

      const textNodeKey = getTextNodeRuntimeKey(editor, 'before js代码 after');
      await editor.setSelection({
        endNodeId: textNodeKey,
        endOffset: 11,
        startNodeId: textNodeKey,
        startOffset: 7,
        type: 'range',
      });

      const clipboard = dispatchCopyCommand(editor);

      expect(clipboard.get('text/plain')).toBe('js代码');
      expect(clipboard.get('text/markdown')).toBe('js代码');
    });

    it('should preserve paragraph breaks when copying across paragraphs', async () => {
      const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
      editor.initNodeEditor();

      editor.setDocument(
        'json',
        {
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    id: '2',
                    mode: 'normal',
                    style: '',
                    text: 'before 第一段',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                id: '1',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                type: 'paragraph',
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    id: '4',
                    mode: 'normal',
                    style: '',
                    text: '第二段 after',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                id: '3',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                type: 'paragraph',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            id: 'root',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        { keepId: true },
      );

      const firstTextNodeKey = getTextNodeRuntimeKey(editor, 'before 第一段');
      const secondTextNodeKey = getTextNodeRuntimeKey(editor, '第二段 after');
      await editor.setSelection({
        endNodeId: secondTextNodeKey,
        endOffset: 3,
        startNodeId: firstTextNodeKey,
        startOffset: 7,
        type: 'range',
      });

      const clipboard = dispatchCopyCommand(editor);

      expect(clipboard.get('text/plain')).toBe('第一段\n\n第二段');
      expect(clipboard.get('text/markdown')).toBe('第一段\n\n第二段');
    });
  });

  describe('INSERT_MARKDOWN_COMMAND', () => {
    it('should keep markdown auto-convert redoable after undo', async () => {
      const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
      editor.setRootElement(document.createElement('div'));

      editor.setDocument(
        'json',
        {
          root: {
            children: [
              {
                children: [],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
                textFormat: 0,
                textStyle: '',
                id: '1',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
            id: 'root',
          },
        },
        { keepId: true },
      );

      const paragraphKey = getFirstParagraphRuntimeKey(editor);
      expect(
        await editor.setSelection({
          endNodeId: paragraphKey,
          endOffset: 0,
          startNodeId: paragraphKey,
          startOffset: 0,
          type: 'range',
        }),
      ).toBe(true);

      const prePasteHistoryState = editor.getHistoryState().current;

      editor.setDocument('text', '# Title\n\nBody', { keepHistory: true });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const rawJson = editor.getDocument('json') as any;

      editor.dispatchCommand(INSERT_MARKDOWN_COMMAND, {
        historyState: prePasteHistoryState,
        markdown: '# Title\n\nBody',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const convertedJson = editor.getDocument('json') as any;
      expect(convertedJson.root.children.map((child: any) => child.type)).toEqual([
        'heading',
        'paragraph',
      ]);
      expect(convertedJson.root.children[0].tag).toBe('h1');
      expect(convertedJson.root.children[0].children[0].text).toBe('Title');
      expect(convertedJson.root.children[1].children[0].text).toBe('Body');

      editor.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editor.getDocument('json')).toEqual(rawJson);

      editor.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editor.getDocument('json')).toEqual(convertedJson);
    });
  });

  describe('GET_MARKDOWN_SELECTION_COMMAND', () => {
    it('should get markdown selection with correct line numbers', async () => {
      const editor = Editor.createEditor().registerPlugins([
        CodePlugin,
        CodeblockPlugin,
        CommonPlugin,
        FilePlugin,
        HRPlugin,
        ImagePlugin,
        LinkPlugin,
        LinkHighlightPlugin,
        ListPlugin,
        MarkdownPlugin,
        MathPlugin,
        MentionPlugin,
        TablePlugin,
      ]);
      editor.initNodeEditor();
      // Set up editor with multi-line content
      editor.setDocument('json', json, { keepId: true });
      const startNodeKey = getTextNodeRuntimeKey(
        editor,
        'The playground is a demo environment built with ',
      );
      const endNodeKey = getTextNodeRuntimeKey(editor, 'GitHub repository');
      expect(
        await editor.setSelection({
          endNodeId: endNodeKey,
          endOffset: 6,
          startNodeId: startNodeKey,
          startOffset: 33,
          type: 'range',
        }),
      ).toBe(true);
      const ret = await new Promise((resolve) => {
        editor.dispatchCommand(GET_MARKDOWN_SELECTION_COMMAND, {
          onResult: (startLine: number, endLine: number) => {
            resolve({ startLine, endLine });
          },
        });
      });
      expect(ret).toEqual({ startLine: 5, endLine: 8 });
    });

    it('maps a root-boundary range selection into the clone', async () => {
      const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin]);
      editor.initNodeEditor();
      editor.setDocument('markdown', 'First paragraph\n\nSecond paragraph');

      const lexicalEditor = editor.getLexicalEditor()!;
      const { rootKey, rootChildren } = lexicalEditor.getEditorState().read(() => ({
        rootChildren: $getRoot().getChildrenSize(),
        rootKey: $getRoot().getKey(),
      }));
      expect(
        await editor.setSelection({
          endNodeId: rootKey,
          endOffset: rootChildren,
          startNodeId: rootKey,
          startOffset: 0,
          type: 'range',
        }),
      ).toBe(true);

      const result = await new Promise((resolve) => {
        editor.dispatchCommand(GET_MARKDOWN_SELECTION_COMMAND, {
          onResult: (startLine: number, endLine: number) => resolve({ startLine, endLine }),
        });
      });

      expect(result).toEqual({ startLine: 1, endLine: 3 });
    });

    it('maps a pending review selection to its active after side in the clone', async () => {
      const editor = Editor.createEditor().registerPlugins([
        CommonPlugin,
        MarkdownPlugin,
        LitexmlPlugin,
      ]);
      editor.initNodeEditor();
      editor.setDocument('markdown', 'First paragraph\n\nTarget text\n\nLast paragraph');

      const sourceXml = editor.getDocument('litexml') as unknown as string;
      const targetId = /<span id="([^"]+)">Target text<\/span>/.exec(sourceXml)?.[1];
      expect(targetId).toBeTruthy();

      editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
        delay: true,
        litexml: `<span id="${targetId}">Replacement text</span>`,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editor.getDocument('markdown')).toContain('Replacement text');
      const afterSideKey = getTextNodeRuntimeKey(editor, 'Replacement text');
      expect(
        await editor.setSelection({
          endNodeId: afterSideKey,
          endOffset: 'Replacement text'.length,
          startNodeId: afterSideKey,
          startOffset: 0,
          type: 'range',
        }),
      ).toBe(true);

      const result = await new Promise((resolve) => {
        editor.dispatchCommand(GET_MARKDOWN_SELECTION_COMMAND, {
          onResult: (startLine: number, endLine: number) => resolve({ startLine, endLine }),
        });
      });

      expect(result).toEqual({ startLine: 3, endLine: 3 });
    });
  });
});
