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
  it('accounts for nested element children and line breaks', () => {
    const editor = createEditor({ nodes: [LinkNode] });

    editor.update(() => {
      const block = $createParagraphNode();
      const link = $createLinkNode('https://example.com');
      const afterBreak = $createTextNode('z');
      link.append($createTextNode('xy'));
      block.append($createTextNode('a'), link, $createLineBreakNode(), afterBreak);
      $getRoot().append(block);

      expect(getBlockOffset({ getNode: () => link, offset: 1, type: 'element' }, block)).toBe(3);
      expect(getBlockOffset({ getNode: () => afterBreak, offset: 0, type: 'text' }, block)).toBe(4);
      expect(getBlockOffset({ getNode: () => link, offset: 2, type: 'element' }, block)).toBe(4);
      expect(getBlockOffset({ getNode: () => link, offset: 1, type: 'text' }, block)).toBeNull();
    });
  });
});
