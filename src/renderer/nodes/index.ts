import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import type { Klass, LexicalNode } from 'lexical';

import { AlertNode } from '@/plugins/alert/node/AlertNode';
import {
  PlaceholderBlockNode,
  PlaceholderNode,
} from '@/plugins/auto-complete/node/placeholderNode';
import { ChartNode } from '@/plugins/chart/node/ChartNode';
import { CodeNode } from '@/plugins/code/node/code';
import { CodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CursorNode } from '@/plugins/common/node/cursor';
import { FileNode } from '@/plugins/file/node/FileNode';
import { FootnoteDefinitionNode } from '@/plugins/footnote/node/FootnoteDefinitionNode';
import { FootnoteNode } from '@/plugins/footnote/node/FootnoteNode';
import { FootnoteSectionNode } from '@/plugins/footnote/node/FootnoteSectionNode';
import { HorizontalRuleNode } from '@/plugins/hr/node/HorizontalRuleNode';
import { BlockImageNode } from '@/plugins/image/node/block-image-node';
import { ImageNode } from '@/plugins/image/node/image-node';
import { AutoLinkNode, LinkNode } from '@/plugins/link/node/LinkNode';
import { LinkHighlightNode } from '@/plugins/link-highlight/node/link-highlight';
import { DiffNode } from '@/plugins/litexml/node/DiffNode';
import { MathBlockNode, MathInlineNode } from '@/plugins/math/node';
import { MentionNode } from '@/plugins/mention/node/MentionNode';

export const rendererNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ImageNode,
  BlockImageNode,
  MathInlineNode,
  MathBlockNode,
  CodeMirrorNode,
  HorizontalRuleNode,
  MentionNode,
  FileNode,
  CodeNode,
  LinkNode,
  AutoLinkNode,
  CursorNode,
  DiffNode,
  LinkHighlightNode,
  PlaceholderNode,
  PlaceholderBlockNode,
  ChartNode,
  AlertNode,
  FootnoteNode,
  FootnoteSectionNode,
  FootnoteDefinitionNode,
];
