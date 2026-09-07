import { KernelPlugin } from '@/editor-kernel/plugin';
import { registerBlockRewriteAdapter } from '@/plugins/block/service/rewrite-adapter';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

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

  onInit(): void {
    // Registration is complete in the constructor. No DOM/Markdown lifecycle
    // is needed for a headless rewrite target.
  }
};
