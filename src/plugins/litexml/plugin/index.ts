import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

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

  constructor(
    protected kernel: IEditorKernel,
    public config?: LitexmlPluginOptions,
  ) {
    super();

    // Create and register the Litexml service
    const litexmlService = new LitexmlService();
    kernel.registerService(ILitexmlService, litexmlService);

    // Register the litexml data source
    if (config?.enabled !== false) {
      kernel.registerDataSource(new LitexmlDataSource('litexml', litexmlService));
    }
  }

  onInit(): void {
    // Plugin initialization logic can be added here if needed
  }
};
