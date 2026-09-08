import {
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $nodesOfType,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { APPLY_BLOCK_REWRITE_COMMAND } from '@/plugins/block/command';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { IBlockRewriteAdapterService } from '@/plugins/block/service/rewrite-adapter';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { $getNodeId } from '@/plugins/properties/utils';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_BLOCK_IMAGE_COMMAND } from '../command';
import { $isBlockImageNode, BlockImageNode } from '../node/block-image-node';
import { $isImageNode, ImageNode } from '../node/image-node';
import { ImagePlugin } from '../plugin';

const blockImage = {
  altText: '原图',
  height: 90,
  maxWidth: 600,
  src: 'https://cdn.example.com/original.png',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  width: 160,
};

const inlineImage = {
  altText: 'inline',
  height: 20,
  maxWidth: 200,
  src: 'https://cdn.example.com/inline.png',
  type: 'image',
  version: 1,
  width: 40,
};

describe('BlockImageNode and rewrite adapter', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      BlockRewritePlugin,
      PropertiesPlugin,
      MarkdownPlugin,
      ImagePlugin,
    ]);
    editor.initHeadlessEditor();
  });

  afterEach(() => editor?.destroy());

  const setJson = async (children: unknown[]) => {
    editor.setDocument('json', {
      root: { children, direction: null, format: '', indent: 0, type: 'root', version: 1 },
    });
    await moment();
    await moment();
    await moment();
  };

  const readImage = () =>
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) {
          throw new Error(
            `Hole missing: ${$getRoot()
              .getChildren()
              .map((node) => node.getType())
              .join(',')}`,
          );
        }
        const image = hole?.getContentChildren()[0];
        if (!$isBlockImageNode(image)) throw new Error('Block image Hole missing');
        return image;
      });

  it('wraps legacy block-image JSON in one Hole and preserves its image fields', async () => {
    await setJson([{ ...blockImage }]);

    const image = readImage();
    expect(image.src).toBe(blockImage.src);
    expect(image.altText).toBe(blockImage.altText);
    expect(image.width).toBe(blockImage.width);
    expect(image.height).toBe(blockImage.height);
    expect(JSON.stringify(editor.getDocument('json'))).toContain('"type":"block-image"');
  });

  it('keeps inline ImageNode outside the atomic BlockImage Hole contract', async () => {
    await setJson([{ ...inlineImage }]);

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(ImageNode)).toHaveLength(1);
        expect($nodesOfType(BlockImageNode)).toHaveLength(0);
        expect($nodesOfType(HoleNode)).toHaveLength(0);
      });
  });

  it('splits a legacy mixed paragraph around a block image without losing text order', async () => {
    await setJson([
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '前文',
            type: 'text',
            version: 1,
          },
          { ...blockImage },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '后文',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ]);

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const children = $getRoot().getChildren();
        expect(children.map((node) => node.getType())).toEqual(['paragraph', 'hole', 'paragraph']);
        expect(children[0]?.getTextContent()).toBe('前文');
        expect(children[2]?.getTextContent()).toBe('后文');
        expect($nodesOfType(BlockImageNode)).toHaveLength(1);
      });
    expect(editor.getDocument('markdown')).toContain('前文');
    expect(editor.getDocument('markdown')).toContain('![原图]');
    expect(editor.getDocument('markdown')).toContain('后文');
  });

  it('inserts a loading block-image placeholder with a stable target and selects it', async () => {
    await setJson([
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
    ]);
    const onInserted = vi.fn();
    expect(
      editor.dispatchCommand(INSERT_BLOCK_IMAGE_COMMAND, {
        altText: '生成图片',
        onInserted,
      }),
    ).toBe(true);
    await moment();
    await moment();

    const image = readImage();
    const nodeId = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const id = $getNodeId(image);
        if (!id) throw new Error('Block image node id missing');
        return id;
      });
    expect(nodeId).toBeTruthy();
    expect(onInserted).toHaveBeenCalledWith(nodeId);
    expect(image.status).toBe('loading');
    expect(image.src).toBe('');
    const adapter = editor
      .requireService(IBlockRewriteAdapterService)
      ?.getAdapterByKey('block-image');
    const context = adapter
      ? editor
          .getLexicalEditor()!
          .getEditorState()
          .read(() => adapter.readContext(image))
      : null;
    expect(context?.image).toMatchObject({ placeholder: true, status: 'loading', src: '' });
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        expectedSourceHash: context?.sourceHash,
        nodeId,
        output: {
          kind: 'patch',
          patch: { altText: '已生成', src: 'https://cdn.example.com/generated.png' },
        },
      }),
    ).toBe(true);
    await moment();
    expect(readImage()).toMatchObject({
      altText: '已生成',
      src: 'https://cdn.example.com/generated.png',
      status: 'uploaded',
    });
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($isNodeSelection($getSelection())).toBe(true);
      });
  });

  it('applies a stored-image patch atomically and supports Undo/Redo', async () => {
    await setJson([{ ...blockImage }]);
    const image = readImage();
    const nodeId = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const id = $getNodeId(image);
        if (!id) throw new Error('Block image node id missing');
        return id;
      });
    const adapter = editor
      .requireService(IBlockRewriteAdapterService)
      ?.getAdapterByKey('block-image');
    const sourceHash = adapter
      ? editor
          .getLexicalEditor()!
          .getEditorState()
          .read(() => adapter.readContext(image)?.sourceHash)
      : undefined;

    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        expectedSourceHash: sourceHash,
        generationId: 'generation-image',
        nodeId,
        output: {
          kind: 'patch',
          patch: {
            altText: '更新后的图片',
            height: 180,
            maxWidth: 720,
            src: 'https://cdn.example.com/replaced.png',
            width: 320,
          },
        },
        requestId: 'request-image',
      }),
    ).toBe(true);
    await moment();

    expect(readImage()).toMatchObject({
      altText: '更新后的图片',
      height: 180,
      maxWidth: 720,
      src: 'https://cdn.example.com/replaced.png',
      width: 320,
    });
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await moment();
    expect(readImage()).toMatchObject({ altText: '原图', src: blockImage.src, width: 160 });
    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await moment();
    expect(readImage()).toMatchObject({
      altText: '更新后的图片',
      src: 'https://cdn.example.com/replaced.png',
    });
  });

  it('rejects stale, invalid, and unfinished patches without changing the original image', async () => {
    await setJson([{ ...blockImage }]);
    const image = readImage();
    const nodeId = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const id = $getNodeId(image);
        if (!id) throw new Error('Block image node id missing');
        return id;
      });
    const original = { src: image.src, altText: image.altText, width: image.width };

    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        expectedSourceHash: 'stale-hash',
        nodeId,
        output: { kind: 'patch', patch: { src: 'javascript:alert(1)' } },
      }),
    ).toBe(false);
    expect(readImage()).toMatchObject(original);

    for (const src of [
      'javascript:alert(1)',
      'data:image/png;base64,AA==',
      '//evil.test/a.png',
      '/\\evil.test/a.png',
      'http://',
    ]) {
      expect(
        editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
          adapterKey: 'block-image',
          nodeId,
          output: { kind: 'patch', patch: { src } },
        }),
      ).toBe(false);
    }
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        nodeId,
        output: { kind: 'patch', patch: { status: 'uploaded' } },
      }),
    ).toBe(false);
    expect(readImage()).toMatchObject(original);

    await setJson([
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
    ]);
    editor.dispatchCommand(INSERT_BLOCK_IMAGE_COMMAND, { altText: '待生成' });
    await moment();
    const placeholder = readImage();
    const placeholderId = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const id = $getNodeId(placeholder);
        if (!id) throw new Error('Placeholder node id missing');
        return id;
      });
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        nodeId: placeholderId,
        output: { kind: 'patch', patch: { altText: '无 URL' } },
      }),
    ).toBe(false);
    expect(readImage().src).toBe('');

    editor.getLexicalEditor()!.update(() => {
      $nodesOfType(BlockImageNode)[0]?.setError('generation failed');
    });
    await moment();
    const erroredPlaceholder = readImage();
    const adapter = editor
      .requireService(IBlockRewriteAdapterService)
      ?.getAdapterByKey('block-image');
    const erroredContext = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => adapter?.readContext(erroredPlaceholder));
    expect(erroredContext?.image).toMatchObject({ placeholder: true, status: 'error', src: '' });
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'block-image',
        expectedSourceHash: erroredContext?.sourceHash,
        nodeId: placeholderId,
        output: { kind: 'patch', patch: { src: 'https://cdn.example.com/retry.png' } },
      }),
    ).toBe(true);
    await moment();
    expect(readImage()).toMatchObject({
      src: 'https://cdn.example.com/retry.png',
      status: 'uploaded',
    });
  });
});
