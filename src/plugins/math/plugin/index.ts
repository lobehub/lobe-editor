import { $createNodeSelection, $setSelection, DecoratorNode, LexicalEditor } from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerMathCommand } from '../command';
import {
  $createMathBlockNode,
  $createMathInlineNode,
  MathBlockNode,
  MathInlineNode,
} from '../node';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MathPluginOptions {
  decorator: (node: MathInlineNode | MathBlockNode, editor: LexicalEditor) => unknown;
  theme?: {
    mathBlock?: string;
    mathInline?: string;
  };
}

export const MathPlugin: IEditorPluginConstructor<MathPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<MathPluginOptions>
{
  public static readonly pluginName = 'MathPlugin';
  private logger = createDebugLogger('plugin', 'math');

  constructor(
    protected kernel: IEditorKernel,
    public config?: MathPluginOptions,
  ) {
    super();
    kernel.registerNodes([MathInlineNode, MathBlockNode]);
    if (config?.theme) {
      kernel.registerThemes(config?.theme);
    }
    this.registerDecorator(
      kernel,
      MathInlineNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as MathInlineNode, editor) : null;
      },
    );
    this.registerDecorator(
      kernel,
      MathBlockNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as MathBlockNode, editor) : null;
      },
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerMathCommand(editor));
    this.registerMarkdown();
    this.registerLiteXml();
  }

  registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) {
      return;
    }

    litexmlService.registerXMLWriter(MathInlineNode.getType(), (node, ctx) => {
      if (node instanceof MathInlineNode) {
        const attributes: { [key: string]: string } = {
          code: node.getTextContent(),
        };
        return ctx.createXmlNode('math', attributes);
      }
      return false;
    });

    litexmlService.registerXMLWriter(MathBlockNode.getType(), (node, ctx) => {
      if (node instanceof MathBlockNode) {
        const attributes: { [key: string]: string } = {
          code: node.getTextContent(),
        };
        return ctx.createXmlNode('mathBlock', attributes);
      }
      return false;
    });
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);

    markdownService?.registerMarkdownShortCut({
      regExp: /\$([^$]+)\$\s?$/,
      replace: (textNode, match) => {
        const [, code] = match;
        const mathNode = $createMathInlineNode(code);
        this.logger.debug('Math node inserted:', mathNode);
        // textNode.replace(mathNode);
        textNode.insertBefore(mathNode);
        textNode.setTextContent('');
        textNode.select();
        // mathNode.selectEnd();

        return;
      },
      trigger: '$',
      type: 'text-match',
    });

    markdownService?.registerMarkdownShortCut({
      regExp: /^(\$\$)$/,
      replace: (parentNode, _1, _2, isImport) => {
        const node = $createMathBlockNode();

        // TODO: Get rid of isImport flag
        if (isImport || parentNode.getNextSibling()) {
          parentNode.replace(node);
        } else {
          parentNode.insertBefore(node);
        }

        const sel = $createNodeSelection();
        sel.add(node.getKey());
        $setSelection(sel);
      },
      trigger: 'enter',
      type: 'element',
    });

    markdownService?.registerMarkdownWriter(MathInlineNode.getType(), (ctx, node) => {
      ctx.appendLine(node.getTextContent());
      return true;
    });

    markdownService?.registerMarkdownWriter(MathBlockNode.getType(), (ctx, node) => {
      ctx.appendLine(node.getTextContent());
      return true;
    });

    markdownService?.registerMarkdownReader('inlineMath', (node) => {
      return INodeHelper.createElementNode('math', {
        code: node.value,
        version: 1,
      });
    });

    markdownService?.registerMarkdownReader('math', (node) => {
      return INodeHelper.createElementNode('mathBlock', {
        code: node.value,
        version: 1,
      });
    });
  }
};
