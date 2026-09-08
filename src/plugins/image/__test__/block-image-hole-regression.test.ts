import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createQuoteNode } from '@lexical/rich-text';
import {
  $createTableNodeWithDimensions,
  type TableCellNode,
  type TableRowNode,
} from '@lexical/table';
import { createBinding, type Provider } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, decodeUpdate, Doc, encodeStateAsUpdate, XmlText } from 'yjs';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { Kernel } from '@/editor-kernel/kernel';
import { migrateLegacyBlockImagesInYjsDoc } from '@/headless/yjs-snapshot';
import { APPLY_BLOCK_REWRITE_COMMAND } from '@/plugins/block/command';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { IBlockRewriteAdapterService } from '@/plugins/block/service/rewrite-adapter';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { ListPlugin } from '@/plugins/list';
import { MarkdownPlugin } from '@/plugins/markdown';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { $getNodeId } from '@/plugins/properties/utils';
import { TablePlugin } from '@/plugins/table';
import { YjsPlugin } from '@/plugins/yjs/plugin';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

import { INSERT_IMAGE_COMMAND } from '../command';
import { $createBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { ImagePlugin } from '../plugin';

const uploadedImage = {
  altText: '旧图',
  height: 90,
  maxWidth: 600,
  src: 'https://cdn.example.com/original.png',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  width: 160,
};

const paragraph = (text = '') => ({
  children: text
    ? [
        {
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text,
          type: 'text',
          version: 1,
        },
      ]
    : [],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const documentWith = (...children: unknown[]) => ({
  root: {
    children,
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const settle = async (): Promise<void> => {
  await moment();
  await Promise.resolve();
  await moment();
  await moment();
};

const imageFromHole = () => {
  const hole = $nodesOfType(HoleNode)[0];
  if (!hole) throw new Error('Block image Hole missing');
  const image = hole.getContentChildren()[0];
  if (!(image instanceof BlockImageNode)) throw new Error('Block image payload missing');
  return { hole, image };
};

const rootTypes = () =>
  $getRoot()
    .getChildren()
    .map((node) => node.getType());

const createDomEditor = async (): Promise<{
  editor: ReturnType<typeof Editor.createEditor>;
  lexical: NonNullable<ReturnType<ReturnType<typeof Editor.createEditor>['setRootElement']>>;
  root: HTMLDivElement;
}> => {
  const editor = Editor.createEditor().registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    BlockRewritePlugin,
    ListPlugin,
    PropertiesPlugin,
    TablePlugin,
    MarkdownPlugin,
    ImagePlugin,
  ]);
  const root = document.createElement('div');
  root.contentEditable = 'true';
  document.body.append(root);
  const lexical = editor.setRootElement(root);
  editor.setDocument('json', documentWith({ ...uploadedImage }));
  await settle();
  if (!lexical) throw new Error('Lexical editor failed to initialize');
  return { editor, lexical, root };
};

const setNativeCaret = (textNode: Text, offset: number, notify = true): void => {
  const selection = document.getSelection();
  if (!selection) throw new Error('Native selection unavailable');
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset);
  selection.addRange(range);
  if (notify) document.dispatchEvent(new Event('selectionchange'));
};

const selectBoundary = async (
  root: HTMLDivElement,
  lexical: NonNullable<ReturnType<ReturnType<typeof Editor.createEditor>['setRootElement']>>,
  side: 'before' | 'after',
): Promise<Text> => {
  const hit = root.querySelector<HTMLElement>(`[data-hole-cursor-hit="${side}"]`);
  if (!hit) throw new Error(`${side} Hole boundary hit area missing`);
  const holeElement = root.querySelector<HTMLElement>('[data-hole="true"]');
  if (!holeElement) throw new Error('Block image Hole DOM missing');
  vi.spyOn(holeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 10));
  hit.dispatchEvent(
    new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      clientX: side === 'before' ? 0 : 200,
    }),
  );
  hit.dispatchEvent(
    new MouseEvent('pointerup', { bubbles: true, button: 0, buttons: 0, cancelable: true }),
  );
  hit.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: side === 'before' ? 0 : 200,
    }),
  );
  await settle();
  const cursorKey = lexical.getEditorState().read(() => {
    const { hole } = imageFromHole();
    const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
    if (!cursor) throw new Error(`${side} Hole boundary cursor missing`);
    return cursor.getKey();
  });
  const cursorElement = lexical.getElementByKey(cursorKey);
  if (!cursorElement || !(cursorElement.firstChild instanceof Text)) {
    throw new Error(`${side} Hole boundary DOM text missing`);
  }
  const cursorText = cursorElement.firstChild;
  setNativeCaret(cursorText, side === 'before' ? cursorText.data.length : 0, false);
  return cursorText;
};

