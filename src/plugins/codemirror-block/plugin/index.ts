import { $createNodeSelection, $setSelection, DecoratorNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml/service/litexml-service';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeMirrorCommand } from '../command';
import { modeMatch } from '../lib/mode';
import { $createCodeMirrorNode, CodeMirrorNode } from '../node/CodeMirrorNode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CodemirrorPluginOptions {
  decorator: (node: CodeMirrorNode, editor: LexicalEditor) => any;
  theme?: string;
}

export const CodemirrorPlugin: IEditorPluginConstructor<CodemirrorPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CodemirrorPluginOptions>
{
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

    this.registerMarkdown();
    this.registerLiteXml();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(CodeMirrorNode.getType(), (node, ctx) => {
      const codeMirrorNode = node as CodeMirrorNode;
      const xmlNode = ctx.createXmlNode(
        'code',
        {
          lang: codeMirrorNode.lang || 'plain',
        },
        codeMirrorNode.code,
      );
      return xmlNode;
    });

    litexmlService.registerXMLReader('code', (xmlElement: Element, children: any[]) => {
      const text = children.map((v) => v.text || '').join('');
      const language = xmlElement.getAttribute('lang') || 'plain';
      return INodeHelper.createTypeNode('code', {
        code: text || xmlElement.textContent || '',
        language: modeMatch(language),
        version: 1,
      });
    });
  }

  registerMarkdown() {
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

    markdownService?.registerMarkdownWriter(CodeMirrorNode.getType(), (ctx, node) => {
      if (node instanceof CodeMirrorNode) {
        ctx.appendLine('```' + node.lang);
        ctx.appendLine('\n');
        ctx.appendLine(node.code);
        ctx.appendLine('\n```\n');
      }
    });

    markdownService?.registerMarkdownReader('code', (node) => {
      const language = node.lang ? modeMatch(node.lang) : 'plain';
      return INodeHelper.createTypeNode('code', {
        code: node.value,
        language,
        version: 1,
      });
    });
  }
};
