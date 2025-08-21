import EventEmitter from 'eventemitter3';
import {
  CommandPayloadType,
  DecoratorNode,
  LexicalCommand,
  LexicalEditor,
  LexicalNodeConfig,
  createEditor,
} from 'lexical';
import { get, merge, template, templateSettings } from 'lodash-es';

import defaultLocale from '@/locale';
import {
  IEditor,
  IEditorKernel,
  IEditorPlugin,
  IEditorPluginConstructor,
  IPlugin,
  IServiceID,
} from '@/types/kernel';
import { ILocaleKeys } from '@/types/locale';

import DataSource from './data-source';
import { registerEvent } from './event';
import { createEmptyEditorState } from './utils';

templateSettings.interpolate = /{{([\S\s]+?)}}/g;

export class Kernel extends EventEmitter implements IEditorKernel {
  private dataTypeMap: Map<string, DataSource>;
  private plugins: Array<IEditorPluginConstructor<any> & { __config: any }> = [];
  private pluginsInstances: Array<IEditorPlugin<any>> = [];
  private nodes: Array<LexicalNodeConfig> = [];
  private themes: Record<string, any> = {}; // Used to store theme configuration
  private decorators: Record<string, (_node: DecoratorNode<any>, _editor: LexicalEditor) => any> =
    {};
  private serviceMap: Map<string, any> = new Map();
  private localeMap: Record<keyof ILocaleKeys, string> = defaultLocale as unknown as Record<
    keyof ILocaleKeys,
    string
  >;
  private hotReloadMode: boolean = false;

  private editor?: LexicalEditor;

  constructor() {
    super();
    this.dataTypeMap = new Map<string, DataSource>();
    // Enable hot reload mode in development
    this.hotReloadMode = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  }

  getLexicalEditor(): LexicalEditor | null {
    return this.editor || null;
  }

  destroy() {
    this.editor?.setEditorState(createEmptyEditorState());
    this.dataTypeMap.clear();
    this.pluginsInstances.forEach((plugin) => {
      if (plugin.destroy) {
        plugin.destroy();
      }
    });
    this.pluginsInstances = [];
    // Clear services to support hot reload
    this.serviceMap.clear();
  }

  getRootElement(): HTMLElement | null {
    return this.editor?.getRootElement() || null;
  }

  setRootElement(dom: HTMLElement) {
    for (const plugin of this.plugins) {
      const instance = new plugin(this, plugin.__config);
      this.pluginsInstances.push(instance);
    }
    const editor = (this.editor = createEditor({
      // @ts-expect-error Inject into lexical editor instance
      __kernel: this,
      nodes: this.nodes,
      onError: (error: Error) => {
        this.emit('error', error);
      },
      theme: this.themes,
    }));
    this.editor.setRootElement(dom);
    registerEvent(editor, dom);

    this.pluginsInstances.forEach((plugin) => {
      plugin.onInit?.(editor);
    });
    this.emit('initialized', editor);
    return this.editor;
  }

  setDocument(type: string, content: any) {
    const datasource = this.dataTypeMap.get(type);
    if (!datasource) {
      throw new Error(`DataSource for type "${type}" is not registered.`);
    }
    if (!this.editor) {
      throw new Error(`Editor is not initialized.`);
    }
    datasource.read(this.editor, content);
  }

  focus() {
    this.editor?.focus();
  }

  blur(): void {
    this.editor?.blur();
  }

  getDocument(type: string): DataSource | undefined {
    const datasource = this.dataTypeMap.get(type);
    if (!datasource) {
      throw new Error(`DataSource for type "${type}" is not registered.`);
    }
    if (!this.editor) {
      throw new Error(`Editor is not initialized.`);
    }
    return datasource.write(this.editor);
  }

  registerDecorator(
    name: string,
    decorator: (_node: DecoratorNode<any>, _editor: LexicalEditor) => any,
  ) {
    this.decorators[name] = decorator;
    return this;
  }

