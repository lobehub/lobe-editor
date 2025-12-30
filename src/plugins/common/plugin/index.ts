import { registerDragonSupport } from '@lexical/dragon';
import { registerHistory } from '@lexical/history';
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
import { CAN_USE_DOM } from '@lexical/utils';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  PASTE_COMMAND,
  ParagraphNode,
  TEXT_TYPE_TO_FORMAT,
  TextNode,
} from 'lexical';
import type { LexicalEditor } from 'lexical';

import { noop } from '@/editor-kernel';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { isPunctuationChar } from '@/plugins/markdown/utils';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCommands } from '../command';
import JSONDataSource from '../data-source/json-data-source';
import TextDataSource from '../data-source/text-data-source';
import { patchBreakLine, registerBreakLineClick } from '../node/ElementDOMSlot';
import { CursorNode, registerCursorNode } from '../node/cursor';
import { $isCursorInQuote, $isCursorInTable, createBlockNode, sampleReader } from '../utils';
import { registerMDReader } from './mdReader';
import { registerHeaderBackspace, registerLastElement, registerRichKeydown } from './register';

patchBreakLine();

export interface CommonPluginOptions {
  enableHotkey?: boolean;
  /**
   * Enable/disable markdown shortcuts
   * @default true - most formats enabled, but subscript/superscript are disabled by default
   */
  markdownOption?:
    | boolean
    | {
        bold?: boolean;
        code?: boolean;
        header?: boolean;
        italic?: boolean;
        quote?: boolean;
        strikethrough?: boolean;
        subscript?: boolean;
        superscript?: boolean;
        underline?: boolean;
        underlineStrikethrough?: boolean;
      };
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

    // Parse markdown options
    const markdownOption = this.config?.markdownOption ?? true;
    const isMarkdownEnabled = markdownOption !== false;

    const breakMark = isMarkdownEnabled ? '\n\n' : '\n';

    // Determine which formats are enabled
    const formats = {
      bold: true,
      header: true,
      italic: true,
      quote: true,
      strikethrough: true,
      subscript: false, // Disabled by default
      superscript: false, // Disabled by default
      // Note: code, underline, underlineStrikethrough are handled by other plugins/writers
    };

    if (typeof markdownOption === 'object') {
      formats.bold = markdownOption.bold ?? true;
      formats.header = markdownOption.header ?? true;
      formats.italic = markdownOption.italic ?? true;
      formats.quote = markdownOption.quote ?? true;
      formats.strikethrough = markdownOption.strikethrough ?? true;
      formats.subscript = markdownOption.subscript ?? false;
      formats.superscript = markdownOption.superscript ?? false;
    }

    // Register quote shortcut if enabled
    if (formats.quote) {
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
    }

    // Register header shortcut if enabled
    if (formats.header) {
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
    }

    // Register text format shortcuts based on enabled formats
    const textFormatShortcuts = [];

    if (formats.bold) {
      textFormatShortcuts.push(
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
      );
    }

    if (formats.strikethrough) {
      textFormatShortcuts.push({
        format: ['strikethrough'],
        tag: '~~',
        type: 'text-format',
      });
    }

    if (formats.italic) {
      textFormatShortcuts.push(
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
      );
    }

    if (formats.superscript) {
      textFormatShortcuts.push({
        format: ['superscript'],
        tag: '^',
        type: 'text-format',
      });
    }

    if (formats.subscript) {
      textFormatShortcuts.push({
        format: ['subscript'],
        tag: '~',
        type: 'text-format',
      });
    }

    if (textFormatShortcuts.length > 0) {
      markdownService.registerMarkdownShortCuts(textFormatShortcuts as any);
    }

    markdownService.registerMarkdownWriter('paragraph', (ctx) => {
      ctx.wrap('', '\n\n');
    });
    markdownService.registerMarkdownWriter('quote', (ctx, node) => {
      if ($isQuoteNode(node)) {
        ctx.wrap('> ', breakMark);
      }
    });

