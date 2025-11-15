import { HistoryState, createEmptyHistoryState } from '@lexical/history';
import EventEmitter from 'eventemitter3';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  CommandListener,
  CommandListenerPriority,
  CommandPayloadType,
  DecoratorNode,
  KEY_DOWN_COMMAND,
  LexicalCommand,
  LexicalEditor,
  LexicalNodeConfig,
  createEditor,
} from 'lexical';
import { get, merge, template, templateSettings } from 'lodash-es';

import defaultLocale from '@/locale';
import { $isRootTextContentEmpty } from '@/plugins/common/utils';
import { HotkeyId } from '@/types/hotkey';
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
import { createDebugLogger } from '@/utils/debug';
import {
  HotkeyOptions,
  HotkeysEvent,
  getHotkeyById,
  registerHotkey,
} from '@/utils/hotkey/registerHotkey';

import DataSource from './data-source';
import { registerEvent } from './event';
import { KernelPlugin } from './plugin';
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
  private logger = createDebugLogger('kernel');

  private historyState = createEmptyHistoryState();

  private editor?: LexicalEditor;

  constructor() {
    super();
    this.dataTypeMap = new Map<string, DataSource>();
    // Enable hot reload mode in development
    this.hotReloadMode = this.detectDevelopmentMode();
    this.logger.info(`🚀 Kernel initialized (hot reload: ${this.hotReloadMode})`);
  }

  getHistoryState(): HistoryState {
    return this.historyState;
  }

  isEditable(): boolean {
    return this.editor?.isEditable() || false;
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
    this.logger.info(`🗑️ Destroying editor with ${this.pluginsInstances.length} plugins`);
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
    // Clear decorators to prevent memory leaks
    this.decorators = {};
    this.logger.info('✅ Editor destroyed');
  }

  getRootElement(): HTMLElement | null {
    return this.editor?.getRootElement() || null;
  }

  setRootElement(dom: HTMLElement, editable: boolean = true): LexicalEditor {
    // Check if editor is already initialized to prevent re-initialization
    if (this.editor) {
      this.logger.warn('[Editor] Editor is already initialized, updating root element only');
      this.editor.setRootElement(dom);
      return this.editor;
    }

    // Initialize plugins if not already done
    if (this.pluginsInstances.length === 0) {
      this.logger.info(`🔌 Initializing ${this.plugins.length} plugins`);
      for (const plugin of this.plugins) {
        const instance = new plugin(this, plugin.__config);
        this.pluginsInstances.push(instance);
      }
    }

    this.logger.info(`📝 Creating editor with ${this.nodes.length} nodes`);
    const editor = (this.editor = createEditor({
      // @ts-expect-error Inject into lexical editor instance
      __kernel: this,
      editable,
      namespace: 'lobehub',
      nodes: this.nodes,
      onError: (error: Error) => {
        this.logger.error('❌ Lexical editor error:', error);
        this.emit('error', error);
      },
      theme: this.themes,
    }));
    this.editor.setRootElement(dom);
    registerEvent(editor, dom);

    this.pluginsInstances.forEach((plugin) => {
      plugin.onInit?.(editor);
    });
    this.logger.info(`✅ Editor ready with ${this.pluginsInstances.length} plugins`);
    this.emit('initialized', editor);
    return this.editor;
  }

  setEditable(editable: boolean): void {
    if (!this.editor) {
      this.logger.error('❌ Editor not initialized');
      throw new Error(`Editor is not initialized.`);
    }
    this.editor.setEditable(editable);
    this.emit('editableChange', editable);
    this.logger.debug(`✏️ Editor editable set to ${editable}`);
  }

  setDocument(type: string, content: any) {
    const datasource = this.dataTypeMap.get(type);
    if (!datasource) {
      this.logger.error(`❌ DataSource for type "${type}" not found`);
      throw new Error(`DataSource for type "${type}" is not registered.`);
    }
    if (!this.editor) {
      this.logger.error('❌ Editor not initialized');
      throw new Error(`Editor is not initialized.`);
    }
    datasource.read(this.editor, content);
    this.logger.debug(`📥 Set ${type} document`);
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
      this.logger.error(`❌ DataSource for type "${type}" not found`);
      throw new Error(`DataSource for type "${type}" is not registered.`);
    }
    if (!this.editor) {
      this.logger.error('❌ Editor not initialized');
      throw new Error(`Editor is not initialized.`);
    }
    const result = datasource.write(this.editor);
    return result;
  }

  getSelectionDocument(type: string): unknown | null {
    const datasource = this.dataTypeMap.get(type);
    if (!datasource) {
      throw new Error(`DataSource for type "${type}" is not registered.`);
    }
    if (!this.editor) {
      throw new Error(`Editor is not initialized.`);
    }
    return datasource.write(this.editor, {
      selection: true,
    });
  }

  registerDecorator(
    name: string,
    decorator: (_node: DecoratorNode<any>, _editor: LexicalEditor) => any,
  ) {
    if (this.decorators[name]) {
      if (this.hotReloadMode) {
        // In hot reload mode, allow decorator override with warning
        this.logger.warn(`🔄 Hot reload: decorator "${name}"`);
        this.decorators[name] = decorator;
        return this;
      } else {
        // Check if it's the same decorator function
        const existingDecorator = this.decorators[name];
        if (existingDecorator === decorator) {
          // Same decorator function, no need to re-register
          this.logger.warn(
            `[Editor] Decorator "${name}" is already registered with the same function`,
          );
          return this;
        }

        // Different decorator function in production mode
        this.logger.error(
          `[Editor] Attempting to register duplicate decorator "${name}". Enable hot reload mode if this is intended.`,
        );
        throw new Error(`Decorator with name "${name}" is already registered.`);
      }
    }

    this.decorators[name] = decorator;
    this.logger.debug(`🎭 Decorator: ${name}`);
    return this;
  }

  getDecorator(
    name: string,
  ): ((_node: DecoratorNode<any>, _editor: LexicalEditor) => any) | undefined {
    return this.decorators[name];
  }

  /**
   * Unregister a decorator
   * @param name Decorator name
   */
  unregisterDecorator(name: string): boolean {
    if (this.decorators[name]) {
      delete this.decorators[name];
      this.logger.debug(`🗑️ Removed decorator: ${name}`);
      return true;
    }
    this.logger.warn(`⚠️ Decorator "${name}" not found`);
    return false;
  }

  /**
   * Get all registered decorator names
   */
  getRegisteredDecorators(): string[] {
    return Object.keys(this.decorators);
  }

  /**
   * Support registering target data source
   * @param dataSource Data source
   */
  registerDataSource(dataSource: DataSource) {
    this.dataTypeMap.set(dataSource.type, dataSource);
    this.logger.debug(`📄 Data source: ${dataSource.type}`);
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
          this.logger.warn(`🔄 Hot reload: plugin "${plugin.pluginName}"`);
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
              // Clean up decorators registered by the old plugin instance
              if (oldInstance instanceof KernelPlugin) {
                const decoratorNames = oldInstance.getRegisteredDecorators();
                for (const decoratorName of decoratorNames) {
                  this.unregisterDecorator(decoratorName);
                  this.logger.debug(`🧨 Cleanup: decorator "${decoratorName}"`);
                }
              }
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
    this.logger.debug(`🔌 Plugin: ${plugin.pluginName}`);
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
    this.logger.debug(`🔌 Registered ${plugins.length} plugins`);
    return this;
  }

  registerNodes(nodes: Array<LexicalNodeConfig>) {
    const nodeTypes = nodes
      .map((node) => {
        // Handle both node classes and node replacements
        if (typeof node === 'function' && node.getType) {
          return node.getType();
        } else if (
          typeof node === 'object' &&
          node.replace &&
          typeof node.replace === 'function' &&
          node.replace.getType
        ) {
          return node.replace.getType();
        }
        return 'unknown';
      })
      .filter((type) => type !== 'unknown');
    this.nodes.push(...nodes);
    if (nodeTypes.length > 3) {
      this.logger.debug(`🧩 Nodes: ${nodeTypes.length} types`);
    } else {
      this.logger.debug(`🧩 Nodes: ${nodeTypes.join(', ')}`);
    }
  }

  registerService<T>(serviceId: IServiceID<T>, service: T): void {
    const serviceIdString = serviceId.__serviceId;

    if (this.serviceMap.has(serviceIdString)) {
      if (this.hotReloadMode) {
        // In hot reload mode, allow service override with warning
        this.logger.warn(`🔄 Hot reload: service "${serviceIdString}"`);
        this.serviceMap.set(serviceIdString, service);
        return;
      } else {
        // Check if it's the same service instance
        const existingService = this.serviceMap.get(serviceIdString);
        if (existingService === service) {
          // Same service instance, no need to re-register
          this.logger.warn(
            `[Editor] Service "${serviceIdString}" is already registered with the same instance`,
          );
          return;
        }

        // Different service instance in production mode
        this.logger.error(
          `[Editor] Attempting to register duplicate service "${serviceIdString}". Enable hot reload mode if this is intended.`,
        );
        throw new Error(`Service with ID "${serviceIdString}" is already registered.`);
      }
    }

    this.serviceMap.set(serviceIdString, service);
    this.logger.debug(`🔧 Service: ${serviceIdString}`);
  }

  /**
   * Register service with hot reload support - allows overriding existing services
   * @param serviceId Service identifier
   * @param service Service instance
   */
  registerServiceHotReload<T>(serviceId: IServiceID<T>, service: T): void {
    this.serviceMap.set(serviceId.__serviceId, service);
    this.logger.debug(`🔄 Hot-reload service: ${serviceId.__serviceId}`);
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
    const localeKeys = Object.keys(locale);
    this.localeMap = merge(this.localeMap, locale);
    this.logger.debug(`🌐 Locale: ${localeKeys.length} keys`);
  }

  t<K extends keyof ILocaleKeys>(key: K, params?: Record<string, any>): string {
    let translation = get(this.localeMap, key) || key;
    if (params) {
      const compiled = template(translation);
      translation = compiled(params);
    }
    return translation;
  }

  get isEmpty(): boolean {
    if (!this.editor) {
      return true;
    }

    return this.editor.getEditorState().read(() => {
      return $isRootTextContentEmpty(this.editor!.isComposing(), true);
    });
  }

  get isSelected(): boolean {
    if (!this.editor) {
      return false;
    }

    return this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        return !!selection._cachedNodes;
      }
      return false;
    });
  }

  cleanDocument(): void {
    this.setDocument('text', '');
  }

  private _commands: Commands = new Map();
  private _commandsClean: Map<LexicalCommand<unknown>, () => void> = new Map();

  registerHotkey(
    hotkeyId: HotkeyId,
    callback: (event: KeyboardEvent, handler: HotkeysEvent) => void,
    options: HotkeyOptions = {},
  ): () => void {
    const lexicalEditor = this.editor;
    if (!lexicalEditor) {
      throw new Error('Editor is not initialized.');
    }

    const hotkey = getHotkeyById(hotkeyId);
    if (!hotkey) return () => false;
    if (options.enabled === false) return () => false;

    this.logger.debug(`⌨️ Hotkey: ${hotkey.id}`);

    return lexicalEditor.registerCommand(
      KEY_DOWN_COMMAND,
      registerHotkey(hotkey, callback, options),
      hotkey.priority,
    );
  }

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
      // Only log non-keyboard commands to reduce noise
      if (!command.type?.includes('KEY')) {
        this.logger.debug(`⚡ Command: ${command.type || 'unknown'}`);
      }
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
