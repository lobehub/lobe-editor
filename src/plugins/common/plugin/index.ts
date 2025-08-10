import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  HeadingTagType,
  QuoteNode,
  registerRichText,
} from '@lexical/rich-text';
import { $createLineBreakNode, $createParagraphNode, $isTextNode } from 'lexical';
import { LexicalEditor } from 'lexical/LexicalEditor';

import { IEditorKernel, IEditorPlugin } from '@/editor-kernel';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { registerCommands } from '../command';
import JSONDataSource from '../data-source/json-data-source';
import TextDataSource from '../data-source/text-data-source';
import { createBlockNode } from '../utils';
import { registerHeaderBackspace, registerRichKeydown } from './register';

export interface CommonPluginOptions {
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
    kernel.registerNodes([HeadingNode, QuoteNode]);
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
    this.registerMarkdown(kernel);
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
        format: ['code'],
        tag: '`',
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
      const isCode = node.hasFormat('code');

      if (isCode) {
        ctx.appendLine('`');
      }
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
        ctx.appendLine('<u>');
      }
      ctx.appendLine(node.getTextContent());
      if (isUnderline) {
        ctx.appendLine('</u>');
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
      if (isCode) {
        ctx.appendLine('`');
      }
    });
  }

  onInit(editor: LexicalEditor): void {
    this.registerClears(
      registerRichText(editor),
      registerDragonSupport(editor),
      registerHistory(editor, createEmptyHistoryState(), 300),
      registerHeaderBackspace(editor),
      registerRichKeydown(editor),
      registerCommands(editor),
    );
  }

  destroy(): void {
    // Cleanup logic
    super.destroy();
  }
};
