import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
  PASTE_COMMAND,
} from 'lexical';

import type { ITextNode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { $createCursorNode, cursorNodeSerialized } from '@/plugins/common/node/cursor';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerLinkHighlightCommand } from '../command';
import { $createLinkHighlightNode, LinkHighlightNode } from '../node/link-highlight';
import { isValidUrl } from '../utils';
import { registerLinkHighlight } from './registry';

export interface LinkHighlightPluginOptions {
  enableHotkey?: boolean;
  /**
   * Enable auto-highlight when pasting URLs
   * @default true
   */
  enablePasteAutoHighlight?: boolean;
  theme?: string;
  /**
   * Custom URL validation regex
   */
  urlRegex?: RegExp;
}

export const LinkHighlightPlugin: IEditorPluginConstructor<LinkHighlightPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LinkHighlightPluginOptions>
{
  static pluginName = 'LinkHighlightPlugin';
  private logger = createDebugLogger('plugin', 'link-highlight');
  private urlRegex: RegExp;

  constructor(
    private kernel: IEditorKernel,
    public config?: LinkHighlightPluginOptions,
  ) {
    super();
    kernel.registerNodes([LinkHighlightNode]);
    kernel.registerThemes({
      linkHighlight: config?.theme || 'editor-link-highlight',
    });

    // Default URL regex that matches http(s), mailto, tel, etc.
    this.urlRegex =
      config?.urlRegex ||
      /^(?:https?:\/\/|mailto:|tel:)[^\s"<>[\\\]^`{|}]+|^www\.[^\s"<>[\\\]^`{|}]+/i;

    this.logger.debug('LinkHighlightPlugin initialized');
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerLinkHighlightCommand(editor));
    this.register(
      registerLinkHighlight(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
    );

    // Register paste handler for auto-highlighting URLs
    if (this.config?.enablePasteAutoHighlight !== false) {
      this.register(
        editor.registerCommand(
          PASTE_COMMAND,
          (payload: ClipboardEvent) => {
            const { clipboardData } = payload;
            if (
              clipboardData &&
              clipboardData.types &&
              clipboardData.types.length === 1 &&
              clipboardData.types[0] === 'text/plain'
            ) {
              const data = clipboardData.getData('text/plain').trim();
              // Check if the pasted content is a valid URL
              if (this.urlRegex.test(data) && isValidUrl(data)) {
                payload.stopImmediatePropagation();
                payload.preventDefault();
                this.logger.debug('Auto-highlighting pasted URL:', data);

                // Insert LinkHighlightNode directly
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    const linkHighlightNode = $createLinkHighlightNode(data);
                    const cursorNode = $createCursorNode();
                    selection.insertNodes([linkHighlightNode, cursorNode]);
                  }
                });

                return true;
              }
            }
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
      );
    }

    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }

    // Register markdown writer for <link> format
    markdownService.registerMarkdownWriter(LinkHighlightNode.getType(), (ctx, node) => {
      ctx.appendLine(`<${node.getTextContent()}>`);
      return true;
    });

    // Register markdown shortcut for auto-link syntax: <url>
    // Matches URLs wrapped in angle brackets like <https://example.com>
    markdownService.registerMarkdownShortCut({
      regExp: /<((?:https?:\/\/|mailto:|tel:|www\.)[^\s"<>[\\\]^`{|}]+)>\s?$/,
      replace: (textNode, match) => {
        const [, url] = match;
        if (!url || !isValidUrl(url)) {
          return;
        }

        this.logger.debug('Converting markdown auto-link to LinkHighlightNode:', url);
        const linkHighlightNode = $createLinkHighlightNode(url);
        const cursorNode = $createCursorNode();
        textNode.replace(linkHighlightNode);
        linkHighlightNode.insertAfter(cursorNode);

        return undefined;
      },
      trigger: '>',
      type: 'text-match',
    });

    // Register HTML reader to handle <url> syntax that might be parsed as HTML
    markdownService.registerMarkdownReader(
      'html',
      (node) => {
        const htmlValue = (node as any).value || '';

        // Check if this looks like an auto-link: <url>
        const match = htmlValue.match(
          /^<((?:https?:\/\/|mailto:|tel:|www\.)[^\s"<>[\\\]^`{|}]+)>$/,
        );

        if (match) {
          const url = match[1].replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, '');
          this.logger.debug('Converting HTML auto-link to LinkHighlightNode:', url);

          return [
            INodeHelper.createElementNode('linkHighlight', {
              children: [cursorNodeSerialized, INodeHelper.createTextNode(url, {})],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'linkHighlight',
              version: 1,
            }),
            cursorNodeSerialized,
          ];
        }

        // Not an auto-link, let other handlers process it
        return false;
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );

    // Register markdown reader for 'link' type (auto-links like <url>)
    // Use HIGH priority to handle auto-links before standard Link plugin
    markdownService.registerMarkdownReader(
      'link',
      (node, children) => {
        // Check if this is an auto-link (URL and text are the same)
        const url = node.url || '';

        // Check if we have text children
        if (!children || children.length === 0) {
          return false;
        }

        // Get text content from children
        const textContent = children
          .filter((child) => child.type === 'text')
          .map((child) => (child as ITextNode).text || '')
          .join('');

        // If text matches URL exactly (auto-link syntax), convert to LinkHighlightNode
        if (textContent === url) {
          this.logger.debug('Converting markdown auto-link to LinkHighlightNode:', url);
          // Return array with LinkHighlightNode and trailing cursor
          // Structure matches CodeNode: [node with internal cursor + text, external cursor]
          return [
            INodeHelper.createElementNode('linkHighlight', {
              children: [cursorNodeSerialized, INodeHelper.createTextNode(url, {})],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'linkHighlight',
              version: 1,
            }),
            cursorNodeSerialized,
          ];
        }

        // Otherwise, let standard Link plugin handle it
        return false;
      },
      MARKDOWN_READER_LEVEL_HIGH, // High priority to intercept auto-links
    );

    this.logger.debug('LinkHighlightPlugin initialized with markdown support');
  }
};
