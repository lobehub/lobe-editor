import { $createNodeSelection, $setSelection, DecoratorNode, LexicalEditor } from 'lexical';
import type { Paragraph } from 'mdast';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerMeta2dCommand } from '../command';
import { $createMeta2dNode, Meta2dNode } from '../node';
import { DEFAULT_META2D_DIAGRAM_JSON } from '../utils/meta2dManager';

const META2D_SHORTCUT = /^---meta2d---$/i;
const META2D_BLOCK = /^---meta2d---\n([\S\s]*?)\n---\/meta2d---$/i;

export interface Meta2dPluginOptions {
  decorator?: (node: Meta2dNode, editor: LexicalEditor) => unknown;
  theme?: {
    meta2d?: string;
  };
}

function extractParagraphText(node: Paragraph): string {
  return (node.children || [])
    .map((child) => {
      if ('value' in child && typeof child.value === 'string') {
        return child.value;
      }
      return '';
    })
    .join('');
}

export const Meta2dPlugin: IEditorPluginConstructor<Meta2dPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<Meta2dPluginOptions>
{
  static pluginName = 'Meta2dPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: Meta2dPluginOptions,
  ) {
    super();
    kernel.registerNodes([Meta2dNode]);

    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
    this.registerDecorator(
      kernel,
      Meta2dNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as Meta2dNode, editor) : null;
      },
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerMeta2dCommand(editor));
    this.registerMarkdown();
  }

  registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownShortCut({
      regExp: META2D_SHORTCUT,
      replace: (parentNode) => {
        const node = $createMeta2dNode(DEFAULT_META2D_DIAGRAM_JSON, '');
        parentNode.replace(node);
        const selection = $createNodeSelection();
        selection.add(node.getKey());
        $setSelection(selection);
      },
      trigger: 'enter',
      type: 'element',
    });

    markdownService.registerMarkdownWriter(Meta2dNode.getType(), (ctx, node) => {
      const meta2dNode = node as Meta2dNode;
      ctx.appendLine('---meta2d---');
      ctx.appendLine(meta2dNode.__diagram || DEFAULT_META2D_DIAGRAM_JSON);
      ctx.appendLine('---/meta2d---');
      return true;
    });

    markdownService.registerMarkdownReader(
      'paragraph',
      (node) => {
        const paragraphText = extractParagraphText(node as Paragraph);
        const match = paragraphText.match(META2D_BLOCK);
        if (!match) return false;
        const diagram = match[1]?.trim() || DEFAULT_META2D_DIAGRAM_JSON;
        return INodeHelper.createTypeNode(Meta2dNode.getType(), {
          diagram,
          svg: '',
        });
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );

    markdownService.registerMarkdownReader(
      'code',
      (node) => {
        const codeNode = node as unknown as { lang?: string; value?: string };
        if (codeNode.lang !== 'meta' && codeNode.lang !== 'meta2d') return false;
        return INodeHelper.createTypeNode(Meta2dNode.getType(), {
          diagram: codeNode.value?.trim() ? codeNode.value : DEFAULT_META2D_DIAGRAM_JSON,
          svg: '',
        });
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }
};
