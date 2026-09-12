import type { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerBlockRewriteCommand } from '../command';
import {
  BlockRewriteAdapterRegistry,
  IBlockRewriteAdapterService,
} from '../service/rewrite-adapter';
import {
  CollaborativeTargetLeaseService,
  ICollaborativeTargetLeaseService,
} from '../service/target-lease';

/** Headless/browser bridge for adapter-owned atomic block mutations. */
type BlockRewritePluginConfig = Record<string, never>;

export const BlockRewritePlugin: IEditorPluginConstructor<BlockRewritePluginConfig> = class
  extends KernelPlugin
  implements IEditorPlugin<BlockRewritePluginConfig>
{
  static pluginName = 'BlockRewritePlugin';

  constructor(protected kernel: IEditorKernel) {
    super();
    if (!kernel.requireService(IBlockRewriteAdapterService)) {
      kernel.registerServiceHotReload(
        IBlockRewriteAdapterService,
        new BlockRewriteAdapterRegistry(),
      );
    }
    if (!kernel.requireService(ICollaborativeTargetLeaseService)) {
      kernel.registerServiceHotReload(
        ICollaborativeTargetLeaseService,
        new CollaborativeTargetLeaseService(),
      );
    }
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerBlockRewriteCommand(editor, this.kernel));
  }
};