const dispatchNativeTextInput = (root: HTMLDivElement, cursorText: Text, data: string): void => {
  const beforeInput = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    data,
    inputType: 'insertText',
  });
  root.dispatchEvent(beforeInput);
  if (beforeInput.defaultPrevented) return;
  cursorText.data = `${cursorText.data}${data}`;
  setNativeCaret(cursorText, cursorText.data.length, false);
  root.dispatchEvent(new InputEvent('input', { bubbles: true, data, inputType: 'insertText' }));
};

const createHeadlessImageEditor = () =>
  Editor.createEditor().registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    BlockRewritePlugin,
    ListPlugin,
    PropertiesPlugin,
    MarkdownPlugin,
    TablePlugin,
    ImagePlugin,
  ]);

describe('BlockImage Hole boundary regressions', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let root: HTMLDivElement | undefined;

  beforeEach(() => {
    resetRandomKey();
  });

  afterEach(() => {
    editor?.destroy();
    root?.remove();
    editor = undefined;
    root = undefined;
  });

  it.each(['before', 'after'] as const)(
    'keeps the BlockImage Hole atomic while Latin text enters at the %s boundary',
    async (side) => {
      const fixture = await createDomEditor();
      editor = fixture.editor;
      root = fixture.root;
      const cursor = await selectBoundary(fixture.root, fixture.lexical, side);
      dispatchNativeTextInput(fixture.root, cursor, 'Latin');
      await settle();

      fixture.lexical.getEditorState().read(() => {
        expect(rootTypes()).toEqual(
          side === 'before' ? ['paragraph', 'hole'] : ['hole', 'paragraph'],
        );
        const paragraphs = $getRoot()
          .getChildren()
          .filter((node) => node.getType() === 'paragraph');
        expect(paragraphs.at(side === 'before' ? 0 : -1)?.getTextContent()).toBe('Latin');
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect(imageFromHole().image.src).toBe(uploadedImage.src);
      });
    },
  );

  it.each(['before', 'after'] as const)(
    'keeps the BlockImage Hole atomic while Chinese IME text enters at the %s boundary',
    async (side) => {
      const fixture = await createDomEditor();
      editor = fixture.editor;
      root = fixture.root;
      await selectBoundary(fixture.root, fixture.lexical, side);
      fixture.root.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, data: '' }),
      );
      await settle();
      let compositionKey = '';
      let compositionOffset = 0;
      fixture.lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('IME range selection missing');
        compositionKey = selection.anchor.key;
        compositionOffset = selection.anchor.offset;
      });
      const compositionElement = fixture.lexical.getElementByKey(compositionKey);
      if (!compositionElement || !(compositionElement.firstChild instanceof Text)) {
        throw new Error('IME paragraph DOM missing');
      }
      const compositionText = compositionElement.firstChild;
      setNativeCaret(compositionText, compositionOffset, false);
      const beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '简介',
        inputType: 'insertCompositionText',
      });
      fixture.root.dispatchEvent(beforeInput);
      if (!beforeInput.defaultPrevented) {
        compositionText.data = `${compositionText.data.slice(0, compositionOffset)}简介${compositionText.data.slice(compositionOffset)}`;
        setNativeCaret(compositionText, compositionOffset + 2, false);
        fixture.root.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            data: '简介',
            inputType: 'insertCompositionText',
          }),
        );
      }
      fixture.root.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: '简介' }),
      );
      await settle();

      fixture.lexical.getEditorState().read(() => {
        expect(rootTypes()).toEqual(
          side === 'before' ? ['paragraph', 'hole'] : ['hole', 'paragraph'],
        );
        const paragraphs = $getRoot()
          .getChildren()
          .filter((node) => node.getType() === 'paragraph');
        expect(paragraphs.at(side === 'before' ? 0 : -1)?.getTextContent()).toBe('简介');
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect(imageFromHole().image.src).toBe(uploadedImage.src);
      });
    },
  );

  it('moves the caret around the Hole and deletes only the selected BlockImage unit', async () => {
    const fixture = await createDomEditor();
    editor = fixture.editor;
    root = fixture.root;
    fixture.editor.setDocument(
      'json',
      documentWith(paragraph('前'), { ...uploadedImage }, paragraph('后')),
    );
    await settle();

    fixture.lexical.update(
      () => {
        const currentHole = $nodesOfType(HoleNode)[0];
        currentHole.getBeforeCursor()?.selectEnd();
      },
      { discrete: true },
    );
    expect(
      fixture.lexical.dispatchCommand(
        KEY_ARROW_RIGHT_COMMAND,
        new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
      ),
    ).toBe(true);
    await settle();
    fixture.lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const currentHole = $nodesOfType(HoleNode)[0];
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect(selection.anchor.key).toBe(currentHole.getAfterCursor()?.getKey());
        expect(selection.anchor.offset).toBe(0);
      }
    });

    const backspace = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
    expect(fixture.lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, backspace)).toBe(true);
    expect(backspace.defaultPrevented).toBe(true);
    await settle();
    fixture.lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect($nodesOfType(BlockImageNode)).toHaveLength(0);
      expect($getRoot().getTextContent()).toContain('前');
      expect($getRoot().getTextContent()).toContain('后');
    });
  });

  it('leaves internal image controls interactive while the BlockImage Hole stays intact', async () => {
    const fixture = await createDomEditor();
    editor = fixture.editor;
    root = fixture.root;
    const content = fixture.root.querySelector<HTMLElement>('[data-hole-content="true"]');
    if (!content) throw new Error('BlockImage Hole content DOM missing');
    const control = document.createElement('input');
    control.dataset.holeEditable = 'true';
    content.append(control);
    const pointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    control.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(false);
    control.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '标题',
        inputType: 'insertText',
      }),
    );
    await settle();
    fixture.lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(1);
      expect($nodesOfType(BlockImageNode)).toHaveLength(1);
      expect(imageFromHole().image.src).toBe(uploadedImage.src);
    });
  });

  it('keeps one BlockImage Hole and node identity through patch Undo/Redo', async () => {
    const headless = createHeadlessImageEditor();
    editor = headless;
    headless.initHeadlessEditor();
    headless.setDocument('json', documentWith({ ...uploadedImage }));
    await settle();
    const persisted = JSON.stringify(headless.getDocument('json'));
    expect(persisted).toContain('"type":"block-image"');
    expect(persisted).not.toContain('"type":"hole"');

    const { image } = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => imageFromHole());
    const nodeId = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => $getNodeId(image));
    if (!nodeId) throw new Error('Block image node id missing');
    const adapter = headless
      .requireService(IBlockRewriteAdapterService)
      ?.getAdapterByKey('block-image');
    const sourceHash = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => adapter?.readContext(image)?.sourceHash);
    expect(
      headless.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        expectedSourceHash: sourceHash,
        nodeId,
        output: {
          kind: 'patch',
          patch: { src: 'https://cdn.example.com/rewritten.png', width: 320, height: 180 },
        },
      }),
    ).toBe(true);
    await settle();
    expect(
      headless
        .getLexicalEditor()!
        .getEditorState()
        .read(() => imageFromHole().image.src),
    ).toBe('https://cdn.example.com/rewritten.png');
    expect(headless.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect(imageFromHole().image.src).toBe(uploadedImage.src);
      });
    expect(headless.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect(imageFromHole().image.src).toBe('https://cdn.example.com/rewritten.png');
      });
  });

  it('keeps loading/error placeholder proof stable and rejects an uploaded empty source', async () => {
    const headless = createHeadlessImageEditor();
    editor = headless;
    headless.initHeadlessEditor();
    headless.setDocument('json', documentWith({ ...uploadedImage, src: '', status: 'loading' }));
    await settle();

    const adapter = headless
      .requireService(IBlockRewriteAdapterService)
      ?.getAdapterByKey('block-image');
    if (!adapter) throw new Error('Block image adapter missing');
    const loading = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const { image } = imageFromHole();
        return adapter.readContext(image);
      });
    expect(loading?.image).toMatchObject({ placeholder: true, src: '', status: 'loading' });

    headless.getLexicalEditor()!.update(() => {
      imageFromHole().image.setError('generation failed');
    });
    await settle();
    const errored = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const { image } = imageFromHole();
        return adapter.readContext(image);
      });
    expect(errored?.image).toMatchObject({ placeholder: true, src: '', status: 'error' });
    expect(errored?.sourceHash).toBe(loading?.sourceHash);

    headless.getLexicalEditor()!.update(() => {
      imageFromHole().image.setStatus('uploaded');
    });
    await settle();
    const invalidUploaded = headless
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const { image } = imageFromHole();
        return adapter.validate(image, { kind: 'patch', patch: { altText: 'still empty' } });
      });
    expect(invalidUploaded.ok).toBe(false);
  });
});

