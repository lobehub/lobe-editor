import type {
  CommandPayloadType,
  DecoratorNode,
  LexicalCommand,
  LexicalEditor,
  LexicalNodeConfig,
} from 'lexical';

import type DataSource from '@/editor-kernel/data-source';

import { ILocaleKeys } from './locale';

/**
 * Service ID type
 */
export type IServiceID<Service> = {
  readonly __serviceId: string;
  __serviceType?: Service;
};

export interface IKernelEventMap {
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
   * Set document editor root node
   * @param dom
   */
  setRootElement(dom: HTMLElement): LexicalEditor;

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
  /**
   * Get editor Node decorator for specific Node rendering
   * @param name
   */
  getDecorator(
    name: string,
  ): ((_node: DecoratorNode<any>, _editor: LexicalEditor) => any) | undefined;
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
  registerDecorator(
    name: string,
    decorator: (_node: DecoratorNode<any>, _editor: LexicalEditor) => any,
  ): void;
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
