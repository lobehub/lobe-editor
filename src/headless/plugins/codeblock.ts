import { $isCodeHighlightNode, $isCodeNode, CodeHighlightNode, CodeNode } from '@lexical/code-core';
import { TabNode } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { getCodeLanguageByInput } from '@/plugins/codeblock/utils/language';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

export type HeadlessCodeblockPluginOptions = Record<string, never>;

const createCodeChildren = (code: string) =>
  code
    .split('\n')
    .flatMap((text, index, array) => {
      const textNode = INodeHelper.createTextNode(text);
      textNode.type = 'code-highlight';

      if (index === array.length - 1) {
        return textNode;
      }

      return [
        textNode,
        {
          type: 'linebreak',
          version: 1,
        },
      ];
    })
    .flat();

export const HeadlessCodeblockPlugin: IEditorPluginConstructor<HeadlessCodeblockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<HeadlessCodeblockPluginOptions>
{
  static pluginName = 'HeadlessCodeblockPlugin';

  constructor(protected kernel: IEditorKernel) {
    super();
    kernel.registerNodes([CodeNode, CodeHighlightNode]);
    kernel.registerThemes({
      code: 'editor-code',
    });
  }

  onInit(): void {
    this.registerMarkdown();
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }

    markdownService.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
      if ($isCodeNode(node)) {
        ctx.wrap('```' + (node.getLanguage() || '') + '\n', '\n```\n');
      }
    });

    markdownService.registerMarkdownWriter(TabNode.getType(), (ctx) => {
      ctx.appendLine('  ');
    });

    markdownService.registerMarkdownWriter(CodeHighlightNode.getType(), (ctx, node) => {
      if ($isCodeHighlightNode(node)) {
        ctx.appendLine(node.getTextContent());
      }
    });

    markdownService.registerMarkdownWriter('linebreak', (ctx, node) => {
      if ($isCodeNode(node.getParent())) {
        ctx.appendLine('\n');
      }
    });

    markdownService.registerMarkdownReader('code', (node) => {
      const language = node.lang ? getCodeLanguageByInput(node.lang) : 'plaintext';
      return INodeHelper.createElementNode('code', {
        children: createCodeChildren(node.value),
        direction: 'ltr',
        format: '',
        indent: 0,
        language,
        version: 1,
      });
    });
  }
};
