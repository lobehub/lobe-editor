import {
  $createCodeNode,
  $isCodeHighlightNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
} from '@lexical/code';
import { LexicalEditor, TabNode } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/editor-kernel/types';
import { IMarkdownShortCutService } from '@/plugins/markdown';

import { CustomShikiTokenizer, registerCodeCommand } from '../command';
import { getCodeLanguageByInput } from '../utils/language';
import { registerCodeHighlighting } from './CodeHighlighterShiki';
import { AllColorReplacements } from './FacadeShiki';

/**
 * Options for configuring the Codeblock plugin
 *
 * @example
 * // Basic usage with theme
 * new CodeblockPlugin(kernel, {
 *   shikiTheme: 'dracula'
 * })
 *
 * @example
 * // With simple color replacements
 * new CodeblockPlugin(kernel, {
 *   shikiTheme: 'dracula',
 *   colorReplacements: {
 *     '#ff79c6': '#189eff',
 *     '#f8f8f2': '#ffffff'
 *   }
 * })
 *
 * @example
 * // With scoped color replacements for multiple themes
 * new CodeblockPlugin(kernel, {
 *   colorReplacements: {
 *     'dracula': {
 *       '#ff79c6': '#189eff',
 *       '#f8f8f2': '#ffffff'
 *     },
 *     'github-light': {
 *       '#ff79c6': '#defdef',
 *       '#f8f8f2': '#000000'
 *     }
 *   }
 * })
 */
export interface CodeblockPluginOptions {
  /** Color replacements configuration for customizing theme colors */
  colorReplacements?: AllColorReplacements;
  /** Shiki theme name to use for syntax highlighting */
  shikiTheme?: string;
  /** Custom CSS theme configuration */
  theme?: {
    code?: string;
  };
}

export const CodeblockPlugin: IEditorPluginConstructor<CodeblockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodeblockPluginOptions>
{
  static pluginName = 'CodeblockPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config: CodeblockPluginOptions = {},
  ) {
    super();
    // Register the code block plugin
    kernel.registerNodes([CodeNode, CodeHighlightNode]);
    kernel.registerThemes({
      code: config.theme?.code || 'editor-code',
    });

    if (this.config?.shikiTheme) {
      CustomShikiTokenizer.defaultTheme = this.config?.shikiTheme;
    }

    if (this.config?.colorReplacements) {
      CustomShikiTokenizer.defaultColorReplacements = this.config?.colorReplacements;
    }

    kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
      regExp: /^(```|···)(.+)?$/,
      replace: (parentNode, _, match) => {
        const code = $createCodeNode(
          getCodeLanguageByInput(match[2]),
          CustomShikiTokenizer.defaultTheme,
        );

        parentNode.replace(code);

        code.selectStart();
      },
      trigger: 'enter',
      type: 'element',
    });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
        if ($isCodeNode(node)) {
          ctx.wrap('```' + (node.getLanguage() || '') + '\n', '\n```\n');
        }
      });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(TabNode.getType(), (ctx) => {
        ctx.appendLine('  ');
      });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter(CodeHighlightNode.getType(), (ctx, node) => {
        if ($isCodeHighlightNode(node)) {
          ctx.appendLine(node.getTextContent());
        }
      });
    kernel
      .requireService(IMarkdownShortCutService)
      ?.registerMarkdownWriter('linebreak', (ctx, node) => {
        if ($isCodeNode(node.getParent())) {
          ctx.appendLine('\n');
        }
      });
  }

  onInit(editor: LexicalEditor): void {
    if (this.config?.shikiTheme) {
      this.register(registerCodeHighlighting(editor, CustomShikiTokenizer));
    } else {
      this.register(registerCodeHighlighting(editor));
    }
    this.register(registerCodeCommand(editor));
  }
};
