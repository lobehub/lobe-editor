import { AISessionPlugin } from '@/plugins/ai-session/plugin';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { CodePlugin } from '@/plugins/code/plugin';
import { HeadlessCodeblockPlugin } from '@/plugins/codeblock/plugin/headless';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { FilePlugin } from '@/plugins/file/plugin';
import { HRPlugin } from '@/plugins/hr/plugin';
import { ImagePlugin } from '@/plugins/image/plugin';
import { INodePlugin } from '@/plugins/inode/plugin';
import { LinkPlugin } from '@/plugins/link/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import { LitexmlPlugin } from '@/plugins/litexml/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { MathPlugin } from '@/plugins/math/plugin';
import { MentionPlugin } from '@/plugins/mention/plugin';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IPlugin } from '@/types';

import { HeadlessCollapsiblePlugin } from './collapsible-plugin';

/**
 * The DOM-free node/plugin set shared by ordinary headless projections and
 * collaborative Agent editors. Keep React plugins out of this list.
 */
export const DEFAULT_HEADLESS_EDITOR_PLUGINS: ReadonlyArray<IPlugin> = [
  [CommonPlugin, { enableHotkey: false }],
  BlockRewritePlugin,
  INodePlugin,
  MarkdownPlugin,
  [LinkPlugin, { enableHotkey: false }],
  CodePlugin,
  HeadlessCodeblockPlugin,
  CodemirrorPlugin,
  ImagePlugin,
  FilePlugin,
  MathPlugin,
  MentionPlugin,
  HRPlugin,
  ListPlugin,
  TablePlugin,
  HeadlessCollapsiblePlugin,
  LitexmlPlugin,
  ArtifactPlugin,
  PropertiesPlugin,
  AISessionPlugin,
];