describe('BlockImage Hole migration inside structural containers', () => {
  it.each(['table-cell', 'list-item', 'quote'] as const)(
    'moves one image into a Hole without changing the %s structure',
    async (containerKind) => {
      resetRandomKey();
      const editor = createHeadlessImageEditor();
      editor.initHeadlessEditor();
      editor.getLexicalEditor()!.update(
        () => {
          const image = $createBlockImageNode({
            altText: '迁移图',
            height: 90,
            maxWidth: 600,
            src: 'https://cdn.example.com/migrate.png',
            status: 'uploaded',
            width: 160,
          });
          const root = $getRoot();
          if (containerKind === 'table-cell') {
            const table = $createTableNodeWithDimensions(1, 1, false);
            const row = table.getFirstChild() as TableRowNode;
            const cell = row.getFirstChild() as TableCellNode;
            cell.append(
              $createParagraphNode().append(
                $createTextNode('单元格前'),
                image,
                $createTextNode('单元格尾部'),
              ),
            );
            root.append(table);
          } else if (containerKind === 'list-item') {
            const list = $createListNode('bullet');
            const item = $createListItemNode();
            item.append(
              $createParagraphNode().append(
                $createTextNode('列表前'),
                image,
                $createTextNode('列表后'),
              ),
            );
            list.append(item);
            root.append(list);
          } else {
            const quote = $createQuoteNode();
            quote.append(
              $createParagraphNode().append(
                $createTextNode('引用前'),
                image,
                $createTextNode('引用后'),
              ),
            );
            root.append(quote);
          }
        },
        { discrete: true },
      );
      await settle();

      editor
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          expect($nodesOfType(HoleNode)).toHaveLength(1);
          expect($nodesOfType(BlockImageNode)).toHaveLength(1);
          const { hole, image } = imageFromHole();
          expect(hole.getParent()?.getType()).toBe(
            containerKind === 'table-cell'
              ? 'tablecell'
              : containerKind === 'list-item'
                ? 'listitem'
                : 'quote',
          );
          expect(image.src).toContain('migrate.png');
          const parentText = hole.getParent()?.getTextContent() ?? '';
          expect(parentText.replaceAll(/\s+/gu, '')).toContain(
            containerKind === 'table-cell'
              ? '单元格尾部'
              : containerKind === 'list-item'
                ? '列表前列表后'
                : '引用前引用后',
          );
          expect($getRoot().getChildren()[0]?.getType()).toBe(
            containerKind === 'table-cell'
              ? 'table'
              : containerKind === 'list-item'
                ? 'list'
                : 'quote',
          );
        });
      editor.destroy();
    },
  );
});

