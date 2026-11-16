import type { DecoratorNode, LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { INodeService } from '@/plugins/inode';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { registerFootnoteCommands } from '../command';
import { FootnoteDefinitionNode } from '../node/FootnoteDefinitionNode';
import { FootnoteNode } from '../node/FootnoteNode';
import { FootnoteSectionNode } from '../node/FootnoteSectionNode';
import { FootnoteService, IFootnoteService } from '../service';
import { normalizeFootnoteINodeTree } from './inode';
import { registerFootnoteLiteXml, registerFootnoteMarkdown } from './serialization';
import { registerFootnoteStructure } from './structure';
import { registerFootnoteSync } from './sync';

const logger = createDebugLogger('plugin', 'footnote');

export interface FootnotePluginOptions {
  decorator?: (node: FootnoteNode, editor: LexicalEditor) => any;
  theme?: {
    footnote?: string;
    footnoteDefinition?: string;
    footnoteSection?: string;
  };
}

export const FootnotePlugin: IEditorPluginConstructor<FootnotePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<FootnotePluginOptions>
{
  static pluginName = 'FootnotePlugin';

  private service = new FootnoteService();

  constructor(
    protected kernel: IEditorKernel,
    public config?: FootnotePluginOptions,
  ) {
    super();
    kernel.registerNodes([FootnoteNode, FootnoteSectionNode, FootnoteDefinitionNode]);
    kernel.registerService(IFootnoteService, this.service);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
    this.registerDecorator(
      kernel,
      FootnoteNode.getType(),
      (node: DecoratorNode<any>, editor: LexicalEditor) =>
        config?.decorator ? config.decorator(node as FootnoteNode, editor) : null,
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerFootnoteCommands(editor));
    this.register(registerFootnoteStructure(editor));
    if (!editor._headless) {
      this.register(
        registerFootnoteSync(editor, this.service, () => this.kernel.t('footnote.unused')),
      );
    }

    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (markdownService) registerFootnoteMarkdown(markdownService);

    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (litexmlService) registerFootnoteLiteXml(litexmlService);

    const nodeService = this.kernel.requireService(INodeService);
    if (nodeService) nodeService.registerProcessNodeTree(normalizeFootnoteINodeTree);
    else logger.debug('INodeService missing; imported footnote sections are merged in the editor');
  }
};
