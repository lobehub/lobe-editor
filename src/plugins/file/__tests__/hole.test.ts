import {
  $createRangeSelection,
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  COPY_COMMAND,
  KEY_BACKSPACE_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { CodeNode } from '@lexical/code-core';
import { TableNode } from '@lexical/table';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { CodeblockPlugin } from '@/plugins/codeblock/plugin';
import { LinkPlugin } from '@/plugins/link/plugin';
import { MathPlugin } from '@/plugins/math';
import { MathBlockNode } from '@/plugins/math/node';
import { TablePlugin } from '@/plugins/table/plugin';

import { INSERT_FILE_COMMAND } from '../command';
import { $createBlockFileNode, BlockFileNode } from '../node/BlockFileNode';
import { FileNode } from '../node/FileNode';
import { FilePlugin } from '../plugin';

const documentWith = (type: string) => ({
  root: {
    children: [
      {
        fileUrl: 'https://example.test/report.pdf',
        name: 'report.pdf',
        status: 'uploaded',
        type,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

const selectAfterBoundary = async (lexical: LexicalEditor): Promise<void> => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!cursor) throw new Error('Block file Hole boundary missing');
      cursor.selectStart();
    },
    { discrete: true },
  );
  await moment();
};

class MockClipboardEvent extends Event {
  constructor(
    type: string,
    readonly clipboardData: DataTransfer,
  ) {
    super(type, { bubbles: true, cancelable: true });
  }
}

const createClipboard = () => {
  const values = new Map<string, string>();
  const clipboardData = {
    clearData: (type?: string) => {
      if (type) values.delete(type);
      else values.clear();
    },
    files: [],
    getData: (type: string) => values.get(type) || '',
    setData: (type: string, value: string) => values.set(type, value),
    get types() {
      return [...values.keys()];
    },
  } as unknown as DataTransfer;
  return { clipboardData, values };
};

describe('BlockFileNode Hole integration', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    vi.unstubAllGlobals();
  });

  it('round-trips a marked block-file DOM node without consuming unrelated block data', () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin, FilePlugin]);
    kernel.initHeadlessEditor();
    let node!: BlockFileNode;
    kernel.getLexicalEditor()!.update(() => {
      node = $createBlockFileNode(
        'report.pdf',
        'https://example.test/report.pdf',
        42,
        'uploaded',
        'ready',
      );
    });
    const exported = node.exportDOM().element as HTMLElement;
    expect(exported.dataset.blockFile).toBe('true');
    expect(exported.dataset.fileName).toBe('report.pdf');
    expect(exported.dataset.fileUrl).toBe('https://example.test/report.pdf');
    expect(exported.dataset.fileSize).toBe('42');
    expect(exported.dataset.fileStatus).toBe('uploaded');
    expect(exported.dataset.fileMessage).toBe('ready');

    const importer = BlockFileNode.importDOM()?.div;
    if (typeof importer !== 'function') throw new Error('Block file DOM importer missing');
    let imported: ReturnType<typeof $createBlockFileNode> | undefined;
    kernel.getLexicalEditor()!.update(() => {
      const conversion = importer(exported);
      const converted = conversion?.conversion(exported);
      imported = converted?.node instanceof BlockFileNode ? converted.node : undefined;
    });
    expect(imported).toBeInstanceOf(BlockFileNode);
    if (imported instanceof BlockFileNode) {
      expect(imported.name).toBe('report.pdf');
      expect(imported.fileUrl).toBe('https://example.test/report.pdf');
      expect(imported.size).toBe(42);
      expect(imported.status).toBe('uploaded');
      expect(imported.message).toBe('ready');
    }

    const unrelated = document.createElement('div');
    unrelated.dataset.block = 'true';
    expect(importer(unrelated)).toBeNull();
    kernel.destroy();
  });

  it('updates block-file DOM attributes as upload state changes', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      [FilePlugin, { decorator: () => null }],
    ]);
    editor.initNodeEditor();
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('json', {
      root: {
        children: [
          {
            name: 'pending.txt',
            status: 'pending',
            type: BlockFileNode.getType(),
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const fileKey = lexical.getEditorState().read(() => $nodesOfType(BlockFileNode)[0]!.getKey());
    const host = () => lexical.getElementByKey(fileKey)!;
    expect(host().dataset.fileStatus).toBe('pending');
    expect(host().dataset.fileUrl).toBeUndefined();

    lexical.update(() => {
      $nodesOfType(BlockFileNode)[0]!.setUploaded('https://example.test/pending.txt');
    });
    await moment();
    expect(host().dataset.fileStatus).toBe('uploaded');
    expect(host().dataset.fileUrl).toBe('https://example.test/pending.txt');

    lexical.update(() => {
      const file = $nodesOfType(BlockFileNode)[0]!;
      const writable = file.getWritable();
      writable.__fileUrl = undefined;
      writable.__size = undefined;
      writable.__status = 'error';
      writable.__message = 'failed';
    });
    await moment();
    expect(host().dataset.fileStatus).toBe('error');
    expect(host().dataset.fileUrl).toBeUndefined();
    expect(host().dataset.fileSize).toBeUndefined();
    expect(host().dataset.fileMessage).toBe('failed');
    root.remove();
  });

  it('separates block-file Markdown before later math, table, code, and END blocks', async () => {
    const source = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      FilePlugin,
      MathPlugin,
    ]);
    source.initHeadlessEditor();
    source.setDocument('json', {
      root: {
        children: [
          {
            fileUrl: 'https://example.test/fixture.txt',
            name: 'fixture.txt',
            status: 'uploaded',
            type: BlockFileNode.getType(),
            version: 1,
          },
          {
            code: '\\frac{1}{2}',
            type: MathBlockNode.getType(),
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    });
    await moment();

    const prefix = source.getDocument('markdown') as unknown as string;
    expect(prefix).toContain('[fixture.txt](https://example.test/fixture.txt)\n\n$$');

    const roundtrip = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      CodeblockPlugin,
      [FilePlugin, { decorator: () => null }],
      LinkPlugin,
      MathPlugin,
      TablePlugin,
    ]);
    roundtrip.initHeadlessEditor();
    const laterBlocks = [
      '[Example block card](https://example.com/card)',
      '',
      '| T11 | T12 |',
      '| :-- | :-- |',
      '| T21 | T22 |',
      '',
      '```javascript',
      'const end = true;',
      '```',
      '',
      'END',
    ].join('\n');
    roundtrip.setDocument('markdown', `${prefix}${laterBlocks}`);
    await moment();

    const lexical = roundtrip.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      expect($nodesOfType(MathBlockNode)).toHaveLength(1);
      expect($nodesOfType(TableNode)).toHaveLength(1);
      expect($nodesOfType(CodeNode)).toHaveLength(1);
    });
    expect(roundtrip.getDocument('markdown')).toContain('END');
    source.destroy();
    roundtrip.destroy();
  });

  it('wraps block files while leaving legacy inline files untouched', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, FilePlugin]);
    editor.initHeadlessEditor();

    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(1);
      expect(holes[0]?.getContentChildren()[0]).toBeInstanceOf(BlockFileNode);
      expect(holes[0]?.getContentChildren()[0]?.isInline()).toBe(false);
    });

    const projectedJSON = JSON.stringify(editor.getDocument('json'));
    expect(projectedJSON).toContain('block-file');
    expect(projectedJSON).not.toContain('"type":"hole"');

    editor.setDocument('json', documentWith(FileNode.getType()));
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect($nodesOfType(FileNode)).toHaveLength(1);
    });
  });

  it('removes the complete block-file Hole shell from its boundary', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, FilePlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    await selectAfterBoundary(lexical);
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
    expect(lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, event)).toBe(true);
    await moment();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(['paragraph']);
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });
  });

  it('inserts a block file beside a Hole boundary', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      [FilePlugin, { handleUpload: async () => ({ url: 'https://example.test/new.txt' }) }],
    ]);
    editor.initHeadlessEditor();
    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    await selectAfterBoundary(lexical);
    lexical.dispatchCommand(INSERT_FILE_COMMAND, {
      block: true,
      file: new File(['new file'], 'new.txt', { type: 'text/plain' }),
    });
    await moment();

    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(2);
      expect(holes.every((hole) => hole.getContentChildren()[0] instanceof BlockFileNode)).toBe(
        true,
      );
    });
  });

  it('copies the block-file name and marks a Hole-selected block file', async () => {
    Object.defineProperty(MockClipboardEvent, 'name', { value: 'ClipboardEvent' });
    vi.stubGlobal('ClipboardEvent', MockClipboardEvent);
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      [FilePlugin, { decorator: () => null }],
    ]);
    editor.initNodeEditor();
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let fileKey = '';
    lexical.update(() => {
      const file = $nodesOfType(BlockFileNode)[0];
      const hole = $nodesOfType(HoleNode)[0];
      if (!file || !hole) throw new Error('Block file Hole missing');
      fileKey = file.getKey();
      const selection = $createNodeSelection();
      selection.add(hole.getKey());
      $setSelection(selection);
    });
    await moment();

    expect(lexical.getElementByKey(fileKey)?.classList.contains('selected')).toBe(true);

    const clipboard = createClipboard();
    expect(
      lexical.dispatchCommand(
        COPY_COMMAND,
        new MockClipboardEvent('copy', clipboard.clipboardData),
      ),
    ).toBe(true);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(clipboard.values.get('text/plain')).toBe('report.pdf');
    root.remove();
  });

  it('marks a block file when a range covers both Hole boundaries', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      MarkdownPlugin,
      [FilePlugin, { decorator: () => null }],
    ]);
    editor.initNodeEditor();
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let fileKey = '';
    lexical.update(() => {
      const file = $nodesOfType(BlockFileNode)[0];
      const hole = $nodesOfType(HoleNode)[0];
      if (!file || !hole) throw new Error('Block file Hole missing');
      const before = hole.getBeforeCursor();
      const after = hole.getAfterCursor();
      if (!before || !after) throw new Error('Hole boundary cursors missing');
      fileKey = file.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(before.getKey(), before.getTextContentSize(), 'text');
      selection.focus.set(after.getKey(), 0, 'text');
      $setSelection(selection);
    });
    await moment();

    expect(lexical.getElementByKey(fileKey)?.classList.contains('selected')).toBe(true);
    root.remove();
  });

  it('subscribes to Hole selection when FilePlugin initializes before CommonPlugin', async () => {
    editor = Editor.createEditor().registerPlugins([
      [FilePlugin, { decorator: () => null }],
      CommonPlugin,
      MarkdownPlugin,
    ]);
    editor.initNodeEditor();
    const root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    editor.setRootElement(root);
    editor.setDocument('json', documentWith(BlockFileNode.getType()));
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let fileKey = '';
    lexical.update(() => {
      const file = $nodesOfType(BlockFileNode)[0];
      const hole = $nodesOfType(HoleNode)[0];
      if (!file || !hole) throw new Error('Block file Hole missing');
      const before = hole.getBeforeCursor();
      const after = hole.getAfterCursor();
      if (!before || !after) throw new Error('Hole boundary cursors missing');
      fileKey = file.getKey();
      const selection = $createRangeSelection();
      selection.anchor.set(before.getKey(), before.getTextContentSize(), 'text');
      selection.focus.set(after.getKey(), 0, 'text');
      $setSelection(selection);
    });
    await moment();

    expect(lexical.getElementByKey(fileKey)?.classList.contains('selected')).toBe(true);
    root.remove();
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores a deferred %s upload after its block file Hole is deleted',
    async (settlement) => {
      let resolveUpload!: (value: { url: string }) => void;
      let rejectUpload!: (error: Error) => void;
      const pendingUpload = new Promise<{ url: string }>((resolve, reject) => {
        resolveUpload = resolve;
        rejectUpload = reject;
      });
      editor = Editor.createEditor().registerPlugins([
        CommonPlugin,
        MarkdownPlugin,
        [FilePlugin, { handleUpload: async () => pendingUpload }],
      ]);
      editor.initHeadlessEditor();
      editor.setDocument('markdown', 'before');
      await moment();

      const lexical = editor.getLexicalEditor()!;
      lexical.dispatchCommand(INSERT_FILE_COMMAND, {
        block: true,
        file: new File(['pending'], 'pending.txt', { type: 'text/plain' }),
      });
      await moment();

      lexical.update(() => {
        const hole = $nodesOfType(HoleNode).find((candidate) =>
          candidate.getContentChildren().some((node) => node instanceof BlockFileNode),
        );
        if (!hole) throw new Error('Pending block file Hole missing');
        hole.getAfterCursor()?.selectStart();
      });
      await moment();
      const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
      expect(lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, event)).toBe(true);
      await moment();

      if (settlement === 'resolve') resolveUpload({ url: 'https://example.test/pending.txt' });
      else rejectUpload(new Error('upload failed'));
      await Promise.resolve();
      await moment();

      lexical.getEditorState().read(() => {
        expect($nodesOfType(BlockFileNode)).toHaveLength(0);
        expect($nodesOfType(HoleNode)).toHaveLength(0);
      });
    },
  );
});
