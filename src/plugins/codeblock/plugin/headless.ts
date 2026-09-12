import { CodeNode } from '@lexical/code-core';
import type { LexicalEditor } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { registerBlockRewriteAdapter } from '@/plugins/block/service/rewrite-adapter';
import { IHoleService } from '@/plugins/common/service/i-hole-service';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCodeblockHoleEntry } from '../command/hole-entry';
import { codeBlockRewriteAdapter } from '../rewrite-adapter';

export interface HeadlessCodeblockPluginOptions {
  shikiTheme?:
    | string
    | {
        dark: string;
        light: string;
      };
  theme?: {
    code?: string;
  };
}

/**
 * Node-only adapter registration. The ordinary CodeNode and the CodeMirror
 * node intentionally share Lexical's `code` type, so registering both in one
 * headless editor would make hydration order decide which class wins. The
 * active node plugin owns node registration; this plugin only makes the
 * ordinary CodeNode adapter available without importing the browser
 * highlighter/command module (which imports the React-facing UI theme).
 */
export const HeadlessCodeblockPlugin: IEditorPluginConstructor<HeadlessCodeblockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<HeadlessCodeblockPluginOptions>
{
  static pluginName = 'HeadlessCodeblockPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config: HeadlessCodeblockPluginOptions = {},
  ) {
    super();
    this.register(registerBlockRewriteAdapter(kernel, codeBlockRewriteAdapter));
  }

  onInit(editor: LexicalEditor): void {
    const holeService = this.kernel.requireService(IHoleService);
    if (holeService) this.register(holeService.registerTarget(CodeNode));
    this.register(registerCodeblockHoleEntry(editor));

    // No DOM/Markdown lifecycle is needed for a headless rewrite target.
  }
};
