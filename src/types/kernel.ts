import type { HistoryState, HistoryStateEntry } from '@lexical/history';
import type {
  CommandListener,
  CommandListenerPriority,
  CommandPayloadType,
  EditorState,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  LexicalNodeConfig,
} from 'lexical';

import type DataSource from '@/editor-kernel/data-source';
import type { HotkeyId } from '@/types/hotkey';
import type { HotkeyOptions, HotkeysEvent } from '@/utils/hotkey/registerHotkey';

import type { ILocaleKeys } from './locale';

export type Commands = Map<LexicalCommand<unknown>, Array<Set<CommandListener<unknown>>>>;
export type CommandsClean = Map<LexicalCommand<unknown>, () => void>;

export type IDecoratorFunc = (_node: LexicalNode, _editor: LexicalEditor) => any;
export type IDecorator =
  | {
      queryDOM: (_element: HTMLElement) => HTMLElement;
      render: IDecoratorFunc;
    }
  | IDecoratorFunc;

/**
 * Service ID type
 */
export type IServiceID<Service> = {
  readonly __serviceId: string;
  __serviceType?: Service;
};

export interface IKernelEventMap {
  /**
   * Document change event
   */
  documentChange: (type: string, content: any) => void;
  /**
   * Editor editable state change event
   */
  editableChange: (editable: boolean) => void;

  /**
   * Editor error event
   */
  error: (error: Error) => void;
  /**
   * Initialization event
   * @param editor Lexical editor instance
   * @returns
   */
  initialized: (editor: LexicalEditor) => void;
  /**
   * handle markdown parse event
   */
  markdownParse: (params: {
    cacheState: EditorState;
    historyState: HistoryStateEntry | null;
    markdown: string;
  }) => void;

  /**
   * handle paste event
   */
  onPaste: (event: ClipboardEvent) => void;
}

/**
 * External API
 */
export interface IEditor {
  /**
   * Lose focus
   */
  blur(): void;
  /**
   * Clean editor content (clear all content)
   */
  cleanDocument(): void;
  /**
   * Destroy editor instance
   */
  destroy(): void;
  /**
   * Execute editor commands to manipulate editor content
   * @param type
   * @param payload
   */
  dispatchCommand<TCommand extends LexicalCommand<unknown>>(
    type: TCommand,
    payload: CommandPayloadType<TCommand>,
  ): boolean;
  /**
   * Focus editor
   */
  focus(): void;
  /**
   * Get editor content of specified type
   */
  getDocument(type: string): DataSource | undefined;
  /**
   * Get Lexical editor instance
   */
  getLexicalEditor(): LexicalEditor | null;

  /**
   * Get document editor root node
   */
  getRootElement(): HTMLElement | null;
  /**
   * Get document editor selection content of specified type
   * @param type
   */
  getSelectionDocument(type: string): unknown | null;
  /**
   * Get editor theme
   */
  getTheme(): Record<string, string | Record<string, string>>;
  /**
   * Get node editor instance
   */
  initNodeEditor(): LexicalEditor | null;

  /**
   * Check if editor is editable
   */
  isEditable(): boolean;

  /**
   * Check if editor content is empty
   * @returns true if editor content is empty, false otherwise
   */
  get isEmpty(): boolean;
  /**
   * Check if editor has active selection
   * @returns true if editor has selection, false otherwise
   */
  get isSelected(): boolean;
  /**
   * Remove editor event listener
   * @param event
   * @param listener
   */
  off<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * Add editor event listener
   * @param event
   * @param listener
   */
  on<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * Listen to event once, automatically remove listener after trigger
   * @param event
   * @param listener
   */
  once<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;

