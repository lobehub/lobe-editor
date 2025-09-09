import { IS_BOLD, IS_ITALIC } from 'lexical';

import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import type { IMarkdownShortCutService } from '@/plugins/markdown';

export function registerMDReader(markdownService: IMarkdownShortCutService) {
  markdownService.registerMarkdownReader('blockquote', (node, children) => {
    return INodeHelper.createElementNode('quote', {
      children: children as INode[],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    });
  });

  // strong italic del
  markdownService.registerMarkdownReader('strong', (node, children) => {
    return children.map((child) => {
      if (INodeHelper.isTextNode(child)) {
        child.format = (child.format || 0) | IS_BOLD;
      }
      return child;
    });
  });

  // strong italic del
  markdownService.registerMarkdownReader('emphasis', (node, children) => {
    return children.map((child) => {
      if (INodeHelper.isTextNode(child)) {
        child.format = (child.format || 0) | IS_ITALIC;
      }
      return child;
    });
  });
}
