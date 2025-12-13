import { LexicalEditor, LexicalNode } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerLiteXMLCommand } from '../command';
import { registerLiteXMLDiffCommand } from '../command/diffCommand';
import LitexmlDataSource from '../data-source/litexml-data-source';
import { DiffNode } from '../node/DiffNode';
import { ILitexmlService, LitexmlService } from '../service/litexml-service';

/**
 * LitexmlPluginOptions - Configuration options for the Litexml plugin
 */
export interface LitexmlPluginOptions {
  decorator: (node: DiffNode, editor: LexicalEditor) => any;
  /**
   * Enable or disable the litexml data source
   * @default true
   */
  enabled?: boolean;
  theme?: string;
}

/**
 * LitexmlPlugin - A plugin that provides XML-based data source support
 * Allows converting between Lexical editor state and XML format
 */
export const LitexmlPlugin: IEditorPluginConstructor<LitexmlPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<LitexmlPluginOptions>
{
  static pluginName = 'LitexmlPlugin';
  datasource: LitexmlDataSource;

  constructor(
    protected kernel: IEditorKernel,
    public config?: LitexmlPluginOptions,
  ) {
    super();

    kernel.registerThemes({
      diffNode: config?.theme || 'editor_diffNode',
    });

    // Create and register the Litexml service
    const litexmlService = new LitexmlService();
    kernel.registerService(ILitexmlService, litexmlService);
    this.datasource = new LitexmlDataSource('litexml', litexmlService);

    // register diff node type
    kernel.registerNodes([DiffNode]);
    kernel.registerDecorator(DiffNode.getType(), {
      queryDOM: (el: HTMLElement) => el.querySelector('.toolbar')!,
      render: (node: LexicalNode, editor: LexicalEditor) => {
        return config?.decorator ? config.decorator(node as DiffNode, editor) : null;
      },
    });

    // Register the litexml data source
    if (config?.enabled !== false) {
      kernel.registerDataSource(this.datasource);
    }
  }

  onInit(editor: LexicalEditor): void {
    // Plugin initialization logic can be added here if needed
    this.register(registerLiteXMLCommand(editor, this.datasource));
    this.register(registerLiteXMLDiffCommand(editor));
  }
};