  /**
   * Extends the priority level of Lexical commands.
   * Registers a listener that triggers when the provided command is dispatched
   * via {@link LexicalEditor.dispatch}. The listener is triggered based on its priority.
   * Listeners with higher priority can "intercept" commands and prevent them
   * from propagating to other handlers by returning true.
   *
   * Listeners are always invoked within {@link LexicalEditor.update} and can call dollar functions.
   *
   * Listeners registered at the same priority level will deterministically run
   * in the order of registration.
   *
   * @param command - The command that triggers the callback.
   * @param listener - The function executed when the command is dispatched.
   * @param priority - The relative priority of the listener. 0 | 1 | 2 | 3 | 4
   *   (or {@link COMMAND_PRIORITY_EDITOR} |
   *     {@link COMMAND_PRIORITY_LOW} |
   *     {@link COMMAND_PRIORITY_NORMAL} |
   *     {@link COMMAND_PRIORITY_HIGH} |
   *     {@link COMMAND_PRIORITY_CRITICAL})
   * @returns A teardown function to clean up the listener.
   */
  registerHighCommand<P>(
    command: LexicalCommand<P>,
    listener: CommandListener<P>,
    priority: CommandListenerPriority,
  ): () => void;
  /**
   * Register keyboard shortcut
   * @param hotkey
   * @param callback
   * @param options
   */
  registerHotkey(
    hotkey: HotkeyId,
    callback: (event: KeyboardEvent, handler: HotkeysEvent) => void,
    options?: HotkeyOptions,
  ): () => void;

  /**
   * Register internationalization text
   * @param locale Internationalization text object
   */
  registerLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void;

  /**
   * Register editor plugin
   */
  registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;

  /**
   * Register multiple editor plugins
   */
  registerPlugins(plugins: Array<IPlugin>): IEditor;

  /**
   * Get editor Service, usually provided by plugins to extend certain functionalities
   * @param serviceId
   */
  requireService<T>(serviceId: IServiceID<T>): T | null;

  /**
   * Set editor content, type is content type, content is content data
   * @param type
   * @param content
   */
  setDocument(type: string, content: any): void;

  /**
   * Enable or disable editor editing capability
   * @param editable
   */
  setEditable(editable: boolean): void;

  /**
   * Set document editor root node
   * @param dom
   */
  setRootElement(dom: HTMLElement, editable?: boolean): LexicalEditor;

  /**
   * Get translation text
   * @param key Translation key
   * @param params Parameter replacement
   */
  t<K extends keyof ILocaleKeys>(key: K, params?: Record<string, any>): string;
  /**
   * Update editor theme
   * @param key
   * @param value
   */
  updateTheme(key: string, value: string | Record<string, string>): void;
}

/**
 * API provided to plugins
 */
export interface IEditorKernel extends IEditor {
  emit<T extends keyof IKernelEventMap>(event: T, params: Parameters<IKernelEventMap[T]>[0]): void;
  /**
   * Get editor Node decorator for specific Node rendering
   * @param name
   */
  getDecorator(name: string): IDecorator | undefined;
  /**
   * Get editor history state
   */
  getHistoryState(): HistoryState;
  /**
   * Get all registered decorator names
   */
  getRegisteredDecorators(): string[];
  /**
   * Check if hot reload mode is enabled
   */
  isHotReloadMode(): boolean;
  /**
   * Register data source for multi-format data conversion
   * @param dataSource
   */
  registerDataSource(dataSource: DataSource): void;
  /**
   * Register editor node decorator
   * @param name
   * @param decorator
   */
  registerDecorator(name: string, decorator: IDecorator): void;
  /**
   * Register Lexical Node
   * @param nodes
   */
  registerNodes(nodes: Array<LexicalNodeConfig>): void;
  /**
   * Register service
   * @param serviceId
   * @param service
   */
  registerService<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Register service with hot reload support - allows overriding existing services
   * @param serviceId Service identifier
   * @param service Service instance
   */
  registerServiceHotReload<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Register theme
   * @param themes
   */
  registerThemes(themes: Record<string, any>): void;

  /**
   * Enable or disable hot reload mode
   * @param enabled Whether to enable hot reload mode
   */
  setHotReloadMode(enabled: boolean): void;

  /**
   * Unregister editor node decorator
   * @param name Decorator name
   */
  unregisterDecorator(name: string): boolean;
}

/**
 * Plugin interface
 */
export interface IEditorPlugin<IConfig> {
  config?: IConfig;
  /**
   * Editor destruction
   */
  destroy(): void;
  /**
   * After Lexical editor instantiation
   * @param editor Lexical editor instance
   */
  onInit?(editor: LexicalEditor): void;
}

/**
 * Plugin class interface
 */
export interface IEditorPluginConstructor<IConfig> {
  readonly pluginName: string; // Plugin name, must be unique
  new (kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}

export interface IKernelStatic {
  resetGlobalHotReloadMode(): void;
  setGlobalHotReloadMode(enabled: boolean): void;
}

export type IPlugin<T = any> = IEditorPluginConstructor<T> | [IEditorPluginConstructor<T>, T?];
