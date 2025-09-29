import { $setSelection, LexicalEditor, TextNode } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { $createCursorNode, cursorNodeSerialized } from '@/plugins/common';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeInlineCommand } from '../command';
import { $createCodeNode, CodeNode } from '../node/code';
import { registerCodeInline } from './registry';

export interface CodePluginOptions {
  enableHotkey?: boolean;
  theme?: string;
}

export const CodePlugin: IEditorPluginConstructor<CodePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodePluginOptions>
{
  static pluginName = 'CodePlugin';

  constructor(
    private kernel: IEditorKernel,
    public config?: CodePluginOptions,
  ) {
    super();
    kernel.registerNodes([CodeNode]);
    kernel.registerThemes({
      codeInline: config?.theme || 'editor-code',
    });
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCodeInlineCommand(editor));
    this.register(
      registerCodeInline(editor, this.kernel, {
        enableHotkey: this.config?.enableHotkey,
      }),
    );
    this.register(
      editor.registerNodeTransform(TextNode, (node) => {
        if (node.hasFormat('code')) {
          node.replace($createCodeNode(node.getTextContent())).insertAfter($createCursorNode());
        }
      }),
    );

    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) {
      return;
    }

    markdownService.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
      ctx.appendLine(`\`${node.getTextContent()}\``);
      return true;
    });

    markdownService.registerMarkdownShortCuts([
      {
        process: (selection) => {
          const text = selection.getTextContent();
          selection.removeText();
          selection.insertNodes([$createCodeNode(text), $createCursorNode()]);
          $setSelection(selection);
        },
        tag: '`',
        type: 'text-format',
      },
    ]);
    markdownService.registerMarkdownReader('inlineCode', (node) => {
      return [
        INodeHelper.createElementNode('codeInline', {
          children: [cursorNodeSerialized, INodeHelper.createTextNode(node.value || '', {})],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'codeInline',
          version: 1,
        }),
        cursorNodeSerialized,
      ];
    });
  }
};
