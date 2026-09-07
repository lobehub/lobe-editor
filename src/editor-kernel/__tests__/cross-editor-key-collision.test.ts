// @vitest-environment node
import { CodeNode } from '@lexical/code-core';
import {
  createBinding,
  type Provider,
  type ProviderAwareness,
  syncLexicalUpdateToYjs,
  type UserState,
} from '@lexical/yjs';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  resetRandomKey,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { LitexmlPlugin } from '@/plugins/litexml/plugin';
import { idToChar } from '@/plugins/litexml/utils';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

import { moment } from '..';

type JsonNode = Record<string, any> & { children?: JsonNode[]; type: string };
type EditorKernel = Kernel;

const providerAwareness: ProviderAwareness = {
  getLocalState: () => null,
  getStates: () => new Map<number, UserState>(),
  off: () => undefined,
  on: () => undefined,
  setLocalState: () => undefined,
  setLocalStateField: () => undefined,
};

const provider: Provider = {
  awareness: providerAwareness,
  connect: () => undefined,
  disconnect: () => undefined,
  off: () => undefined,
  on: () => undefined,
};

const createKernel = (): Kernel => {
  const kernel = new Kernel();
  kernel.registerPlugins([[CommonPlugin, { enableHotkey: false }]]);
  kernel.registerNodes([CodeNode]);
  kernel.initHeadlessEditor();
  return kernel;
};

const createPlainKernel = (): Kernel => {
  const kernel = new Kernel();
  kernel.registerPlugins([[CommonPlugin, { enableHotkey: false }]]);
  kernel.initHeadlessEditor();
  return kernel;
};

const createLitexmlKernel = (): Kernel => {
  const kernel = new Kernel();
  kernel.registerPlugins([[CommonPlugin, { enableHotkey: false }], LitexmlPlugin]);
  kernel.registerNodes([CodeNode]);
  kernel.initHeadlessEditor();
  return kernel;
};

