import { $createQuoteNode } from '@lexical/rich-text';
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $nodesOfType,
  $setSelection,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { CommonPlugin } from '@/plugins/common';
import { $createHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { $createBlockImageNode, BlockImageNode } from '@/plugins/image/node/block-image-node';
import { ImageNode } from '@/plugins/image/node/image-node';
import { $setNodeProperties } from '@/plugins/properties';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import type { IEditor, IEditorKernel } from '@/types';

class MockClipboardEvent extends Event {
  constructor(
    type: string,
    readonly clipboardData: DataTransfer | null,
  ) {
    super(type, { bubbles: true, cancelable: true });
  }
}

class MockDragEvent extends Event {}

const createClipboard = (
  initial?: ReadonlyMap<string, string>,
  onSetData?: (type: string, value: string) => void,
) => {
  const values = new Map(initial);
  const clipboardData = {
    clearData: (type?: string) => {
      if (type) values.delete(type);
      else values.clear();
    },
    files: [],
    getData: (type: string) => values.get(type) || '',
    setData: (type: string, value: string) => {
      values.set(type, value);
      onSetData?.(type, value);
    },
    get types() {
      return [...values.keys()];
    },
  } as unknown as DataTransfer;
  return { clipboardData, values };
};

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createEditor = (): {
  editor: IEditor;
  lexical: ReturnType<IEditor['getLexicalEditor']>;
  root: HTMLDivElement;
} => {
  const editor = Editor.createEditor() as IEditorKernel;
  editor.registerPlugins([CommonPlugin, PropertiesPlugin]);
  editor.registerNodes([ArtifactNode, BlockImageNode, ImageNode]);
  editor.initNodeEditor();
  const root = document.createElement('div');
  root.contentEditable = 'true';
  document.body.append(root);
  const lexical = editor.setRootElement(root);
  return { editor, lexical, root };
};

const createMixedHoleDocument = (lexical: NonNullable<ReturnType<IEditor['getLexicalEditor']>>) => {
  const keys: {
    after: string;
    artifactHole: string;
    artifact: string;
    before: string;
    imageHole: string;
    image: string;
  } = {
    after: '',
    artifact: '',
    artifactHole: '',
    before: '',
    image: '',
    imageHole: '',
  };
  lexical.update(
    () => {
      const before = $createParagraphNode().append($createTextNode('before'));
      const artifact = $createArtifactNode('<main>artifact</main>', 'Clipboard artifact');
      const artifactHole = $createHoleNode(artifact);
      const image = $createBlockImageNode({
        altText: 'Clipboard image',
        maxWidth: 640,
        src: 'https://example.com/image.png',
        width: 320,
      });
      const imageHole = $createHoleNode(image);
      const after = $createParagraphNode().append($createTextNode('after'));
      $setNodeProperties(artifact, { nodeId: 'artifact-business-id' });
      $setNodeProperties(image, { nodeId: 'image-business-id' });
      keys.artifact = artifact.getKey();
      keys.artifactHole = artifactHole.getKey();
      keys.before = before.getKey();
      keys.after = after.getKey();
      keys.image = image.getKey();
      keys.imageHole = imageHole.getKey();
      $getRoot().append(before, artifactHole, imageHole, after);
    },
    { discrete: true },
  );
  return keys;
};

const selectNodes = (
  lexical: NonNullable<ReturnType<IEditor['getLexicalEditor']>>,
  keys: readonly string[],
) => {
  lexical.update(
    () => {
      const selection = $createNodeSelection();
      keys.forEach((key) => selection.add(key));
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const selectHoleBoundary = (
  lexical: NonNullable<ReturnType<IEditor['getLexicalEditor']>>,
  side: 'before' | 'after',
): void => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
      if (!cursor) throw new Error(`${side} Hole boundary is missing`);
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
};

describe('Hole clipboard', () => {
  let editor: IEditor;
  let lexical: NonNullable<ReturnType<IEditor['getLexicalEditor']>>;
  let root: HTMLDivElement;

  beforeEach(() => {
    Object.defineProperty(MockClipboardEvent, 'name', { value: 'ClipboardEvent' });
    Object.defineProperty(MockDragEvent, 'name', { value: 'DragEvent' });
    resetRandomKey();
    vi.stubGlobal('ClipboardEvent', MockClipboardEvent);
    vi.stubGlobal('DragEvent', MockDragEvent);
    const instance = createEditor();
    editor = instance.editor;
    lexical = instance.lexical!;
    root = instance.root;
  });

  afterEach(() => {
    editor.destroy();
    root.remove();
    vi.unstubAllGlobals();
  });

  it('copies a mixed Hole forest as content-only JSON and HTML without boundary markers', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    selectNodes(lexical, [keys.before, keys.artifact, keys.image, keys.after]);
    await moment();

    const clipboard = createClipboard();
    expect(
      lexical.dispatchCommand(
        COPY_COMMAND,
        new MockClipboardEvent('copy', clipboard.clipboardData),
      ),
    ).toBe(true);
    await flush();

    const payload = JSON.parse(clipboard.values.get('application/x-lexical-editor') || '{}');
    expect(payload.nodes.map((node: { type: string }) => node.type)).toEqual([
      'paragraph',
      'artifact',
      'block-image',
      'paragraph',
    ]);
    expect(JSON.stringify(payload)).not.toContain('"hole"');
    expect(JSON.stringify(payload)).not.toContain('\uFEFF');
    expect(clipboard.values.get('text/html')).toContain('<figure');
    expect(clipboard.values.get('text/html')).toContain('<img');
    expect(clipboard.values.get('text/html')).not.toContain('data-hole');
    expect(clipboard.values.get('text/html')).not.toContain('\uFEFF');
    expect(clipboard.values.get('text/plain')).toBe('before\nafter');
  });

  it.each(['before', 'after'] as const)(
    'pastes canonical content at the %s Hole boundary without a block Cursor error',
    async (side) => {
      const keys = createMixedHoleDocument(lexical);
      await moment();
      selectHoleBoundary(lexical, side);
      await moment();

      const errors: Error[] = [];
      (editor as unknown as { on: (type: string, listener: (error: Error) => void) => void }).on(
        'error',
        (error) => errors.push(error),
      );
      const clipboard = createClipboard(
        new Map([
          [
            'application/x-lexical-editor',
            JSON.stringify({
              namespace: lexical._config.namespace,
              nodes: [
                {
                  html: '<main>canonical paste</main>',
                  title: 'Canonical paste',
                  type: 'artifact',
                  version: 1,
                },
              ],
            }),
          ],
          ['text/plain', 'Canonical paste'],
        ]),
      );
      const event = new MockClipboardEvent('paste', clipboard.clipboardData);
      expect(lexical.dispatchCommand(PASTE_COMMAND, event)).toBe(true);
      await flush();

      lexical.getEditorState().read(() => {
        expect(errors).toEqual([]);
        expect($nodesOfType(ArtifactNode)).toHaveLength(2);
        expect($nodesOfType(HoleNode)).toHaveLength(2);
        expect($nodesOfType(ArtifactNode).map((node) => node.getTitle())).toContain(
          'Canonical paste',
        );
        expect($nodesOfType(ArtifactNode).some((node) => node.getKey() === keys.artifact)).toBe(
          true,
        );
      });
    },
  );

  it.each(['artifact', 'image'] as const)(
    'replaces a directly selected %s payload through the canonical paste path',
    async (targetType) => {
      const keys = createMixedHoleDocument(lexical);
      await moment();
      const targetKey = targetType === 'artifact' ? keys.artifact : keys.image;
      selectNodes(lexical, [targetKey]);
      await moment();

      const errors: Error[] = [];
      (editor as unknown as { on: (type: string, listener: (error: Error) => void) => void }).on(
        'error',
        (error) => errors.push(error),
      );
      const clipboard = createClipboard(
        new Map([
          [
            'application/x-lexical-editor',
            JSON.stringify({
              namespace: lexical._config.namespace,
              nodes:
                targetType === 'artifact'
                  ? [
                      {
                        html: '<main>replaced artifact</main>',
                        title: 'Replaced artifact',
                        type: 'artifact',
                        version: 1,
                      },
                    ]
                  : [
                      {
                        altText: 'Replaced image',
                        height: 120,
                        maxWidth: 640,
                        src: 'https://example.com/replaced.png',
                        status: 'uploaded',
                        type: 'block-image',
                        version: 1,
                        width: 320,
                      },
                    ],
            }),
          ],
          ['text/plain', `Replaced ${targetType}`],
        ]),
      );
      expect(
        lexical.dispatchCommand(
          PASTE_COMMAND,
          new MockClipboardEvent('paste', clipboard.clipboardData),
        ),
      ).toBe(true);
      await flush();

      lexical.getEditorState().read(() => {
        expect(errors).toEqual([]);
        expect($nodesOfType(HoleNode)).toHaveLength(1);
        if (targetType === 'artifact') {
          expect($nodesOfType(ArtifactNode)).toHaveLength(1);
          expect($nodesOfType(ArtifactNode)[0]?.getTitle()).toBe('Replaced artifact');
        } else {
          expect($nodesOfType(BlockImageNode)).toHaveLength(1);
          expect($nodesOfType(BlockImageNode)[0]?.src).toBe('https://example.com/replaced.png');
        }
      });
    },
  );

  it('copies a directly selected payload and expands an Element payload for standard export', async () => {
    let paragraphKey = '';
    lexical.update(
      () => {
        const paragraph = $createParagraphNode().append($createTextNode('element payload'));
        paragraphKey = paragraph.getKey();
        $getRoot().append($createHoleNode(paragraph));
      },
      { discrete: true },
    );
    await moment();
    selectNodes(lexical, [paragraphKey]);

    const clipboard = createClipboard();
    expect(
      lexical.dispatchCommand(
        COPY_COMMAND,
        new MockClipboardEvent('copy', clipboard.clipboardData),
      ),
    ).toBe(true);
    await flush();

    const payload = JSON.parse(clipboard.values.get('application/x-lexical-editor') || '{}');
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        children: [expect.objectContaining({ text: 'element payload' })],
        type: 'paragraph',
      }),
    ]);
    expect(clipboard.values.get('text/html')).toContain('element payload');
    expect(clipboard.values.get('text/html')).not.toContain('data-hole');
  });

  it('handles a programmatic null copy safely and never cuts on a failed copy', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    selectNodes(lexical, [keys.artifactHole]);

    expect(lexical.dispatchCommand(COPY_COMMAND, null)).toBe(true);
    await flush();
    expect(lexical.dispatchCommand(CUT_COMMAND, null)).toBe(true);
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($nodesOfType(ArtifactNode)).toHaveLength(1);
      expect($nodesOfType(BlockImageNode)).toHaveLength(1);
    });
  });

  it('requires every direct payload for a multi-payload Hole NodeSelection', async () => {
    const keys: string[] = [];
    lexical.update(
      () => {
        const first = $createParagraphNode().append($createTextNode('first payload'));
        const second = $createParagraphNode().append($createTextNode('second payload'));
        keys.push(first.getKey(), second.getKey());
        $getRoot().append($createHoleNode([first, second]));
      },
      { discrete: true },
    );
    await moment();
    selectNodes(lexical, keys);

    const clipboard = createClipboard();
    expect(
      lexical.dispatchCommand(
        COPY_COMMAND,
        new MockClipboardEvent('copy', clipboard.clipboardData),
      ),
    ).toBe(true);
    await flush();

    const payload = JSON.parse(clipboard.values.get('application/x-lexical-editor') || '{}');
    expect(payload.nodes.map((node: { type: string }) => node.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(clipboard.values.get('text/html')).toContain('first payload');
    expect(clipboard.values.get('text/html')).toContain('second payload');
  });

  it('keeps mixed selection order and removes only the captured Hole units after a successful cut', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    selectNodes(lexical, [keys.artifactHole, keys.imageHole]);
    const clipboard = createClipboard();
    expect(
      lexical.dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', clipboard.clipboardData)),
    ).toBe(true);
    await flush();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect($nodesOfType(ArtifactNode)).toHaveLength(0);
      expect($nodesOfType(BlockImageNode)).toHaveLength(0);
      expect($getRoot().getTextContent()).toContain('before');
      expect($getRoot().getTextContent()).toContain('after');
    });
  });

  it('does not delete content when the clipboard write fails', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    selectNodes(lexical, [keys.artifactHole]);
    expect(lexical.dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', null))).toBe(true);
    await flush();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($nodesOfType(ArtifactNode)).toHaveLength(1);
      expect($nodesOfType(BlockImageNode)).toHaveLength(1);
    });
  });

  it('does not cut a target whose content changes before the deferred copy settles', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    selectNodes(lexical, [keys.artifactHole]);
    let changed = false;
    const clipboard = createClipboard(undefined, (type) => {
      if (type !== 'application/x-lexical-editor' || changed) return;
      changed = true;
      const artifact = $nodesOfType(ArtifactNode)[0];
      if (!artifact) throw new Error('Artifact missing during deferred copy');
      artifact.setTitle('Changed while copying');
    });

    expect(
      lexical.dispatchCommand(CUT_COMMAND, new MockClipboardEvent('cut', clipboard.clipboardData)),
    ).toBe(true);
    await flush();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($nodesOfType(ArtifactNode)).toHaveLength(1);
      expect($nodesOfType(ArtifactNode)[0]?.getTitle()).toBe('Changed while copying');
    });
  });

  it('accepts legacy Hole JSON and new content JSON without swallowing a mixed forest', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    const serializedArtifact = lexical.getEditorState().read(() => {
      const artifact = $nodesOfType(ArtifactNode)[0];
      if (!artifact) throw new Error('Artifact missing');
      return {
        html: artifact.getHtml(),
        title: artifact.getTitle(),
        type: 'artifact',
        version: 1,
      };
    });
    const serializedImage = lexical.getEditorState().read(() => {
      const image = $nodesOfType(BlockImageNode)[0];
      if (!image) throw new Error('Block image missing');
      return image.exportJSON();
    });
    const legacyPayload = JSON.stringify({
      namespace: lexical._config.namespace,
      nodes: [
        {
          children: [
            { text: '\uFEFF', type: 'cursor', version: 1 },
            serializedArtifact,
            { text: '\uFEFF', type: 'cursor', version: 1 },
          ],
          type: 'hole',
          version: 1,
        },
        {
          children: [{ text: 'middle', type: 'text', version: 1 }],
          type: 'paragraph',
          version: 1,
        },
        serializedImage,
      ],
    });
    lexical.update(
      () => {
        const destination = $createParagraphNode();
        $getRoot().append(destination);
        destination.selectEnd();
      },
      { discrete: true },
    );
    const clipboard = createClipboard(new Map([['application/x-lexical-editor', legacyPayload]]));
    expect(
      lexical.dispatchCommand(
        PASTE_COMMAND,
        new MockClipboardEvent('paste', clipboard.clipboardData),
      ),
    ).toBe(true);
    await flush();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($nodesOfType(ArtifactNode)).toHaveLength(2);
      expect($nodesOfType(BlockImageNode)).toHaveLength(2);
      expect(keys.artifact).toBeTruthy();
    });
  });

  it('leaves an internal content range inside its Hole instead of deleting the wrapper', async () => {
    const keys = createMixedHoleDocument(lexical);
    await moment();
    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode).find((node) => node.getKey() === keys.artifactHole);
        const content = hole?.getContentChildren()[0];
        if (!content) throw new Error('Hole content missing');
        const quote = $createQuoteNode();
        const paragraph = $createParagraphNode().append($createTextNode('inner'));
        quote.append(paragraph);
        content.replace(quote);
        const selection = $createNodeSelection();
        selection.add(paragraph.getKey());
        $setSelection(selection);
      },
      { discrete: true },
    );
    await moment();
    expect(
      lexical.dispatchCommand(
        CUT_COMMAND,
        new MockClipboardEvent('cut', createClipboard().clipboardData),
      ),
    ).toBe(true);
    await flush();

    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
      expect($getRoot().getTextContent()).not.toContain('inner');
    });
  });
});
