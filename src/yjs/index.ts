// Node-safe server entry for the Yjs plugin: the main entry pulls in modules
// that import JSON without import attributes, which Node ESM rejects.
export type {
  YjsInitialEditorState,
  YjsPluginOptions,
  YjsProviderFactory,
} from '../plugins/yjs/plugin';
export { YjsPlugin } from '../plugins/yjs/plugin';
export type { YjsAwarenessUser, YjsPluginState, YjsService } from '../plugins/yjs/service';
export { IYjsService } from '../plugins/yjs/service';