type SyncProvider = Provider & { emitSync: () => void };

type YXmlElementLike = {
  getAttribute?: (name: string) => unknown;
};

const readYjsRootTypes = (doc: Doc): string[] =>
  doc
    .get('root', XmlText)
    .toDelta()
    .flatMap((operation: { insert?: unknown }) => {
      const { insert } = operation;
      if (!insert || typeof insert === 'string') return [];
      const type = (insert as YXmlElementLike).getAttribute?.('__type');
      return typeof type === 'string' ? [type] : [];
    });

type YjsNodeLike = {
  getAttribute?: (name: string) => unknown;
  toArray?: () => unknown[];
  toDelta?: () => Array<{ insert?: unknown }>;
};

const readYjsBlockImageNodeIds = (doc: Doc): string[] => {
  const ids: string[] = [];
  const visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    const node = value as YjsNodeLike;
    if (node.getAttribute?.('__type') === 'block-image') {
      const state = node.getAttribute?.('__state') as
        { get?: (key: string) => unknown } | undefined;
      const properties = state?.get?.('properties') as
        { get?: (key: string) => unknown; nodeId?: unknown } | undefined;
      const nodeId = properties?.get?.('nodeId') ?? properties?.nodeId;
      if (typeof nodeId === 'string') ids.push(nodeId);
    }
    node.toDelta?.().forEach(({ insert }) => visit(insert));
    node.toArray?.().forEach(visit);
  };
  doc
    .get('root', XmlText)
    .toDelta()
    .forEach((operation: { insert?: unknown }) => visit(operation.insert));
  return ids;
};

