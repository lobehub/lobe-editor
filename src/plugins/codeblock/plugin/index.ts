import {
  $createCodeNode,
  $isCodeHighlightNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
} from '@lexical/code';
import { DOMConversionOutput, LexicalEditor, TabNode } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { CustomShikiTokenizer, registerCodeCommand } from '../command';
import { getCodeLanguageByInput } from '../utils/language';
import { registerCodeHighlighting, toCodeTheme } from './CodeHighlighterShiki';
import { AllColorReplacements } from './FacadeShiki';

const origin = CodeNode.importDOM;

const LANGUAGE_DATA_ATTRIBUTE = 'data-language';
const MAX_LENGTH = 8000;

function $convertPreElement(domNode: HTMLElement): DOMConversionOutput {
  const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
  if (domNode.innerHTML.length > MAX_LENGTH) {
    return { node: null };
  }
  return { node: $createCodeNode(language) };
}

CodeNode.importDOM = () => {
  const node = origin();
  if (node) {
    node.pre = () => ({
      conversion: $convertPreElement,
      priority: 0,
    });
  }
  // Custom logic for handling imported DOM
  return node;
};

export interface CodeblockPluginOptions {
  /** Color replacements configuration for customizing theme colors */
  colorReplacements?: { current?: AllColorReplacements };
  /** Shiki theme name to use for syntax highlighting */
  shikiTheme?:
    | string
    | {
        dark: string;
        light: string;
      };
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
          toCodeTheme(CustomShikiTokenizer),
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
