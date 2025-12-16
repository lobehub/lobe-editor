import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { INodeService, NodeService } from '../service';

/**
 * NodePluginOptions - Configuration options for the Node plugin
 */
export interface INodePluginOptions {
  /**
   * Enable or disable the node data source
   * @default true
   */
  enabled?: boolean;
}

/**
 * LitexmlPlugin - A plugin that provides XML-based data source support
 * Allows converting between Lexical editor state and XML format
 */
export const INodePlugin: IEditorPluginConstructor<INodePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<INodePluginOptions>
{
  static pluginName = 'INodePlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: INodePluginOptions,
  ) {
    super();

    // Create and register the Node service
    const nodeService = new NodeService();
    kernel.registerService(INodeService, nodeService);
  }

  onInit(): void {
    // Plugin initialization logic can be added here if needed
  }
};
