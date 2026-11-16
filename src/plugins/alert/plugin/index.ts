import type { LexicalEditor } from 'lexical';

import type { INode } from '@/editor-kernel/inode';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { ILitexmlService } from '@/plugins/litexml';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerAlertCommand } from '../command';
import { $isAlertNode, AlertNode, normalizeAlertType } from '../node/AlertNode';
import { registerAlertKeyboard } from './keyboard';
import {
  formatAlertMarkdown,
  matchAlertMarker,
  stripAlertMarker,
  wrapInlineChildren,
} from './utils';

export interface AlertPluginOptions {
  theme?: {
    alert?: string;
  };
}

export const AlertPlugin: IEditorPluginConstructor<AlertPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<AlertPluginOptions>
{
  static pluginName = 'AlertPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: AlertPluginOptions,
  ) {
    super();
    kernel.registerNodes([AlertNode]);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerAlertCommand(editor));
    this.register(registerAlertKeyboard(editor));
    this.registerMarkdown();
    this.registerLiteXml();
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownWriter(AlertNode.getType(), (ctx, node) => {
      if (!$isAlertNode(node)) return false;
      const alertType = node.getAlertType();
      ctx.addProcessor((_before, content) => formatAlertMarkdown(alertType, content));
    });

    markdownService.registerMarkdownReader(
      'blockquote',
      (node, children) => {
        const alertType = matchAlertMarker(node);
        if (!alertType) return false;

        const body = stripAlertMarker(children as INode[]);
        return INodeHelper.createElementNode(AlertNode.getType(), {
          alertType,
          children: body.length > 0 ? body : [INodeHelper.createParagraph()],
        });
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }

  private registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) return;

    litexmlService.registerXMLWriter(AlertNode.getType(), (node, ctx) => {
      if (!$isAlertNode(node)) return false;
      return ctx.createXmlNode('alert', { type: node.getAlertType() });
    });

    litexmlService.registerXMLReader('alert', (xmlNode, children) => {
      const body = wrapInlineChildren(children as INode[]);
      return INodeHelper.createElementNode(AlertNode.getType(), {
        alertType: normalizeAlertType(xmlNode.getAttribute('type')),
        children: body.length > 0 ? body : [INodeHelper.createParagraph()],
      });
    });
  }
};