const countDecodedMigrationStructs = (updates: Uint8Array[]): number =>
  updates.reduce((count, update) => count + decodeUpdate(update).structs.length, 0);

const createSyncProvider = (): SyncProvider => {
  const listeners = new Map<string, Set<(value?: boolean) => void>>();
  const on = (type: string, listener: (value?: boolean) => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(listener);
    listeners.set(type, set);
  };
  const off = (type: string, listener: (value?: boolean) => void) =>
    listeners.get(type)?.delete(listener);
  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => new Map(),
      off,
      on,
      setLocalState: () => undefined,
      setLocalStateField: () => undefined,
    },
    connect: () => undefined,
    disconnect: () => undefined,
    emitSync: () => listeners.get('sync')?.forEach((listener) => listener(true)),
    off,
    on,
  } as unknown as SyncProvider;
};

const createBareBlockImageSnapshot = async (): Promise<{ json: unknown; snapshot: Uint8Array }> => {
  const legacyImage = {
    ...uploadedImage,
    $: { properties: { nodeId: 'legacy-block-image-node' } },
  };
  const legacy = new Kernel();
  legacy.registerPlugins([[CommonPlugin, { enableHotkey: false }], PropertiesPlugin]);
  legacy.registerNodes([BlockImageNode]);
  legacy.initHeadlessEditor();
  legacy.setDocument('json', documentWith(legacyImage, paragraph('保留段落')));
  await settle();
  const doc = new Doc();
  const provider = createSyncProvider();
  const binding = createBinding(
    legacy.getLexicalEditor()!,
    provider,
    'block-image-concurrent-migration',
    doc,
    new Map([['block-image-concurrent-migration', doc]]),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const snapshot = encodeStateAsUpdate(doc);
  const json = legacy.getLexicalEditor()!.getEditorState().toJSON();
  binding.root.destroy(binding);
  legacy.destroy();
  doc.destroy();
  return { json, snapshot };
};

const createMigratingPeer = (doc: Doc, provider: SyncProvider, legacyJson: unknown) => {
  const editor = Editor.createEditor().registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    PropertiesPlugin,
    MarkdownPlugin,
    ImagePlugin,
    [
      // The provider is intentionally disconnected from its peer during the
      // initial sync, so each client migrates the same old structs locally.
      YjsPlugin,
      {
        id: 'block-image-concurrent-migration',
        providerFactory: () => provider,
        yjsDoc: doc,
      },
    ],
  ]);
  editor.initHeadlessEditor();
  editor.setDocument('json', legacyJson);
  return editor;
};

const createNonAuthorityCollaborativeEditor = (
  doc: Doc,
  provider: SyncProvider,
  handleUpload?: (file: File) => Promise<{ url: string }>,
) =>
  Editor.createEditor().registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    PropertiesPlugin,
    MarkdownPlugin,
    [
      ImagePlugin,
      {
        handleUpload,
      },
    ],
    [
      YjsPlugin,
      {
        id: 'block-image-browser',
        providerFactory: () => provider,
        yjsDoc: doc,
      },
    ],
  ]);

