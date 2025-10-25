import { $createNodeSelection, $setSelection, DecoratorNode, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeMirrorCommand } from '../command';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '../node/CodeMirrorNode';
import { modeMatch } from '../lib/mode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodemirrorPluginOptions {
  decorator: (node: CodeMirrorNode, editor: LexicalEditor) => any;
  theme?: string;
}

export const CodemirrorPlugin: IEditorPluginConstructor<CodemirrorPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodemirrorPluginOptions> {
  static pluginName = 'CodemirrorPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: CodemirrorPluginOptions,
  ) {
    super();
    // Register the horizontal rule node
    kernel.registerNodes([CodeMirrorNode]);
    kernel.registerThemes({
      hr: config?.theme || '',
    });
    this.registerDecorator(
      kernel,
      'codemirror',
      (node: DecoratorNode<any>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as CodeMirrorNode, editor) : null;
      },
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCodeMirrorCommand(editor));

    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    markdownService?.registerMarkdownShortCut({
      regExp: /^(```|···)(.+)?$/,
      replace: (parentNode, _, match) => {
        const code = $createCodeMirrorNode(modeMatch(match[2]), '');

        parentNode.replace(code);

        const sel = $createNodeSelection();
        sel.add(code.getKey());
        $setSelection(sel);
      },
      trigger: 'enter',
      type: 'element',
    });
    // this.kernel
    //   .requireService(IMarkdownShortCutService)
    //   ?.registerMarkdownWriter(CodeMirrorNode.getType(), (ctx, node) => {
    //     if ($isCodeMirrorNode(node)) {
    //       ctx.appendLine('---\n\n');
    //     }
    //   });
    // this.kernel
    //   .requireService(IMarkdownShortCutService)
    //   ?.registerMarkdownReader('thematicBreak', () => {
    //     return INodeHelper.createElementNode('horizontalrule', {});
    //   });
  }
};
