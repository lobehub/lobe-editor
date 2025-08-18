import EventEmitter from 'eventemitter3';
import {
  CommandPayloadType,
  DecoratorNode,
  LexicalCommand,
  LexicalEditor,
  LexicalNodeConfig,
  createEditor,
} from 'lexical';
import { get, template, templateSettings } from 'lodash-es';
import merge from 'lodash/merge';

import defaultLocale from '@/locale';

import DataSource from './data-source';
import { registerEvent } from './event';
import {
  IEditor,
  IEditorKernel,
  IEditorPlugin,
  IEditorPluginConstructor,
  ILocaleKeys,
  IPlugin,
  IServiceID,
} from './types';
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

  private editor?: LexicalEditor;

  constructor() {
    super();
    this.dataTypeMap = new Map<string, DataSource>();
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
        throw new Error(
          `Plugin with name "${plugin.pluginName}" is already registered with a different implementation.`,
        );
      }
      return this; // If plugin already exists, don't register again
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
      throw new Error(`Service with ID "${serviceId.__serviceId}" is already registered.`);
    }
    this.serviceMap.set(serviceId.__serviceId, service);
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
