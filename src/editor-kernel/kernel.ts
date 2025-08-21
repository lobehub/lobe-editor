import EventEmitter from 'eventemitter3';
import {
  COMMAND_PRIORITY_CRITICAL,
  CommandListener,
  CommandListenerPriority,
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
  Commands,
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
  // Global hot reload flag
  private static globalHotReloadMode: boolean | undefined = undefined;
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
    this.hotReloadMode = this.detectDevelopmentMode();
  }

  private detectDevelopmentMode(): boolean {
    // Check global override first
    if (Kernel.globalHotReloadMode !== undefined) {
      return Kernel.globalHotReloadMode;
    }

    // Multiple ways to detect development mode
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }

    // Check for common development indicators
    if (typeof window !== 'undefined') {
      // Webpack HMR
      if ((window as any).webpackHotUpdate) {
        return true;
      }
      // Vite HMR
      if ((window as any).__vite_plugin_react_preamble_installed__) {
        return true;
      }
      // Next.js development
      if ((window as any).__NEXT_DATA__?.buildId === 'development') {
        return true;
      }
    }

    // Check for localhost or development URLs
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
        return true;
      }
    }

    // Default to development mode for better DX
    return true;
  }

  /**
   * Globally enable or disable hot reload mode for all kernel instances
   * @param enabled Whether to enable hot reload mode globally
   */
  static setGlobalHotReloadMode(enabled: boolean): void {
    Kernel.globalHotReloadMode = enabled;
  }

  /**
   * Reset global hot reload mode to automatic detection
   */
  static resetGlobalHotReloadMode(): void {
    Kernel.globalHotReloadMode = undefined;
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
    // Check if editor is already initialized to prevent re-initialization
    if (this.editor) {
      console.warn('[Editor] Editor is already initialized, updating root element only');
      this.editor.setRootElement(dom);
      return this.editor;
    }

    // Initialize plugins if not already done
    if (this.pluginsInstances.length === 0) {
      for (const plugin of this.plugins) {
        const instance = new plugin(this, plugin.__config);
        this.pluginsInstances.push(instance);
      }
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
            // Also remove corresponding plugin instance if it exists
            const instanceIndex = this.pluginsInstances.findIndex((instance) => {
              return (instance.constructor as any).pluginName === plugin.pluginName;
            });
            if (instanceIndex !== -1) {
              const oldInstance = this.pluginsInstances[instanceIndex];
              if (oldInstance.destroy) {
                oldInstance.destroy();
              }
              this.pluginsInstances.splice(instanceIndex, 1);
            }
          }
        } else {
          throw new Error(
            `Plugin with name "${plugin.pluginName}" is already registered with a different implementation.`,
          );
        }
      } else {
        // Same plugin, just update config if provided
        if (config !== undefined) {
          // @ts-expect-error not error
          plugin.__config = config;
        }
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
    const serviceIdString = serviceId.__serviceId;

    if (this.serviceMap.has(serviceIdString)) {
      if (this.hotReloadMode) {
        // In hot reload mode, allow service override with warning
        console.warn(`[Hot Reload] Overriding service with ID "${serviceIdString}"`);
        this.serviceMap.set(serviceIdString, service);
        return;
      } else {
        // Check if it's the same service instance
        const existingService = this.serviceMap.get(serviceIdString);
        if (existingService === service) {
          // Same service instance, no need to re-register
          console.warn(
            `[Editor] Service "${serviceIdString}" is already registered with the same instance`,
          );
          return;
        }

        // Different service instance in production mode
        console.error(
          `[Editor] Attempting to register duplicate service "${serviceIdString}". Enable hot reload mode if this is intended.`,
        );
        throw new Error(`Service with ID "${serviceIdString}" is already registered.`);
      }
    }

    this.serviceMap.set(serviceIdString, service);
    console.debug(`[Editor] Registered service: ${serviceIdString}`);
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

  private _commands: Commands = new Map();
  private _commandsClean: Map<LexicalCommand<unknown>, () => void> = new Map();

  registerHighCommand<P>(
    command: LexicalCommand<P>,
    listener: CommandListener<P>,
    priority: CommandListenerPriority,
  ): () => void {
    const lexicalEditor = this.editor;
    if (!lexicalEditor) {
      throw new Error('Editor is not initialized.');
    }
    const commandsMap = this._commands;

    if (!commandsMap.has(command)) {
      commandsMap.set(command, [new Set(), new Set(), new Set(), new Set(), new Set()]);
      this._commandsClean.set(
        command,
        lexicalEditor.registerCommand(
          command,
          (payload: any) => {
            for (let i = 4; i >= 0; i--) {
              const listenerInPriorityOrder = this._commands.get(command);

              if (listenerInPriorityOrder !== undefined) {
                const listenersSet = listenerInPriorityOrder[i];
                for (const listener of listenersSet) {
                  if (listener(payload, lexicalEditor)) {
                    return true;
                  }
                }
              }
            }
            return false;
          },
          COMMAND_PRIORITY_CRITICAL,
        ),
      );
    }

    const listenersInPriorityOrder = commandsMap.get(command);

    if (listenersInPriorityOrder === undefined) {
      return () => {};
    }

    const listeners = listenersInPriorityOrder[priority];
    listeners.add(listener as CommandListener<unknown>);
    return () => {
      listeners.delete(listener as CommandListener<unknown>);

      if (listenersInPriorityOrder.every((listenersSet) => listenersSet.size === 0)) {
        commandsMap.delete(command);
        this._commandsClean.get(command)?.();
      }
    };
  }
}