describe('non-authority BlockImage collaboration boundaries', () => {
  it('replaces a pre-collaboration local Hole with the existing bare room without publishing it', async () => {
    const editor = Editor.createEditor().registerPlugins([
      [CommonPlugin, { enableHotkey: false }],
      PropertiesPlugin,
      ImagePlugin,
    ]);
    editor.initHeadlessEditor();
    editor.setDocument('json', documentWith({ ...uploadedImage }));
    await settle();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect($nodesOfType(BlockImageNode)).toHaveLength(1);
      });

    const { snapshot } = await createBareBlockImageSnapshot();
    const doc = new Doc();
    applyUpdate(doc, snapshot);
    const provider = createSyncProvider();
    editor.registerPlugin(YjsPlugin, {
      id: 'late-block-image-browser',
      providerFactory: () => provider,
      yjsDoc: doc,
    });
    provider.emitSync();
    await settle();
    await settle();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(0);
        expect($nodesOfType(BlockImageNode)).toHaveLength(1);
        expect($nodesOfType(BlockImageNode)[0]?.src).toBe(uploadedImage.src);
      });
    expect(readYjsRootTypes(doc)).toEqual(['block-image', 'paragraph']);
    editor.destroy();
    doc.destroy();
  });

  it('wraps a newly uploaded local image into one shared Hole', async () => {
    const doc = new Doc();
    const provider = createSyncProvider();
    const editor = createNonAuthorityCollaborativeEditor(doc, provider, async () => ({
      url: 'https://cdn.example.com/uploaded.png',
    }));
    editor.initHeadlessEditor();
    editor.setDocument('json', documentWith(paragraph('前文')));
    provider.emitSync();
    await settle();
    const file = new File(['image'], '上传.png', { type: 'image/png' });
    expect(
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        block: true,
        file,
      }),
    ).toBe(true);
    await settle();
    await settle();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        expect($nodesOfType(BlockImageNode)).toHaveLength(1);
        expect($nodesOfType(BlockImageNode)[0]?.src).toBe('https://cdn.example.com/uploaded.png');
      });
    expect(readYjsRootTypes(doc)).toContain('hole');
    editor.destroy();
    doc.destroy();
  });
});

describe('authoritative BlockImage Hole migration', () => {
  it('updates the existing Yjs room once and is idempotent without JSON replacement', async () => {
    const { snapshot } = await createBareBlockImageSnapshot();
    const doc = new Doc();
    applyUpdate(doc, snapshot);
    expect(readYjsRootTypes(doc)).toEqual(['block-image', 'paragraph']);
    expect(doc.get('root', XmlText).toString()).toContain('保留段落');
    const imageNodeIdsBefore = readYjsBlockImageNodeIds(doc);
    expect(imageNodeIdsBefore).toEqual(['legacy-block-image-node']);

    const first = await migrateLegacyBlockImagesInYjsDoc({
      doc,
      roomId: 'block-image-authority-migration',
    });
    expect(first.changed).toBe(true);
    expect(decodeUpdate(first.update).structs.length).toBeGreaterThan(0);
    expect(readYjsRootTypes(doc)).toEqual(['block-image', 'paragraph']);
    applyUpdate(doc, first.update, 'block-image-authority');
    expect(readYjsRootTypes(doc)).toEqual(['hole', 'paragraph']);
    expect(doc.get('root', XmlText).toString()).toContain('保留段落');
    expect(readYjsBlockImageNodeIds(doc)).toEqual(imageNodeIdsBefore);

    const second = await migrateLegacyBlockImagesInYjsDoc({
      doc,
      roomId: 'block-image-authority-migration',
    });
    expect(second.changed).toBe(false);
    expect(decodeUpdate(second.update).structs).toHaveLength(0);
    expect(readYjsRootTypes(doc)).toEqual(['hole', 'paragraph']);
    doc.destroy();
  });
});

