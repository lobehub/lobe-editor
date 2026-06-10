import type { ExcludedProperties, Provider } from '@lexical/yjs';
import type { EditorState, LexicalEditor } from 'lexical';
import type { Doc } from 'yjs';

export type YjsProviderFactory = (id: string, yjsDocMap: Map<string, Doc>) => Provider;

export type YjsInitialEditorState = EditorState | ((editor: LexicalEditor) => void) | null | string;

export interface YjsPluginOptions {
  excludedProperties?: ExcludedProperties;
  id: string;
  initialEditorState?: YjsInitialEditorState;
  providerFactory: YjsProviderFactory;
  shouldBootstrap?: boolean;
  yjsDoc?: Doc;
}