  getDecorator(
    name: string,
  ): ((_node: DecoratorNode<any>, _editor: LexicalEditor) => any) | undefined {
    return this.decorators[name];
  }

  /**
   * Support registering target data source
   * @param dataSource Data source
   */
  registerDataSource(dataSource: DataSource) {
    this.dataTypeMap.set(dataSource.type, dataSource);
  }

  registerThemes(themes: Record<string, any>) {
    this.themes = merge(this.themes, themes);
  }

  registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor {
    const findPlugin = this.plugins.find((p) => p.pluginName === plugin.pluginName);
    if (findPlugin) {
      // Error if same name but different plugin
      if (findPlugin !== plugin) {
        if (this.hotReloadMode) {
          console.warn(
            `[Hot Reload] Replacing plugin "${plugin.pluginName}" with new implementation`,
          );
          // Remove old plugin
          const index = this.plugins.findIndex((p) => p.pluginName === plugin.pluginName);
          if (index !== -1) {
            this.plugins.splice(index, 1);
          }
        } else {
          throw new Error(
            `Plugin with name "${plugin.pluginName}" is already registered with a different implementation.`,
          );
        }
      } else {
        return this; // If plugin already exists, don't register again
      }
    }
    // @ts-expect-error not error
    plugin.__config = config || {};
    // @ts-expect-error not error
    this.plugins.push(plugin);
    return this;
  }

  registerPlugins(plugins: Array<IPlugin>): IEditor {
    for (const plugin of plugins) {
      if (Array.isArray(plugin)) {
        this.registerPlugin(plugin[0], plugin[1]);
      } else {
        this.registerPlugin(plugin);
      }
    }
    return this;
  }

  registerNodes(nodes: Array<LexicalNodeConfig>) {
    this.nodes.push(...nodes);
  }

  registerService<T>(serviceId: IServiceID<T>, service: T): void {
    if (this.serviceMap.has(serviceId.__serviceId)) {
      if (this.hotReloadMode) {
        // In hot reload mode, allow service override with warning
        console.warn(`[Hot Reload] Overriding service with ID "${serviceId.__serviceId}"`);
      } else {
        throw new Error(`Service with ID "${serviceId.__serviceId}" is already registered.`);
      }
    }
    this.serviceMap.set(serviceId.__serviceId, service);
  }

  /**
   * Register service with hot reload support - allows overriding existing services
   * @param serviceId Service identifier
   * @param service Service instance
   */
  registerServiceHotReload<T>(serviceId: IServiceID<T>, service: T): void {
    this.serviceMap.set(serviceId.__serviceId, service);
  }

  /**
   * Enable or disable hot reload mode
   * @param enabled Whether to enable hot reload mode
   */
  setHotReloadMode(enabled: boolean): void {
    this.hotReloadMode = enabled;
  }

  /**
   * Check if hot reload mode is enabled
   */
  isHotReloadMode(): boolean {
    return this.hotReloadMode;
  }

  /**
   * Get service
   * @param serviceId Service ID
   */
  requireService<T>(serviceId: IServiceID<T>): T | null {
    const service = this.serviceMap.get(serviceId.__serviceId);
    if (!service) {
      return null;
    }
    return service as T;
  }

  dispatchCommand<TCommand extends LexicalCommand<unknown>>(
    type: TCommand,
    payload: CommandPayloadType<TCommand>,
  ): boolean {
    if (!this.editor) {
      throw new Error('Editor is not initialized.');
    }
    return this.editor.dispatchCommand(type, payload);
  }

  getTheme() {
    return this.themes;
  }

  updateTheme(key: string, value: string | Record<string, string>): void {
    this.themes[key] = value;
  }

  registerLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void {
    this.localeMap = merge(this.localeMap, locale);
  }

  t<K extends keyof ILocaleKeys>(key: K, params?: Record<string, any>): string {
    let translation = get(this.localeMap, key) || key;
    if (params) {
      const compiled = template(translation);
      translation = compiled(params);
    }
    return translation;
  }
}
