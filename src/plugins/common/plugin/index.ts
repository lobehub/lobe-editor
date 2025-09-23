import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import type { HeadingTagType } from '@lexical/rich-text';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
  registerRichText,
} from '@lexical/rich-text';
import { $createLineBreakNode, $createParagraphNode, $isTextNode } from 'lexical';
import type { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService, isPunctuationChar } from '@/plugins/markdown';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCommands } from '../command';
import JSONDataSource from '../data-source/json-data-source';
import TextDataSource from '../data-source/text-data-source';
import { patchBreakLine, registerBreakLineClick } from '../node/ElementDOMSlot';
import { CursorNode, registerCursorNode } from '../node/cursor';
import { createBlockNode } from '../utils';
import { registerHeaderBackspace, registerLastElement, registerRichKeydown } from './register';
import { registerMDReader } from './mdReader';

patchBreakLine();

export interface CommonPluginOptions {
  enableHotkey?: boolean;
  theme?: {
    quote?: string;
    textBold?: string;
    textCode?: string;
    textHighlight?: string;
    textItalic?: string;
    textStrikethrough?: string;
    textSubscript?: string;
    textSuperscript?: string;
    textUnderline?: string;
    textUnderlineStrikethrough?: string;
  };
}

export const CommonPlugin: IEditorPluginConstructor<CommonPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CommonPluginOptions>
{
  static pluginName = 'CommonPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config: CommonPluginOptions = {},
  ) {
    super();
    // Register the JSON data source
    kernel.registerDataSource(new JSONDataSource('json'));
    // Register the text data source
    kernel.registerDataSource(new TextDataSource('text'));
    // Register common nodes and themes
    kernel.registerNodes([HeadingNode, QuoteNode, CursorNode]);
    if (config?.theme) {
      kernel.registerThemes({
        quote: config.theme.quote,
        text: {
          bold: config.theme.textBold,
          code: config.theme.textCode,
          highlight: config.theme.textHighlight,
          italic: config.theme.textItalic,
          strikethrough: config.theme.textStrikethrough,
          subscript: config.theme.textSubscript,
          superscript: config.theme.textSuperscript,
          underline: config.theme.textUnderline,
          underlineStrikethrough: config.theme.textUnderlineStrikethrough,
        },
      });
    }
  }

  registerMarkdown(kernel: IEditorKernel) {
    const markdownService = kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }
    markdownService.registerMarkdownShortCut({
      regExp: /^>\s/,
      replace: (parentNode, children, _match, isImport) => {
        if (isImport) {
          const previousNode = parentNode.getPreviousSibling();
          if ($isQuoteNode(previousNode)) {
            previousNode.splice(previousNode.getChildrenSize(), 0, [
              $createLineBreakNode(),
              ...children,
            ]);
            parentNode.remove();
            return;
          }
        }

        const node = $createQuoteNode();
        node.append(...children);
        parentNode.replace(node);
        if (!isImport) {
          node.select(0, 0);
        }
      },
      type: 'element',
    });
    markdownService.registerMarkdownShortCut({
      regExp: /^(#{1,6})\s/,
      replace: createBlockNode((match, parentNode) => {
        const tag = ('h' + match[1].length) as HeadingTagType;
        if ($isHeadingNode(parentNode) && parentNode.getTag() === tag) {
          return $createParagraphNode();
        }
        return $createHeadingNode(tag);
      }),
      type: 'element',
    });
    markdownService.registerMarkdownShortCuts([
      {
        format: ['bold'],
        tag: '**',
        type: 'text-format',
      },
      {
        format: ['bold'],
        intraword: false,
        tag: '__',
        type: 'text-format',
      },
      {
        format: ['strikethrough'],
        tag: '~~',
        type: 'text-format',
      },
      {
        format: ['italic'],
        tag: '*',
        type: 'text-format',
      },
      {
        format: ['italic'],
        intraword: false,
        tag: '_',
        type: 'text-format',
      },
      {
        format: ['superscript'],
        tag: '^',
        type: 'text-format',
      },
      {
        format: ['subscript'],
        tag: '~',
        type: 'text-format',
      },
    ]);

    markdownService.registerMarkdownWriter('paragraph', (ctx) => {
      ctx.wrap('', '\n\n');
    });
    markdownService.registerMarkdownWriter('quote', (ctx, node) => {
      if ($isQuoteNode(node)) {
        ctx.wrap('> ', '\n\n');
      }
    });

    markdownService.registerMarkdownWriter('heading', (ctx, node) => {
      if ($isHeadingNode(node)) {
        switch (node.getTag()) {
          case 'h1': {
            ctx.wrap('# ', '\n');
            break;
          }
          case 'h2': {
            ctx.wrap('## ', '\n');
            break;
          }
          case 'h3': {
            ctx.wrap('### ', '\n');
            break;
          }
          case 'h4': {
            ctx.wrap('#### ', '\n');
            break;
          }
          case 'h5': {
            ctx.wrap('##### ', '\n');
            break;
          }
          case 'h6': {
            ctx.wrap('###### ', '\n');
            break;
          }
          default: {
            ctx.wrap('', '\n\n');
            break;
          }
        }
      }
    });
    markdownService.registerMarkdownWriter('text', (ctx, node) => {
      if (!$isTextNode(node)) {
        return;
      }
      const isBold = node.hasFormat('bold');
      const isItalic = node.hasFormat('italic');
      const isUnderline = node.hasFormat('underline');
      const isStrikethrough = node.hasFormat('strikethrough');
      const isSuperscript = node.hasFormat('superscript');
      const isSubscript = node.hasFormat('subscript');

      if (isBold) {
        ctx.appendLine('**');
      }
      if (isStrikethrough) {
        ctx.appendLine('~~');
      }
      if (isItalic) {
        ctx.appendLine('_');
      }
      if (isUnderline) {
        ctx.appendLine('<ins>');
      }
      if (isSuperscript) {
        ctx.appendLine('^');
      }
      if (isSubscript) {
        ctx.appendLine('~');
      }

      const textContent = node.getTextContent();
      const res = textContent.match(/\s+$/);
      let tailSpace = '';
      if (res) {
        tailSpace = res[0];
      }
      const append = textContent.trimEnd();
      const lastChar = append.at(-1);
      ctx.appendLine(append);

      if (isSubscript) {
        ctx.appendLine('~');
      }
      if (isSuperscript) {
        ctx.appendLine('^');
      }
      if (isUnderline) {
        ctx.appendLine('</ins>');
      }
      if (isItalic) {
        ctx.appendLine('_');
      }
      if (isStrikethrough) {
        ctx.appendLine('~~');
      }
      if (isBold) {
        ctx.appendLine('**');
      }

      if (tailSpace) {
        ctx.appendLine(tailSpace);
      } else if (lastChar && isPunctuationChar(lastChar)) {
        ctx.appendLine(' ');
      }
    });

    // Register markdown writer for linebreak nodes (soft line breaks)
    markdownService.registerMarkdownWriter('linebreak', (ctx) => {
      // In markdown, soft line breaks are represented as two spaces followed by a newline
      ctx.appendLine('  \n');
    });

    // 注册 markdown reader
    //
    registerMDReader(markdownService);
  }

  onInit(editor: LexicalEditor): void {
    this.registerClears(
      registerRichText(editor),
      registerDragonSupport(editor),
      registerHistory(editor, createEmptyHistoryState(), 300),
      registerHeaderBackspace(editor),
      registerRichKeydown(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
      registerCommands(editor),
      registerBreakLineClick(editor),
      registerCursorNode(editor),
      registerLastElement(editor),
    );

    this.registerMarkdown(this.kernel);
  }

  destroy(): void {
    // Cleanup logic
    super.destroy();
  }
};
