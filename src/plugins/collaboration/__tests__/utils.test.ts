import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { Doc } from 'yjs';

import Editor from '@/editor-kernel';
import { CodeblockPlugin } from '@/plugins/codeblock';
import { CommonPlugin } from '@/plugins/common/plugin';
import { ImagePlugin } from '@/plugins/image';
import { ListPlugin } from '@/plugins/list';
import { TablePlugin } from '@/plugins/table';

import { registerCollaborationBinding } from '../utils';

const emptyEditorState = {
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const headingEditorState = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Shared heading',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        tag: 'h2',
        type: 'heading',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const richEditorState = {
  root: {
    children: [
      headingEditorState.root.children[0],
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: 'Joining clients hydrate from the room snapshot.',
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: 1,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        type: 'list',
        version: 1,
      },
      {
        children: [
          {
            children: [
              {
                backgroundColor: null,
                children: [
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'Area',
                        type: 'text',
                        version: 1,
                      },
                    ],
                    direction: null,
                    format: '',
                    indent: 0,
                    textFormat: 0,
                    textStyle: '',
                    type: 'paragraph',
                    version: 1,
                  },
                ],
                colSpan: 1,
                direction: 'ltr',
                format: '',
                headerState: 3,
                indent: 0,
                rowSpan: 1,
                type: 'tablecell',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            height: null,
            indent: 0,
            type: 'tablerow',
            version: 1,
          },
        ],
        colWidths: [180],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'table',
        version: 1,
      },
      {
        altText: 'Generated product board placeholder',
        height: 160,
        maxWidth: 640,
        src: 'https://dummyimage.com/960x320/e2e8f0/334155&text=Workspace+Artifact',
        status: 'uploaded',
        type: 'block-image',
        version: 1,
        width: 480,
      },
      {
        children: [],
        code: 'const roomId = `${workspaceId}:${pageId}`;',
        codeTheme: 'default',
        direction: null,
        format: '',
        indent: 0,
        language: 'typescript',
        options: {
          indentWithTabs: false,
          lineNumbers: false,
          tabSize: 2,
        },
        type: 'code',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const collaborationPlugins = [CommonPlugin, ListPlugin, TablePlugin, ImagePlugin, CodeblockPlugin];

const createNoopAwareness = (): ProviderAwareness => {
  let localState: UserState | null = null;

  return {
    getLocalState: () => localState,
    getStates: () => new Map(),
    off: () => {},
    on: () => {},
    setLocalState: (state) => {
      localState = state;
    },
    setLocalStateField: (field, value) => {
      localState = {
        ...(localState ?? {
          anchorPos: null,
          awarenessData: {},
          color: '#1677ff',
          focusPos: null,
          focusing: true,
          name: 'Test',
        }),
        [field]: value,
      };
    },
  };
};

const createNoopProvider = (): Provider => ({
  awareness: createNoopAwareness(),
  connect: () => {},
  disconnect: () => {},
  off: () => {},
  on: () => {},
});

describe('registerCollaborationBinding', () => {
  it('syncs Lexical updates through a shared Y.Doc', async () => {
    const doc = new Doc();
    const docMap = new Map([['room-1', doc]]);
    const leftProvider = createNoopProvider();
    const rightProvider = createNoopProvider();

    const leftEditor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const rightEditor = Editor.createEditor().registerPlugins([CommonPlugin]);
    const leftLexicalEditor = leftEditor.initNodeEditor();
    const rightLexicalEditor = rightEditor.initNodeEditor();

    if (!leftLexicalEditor || !rightLexicalEditor) {
      throw new Error('Failed to initialize test Lexical editors');
    }

    leftEditor.setDocument('json', emptyEditorState);
    rightEditor.setDocument('json', emptyEditorState);

    const leftBinding = registerCollaborationBinding({
      doc,
      id: 'room-1',
      lexicalEditor: leftLexicalEditor,
      provider: leftProvider,
      shouldBootstrap: true,
      syncCursorPositionsFn: () => {},
      yjsDocMap: docMap,
    });
    const rightBinding = registerCollaborationBinding({
      doc,
      id: 'room-1',
      lexicalEditor: rightLexicalEditor,
      provider: rightProvider,
      syncCursorPositionsFn: () => {},
      yjsDocMap: docMap,
    });

    leftLexicalEditor.update(
      () => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Synced through Yjs'));
        root.clear();
        root.append(paragraph);
      },
      { discrete: true },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const rightJson = rightEditor.getDocument('json') as unknown as typeof emptyEditorState;
    expect(JSON.stringify(rightJson)).toContain('Synced through Yjs');

    leftBinding.cleanup();
    rightBinding.cleanup();
  });

  it('bootstraps registered rich element nodes through a shared Y.Doc', async () => {
    const doc = new Doc();
    const docMap = new Map([['room-1', doc]]);
    const leftProvider = createNoopProvider();
    const rightProvider = createNoopProvider();

    const leftEditor = Editor.createEditor().registerPlugins(collaborationPlugins);
    const rightEditor = Editor.createEditor().registerPlugins(collaborationPlugins);
    const leftLexicalEditor = leftEditor.initNodeEditor();
    const rightLexicalEditor = rightEditor.initNodeEditor();

    if (!leftLexicalEditor || !rightLexicalEditor) {
      throw new Error('Failed to initialize test Lexical editors');
    }

    leftEditor.setDocument('json', richEditorState);
    rightEditor.setDocument('json', emptyEditorState);

    const leftBinding = registerCollaborationBinding({
      doc,
      id: 'room-1',
      lexicalEditor: leftLexicalEditor,
      provider: leftProvider,
      shouldBootstrap: true,
      syncCursorPositionsFn: () => {},
      yjsDocMap: docMap,
    });
    const rightBinding = registerCollaborationBinding({
      doc,
      id: 'room-1',
      lexicalEditor: rightLexicalEditor,
      provider: rightProvider,
      syncCursorPositionsFn: () => {},
      yjsDocMap: docMap,
    });

    const rightJson = rightEditor.getDocument('json') as unknown as typeof richEditorState;

    expect(rightJson.root.children[0].type).toBe('heading');
    expect(JSON.stringify(rightJson)).toContain('Shared heading');
    expect(rightJson.root.children.map((node) => node.type)).toEqual([
      'heading',
      'list',
      'table',
      'block-image',
      'code',
    ]);

    leftBinding.cleanup();
    rightBinding.cleanup();
  });
});
