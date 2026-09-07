import { $createLinkNode, LinkNode } from '@lexical/link';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import { getBlockOffset } from '../linear-text';

describe('editor-kernel linear text coordinates', () => {
  it('accounts for nested element children and line breaks before commit', async () => {
    const editor = createEditor({ nodes: [LinkNode] });
    let offsets: Array<number | null> = [];

    await new Promise<void>((resolve) =>
      editor.update(
        () => {
          const block = $createParagraphNode();
          const link = $createLinkNode('https://example.com');
          const afterBreak = $createTextNode('z');
          const otherBlock = $createParagraphNode();
          const otherText = $createTextNode('other');
          link.append($createTextNode('xy'));
          block.append($createTextNode('a'), link, $createLineBreakNode(), afterBreak);
          otherBlock.append(otherText);

          // The subtree is valid, but it has not been attached to root yet.
          // This is the same transient state used while a collaborative node
          // is being materialized.
          offsets = [
            getBlockOffset({ getNode: () => link, offset: 1, type: 'element' }, block),
            getBlockOffset({ getNode: () => afterBreak, offset: 0, type: 'text' }, block),
            getBlockOffset({ getNode: () => block, offset: 2, type: 'element' }, block),
            getBlockOffset({ getNode: () => link, offset: 1, type: 'text' }, block),
            getBlockOffset({ getNode: () => otherText, offset: 0, type: 'text' }, block),
          ];

          $getRoot().append(block, otherBlock);
        },
        { onUpdate: resolve },
      ),
    );

    expect(offsets).toEqual([3, 4, 3, null, null]);
  });
});
