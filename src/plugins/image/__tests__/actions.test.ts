import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { $createBlockImageNode } from '../node/block-image-node';
import { $createImageNode } from '../node/image-node';
import { ImagePlugin } from '../plugin';
import { $deleteImageByKey, $getImageClipboardData } from '../utils/actions';

const SRC = 'https://example.com/cat.png';

function createKeyboardEventMock() {
  return {
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
    target: null,
  } as unknown as KeyboardEvent;
}

function setup(inline = false) {
  const editor = Editor.createEditor().registerPlugins([MarkdownPlugin, CommonPlugin, ImagePlugin]);
  editor.initNodeEditor();
  const lexicalEditor = editor.getLexicalEditor() as LexicalEditor;

  let imageKey = '' as NodeKey;
  lexicalEditor.update(
    () => {
      const before = $createParagraphNode().append($createTextNode('before'));
      const after = $createParagraphNode().append($createTextNode('after'));
      const props = { altText: 'cat', src: SRC, status: 'uploaded' as const };
      if (inline) {
        const image = $createImageNode(props);
        imageKey = image.getKey();
        before.append(image);
        $getRoot().clear().append(before, after);
      } else {
        const image = $createBlockImageNode(props);
        imageKey = image.getKey();
        $getRoot().clear().append(before, image, after);
      }
    },
    { discrete: true },
  );

  const selectImage = () =>
    lexicalEditor.update(
      () => {
        const selection = $createNodeSelection();
        selection.add(imageKey);
        $setSelection(selection);
      },
      { discrete: true },
    );

  const types = () =>
    lexicalEditor.getEditorState().read(() =>
      $getRoot()
        .getChildren()
        .flatMap((child) =>
          'getChildren' in child
            ? [child.getType(), ...(child as any).getChildren().map((n: any) => n.getType())]
            : [child.getType()],
        ),
    );

  return { imageKey, lexicalEditor, selectImage, types };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('image selection actions', () => {
  it.each([
    { inline: false, name: 'block image' },
    { inline: true, name: 'inline image' },
  ])('deletes a selected $name on Enter', async ({ inline }) => {
    const { lexicalEditor, selectImage, types } = setup(inline);
    const imageType = inline ? 'image' : 'block-image';
    expect(types()).toContain(imageType);

    selectImage();
    const event = createKeyboardEventMock();
    let handled = false;
    lexicalEditor.update(
      () => {
        handled = lexicalEditor.dispatchCommand(KEY_ENTER_COMMAND, event);
      },
      { discrete: true },
    );
    await flush();

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(types()).not.toContain(imageType);
  });

  it('keeps Backspace deleting a selected image', async () => {
    const { lexicalEditor, selectImage, types } = setup();

    selectImage();
    lexicalEditor.update(
      () => {
        lexicalEditor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEventMock());
      },
      { discrete: true },
    );
    await flush();

    expect(types()).not.toContain('block-image');
  });

  it('does not delete the image when Enter is pressed in a text selection', async () => {
    const { lexicalEditor, types } = setup();

    lexicalEditor.update(
      () => {
        const first = $getRoot().getFirstChildOrThrow<any>();
        first.selectEnd();
        lexicalEditor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEventMock());
      },
      { discrete: true },
    );
    await flush();

    expect(types()).toContain('block-image');
    // Enter in text still splits the paragraph as before.
    expect(types().filter((type) => type === 'paragraph').length).toBeGreaterThan(2);
  });

  it('$deleteImageByKey removes only the image', () => {
    const { imageKey, lexicalEditor, types } = setup();

    let removed = false;
    lexicalEditor.update(
      () => {
        removed = $deleteImageByKey(imageKey);
      },
      { discrete: true },
    );

    expect(removed).toBe(true);
    expect(types()).not.toContain('block-image');
    expect(types().filter((type) => type === 'paragraph')).toHaveLength(2);
  });

  it('$getImageClipboardData returns lexical, html and text payloads for the image', () => {
    const { imageKey, lexicalEditor } = setup();

    const data = lexicalEditor.getEditorState().read(() => $getImageClipboardData(imageKey), {
      editor: lexicalEditor,
    });

    expect(data).not.toBeNull();
    const lexical = JSON.parse(data!['application/x-lexical-editor']!);
    expect(lexical.nodes).toHaveLength(1);
    expect(lexical.nodes[0]).toMatchObject({ src: SRC, type: 'block-image' });
  });
});
