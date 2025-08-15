import type { CodeblockPluginOptions } from '@/plugins/codeblock';

export interface ReactCodeblockPluginProps extends CodeblockPluginOptions {
  className?: string;
  shikiTheme?: string;
}
