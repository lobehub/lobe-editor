import { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerLiteXMLCommand } from '../command';
import LitexmlDataSource from '../data-source/litexml-data-source';
import { ILitexmlService, LitexmlService } from '../service/litexml-service';

/**
 * LitexmlPluginOptions - Configuration options for the Litexml plugin
 */
export interface LitexmlPluginOptions {
  /**
   * Enable or disable the litexml data source
   * @default true
   */
  enabled?: boolean;
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

    // Create and register the Litexml service
    const litexmlService = new LitexmlService();
    kernel.registerService(ILitexmlService, litexmlService);
    this.datasource = new LitexmlDataSource('litexml', litexmlService);

    // Register the litexml data source
    if (config?.enabled !== false) {
      kernel.registerDataSource(this.datasource);
    }
  }

  onInit(editor: LexicalEditor): void {
    // Plugin initialization logic can be added here if needed
    registerLiteXMLCommand(editor, this.datasource);
  }
};