describe('room-authoritative BlockImage Hole migration from one bare Yjs snapshot', () => {
  it('keeps disconnected browser peers passive until one authority delta is applied', async () => {
    const { json, snapshot } = await createBareBlockImageSnapshot();
    const docA = new Doc();
    const docB = new Doc();
    applyUpdate(docA, snapshot);
    applyUpdate(docB, snapshot);
    const providerA = createSyncProvider();
    const providerB = createSyncProvider();
    const updatesA: Uint8Array[] = [];
    const updatesB: Uint8Array[] = [];
    const updateListenerA = (update: Uint8Array) => updatesA.push(update);
    const updateListenerB = (update: Uint8Array) => updatesB.push(update);
    docA.on('update', updateListenerA);
    docB.on('update', updateListenerB);

    const kernelA = createMigratingPeer(docA, providerA, json);
    const kernelB = createMigratingPeer(docB, providerB, json);
    providerA.emitSync();
    providerB.emitSync();
    await settle();
    await settle();

    const oldDoc = new Doc();
    applyUpdate(oldDoc, snapshot);
    expect(readYjsRootTypes(oldDoc)).toEqual(['block-image', 'paragraph']);
    oldDoc.destroy();

    const migrationUpdatesA = updatesA.splice(0);
    const migrationUpdatesB = updatesB.splice(0);
    expect(migrationUpdatesA).toHaveLength(0);
    expect(migrationUpdatesB).toHaveLength(0);
    expect(countDecodedMigrationStructs(migrationUpdatesA)).toBe(0);
    expect(countDecodedMigrationStructs(migrationUpdatesB)).toBe(0);
    expect(readYjsRootTypes(docA)).toEqual(['block-image', 'paragraph']);
    expect(readYjsRootTypes(docB)).toEqual(['block-image', 'paragraph']);
    docA.off('update', updateListenerA);
    docB.off('update', updateListenerB);
    docA.on('update', (update, origin) => {
      if (origin !== providerB) applyUpdate(docB, update, providerA);
    });
    docB.on('update', (update, origin) => {
      if (origin !== providerA) applyUpdate(docA, update, providerB);
    });
    const authority = await migrateLegacyBlockImagesInYjsDoc({
      doc: docA,
      roomId: 'block-image-concurrent-migration',
    });
    expect(authority.changed).toBe(true);
    expect(decodeUpdate(authority.update).structs.length).toBeGreaterThan(0);
    expect(readYjsRootTypes(docA)).toEqual(['block-image', 'paragraph']);
    applyUpdate(docA, authority.update, 'block-image-room-authority');
    await settle();
    await settle();

    const projection = (kernel: ReturnType<typeof Editor.createEditor>) =>
      kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => ({
          blockImages: $nodesOfType(BlockImageNode).length,
          holes: $nodesOfType(HoleNode).length,
          imageId: $getNodeId($nodesOfType(BlockImageNode)[0]) ?? null,
          imageSrc: $nodesOfType(BlockImageNode)[0]?.src ?? null,
          rootText: $getRoot().getTextContent(),
          trailingParagraphsPreserved: $getRoot()
            .getChildren()
            .slice(1)
            .some((node) => node.getType() === 'paragraph' && node.getTextContent() === '保留段落'),
          rootTypes: rootTypes(),
        }));
    const projectionA = projection(kernelA);
    const projectionB = projection(kernelB);
    expect(projectionA).toEqual(projectionB);
    expect(projectionA.blockImages).toBe(1);
    expect(projectionA.holes).toBe(1);
    expect(projectionA.imageId).toBeTruthy();
    expect(projectionA.imageSrc).toBe(uploadedImage.src);
    expect(projectionA.rootText).toContain('保留段落');
    expect(projectionA.trailingParagraphsPreserved).toBe(true);
    expect(projectionA.rootTypes[0]).toBe('hole');
    expect(projectionA.rootTypes.slice(1).every((type) => type === 'paragraph')).toBe(true);

    const stateA = encodeStateAsUpdate(docA);
    const stateB = encodeStateAsUpdate(docB);
    providerA.emitSync();
    providerB.emitSync();
    await settle();
    expect(encodeStateAsUpdate(docA)).toEqual(stateA);
    expect(encodeStateAsUpdate(docB)).toEqual(stateB);

    const changedSrc = 'https://cdn.example.com/converged.png';
    kernelA.getLexicalEditor()!.update(
      () => {
        const image = $nodesOfType(BlockImageNode)[0];
        if (!image) throw new Error('Block image missing after migration');
        image.setUploaded(changedSrc);
      },
      { discrete: true },
    );
    await settle();
    await settle();
    expect(
      kernelA
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $nodesOfType(BlockImageNode)[0]?.src),
    ).toBe(changedSrc);
    expect(
      kernelB
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $nodesOfType(BlockImageNode)[0]?.src),
    ).toBe(changedSrc);

    kernelA.destroy();
    kernelB.destroy();
    docA.destroy();
    docB.destroy();
  });
});