    markdownService.registerMarkdownWriter('heading', (ctx, node) => {
      if ($isHeadingNode(node)) {
        switch (node.getTag()) {
          case 'h1': {
            ctx.wrap('# ', breakMark);
            break;
          }
          case 'h2': {
            ctx.wrap('## ', breakMark);
            break;
          }
          case 'h3': {
            ctx.wrap('### ', breakMark);
            break;
          }
          case 'h4': {
            ctx.wrap('#### ', breakMark);
            break;
          }
          case 'h5': {
            ctx.wrap('##### ', breakMark);
            break;
          }
          case 'h6': {
            ctx.wrap('###### ', breakMark);
            break;
          }
          default: {
            ctx.wrap('', '\n');
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
    this.register(
      this.kernel.registerHighCommand(
        PASTE_COMMAND,
        (event) => {
          if (!(event instanceof ClipboardEvent)) return false;

          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          this.kernel.emit('onPaste', event);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
    this.registerClears(
      registerRichText(editor),
      CAN_USE_DOM ? registerDragonSupport(editor) : noop,
      registerHistory(editor, this.kernel.getHistoryState(), 300),
      registerHeaderBackspace(editor),
      registerRichKeydown(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
      registerCommands(editor),
      registerBreakLineClick(editor),
      registerCursorNode(editor),
      registerLastElement(editor),
      // Convert soft line breaks (Shift+Enter) to hard line breaks (paragraph breaks)
      // This allows breaking out of code blocks with Shift+Enter
      editor.registerCommand(
        INSERT_LINE_BREAK_COMMAND,
        () => {
          // editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }

          // Check if cursor is in a table
          const { inCell, inTable } = $isCursorInTable(selection);

          if (inCell) {
            // We're in a table cell, allow normal line break behavior
            return false;
          }

          if (inTable) {
            // We're in a table but not in a cell, prevent line break
            return false;
          }

          // Check if cursor is in a quote
          const inQuote = $isCursorInQuote(selection);

          if (inQuote) {
            // We're in a quote block, allow normal line break behavior
            // This preserves line breaks within quotes while maintaining quote formatting
            return false;
          }

          // Not in a table or quote, convert to paragraph break
          editor.update(() => {
            editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
          });
          return true; // Prevent default line break behavior
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );

    this.registerMarkdown(this.kernel);
    this.registerLiteXml();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(TextNode.getType(), (node, ctx) => {
      const attr = {} as Record<string, string>;
      if ($isTextNode(node)) {
        if (node.hasFormat('bold')) {
          attr['bold'] = 'true';
        }
        if (node.hasFormat('italic')) {
          attr['italic'] = 'true';
        }
        if (node.hasFormat('underline')) {
          attr['underline'] = 'true';
        }
        if (node.hasFormat('strikethrough')) {
          attr['strikethrough'] = 'true';
        }
        if (node.hasFormat('subscript')) {
          attr['subscript'] = 'true';
        }
        if (node.hasFormat('superscript')) {
          attr['superscript'] = 'true';
        }
        return ctx.createXmlNode('span', attr, node.getTextContent());
      }
      return false;
    });

    litexmlService.registerXMLReader('b', sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['bold']));
    litexmlService.registerXMLReader(
      'strong',
      sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['bold']),
    );

    litexmlService.registerXMLReader('i', sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['italic']));
    litexmlService.registerXMLReader(
      'emphasis',
      sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['italic']),
    );

    litexmlService.registerXMLReader(
      'u',
      sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['underline']),
    );
    litexmlService.registerXMLReader(
      'ins',
      sampleReader.bind(this, TEXT_TYPE_TO_FORMAT['underline']),
    );

    litexmlService.registerXMLReader('span', (xmlElement: Element, children: any[]) => {
      const bold = xmlElement.getAttribute('bold');
      const italic = xmlElement.getAttribute('italic');
      const underline = xmlElement.getAttribute('underline');
      const strikethrough = xmlElement.getAttribute('strikethrough');
      const subscript = xmlElement.getAttribute('subscript');
      const superscript = xmlElement.getAttribute('superscript');

      let format = 0;

      if (bold === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['bold'];
      }
      if (italic === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['italic'];
      }
      if (underline === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['underline'];
      }
      if (strikethrough === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['strikethrough'];
      }
      if (subscript === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['subscript'];
      }
      if (superscript === 'true') {
        format |= TEXT_TYPE_TO_FORMAT['superscript'];
      }

      children.forEach((child) => {
        if (INodeHelper.isTextNode(child)) {
          child.format = (child.format || 0) | format;
        }
      });

      return children;
    });

    litexmlService.registerXMLWriter('quote', (node, ctx) => {
      if ($isQuoteNode(node)) {
        return ctx.createXmlNode('quote', {});
      }
      return false;
    });

    litexmlService.registerXMLWriter('heading', (node, ctx) => {
      if ($isHeadingNode(node)) {
        return ctx.createXmlNode(node.getTag(), {});
      }
      return false;
    });

    litexmlService.registerXMLWriter(ParagraphNode.getType(), (node, ctx) => {
      return ctx.createXmlNode('p', {});
    });

    litexmlService.registerXMLReader('quote', (xmlElement: Element, children: any[]) => {
      return INodeHelper.createElementNode(QuoteNode.getType(), {
        children,
      });
    });

    litexmlService.registerXMLReader('p', (xmlElement: Element, children: any[]) => {
      return INodeHelper.createElementNode(ParagraphNode.getType(), {
        children,
      });
    });

    const headingTags: HeadingTagType[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    headingTags.forEach((tag) => {
      litexmlService.registerXMLReader(tag, (xmlElement: Element, children: any[]) => {
        return INodeHelper.createElementNode(HeadingNode.getType(), {
          children,
          tag,
        });
      });
    });
  }

  destroy(): void {
    // Cleanup logic
    super.destroy();
  }
};
