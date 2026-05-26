import { KernelPlugin } from '@/editor-kernel/plugin';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import { ContentBlocksDataSource } from '../data-source/content-blocks-data-source';
import type { ExtractContentBlocksOptions } from '../types';

export interface ContentBlocksPluginOptions {
  defaultOptions?: ExtractContentBlocksOptions;
}

export const ContentBlocksPlugin: IEditorPluginConstructor<ContentBlocksPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ContentBlocksPluginOptions>
{
  static pluginName = 'ContentBlocksPlugin';
  private logger = createDebugLogger('plugin', 'content-blocks');

  constructor(
    protected kernel: IEditorKernel,
    public config?: ContentBlocksPluginOptions,
  ) {
    super();
    kernel.registerDataSource(
      new ContentBlocksDataSource(
        () => kernel.requireService(IMarkdownShortCutService),
        config?.defaultOptions,
      ),
    );
  }

  onInit(): void {
    if (!this.kernel.requireService(IMarkdownShortCutService)) {
      this.logger.warn(
        'MarkdownPlugin is not registered; content-blocks extraction will throw on demand.',
      );
    }
  }
};
