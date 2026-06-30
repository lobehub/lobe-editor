import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { Doc } from 'yjs';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';

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
});