const createPageDocument = (): { root: JsonNode } => {
  const paragraph = (id: string, text: string): JsonNode => ({
    children: [
      {
        detail: 0,
        format: 0,
        id: String(100 + Number(id)),
        mode: 'normal',
        style: '',
        text,
        type: 'text',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    id,
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'paragraph',
    version: 1,
  });

  return {
    root: {
      children: [
        paragraph('1', 'before'),
        {
          children: [
            {
              detail: 0,
              format: 0,
              id: '105',
              mode: 'normal',
              style: '',
              text: 'fn code() {}',
              type: 'text',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          id: '2',
          indent: 0,
          language: 'rust',
          theme: null,
          type: 'code',
          version: 1,
        },
        paragraph('3', 'after'),
      ],
      direction: null,
      format: '',
      id: 'root',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
};

const createLowIdPreviewDocument = (): { root: JsonNode } => ({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            id: '1',
            mode: 'normal',
            style: '',
            text: 'preview',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        id: '0',
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
});

const createLowIdPlainDocument = (): { root: JsonNode } => ({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            id: '4',
            mode: 'normal',
            style: '',
            text: 'first',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
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
            id: '5',
            mode: 'normal',
            style: '',
            text: 'second',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        id: '2',
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
});

const createHighThenLowDocument = (includeInvalidNode = false): { root: JsonNode } => ({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            id: '1001',
            mode: 'normal',
            style: '',
            text: 'high',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        id: '1000',
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
            mode: 'normal',
            style: '',
            text: 'low with generated child',
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        id: '2',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
      ...(includeInvalidNode ? [{ type: 'missing-node', version: 1 }] : []),
    ],
    direction: null,
    format: '',
    id: 'root',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const getRootKeys = (kernel: EditorKernel): string[] => {
  const lexical = kernel.getLexicalEditor()!;
  return lexical.getEditorState().read(() => $getRoot().getChildren().map((node) => node.getKey()));
};

const getRootTypes = (kernel: EditorKernel): string[] => {
  const lexical = kernel.getLexicalEditor()!;
  return lexical.getEditorState().read(() => $getRoot().getChildren().map((node) => node.getType()));
};

const getRawRootChildTypes = (binding: any): string[] => {
  const sharedType = binding.root.getSharedType();
  return (sharedType.toDelta?.() ?? []).map((entry: any) => {
    const insert = entry.insert;
    return insert?.get?.('__type') ?? insert?.getAttribute?.('__type') ?? insert?.nodeName ?? 'unknown';
  });
};

describe('cross-editor Lexical key allocation', () => {
  let kernels: EditorKernel[] = [];
  let docs: Doc[] = [];

  beforeEach(() => {
    resetRandomKey();
  });

  afterEach(() => {
    kernels.forEach((kernel) => kernel.destroy());
    docs.forEach((doc) => doc.destroy());
    kernels = [];
    docs = [];
  });

  it('keeps Page keys unique when a preview kernel imports low keepId JSON', async () => {
    const kernelA = createKernel();
    const kernelB = createKernel();
    kernels.push(kernelA, kernelB);
    const pageDocument = createPageDocument();
    kernelA.setDocument('json', pageDocument, { keepId: true });

    const lexicalA = kernelA.getLexicalEditor()!;
    const codeKey = lexicalA.getEditorState().read(() => {
      const code = $getRoot().getChildren().find((node) => node.getType() === 'code');
      return code?.getKey();
    });
    expect(codeKey).toBe('2');
    const codeTextKey = lexicalA.getEditorState().read(() => {
      const code = $getRoot().getChildren().find((node) => node.getType() === 'code');
      return code && $isElementNode(code) ? code.getFirstChild()?.getKey() : undefined;
    });
    expect(codeTextKey).toBe('105');
    const doc = new Doc();
    docs.push(doc);
    const binding = createBinding(lexicalA, provider, 'page-key-collision', doc, new Map());
    const unregisterUpdate = lexicalA.registerUpdateListener(
      ({ dirtyElements, editorState, normalizedNodes, prevEditorState, tags }) => {
        syncLexicalUpdateToYjs(
          binding,
          provider,
          prevEditorState,
          editorState,
          dirtyElements,
          normalizedNodes,
          tags,
          new Set(),
        );
      },
    );
    // Keep a canonical raw Yjs projection before the preview import. The
    // update listener below must continue to mirror A after its local insert.
    syncCurrentEditorStateToYjs(binding, provider);

    kernelB.setDocument('json', createLowIdPreviewDocument(), { keepId: true });
    const previewJson = kernelB.getDocument('json') as unknown as { root: JsonNode };
    expect(previewJson.root.children?.[0]?.id).toBe('0');
    expect(previewJson.root.children?.[0]?.children?.[0]?.id).toBe('1');
    let updateError: unknown = null;
    try {
      lexicalA.update(
        () => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('tail'));
          $getRoot().append(paragraph);
        },
        { discrete: true },
      );
    } catch (error) {
      updateError = error;
    }
    await moment();
    unregisterUpdate();

    expect(updateError).toBeNull();
    const rootKeys = getRootKeys(kernelA);
    const rootTypes = getRootTypes(kernelA);
    const resolvedCodeType = lexicalA.getEditorState().read(() => $getNodeByKey(codeKey!)?.getType());
    const rawRootTypes = getRawRootChildTypes(binding);

    // The imported ids stay explicit, while A's new paragraph and the raw Yjs
    // projection receive a fresh key after the scoped import has completed.
    expect(new Set(rootKeys).size).toBe(rootKeys.length);
    expect(rootTypes).toEqual(['paragraph', 'code', 'paragraph', 'paragraph']);
    expect(resolvedCodeType).toBe('code');
    expect(rawRootTypes).toEqual(rootTypes);
  });

  it('also reproduces the collision through the LiteXML keepId importer', () => {
    const kernelA = createKernel();
    const kernelB = createLitexmlKernel();
    kernels.push(kernelA, kernelB);
    kernelA.setDocument('json', createPageDocument(), { keepId: true });

    const lexicalA = kernelA.getLexicalEditor()!;
    const codeKey = lexicalA.getEditorState().read(() =>
      $getRoot().getChildren().find((node) => node.getType() === 'code')?.getKey(),
    );
    expect(codeKey).toBe('2');

    kernelB.setDocument(
      'litexml',
      `<root><p id="${idToChar(2)}"><text id="${idToChar(1)}">preview</text></p></root>`,
    );
    const previewJson = kernelB.getDocument('json') as unknown as { root: JsonNode };
    expect(previewJson.root.children?.[0]?.id).toBe('2');
    expect(previewJson.root.children?.[0]?.children?.[0]?.id).toBe('1');

    let updateError: unknown = null;
    let insertedKey: string | undefined;
    try {
      lexicalA.update(() => {
        const paragraph = $createParagraphNode();
        insertedKey = paragraph.getKey();
        paragraph.append($createTextNode('tail'));
        $getRoot().append(paragraph);
      }, { discrete: true });
    } catch (error) {
      updateError = error;
    }

    expect(updateError).toBeNull();
    expect(insertedKey).not.toBe(codeKey);
  });

  it('does not let cloneNodeEditor lower another live kernel watermark', () => {
    const page = createPlainKernel();
    const livePeer = createPlainKernel();
    kernels.push(page, livePeer);
    page.setDocument('json', createLowIdPlainDocument(), { keepId: true });

    const livePeerEditor = livePeer.getLexicalEditor()!;
    livePeerEditor.update(
      () => {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('peer-before-clone'));
        $getRoot().append(paragraph);
      },
      { discrete: true },
    );
    const existingPeerKeys = getRootKeys(livePeer);
    expect(existingPeerKeys).toContain('6');

    const clone = page.cloneNodeEditor();
    try {
      livePeerEditor.update(
        () => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('peer-after-clone'));
          $getRoot().append(paragraph);
        },
        { discrete: true },
      );
    } finally {
      clone.destroy();
    }

    const peerKeysAfterClone = getRootKeys(livePeer);
    expect(new Set(peerKeysAfterClone).size).toBe(peerKeysAfterClone.length);
    expect(peerKeysAfterClone).toContain('8');
  });

  it('restores the caller watermark when a scoped import throws', () => {
    resetRandomKey(50);
    expect(() =>
      resetRandomKey(() => {
        resetRandomKey(2);
        throw new Error('synthetic import failure');
      }),
    ).toThrow('synthetic import failure');

    const kernel = createPlainKernel();
    kernels.push(kernel);
    const lexical = kernel.getLexicalEditor()!;
    let createdKey: string | undefined;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        createdKey = paragraph.getKey();
        $getRoot().append(paragraph);
      },
      { discrete: true },
    );
    expect(createdKey).toBe('50');
  });

  it('keeps high and auto-allocated ids above a later low-id reset', () => {
    const kernel = createKernel();
    kernels.push(kernel);
    resetRandomKey(50);
    kernel.setDocument('json', createHighThenLowDocument(), { keepId: true });

    const lexical = kernel.getLexicalEditor()!;
    let createdKey: string | undefined;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        createdKey = paragraph.getKey();
        $getRoot().append(paragraph);
      },
      { discrete: true },
    );
    expect(createdKey).toBe('1002');
  });

  it('restores the high id watermark when a malformed import aborts', () => {
    const kernel = createKernel();
    kernels.push(kernel);
    resetRandomKey(50);
    expect(() => {
      kernel.setDocument('json', createHighThenLowDocument(true), { keepId: true });
    }).not.toThrow();

    const lexical = kernel.getLexicalEditor()!;
    let createdKey: string | undefined;
    lexical.update(
      () => {
        const paragraph = $createParagraphNode();
        createdKey = paragraph.getKey();
        $getRoot().append(paragraph);
      },
      { discrete: true },
    );
    expect(createdKey).toBe('1002');
  });
});
